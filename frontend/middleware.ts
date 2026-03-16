import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('finma_token')?.value

  // Public paths
  const publicPaths = ['/login', '/admin-login', '/invite']
  const isPublic = publicPaths.some(p => pathname.startsWith(p))

  // If on login page and has token, redirect to dashboard
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If not public and no token, redirect to login
  if (!isPublic && !token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons|favicon\\.ico|manifest\\.webmanifest|api/proxy).*)',
  ],
}
