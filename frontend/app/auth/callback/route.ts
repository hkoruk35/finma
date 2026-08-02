import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Google (ve ileride eklenebilecek diğer OAuth sağlayıcıları) için giriş
// callback'i. api/auth/confirm/route.ts'i ÇOĞALTMIYORUZ kasıtlı olarak —
// o route her başarılı doğrulamadan sonra kayıtsız şartsız Stripe Checkout'a
// yönlendiriyor (satır 50-64), bu route'a bağlanırsa her Google girişi
// anında ödeme sayfasına düşer ve free katman hiç çalışmaz.
//
// Yeni auth.users satırı public.handle_new_member() trigger'ı ile otomatik
// members satırına dönüşür (0001_member_section.sql) — plan sütununun
// güncel varsayılanı 'pending'dir (0016_remove_free_trial.sql). Bu route
// sadece 'pending'/boş planı 'free'ye çevirir; premium/canceled/admin
// dokunulmaz kalır (örn. aynı e-postayla daha önce ödeme akışını
// tamamlamamış birinin durumu burada sessizce yükseltilmiş olur, ki bu
// yeni iş modelinde zaten kabul edilebilir bir sonuçtur — free artık
// kalıcı bir katman).
export async function GET(req: NextRequest) {
  const { searchParams, origin } = req.nextUrl;
  const code = searchParams.get('code');
  const localeParam = searchParams.get('locale');
  const locale = (['en', 'es', 'fr', 'pt', 'tr'].includes(localeParam || '') ? localeParam : 'en') as string;
  const loginPath = locale === 'tr' ? 'giris' : 'login';

  if (!code) {
    return NextResponse.redirect(new URL(`/global/${locale}/${loginPath}?error=invalid_link`, origin));
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.user) {
    return NextResponse.redirect(new URL(`/global/${locale}/${loginPath}?error=verification_failed`, origin));
  }

  const userId = data.user.id;

  const { data: member } = await supabaseAdmin
    .from('members')
    .select('plan')
    .eq('id', userId)
    .single();

  if (member && (member.plan === 'pending' || !member.plan)) {
    await supabaseAdmin
      .from('members')
      .update({ plan: 'free' })
      .eq('id', userId);
  }

  return NextResponse.redirect(new URL(`/global/${locale}/home`, origin));
}
