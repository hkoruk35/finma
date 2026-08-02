import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe, createTopupCheckoutSession } from "@/lib/stripe";

const SUPPORTED_LOCALES = ["en", "tr", "es", "fr", "pt"];

// 100 Ekstra Copilot AI Kredisi ($9, tek seferlik) — abonelik durumundan
// bağımsız, herhangi bir giriş yapmış üye satın alabilir.
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { locale?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("email, stripe_customer_id, consent_locale")
    .eq("id", userData.user.id)
    .single();

  if (memberError || !member) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
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

  const session = await createTopupCheckoutSession({
    customerId,
    memberId: userData.user.id,
    locale,
    origin: req.nextUrl.origin,
  });

  return NextResponse.json({ ok: true, checkoutUrl: session.url });
}
