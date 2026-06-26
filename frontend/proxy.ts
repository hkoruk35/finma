import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('boga_auth')
  const { pathname } = request.nextUrl

  // 1. Her zaman erişilebilecek yollar (Login, Landing Page ve Statik Dosyalar)
  const isPublicPath =
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') || // resimler, fontlar vb.
    pathname === '/favicon.ico'

  // 2. Giriş yapmamış kullanıcı → her zaman /login'e yönlendir
  if (!authCookie && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Giriş yapmış kullanıcı /login veya / 'a gelirse → /pro'ya yönlendir
  if (authCookie && (pathname.startsWith('/login') || pathname === '/')) {
    return NextResponse.redirect(new URL('/pro', request.url))
  }

  return NextResponse.next()
}

// Tüm rotaları yakala (Middleware matcher)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
