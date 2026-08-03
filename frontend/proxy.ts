import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isKnownCrawlerUserAgent } from './lib/botUserAgents'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://none.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'none'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── /data/* statik JSON'lara doğrudan HTTP erişimi kapalı ──────────────────
  if (pathname === '/data' || pathname.startsWith('/data/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`)

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

  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => res.cookies.set(c))
    return res
  }

  const LOCALE_AUTH_ROUTES: Record<string, { login: string; register: string; home: string }> = {
    en: { login: 'login', register: 'register', home: 'home' },
    tr: { login: 'giris', register: 'kayit', home: 'home' },
    es: { login: 'login', register: 'register', home: 'home' },
    fr: { login: 'login', register: 'register', home: 'home' },
    pt: { login: 'login', register: 'register', home: 'home' },
  }

  const PUBLIC_SUBPATHS = [
    'login', 'giris',
    'register', 'kayit',
    'home',
    'news',
    'about',
    'disclaimer',
    'terms',
    'privacy',
    'sss', 'faq', 'Perguntas_Frequentes',
    'today',
    'search',
    'discover',
    'sports',
    'weather',
    'contact',
    'ai',
  ]

  let isGlobalMemberPath = false
  let currentLocale: string | null = null
  for (const [locale] of Object.entries(LOCALE_AUTH_ROUTES)) {
    const base = `/global/${locale}`
    if (isPathOrSubpath(base)) {
      currentLocale = locale
      const isPublic = PUBLIC_SUBPATHS.some((sub) => pathname.startsWith(`${base}/${sub}`))
      isGlobalMemberPath = !isPublic
      break
    }
  }

  const hasSupabaseSession = !!user || !!request.cookies.get('boga_member_session')?.value

  if (pathname === '/en/top100' || pathname === '/tr/top100') {
    const globalPath = pathname.startsWith('/tr')
      ? '/global/tr/top100'
      : '/global/en/top100'
    return redirectTo(new URL(globalPath, request.url))
  }

  // Global üye sayfasına (Terminal, Top7, Top100, Swing, Sektörler, Hisse Detay vb.) giriş yapmamış kullanıcı gelirse → register'a yönlendir
  if (isGlobalMemberPath && !hasSupabaseSession && currentLocale) {
    const registerUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].register}`
    return redirectTo(new URL(registerUrl, request.url))
  }

  // ── Faz 4: organik/AI trafiği için "ilk sayfa ücretsiz" ölçümlü kapı ──────
  // Google aramasından/AI asistan linkinden gelen anonim ziyaretçi ilk derin
  // içerik sayfasını (grafik/liste) tam görür; ikinci FARKLI sayfaya
  // geçtiğinde Google girişi istenir. Yukarıdaki isGlobalMemberPath kontrolü
  // bu yolların hiçbirinde tetiklenmez (hepsi izin listesinde) — bu yüzden
  // bağımsız, ek bir kural. Bot/crawler'lar (lib/botUserAgents.ts — hem
  // robots.ts hem burası aynı listeyi okur) HİÇ ölçülmez: her zaman tam
  // içerik görürler, bu SEO/AI-atıf için gerekli ve cloaking değil (User-
  // Agent'a göre farklı İÇERİK değil, farklı bir insan-dönüşüm kuralı
  // gösteriyoruz — crawler'a da, ilk kez gelen insana da AYNI HTML gider).
  const METERED_SEGMENTS = ['graphic', 'top100', 'swing', 'watchlist', 'themes', 'hisse', 'performance', 'swingperformance', 'gainers', 'losers', 'mostactive']
  if (!hasSupabaseSession && currentLocale && !isKnownCrawlerUserAgent(request.headers.get('user-agent'))) {
    const base = `/global/${currentLocale}`
    const isMeteredPath = METERED_SEGMENTS.some((seg) => pathname.startsWith(`${base}/${seg}`))
    if (isMeteredPath) {
      const seenPath = request.cookies.get('boga_first_view')?.value
      if (seenPath && seenPath !== pathname) {
        const registerUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].register}`
        return redirectTo(new URL(registerUrl, request.url))
      }
      if (!seenPath) {
        response.cookies.set('boga_first_view', pathname, {
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 30,
          path: '/',
        })
      }
    }
  }

  const isAdminAuthPath =
    pathname === '/admin/account/login' ||
    pathname?.startsWith('/admin/account/login/') ||
    pathname === '/admin/account/register' ||
    pathname?.startsWith('/admin/account/register/')

  const requiresAdminAuth = pathname?.startsWith('/admin/') && !isAdminAuthPath
  const hasBogaAuth = !!request.cookies.get('boga_auth')?.value

  if (requiresAdminAuth && !hasBogaAuth) {
    return redirectTo(new URL('/admin/account/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
