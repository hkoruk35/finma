import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const authCookie = request.cookies.get('boga_auth')
  const { pathname } = request.nextUrl

  // 1. Her zaman erişilebilecek yollar (Sadece Login ve Statik Dosyalar)
  const isPublicPath = 
    pathname.startsWith('/login') || 
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api') ||
    pathname.includes('.') || // resimler, fontlar vb.
    pathname === '/favicon.ico'

  // 2. Eğer kullanıcı giriş yapmamışsa ve public olmayan bir yere gitmeye çalışıyorsa -> Login'e at
  // Not: pathname === '/' burada isPublicPath olmadığı için login'e yönlendirilecektir.
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
