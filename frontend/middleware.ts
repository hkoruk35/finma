import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('boga_auth')
  const { pathname } = request.nextUrl

  // 1. Her zaman erişilebilecek yollar (Login, Assetler, API)
  const isPublicPath = 
    pathname === '/' ||
    pathname.startsWith('/login') || 
    pathname.startsWith('/swing') || 
    pathname.startsWith('/daytrade') || 
    pathname.startsWith('/optanaliz') || 
    pathname.startsWith('/optanaliz-performance') || 
    pathname.startsWith('/performance') || 
    pathname.startsWith('/swing-performance') || 
    pathname.startsWith('/stock') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.includes('.') || // static resimler, favicons vb.
    pathname === '/favicon.ico'

  // 2. Eğer kullanıcı giriş yapmamışsa ve public olmayan bir yere gitmeye çalışıyorsa -> Login'e at
  if (!authCookie && !isPublicPath) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 3. Eğer kullanıcı giriş yapmışsa ve Login sayfasına gitmeye çalışıyorsa -> Pro'ya at
  if (authCookie && pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/pro', request.url))
  }

  return NextResponse.next()
}

// Tüm rotaları yakala (Middleware matcher)
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
