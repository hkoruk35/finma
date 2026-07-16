import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createPremiumCheckoutSession, stripe } from '@/lib/stripe';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  // Supabase auth callback might also send token_hash and type
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  
  if (!code && !token_hash) {
    return NextResponse.redirect(new URL('/global/en/login?error=invalid_link', req.url));
  }

  const supabase = await createSupabaseServerClient();
  let userId: string | undefined;

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data?.user) {
      userId = data.user.id;
    }
  } else if (token_hash && type === 'signup') {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: 'signup' });
    if (!error && data?.user) {
      userId = data.user.id;
    }
  }

  if (!userId) {
    return NextResponse.redirect(new URL('/global/en/login?error=verification_failed', req.url));
  }

  // Get user details
  const { data: member } = await supabaseAdmin
    .from('members')
    .select('email, stripe_customer_id, consent_locale')
    .eq('id', userId)
    .single();

  if (!member) {
    return NextResponse.redirect(new URL('/global/en/login?error=member_not_found', req.url));
  }

  const origin = req.nextUrl.origin;
  const locale = member.consent_locale || 'en';

  // Create Stripe checkout session
  const session = await createPremiumCheckoutSession({
    customerId: member.stripe_customer_id,
    memberId: userId,
    locale,
    origin,
    withTrial: true,
  });

  if (!session.url) {
    return NextResponse.redirect(new URL(`/global/${locale}/login?error=checkout_failed`, req.url));
  }

  // Redirect directly to Stripe Checkout
  return NextResponse.redirect(session.url);
}
