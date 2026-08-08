import { NextResponse } from 'next/server'
import type { NextRequest, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isKnownCrawlerUserAgent } from './lib/botUserAgents'
import { detectDevice, isTrackablePageRequest, isPrefetchOrDataRequest, VISITOR_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, VISITOR_MAX_AGE_SECONDS } from './lib/trafficAudit'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://none.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'none'
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || ''

const SESSION_CORRELATION_WINDOW_MS = 30_000

// Cookie kayipli ilk-istek durumunda (ad-blocker/gizlilik uzantisi Set-Cookie'yi
// engelledi, tarayici cookie'yi henuz depolamadan ikinci bir kaynak istek attirdi
// vb.) ayni ziyareti YANLISLIKLA ikinci bir session/attribution olarak
// kaydetmemek icin: cookie yoksa, kisa bir pencerede (30sn) ayni IP+User-Agent
// ile olusturulmus EN SON session'i ara; varsa ONU kullan (attribution'ina asla
// dokunma), yoksa gercekten yeni bir session olustur. Bu SADECE cookie'nin
// GERCEKTEN eksik oldugu (nadir) durumda calisir — normal seyirde session
// cookie'si zaten var, bu sorgu hic tetiklenmez.
async function findRecentSessionByFingerprint(ip: string, ua: string): Promise<string | null> {
  if (!supabaseServiceKey || ip === 'Unknown') return null
  try {
    const cutoff = Date.now() - SESSION_CORRELATION_WINDOW_MS
    const url =
      `${supabaseUrl}/rest/v1/traffic_sessions` +
      `?ip=eq.${encodeURIComponent(ip)}&user_agent=eq.${encodeURIComponent(ua)}` +
      `&first_seen=gte.${cutoff}&select=session_id&order=first_seen.desc&limit=1`
    const res = await fetch(url, {
      headers: { apikey: supabaseServiceKey, Authorization: `Bearer ${supabaseServiceKey}` },
      signal: AbortSignal.timeout(1500),
    })
    if (!res.ok) return null
    const rows = (await res.json()) as { session_id: string }[]
    return rows[0]?.session_id ?? null
  } catch {
    return null
  }
}

// First-Party Traffic Audit: sunucuya ulasan HER GERCEK sayfa navigasyonunu
// (admin ve prefetch/RSC istekleri haric) server-side yakalar. Cookie atamasi
// (boga_vid/boga_sid) senkron ve ucuz. YENI session'in traffic_sessions
// INSERT'i BILEREK await edilir (fire-and-forget DEGIL) — boylece client'in
// hemen ardindan gonderdigi page_loaded beacon'i, henuz var olmayan bir
// session'a yazmaya calisip sessizce kaybolmaz (race condition). landing_request
// event log'u ve mevcut session'in last_activity PATCH'i hala event.waitUntil()
// ile fire-and-forget — bunlarda boyle bir yaris riski yok, response'u
// bloklamazlar.
async function trackLanding(request: NextRequest, response: NextResponse, event: NextFetchEvent) {
  if (!supabaseServiceKey) return
  try {
    const existingVisitorId = request.cookies.get(VISITOR_COOKIE)?.value
    const existingSessionId = request.cookies.get(SESSION_COOKIE)?.value

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

    let sessionId = existingSessionId
    let isBrandNewSession = false
    if (!sessionId) {
      const recovered = await findRecentSessionByFingerprint(ip, ua)
      sessionId = recovered || crypto.randomUUID()
      isBrandNewSession = !recovered
    }
    const visitorId = existingVisitorId || crypto.randomUUID()

    response.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: VISITOR_MAX_AGE_SECONDS, path: '/',
    })
    response.cookies.set(SESSION_COOKIE, sessionId, {
      httpOnly: true, secure: true, sameSite: 'lax', maxAge: SESSION_MAX_AGE_SECONDS, path: '/',
    })

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

    if (isBrandNewSession) {
      // Ilk-dokunus (first-touch) attribution: UTM/twclid SADECE burada, session
      // olusurken yazilir — sonraki isteklerde (client eventleri dahil) asla
      // ustune yazilmaz. AWAIT EDILIR (kisa bir timeout ile SINIRLI — asla
      // sayfa yuklemesini askida birakmamali): boylece client'in hemen ardindan
      // gonderdigi page_loaded beacon'i, henuz var olmayan bir session'a
      // yazmaya calisip sessizce kaybolmaz (race condition). Timeout/hata
      // durumunda cookie yine de set edilir, sayfa normal acilir — sadece bu
      // tek session'in ilk page_loaded'i kaybolabilir (landing_request/PATCH
      // zaten fire-and-forget, bunlardan etkilenmez).
      const url = request.nextUrl
      await fetch(`${supabaseUrl}/rest/v1/traffic_sessions`, {
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
        signal: AbortSignal.timeout(2000),
      }).catch(() => {})
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

  // ── Kok yol locale redirect'i edge'de yapilir ──────────────────────────────
  // Eskiden app/page.tsx'te bir Server Component render'i (fonksiyon cold
  // start + React) calisip SONRA redirect() cagriliyordu — edge'de, sayfa
  // hic render edilmeden Accept-Language'e gore yonlendirmek ayni SEO-dogru
  // 307 davranisini cok daha hizli verir. app/page.tsx hala mevcut (JS
  // kapali/eski cache gibi nadir durumlar icin fallback), normalde artik
  // buraya hic ulasmiyor.
  if (pathname === '/') {
    const acceptLang = (request.headers.get('accept-language') || '').toLowerCase()
    let locale = 'en'
    if (acceptLang.includes('tr')) locale = 'tr'
    else if (acceptLang.includes('pt')) locale = 'pt'
    else if (acceptLang.includes('es')) locale = 'es'
    else if (acceptLang.includes('fr')) locale = 'fr'
    return NextResponse.redirect(new URL(`/global/${locale}/home`, request.url))
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

  if (!pathname.startsWith('/admin') && isTrackablePageRequest(pathname) && !isPrefetchOrDataRequest(request.headers)) {
    // Ek guvenlik siniri: trackLanding icindeki fetch'ler kendi timeout'larina
    // sahip olsa da, sayfa yuklemesi HICBIR sekilde tracking'e bagimli
    // kalmamali — 3sn'de sonuclanmazsa vazgecilir, response normal devam eder.
    await Promise.race([trackLanding(request, response, event), new Promise((resolve) => setTimeout(resolve, 3000))])
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
    // Faz 1 — Guest Mode: bu sayfalar artık anonim ziyaretçiye açık, kimlik
    // bazlı kilitleme (maskTop100Ticker / SwingTracker rowLocked / GraphicDetailContent
    // chartUnlocked) component seviyesinde zaten devrede.
    'top100',
    'swing',
    'graphic',
    'sectors',
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
  // graphic/top100/swing artık PUBLIC_SUBPATHS'te (Faz 1 Guest Mode) — kalıcı
  // component-seviyesi kilitlemeleri var, bu "ilk sayfa ücretsiz" duvarına
  // tabi değiller; listeden çıkarıldı ki ikinci ziyarette register'a atmasın.
  const METERED_SEGMENTS = ['watchlist', 'themes', 'hisse', 'performance', 'swingperformance', 'gainers', 'losers', 'mostactive']
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
