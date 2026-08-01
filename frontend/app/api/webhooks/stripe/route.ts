import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function findMemberIdByCustomerId(customerId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("members")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET missing.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature || "", webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const memberId = session.client_reference_id;
      if (!memberId || !session.customer) break;

      // Tek seferlik kredi paketi satın alımı (top-up) — abonelik değil,
      // mode:"payment", session.subscription yok. metadata.credit_pack_amount
      // ile taşınan miktar topup_credit_balance'a eklenir (devreder, expire olmaz).
      if (session.mode === "payment") {
        const creditsPurchased = parseInt(session.metadata?.credit_pack_amount || "0", 10);
        if (creditsPurchased > 0) {
          await supabaseAdmin.rpc("add_topup_credits", { p_user_id: memberId, p_credits: creditsPurchased });
          await supabaseAdmin.from("credit_topups").insert({
            user_id: memberId,
            credits_purchased: creditsPurchased,
            amount_paid: (session.amount_total ?? 0) / 100,
            stripe_payment_id: (session.payment_intent as string) || null,
          });
        }
        break;
      }

      if (!session.subscription) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const item = subscription.items.data[0];

      await supabaseAdmin
        .from("members")
        .update({
          plan: "premium",
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          trial_ends_at: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          current_period_end: item?.current_period_end
            ? new Date(item.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq("id", memberId);

      // İlk abonelik başlangıcında aylık Copilot AI kredisi de tanımlanır.
      if (item?.current_period_end) {
        await supabaseAdmin.rpc("reset_monthly_credits", {
          p_user_id: memberId,
          p_amount: 500,
          p_cycle_start: new Date((item.current_period_start ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
          p_cycle_end: new Date(item.current_period_end * 1000).toISOString(),
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const memberId = await findMemberIdByCustomerId(subscription.customer as string);
      if (!memberId) break;

      const item = subscription.items.data[0];
      await supabaseAdmin
        .from("members")
        .update({
          subscription_status: subscription.status,
          current_period_end: item?.current_period_end
            ? new Date(item.current_period_end * 1000).toISOString()
            : null,
          cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq("id", memberId);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const memberId = await findMemberIdByCustomerId(subscription.customer as string);
      if (!memberId) break;

      await supabaseAdmin
        .from("members")
        .update({
          plan: "canceled",
          subscription_status: "canceled",
          cancel_at_period_end: false,
        })
        .eq("id", memberId);
      break;
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (!customerId) break;
      const memberId = await findMemberIdByCustomerId(customerId);
      if (!memberId) break;

      await supabaseAdmin
        .from("members")
        .update({ subscription_status: "active" })
        .eq("id", memberId);

      // Her yenileme faturası başarıyla ödendiğinde aylık Copilot AI kredisi
      // 500'e sıfırlanır — topup_credit_balance'a DOKUNULMAZ (devreder).
      // Bu Stripe SDK sürümünde invoice.subscription yok, referans
      // invoice.parent.subscription_details.subscription altında.
      const subscriptionRef = invoice.parent?.subscription_details?.subscription;
      if (subscriptionRef) {
        try {
          const subscriptionId = typeof subscriptionRef === "string" ? subscriptionRef : subscriptionRef.id;
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const item = subscription.items.data[0];
          if (item?.current_period_end) {
            await supabaseAdmin.rpc("reset_monthly_credits", {
              p_user_id: memberId,
              p_amount: 500,
              p_cycle_start: new Date(item.current_period_start * 1000).toISOString(),
              p_cycle_end: new Date(item.current_period_end * 1000).toISOString(),
            });
          }
        } catch (e) {
          console.error("[stripe webhook] reset_monthly_credits:", e);
        }
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string | null;
      if (!customerId) break;
      const memberId = await findMemberIdByCustomerId(customerId);
      if (!memberId) break;

      await supabaseAdmin
        .from("members")
        .update({ subscription_status: "past_due" })
        .eq("id", memberId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
