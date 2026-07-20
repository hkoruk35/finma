import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn("STRIPE_SECRET_KEY missing. Stripe calls will fail.");
}

// Sunucu tarafı Stripe client — sadece API route'larında kullanılır.
export const stripe = new Stripe(secretKey || "sk_test_missing", {
  typescript: true,
});

export const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || "";
export const PREMIUM_COUPON_ID = process.env.STRIPE_PREMIUM_COUPON_ID || "";

const STRIPE_LOCALE_MAP: Record<string, Stripe.Checkout.SessionCreateParams.Locale> = {
  en: "en",
  tr: "tr",
  es: "es",
  fr: "fr",
  pt: "pt",
};

export function toStripeLocale(locale: string): Stripe.Checkout.SessionCreateParams.Locale {
  return STRIPE_LOCALE_MAP[locale] || "auto";
}

const ACCOUNT_PATH_MAP: Record<string, string> = {
  en: "/global/en/account",
  tr: "/global/tr/hesabim",
  es: "/global/es/account",
  fr: "/global/fr/account",
  pt: "/global/pt/account",
};

export function accountPathForLocale(locale: string): string {
  return ACCOUNT_PATH_MAP[locale] || ACCOUNT_PATH_MAP.en;
}

// Premium checkout session — kayıt sırasında (7 gün trial + $9 ilk ay) veya
// hesap sayfasından yeniden abonelik (trial'sız, tam $39) için kullanılır.
// Gerçek $9/$39 tutarları burada değil, Stripe Dashboard'daki
// PREMIUM_PRICE_ID (taban $39/ay) ve PREMIUM_COUPON_ID (ilk ay indirimi)
// nesnelerinde tanımlı — o yüzden fiyat değiştiğinde bu dosyada güncellenecek
// bir sayı yok, Stripe tarafındaki coupon'un tutarı/duration'ı revize edilmeli.
export async function createPremiumCheckoutSession({
  customerId,
  memberId,
  locale,
  origin,
  withTrial,
}: {
  customerId: string;
  memberId: string;
  locale: string;
  origin: string;
  withTrial: boolean;
}) {
  const accountPath = accountPathForLocale(locale);
  return stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: memberId,
    line_items: [{ price: PREMIUM_PRICE_ID, quantity: 1 }],
    discounts: withTrial && PREMIUM_COUPON_ID ? [{ coupon: PREMIUM_COUPON_ID }] : undefined,
    subscription_data: {
      metadata: { member_id: memberId },
      ...(withTrial ? { trial_period_days: 7 } : {}),
    },
    payment_method_collection: "always",
    locale: toStripeLocale(locale),
    success_url: `${origin}${accountPath}?tab=subscription&checkout=success`,
    cancel_url: `${origin}${accountPath}?tab=subscription&checkout=cancelled`,
  });
}
