import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(request: NextRequest) {
  const authCookie = request.cookies.get('boga_auth')
  const { pathname } = request.nextUrl

  // Tam segment eşleşmesi — startsWith tek başına '/tr' için '/tracker' gibi yanlış eşleşmeler üretir
  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`)

  // ── Global üye sayfaları: Supabase oturumu gerektirir ─────────────────────
  // /global/en/[ticker], /global/tr/[ticker], /global/en/account, /global/tr/hesabim
  // Bu sayfalar halka açık değil — üye girişi zorunlu
  const isGlobalMemberPath =
    // /global/en altında sadece landing (/) ve login public — geri her şey üye gerektirir
    (isPathOrSubpath('/global/en') &&
      !pathname.startsWith('/global/en/login') &&
      pathname !== '/global/en') ||
    // /global/tr altında sadece landing (/) ve giris public — geri her şey üye gerektirir
    (isPathOrSubpath('/global/tr') &&
      !pathname.startsWith('/global/tr/giris') &&
      pathname !== '/global/tr')

  // Supabase session cookie varlığını kontrol et (sb-* ile başlayan cookie)
  const hasSupabaseSession = request.cookies.getAll().some(
    (c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  // ── /en/top100 ve /tr/top100 → /global/ altına yönlendir ───────────────────
  // Top 100 Tracker sadece /global/ altında, Supabase login gerektirir
  if (pathname === '/en/top100' || pathname === '/tr/top100') {
    if (!hasSupabaseSession) {
      // Login değil → login sayfasına yönlendir
      const loginUrl = pathname.startsWith('/tr')
        ? '/global/tr/giris'
        : '/global/en/login'
      return NextResponse.redirect(new URL(loginUrl, request.url))
    }
    // Login yapıldı → /global/ altına yönlendir
    const globalPath = pathname.startsWith('/tr')
      ? '/global/tr/top100'
      : '/global/en/top100'
    return NextResponse.redirect(new URL(globalPath, request.url))
  }

  // Global üye sayfasına giriş yapmamış kullanıcı gelirse → global login'e yönlendir
  if (isGlobalMemberPath && !hasSupabaseSession) {
    // Hangi dil? /global/tr → tr/giris, diğerleri → en/login
    const loginUrl = pathname.startsWith('/global/tr')
      ? '/global/tr/giris'
      : '/global/en/login'
    return NextResponse.redirect(new URL(loginUrl, request.url))
  }

  // 1. Her zaman erişilebilecek yollar (Admin Login, Public /en+/tr, Landing, Statik Dosyalar)
  const isPublicPath =
    isPathOrSubpath('/login') ||
    isPathOrSubpath('/en') ||
    isPathOrSubpath('/tr') ||
    isPathOrSubpath('/global') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') || // resimler, fontlar vb.
    pathname === '/favicon.ico'

  // 2. Giriş yapmamış kullanıcı kökte (/) ise → public /global/en bölümüne yönlendir
  if (!authCookie && pathname === '/') {
    return NextResponse.redirect(new URL('/global/en', request.url))
  }

  // 3. Admin cookie olmayan kullanıcı admin sayfasına gelirse → /login'e yönlendir
  if (!authCookie && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 4. Admin giriş yapmış kullanıcı /login veya / 'a gelirse → /pro'ya yönlendir
  if (authCookie && (isPathOrSubpath('/login') || pathname === '/')) {
    return NextResponse.redirect(new URL('/pro', request.url))
  }

  return NextResponse.next()
}

// Tüm rotaları yakala (Middleware matcher)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
