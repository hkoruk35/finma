import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://none.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'none'

export async function middleware(request: NextRequest) {
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

  let isGlobalMemberPath = false
  let currentLocale: string | null = null
  for (const [locale, routes] of Object.entries(LOCALE_AUTH_ROUTES)) {
    const base = `/global/${locale}`
    if (isPathOrSubpath(base)) {
      currentLocale = locale
      isGlobalMemberPath =
        !pathname.startsWith(`${base}/${routes.login}`) &&
        !pathname.startsWith(`${base}/${routes.register}`) &&
        !pathname.startsWith(`${base}/${routes.home}`) &&
        !pathname.startsWith(`${base}/analysis`) &&
        !pathname.startsWith(`${base}/graphic`) &&
        !pathname.startsWith(`${base}/news`) &&
        !pathname.startsWith(`${base}/about`) &&
        !pathname.startsWith(`${base}/disclaimer`) &&
        !pathname.startsWith(`${base}/terms`) &&
        !pathname.startsWith(`${base}/privacy`) &&
        !pathname.startsWith(`${base}/sss`) &&
        !pathname.startsWith(`${base}/faq`) &&
        !pathname.startsWith(`${base}/Perguntas_Frequentes`) &&
        pathname !== base
      break
    }
  }

  const hasSupabaseSession = !!user

  if (pathname === '/en/top100' || pathname === '/tr/top100') {
    const globalPath = pathname.startsWith('/tr')
      ? '/global/tr/top100'
      : '/global/en/top100'
    return redirectTo(new URL(globalPath, request.url))
  }

  const loggedInPublicPages = new Set(
    Object.entries(LOCALE_AUTH_ROUTES).flatMap(([locale, routes]) => [
      `/global/${locale}/${routes.login}`,
      `/global/${locale}/${routes.register}`,
    ])
  )
  if (hasSupabaseSession && currentLocale && loggedInPublicPages.has(pathname)) {
    const homeUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].home}`
    return redirectTo(new URL(homeUrl, request.url))
  }

  // Global üye sayfasına giriş yapmamış kullanıcı gelirse → register'e yönlendir
  if (isGlobalMemberPath && !hasSupabaseSession && currentLocale) {
    const registerUrl = `/global/${currentLocale}/${LOCALE_AUTH_ROUTES[currentLocale].register}`
    return redirectTo(new URL(registerUrl, request.url))
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
