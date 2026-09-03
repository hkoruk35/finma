import { NextResponse } from 'next/server'
import type { NextRequest, NextFetchEvent } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { isKnownCrawlerUserAgent } from './lib/botUserAgents'
import { createTimeoutFetch } from './lib/supabaseFetch'
import { detectDevice, isTrackablePageRequest, isPrefetchOrDataRequest, VISITOR_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS, VISITOR_MAX_AGE_SECONDS } from './lib/trafficAudit'
import exchangeMap from './public/exchange_map.json'

// Bilinen ticker listesi (lowercase) — /stock/ redirect'leri için
const KNOWN_TICKERS = new Set(Object.keys(exchangeMap.exchanges).map((t) => t.toLowerCase()))

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

function resolvePreferredLocale(acceptLangHeader: string | null): string {
  if (!acceptLangHeader) return 'en'
  const supported = ['tr', 'en', 'es', 'fr', 'pt', 'id']
  const langs = acceptLangHeader
    .split(',')
    .map((item) => {
      const [lang, qVal] = item.trim().split(';q=')
      const q = qVal ? parseFloat(qVal) : 1.0
      const code = lang.split('-')[0].toLowerCase()
      return { code, q: isNaN(q) ? 1.0 : q }
    })
    .sort((a, b) => b.q - a.q)

  for (const l of langs) {
    if (supported.includes(l.code)) return l.code
  }
  return 'en'
}

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  const { pathname } = request.nextUrl

  // ── SEO: WWW → non-WWW kalıcı yönlendirme (308) ────────────────────────────
  const host = request.headers.get('host') || ''
  if (host.startsWith('www.')) {
    const newUrl = new URL(request.url)
    newUrl.host = host.replace('www.', '')
    return NextResponse.redirect(newUrl, 308)
  }

  // ── SEO: BogaSmart/BogaStock duplicate content düzeltmesi ──────────────────
  // 2026-08-24 kullanıcı bildirimi: bogasmart.com ve bogastock.com AYNI Next.js
  // uygulamasını serve ediyor, host'a göre hiçbir ayrım yoktu — bu yüzden
  // BogaStock'un tüm finans sayfaları (ana sayfa, /graphic/*, endeks sayfaları,
  // About/Terms/Disclaimer vb.) bogasmart.com altında da birebir indekslendi
  // (Google'da "duplicate content" — bkz. Google'ın canonical/redirect
  // önerisi). Mimari karar: BogaStock.com = finans, BogaSmart.com = genel AI /
  // Discover / Today. Bu blok SADECE bogasmart.com host'unda çalışır:
  //  - "/" kökü artık finans ana sayfasına DEĞİL, BogaSmart'ın kendi
  //    "Today" panosuna gider.
  //  - /global/{locale}/... altındaki her şey, BogaSmart'a ait 5 genel sayfa
  //    (discover/search/sports/today/weather) DIŞINDA, aynı path ile
  //    bogastock.com'a 301 kalıcı yönlendirilir (ör. bogasmart.com/global/en/
  //    graphic/NVDA → bogastock.com/global/en/graphic/NVDA).
  // /admin, /api, /auth, /daily, /en, /tr, /[lang]/[slug] gibi /global dışı
  // eski/özel rotalara BİLEREK dokunulmadı — bu ayrı bir inceleme gerektirir.
  const BOGASTOCK_HOST = 'bogastock.com'
  const BOGASMART_GENERAL_SUBPATHS = ['discover', 'search', 'sports', 'today', 'weather']
  if (host === 'bogasmart.com') {
    if (pathname === '/') {
      const locale = resolvePreferredLocale(request.headers.get('accept-language'))
      return NextResponse.redirect(new URL(`/global/${locale}/today`, request.url), 308)
    }
    const globalMatch = pathname.match(/^\/global\/([a-z]{2})(\/([^/]+))?/)
    if (globalMatch) {
      const subpath = globalMatch[3] || ''
      const isGeneralPath = BOGASMART_GENERAL_SUBPATHS.includes(subpath)
      if (!isGeneralPath) {
        const target = new URL(request.url)
        target.host = BOGASTOCK_HOST
        return NextResponse.redirect(target, 301)
      }
    }
  }

  // ── SEO: /sector/* — eski BOGA AI sektör sayfaları artık yok (410 Gone) ─────
  // Önceki next.config.ts redirect'i /sector/* → /admin/stocks/sector/*
  // gönderiyordu; oradan da admin auth guard /admin/account/login'e atıyordu.
  // Bu blok tüm /sector path'lerini burada sonlandırır, admin chain'i kırar.
  if (pathname === '/sector' || pathname.startsWith('/sector/')) {
    return new NextResponse('Gone', { status: 410 })
  }

  // ── SEO: /stock/:ticker → /en/analysis/:ticker (308 Permanent Redirect) ─────
  // Ticker her zaman lowercase normalize edilir. Sistemde olmayan ticker'lar 410.
  if (pathname.startsWith('/stock/')) {
    const rawTicker = pathname.split('/')[2] || ''
    if (rawTicker) {
      const ticker = rawTicker.toLowerCase()
      if (KNOWN_TICKERS.has(ticker)) {
        return NextResponse.redirect(new URL(`/en/analysis/${ticker}`, request.url), 308)
      }
      return new NextResponse('Gone', { status: 410 })
    }
  }

  // ── /data/* statik JSON'lara doğrudan HTTP erişimi kapalı ──────────────────
  if (pathname === '/data' || pathname.startsWith('/data/')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // ── Kok yol locale redirect'i edge'de yapilir ──────────────────────────────
  // Edge'de sayfa hic render edilmeden tarayıcının kendi Accept-Language
  // tercihlerine göre yönlendirilir. Desteklenen diller haricinde varsayılan
  // ikinci seçenek İngilizce'dir.
  if (pathname === '/') {
    const locale = resolvePreferredLocale(request.headers.get('accept-language'))
    return NextResponse.redirect(new URL(`/global/${locale}/home`, request.url))
  }

  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`)

  let response = NextResponse.next({ request })
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    // Bu istemci HER istekte calisir; Supabase yanit vermezse tum site
    // (giris yapmis kullanicilar icin) askida kalir — 2026-08-10'da tam
    // olarak bu oldu. Tracking fetch'lerindeki 1.5s/3s korumalarinin
    // auth cagrisindaki karsiligi budur.
    global: { fetch: createTimeoutFetch(3000) },
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
  // Supabase erisilemezse istek 500'e dusmemeli: kullaniciyi "bilinmiyor"
  // kabul edip devam ederiz. Uyelik kontrolu zaten boga_member_session
  // cookie'sine de bakiyor (bkz. hasSupabaseSession), yani DB kisa sureligine
  // duserse mevcut uyeler disari atilmaz.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    user = (await supabase.auth.getUser()).data.user
  } catch {
    user = null
  }

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
    id: { login: 'login', register: 'register', home: 'home' },
  }

  const PRIVATE_MEMBER_SUBPATHS = ['account', 'hesabim']

  let isPrivateMemberPath = false
  let currentLocale: string | null = null
  for (const [locale] of Object.entries(LOCALE_AUTH_ROUTES)) {
    const base = `/global/${locale}`
    if (isPathOrSubpath(base)) {
      currentLocale = locale
      isPrivateMemberPath = PRIVATE_MEMBER_SUBPATHS.some((sub) => pathname === `${base}/${sub}` || pathname.startsWith(`${base}/${sub}/`))
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

  // Terminal sayfası taşındı: bare /global/{locale} → /global/{locale}/terminal
  // (kalıcı 308 — arama motorlarının eski URL yerine yenisini indekslemesi için).
  for (const locale of Object.keys(LOCALE_AUTH_ROUTES)) {
    if (pathname === `/global/${locale}` || pathname === `/global/${locale}/`) {
      const res = NextResponse.redirect(new URL(`/global/${locale}/terminal`, request.url), 308)
      response.cookies.getAll().forEach((c) => res.cookies.set(c))
      return res
    }
  }

  // Sadece gizli üye hesabı rotalarında (/account /hesabim) giriş yapmamış kullanıcıyı register'a yönlendir
  if (isPrivateMemberPath && !hasSupabaseSession && currentLocale) {
    const registerUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].register}`
    return redirectTo(new URL(registerUrl, request.url))
  }

  const isAdminAuthPath =
    pathname === '/admin/account/login' ||
    pathname?.startsWith('/admin/account/login/') ||
    pathname === '/admin/account/register' ||
    pathname?.startsWith('/admin/account/register/')

  // '/admin' (trailing slash olmadan, kök yönetim paneli) startsWith('/admin/')
  // ile eşleşmediği için ESKİDEN auth kontrolünden tamamen kaçıyordu — giriş
  // yapmamış herkes doğrudan Yönetim Merkezi dashboard'unu görebiliyordu.
  const isAdminPath = pathname === '/admin' || pathname?.startsWith('/admin/')
  const requiresAdminAuth = isAdminPath && !isAdminAuthPath
  const hasBogaAuth = !!request.cookies.get('boga_auth')?.value

  if (requiresAdminAuth && !hasBogaAuth) {
    return redirectTo(new URL('/admin/account/login', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
