import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://none.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'none'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Tam segment eşleşmesi — startsWith tek başına '/tr' için '/tracker' gibi yanlış eşleşmeler üretir
  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`)

  // ── Supabase oturumunu burada yenile ────────────────────────────────────────
  // Access token süresi dolduğunda yenileme, cookie'leri yazabilen bir yerde
  // yapılmalı (Server Component'ler bunu yapamaz). Burada yapılmazsa, rotating
  // refresh token ile bir sonraki istekte oturum sessizce düşer ve kullanıcı
  // çıkış yapmadığı halde "çıkmış" gibi görünür.
  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })
  const { data: { user } } = await supabase.auth.getUser()

  // Bir redirect döndürürken, yukarıda yenilenmiş olabilecek oturum
  // cookie'lerini de redirect response'una taşı.
  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  // ── Global üye sayfaları: Supabase oturumu gerektirir ─────────────────────
  // Her locale altında sadece landing (/), login ve register public — geri her şey üye gerektirir
  // Performance sayfası halka açık (top100 burada de public sayılsa da,
  // app/global/[locale]/top100/layout.tsx kendi oturum kontrolünü ayrıca yapıyor — çift katman)
  // Not: bu tablo 5 dilin hepsini kapsar — önceden sadece en/tr burada tanımlıydı,
  // es/fr/pt hiç gate edilmiyordu (üye olmayan herkes swing/analiz gibi sayfalara girebiliyordu).
  const LOCALE_AUTH_ROUTES: Record<string, { login: string; register: string; home: string; permalink?: string }> = {
    en: { login: 'login', register: 'register', home: 'home' },
    tr: { login: 'giris', register: 'kayit', home: 'home', permalink: 'hisse' },
    es: { login: 'login', register: 'register', home: 'home' },
    fr: { login: 'login', register: 'register', home: 'home' },
    pt: { login: 'login', register: 'register', home: 'home' },
  }

  let isGlobalMemberPath = false
  let currentLocale: string | null = null
  for (const [locale, routes] of Object.entries(LOCALE_AUTH_ROUTES)) {
    const base = `/global/${locale}`
    if (isPathOrSubpath(base)) {
      currentLocale = locale
      isGlobalMemberPath =
        !pathname.startsWith(`${base}/${routes.login}`) &&
        !pathname.startsWith(`${base}/${routes.register}`) &&
        !pathname.startsWith(`${base}/performance`) &&
        !pathname.startsWith(`${base}/top100`) &&
        !(routes.permalink && pathname.startsWith(`${base}/${routes.permalink}`)) &&
        pathname !== base
      break
    }
  }

  const hasSupabaseSession = !!user

  // ── /en/top100 ve /tr/top100 → /global/ altına yönlendir ───────────────────
  // GEÇİCİ: Supabase login zorunluluğu kaldırıldı, direkt /global/ altına yönlendir
  if (pathname === '/en/top100' || pathname === '/tr/top100') {
    const globalPath = pathname.startsWith('/tr')
      ? '/global/tr/top100'
      : '/global/en/top100'
    return redirectTo(new URL(globalPath, request.url))
  }

  // Zaten giriş yapmış kullanıcı landing, login veya kayıt sayfasına dönerse
  // (örn. geri tuşu, eski sekme) → doğrudan home'a at. Oturum açıkken bu
  // sayfalar bir daha gösterilmez; çıkış yapılmadan login ekranına dönülmez.
  const loggedInPublicPages = new Set(
    Object.entries(LOCALE_AUTH_ROUTES).flatMap(([locale, routes]) => [
      `/global/${locale}`,
      `/global/${locale}/${routes.login}`,
      `/global/${locale}/${routes.register}`,
    ])
  )
  if (hasSupabaseSession && currentLocale && loggedInPublicPages.has(pathname)) {
    const homeUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].home}`
    return redirectTo(new URL(homeUrl, request.url))
  }

  // Global üye sayfasına giriş yapmamış kullanıcı gelirse → global login'e yönlendir
  if (isGlobalMemberPath && !hasSupabaseSession && currentLocale) {
    const loginUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].login}`
    return redirectTo(new URL(loginUrl, request.url))
  }

  // ── Admin login sayfaları public ───────────────────────────────────────────
  // /admin/account/login ve /admin/account/register herkes erişebilir
  const isAdminAuthPath =
    pathname === '/admin/account/login' ||
    pathname?.startsWith('/admin/account/login/') ||
    pathname === '/admin/account/register' ||
    pathname?.startsWith('/admin/account/register/')

  // Admin diğer sayfaları boga_auth cookie kontrolü gerektirir
  const requiresAdminAuth =
    pathname?.startsWith('/admin/') &&
    !pathname.startsWith('/admin/admins') &&
    !pathname.startsWith('/admin/members') &&
    !pathname.startsWith('/admin/messages') &&
    !pathname.startsWith('/admin/plans') &&
    !pathname.startsWith('/admin/campaigns') &&
    !pathname.startsWith('/admin/sitemap') &&
    !pathname.startsWith('/admin/top100') &&
    !isAdminAuthPath

  const hasBogaAuth = !!request.cookies.get('boga_auth')?.value

  if (requiresAdminAuth && !hasBogaAuth) {
    return redirectTo(new URL('/admin/account/login', request.url))
  }

  return response
}

// Tüm rotaları yakala (Middleware matcher)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
