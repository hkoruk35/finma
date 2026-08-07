import { NextResponse } from 'next/server'
import type { NextRequest, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isKnownCrawlerUserAgent } from './lib/botUserAgents'
import { detectDevice, VISITOR_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, VISITOR_MAX_AGE_SECONDS } from './lib/trafficAudit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://none.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'none'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

// First-Party Traffic Audit: sunucuya ulasan HER sayfa istegini (admin haric)
// server-side yakalar. Cookie atamasi (boga_vid/boga_sid) senkron ve ucuz;
// asil Supabase yazma cagrilari event.waitUntil() ile "fire and forget"
// yapilir, response'u ASLA bloklamaz (sayfa hizini etkilemez).
function trackLanding(request: NextRequest, response: NextResponse, event: NextFetchEvent) {
  if (!supabaseServiceKey) return
  try {
    const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value
    const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value
    const isNewSession = !existingSessionId
    const visitorId = existingVisitorId || crypto.randomUUID()
    const sessionId = existingSessionId || crypto.randomUUID()

    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true, sameSite: 'lax', maxAge: VISITOR_MAX_AGE_SECONDS, path: '/',
    })
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_SECONDS, path: '/',
    })

    const { pathname } = request.nextUrl
    const now = Date.now()
    const ua = request.headers.get('user-agent') || 'Unknown'
    const country = request.headers.get('x-vercel-ip-country') || request.headers.get('cf-ipcountry') || 'Unknown'
    const city = request.headers.get('x-vercel-ip-city') || 'Unknown'
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'Unknown'
    const referrer = request.headers.get('referer') || null

    const restHeaders = {
      apikey: supabaseServiceKey,
      Authorization: `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json',
    }

    // Requests/Page views: HER istek icin ayri bir satir (dedup YOK — bu sayimin amaci budur).
    event.waitUntil(
      fetch(`${supabaseUrl}/rest/v1/traffic_events`, {
        method: 'POST',
        headers: restHeaders,
        body: JSON.stringify({
          session_id: sessionId,
          request_id: crypto.randomUUID(),
          event_name: 'landing_request',
          timestamp: now,
          pathname,
          metadata: { referrer },
        }),
      }).catch(() => {})
    )

    if (isNewSession) {
      // Ilk-dokunus (first-touch) attribution: UTM/twclid SADECE burada, session
      // olusurken yazilir — sonraki isteklerde asla ustune yazilmaz.
      const url = request.nextUrl
      event.waitUntil(
        fetch(`${supabaseUrl}/rest/v1/traffic_sessions`, {
          method: 'POST',
          headers: { ...restHeaders, Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            session_id: sessionId,
            visitor_id: visitorId,
            first_seen: now,
            last_activity: now,
            landing_pathname: pathname,
            referrer,
            utm_source: url.searchParams.get('utm_source'),
            utm_medium: url.searchParams.get('utm_medium'),
            utm_campaign: url.searchParams.get('utm_campaign'),
            utm_content: url.searchParams.get('utm_content'),
            utm_term: url.searchParams.get('utm_term'),
            twclid: url.searchParams.get('twclid'),
            ip, country, city, user_agent: ua,
            device: detectDevice(ua),
            suspected_bot_ua: isKnownCrawlerUserAgent(ua),
          }),
        }).catch(() => {})
      )
    } else {
      event.waitUntil(
        fetch(`${supabaseUrl}/rest/v1/traffic_sessions?session_id=eq.${sessionId}`, {
          method: 'PATCH',
          headers: restHeaders,
          body: JSON.stringify({ last_activity: now }),
        }).catch(() => {})
      )
    }
  } catch {
    // Tracking hatasi asla siteyi etkilememeli.
  }
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
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

  if (!pathname.startsWith('/admin')) {
    trackLanding(request, response, event)
  }

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
    'earning',
    'earning-calendar',
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
