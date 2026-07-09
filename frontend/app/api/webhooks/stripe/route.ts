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
      if (!memberId || !session.customer || !session.subscription) break;

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
          plan: "free_trial",
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
