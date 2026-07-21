import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe, createPremiumCheckoutSession } from "@/lib/stripe";

const SUPPORTED_LOCALES = ["en", "tr", "es", "fr", "pt"];

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { locale?: string; consentAccepted?: boolean };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  if (!body.consentAccepted) {
    return NextResponse.json(
      { error: "You must confirm the disclaimer notice to continue." },
      { status: 400 }
    );
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("email, subscription_status, stripe_customer_id, stripe_subscription_id, consent_locale")
    .eq("id", userData.user.id)
    .single();

  if (memberError || !member) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  if (member.subscription_status && ["trialing", "active", "past_due"].includes(member.subscription_status)) {
    return NextResponse.json({ error: "You already have an active subscription." }, { status: 400 });
  }

  const locale = body.locale && SUPPORTED_LOCALES.includes(body.locale) ? body.locale : member.consent_locale || "en";

  let customerId = member.stripe_customer_id as string | null;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: member.email,
      metadata: { member_id: userData.user.id },
    });
    customerId = customer.id;
    await supabaseAdmin.from("members").update({ stripe_customer_id: customerId }).eq("id", userData.user.id);
  }

  // Daha önce hiç aboneliği olmamış üyeler ilk ay indirimli fiyattan başlar
  // (Stripe coupon); daha önce abone olup iptal etmiş üyeler tam fiyattan
  // başlar. Deneme süresi yok — ödeme her durumda checkout'ta anında alınır.
  const firstTimeDiscount = !member.stripe_subscription_id;

  const session = await createPremiumCheckoutSession({
    customerId,
    memberId: userData.user.id,
    locale,
    origin: req.nextUrl.origin,
    firstTimeDiscount,
  });

  await supabaseAdmin
    .from("members")
    .update({ consent_accepted_at: new Date().toISOString(), consent_locale: locale })
    .eq("id", userData.user.id);

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
