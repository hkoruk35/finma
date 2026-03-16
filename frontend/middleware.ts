import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('finma_token')?.value

  // Public paths (landing page, login, admin-login, invite)
  const publicPaths = ['/', '/login', '/admin-login', '/invite']
  const isPublic = pathname === '/' || publicPaths.some(p => p !== '/' && pathname.startsWith(p))

  // If on login page or landing and has token, redirect to dashboard
  if ((pathname === '/login' || pathname === '/') && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // If not public and no token, redirect to landing page
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|icons|favicon\\.ico|manifest\\.webmanifest|api/proxy).*)',
  ],
}
