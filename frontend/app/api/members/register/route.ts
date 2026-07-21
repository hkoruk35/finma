import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe, createPremiumCheckoutSession } from "@/lib/stripe";

// Brute-force/spam koruması: basit in-memory rate limiter (app/api/auth/login/route.ts deseni)
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait 15 minutes." },
      { status: 429 }
    );
  }

  let body: {
    email?: string;
    password?: string;
    username?: string;
    redirectTo?: string;
    locale?: string;
    consentAccepted?: boolean;
    region?: string;
    selectedLanguage?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { email, password, username, redirectTo, consentAccepted, region, selectedLanguage } = body;
  const locale = body.locale && ["en", "tr", "es", "fr", "pt"].includes(body.locale) ? body.locale : "en";

  if (!email || !password || !username) {
    return NextResponse.json(
      { error: "Email, password and username are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-24 characters (letters, numbers, underscore)." },
      { status: 400 }
    );
  }
  if (!consentAccepted) {
    return NextResponse.json(
      { error: "You must confirm the disclaimer notice to create an account." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const origin = req.nextUrl.origin;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, region, language: selectedLanguage || locale },
      emailRedirectTo: `${origin}/api/auth/confirm`
    },
  });

  if (error) {
    const message = /members_username_key|duplicate key.*username/i.test(error.message)
      ? "This username is already taken."
      : error.message;
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!data.user) {
    return NextResponse.json({ ok: true, needsEmailConfirmation: !data.session });
  }

  // Ödeme tamamlanmadan üyelik aktifleşmez: hesap "pending" kalır, Stripe
  // Checkout tamamlanınca webhook plan='premium' yapar. Deneme süresi yok —
  // ödeme checkout'ta anında alınır.
  const stripeCustomer = await stripe.customers.create({
    email,
    metadata: { member_id: data.user.id },
  });

  await supabaseAdmin
    .from("members")
    .upsert(
      {
        id: data.user.id,
        username,
        email,
        region,
        plan: "pending",
        trial_ends_at: null,
        subscription_status: "pending",
        stripe_customer_id: stripeCustomer.id,
        consent_accepted_at: new Date().toISOString(),
        consent_locale: locale,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

  // Email doğrulaması gerekmiyorsa (aktif session var) kullanıcıyı direkt Checkout'a yönlendiriyoruz.
  // Doğrulama gerekiyorsa checkout, girişten sonra hesap sayfasındaki "Complete Payment" akışıyla başlatılır.
  if (!data.session) {
    return NextResponse.json({ ok: true, needsEmailConfirmation: true });
  }

  const session = await createPremiumCheckoutSession({
    customerId: stripeCustomer.id,
    memberId: data.user.id,
    locale,
    origin,
    firstTimeDiscount: true,
  });

  return NextResponse.json({ ok: true, needsEmailConfirmation: false, checkoutUrl: session.url });
}
