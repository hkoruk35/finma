/**
 * FinMA V6+ Next.js Middleware
 * Combines locale detection + authentication checks
 *
 * Flow:
 * 1. Extract/detect locale from URL and headers
 * 2. Redirect to locale-prefixed URL if needed
 * 3. Check authentication (existing logic)
 * 4. Set locale cookie for persistence
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  defaultLocale,
  locales,
  isValidLocale,
  getLocaleFromAcceptLanguage,
  normalizeLocale,
  type Locale,
} from '@/i18n'

/**
 * Regex to extract locale from pathname: /tr/path, /en/dashboard, etc.
 */
const localeRegex = new RegExp(
  `^/(${locales.map((l) => l.replace('-', '\\-')).join('|')})(?:/|$)`
)

/**
 * Paths that should NOT be locale-routed
 */
const excludePatterns = [
  /\._next/,
  /^\/api/,
  /^\/public/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.svg$/,
  /\.webp$/,
  /\.ico$/,
  /\.json$/,
  /^\/manifest\.webmanifest/,
  /^\/robots\.txt/,
  /^\/sitemap\.xml/,
]

/**
 * Public paths that don't require authentication
 * (but still get locale routing)
 */
const publicPaths = [
  '/',
  '/login',
  '/admin-login',
  '/invite',
  '/world-markets',
  '/pricing',
  '/privacy',
  '/terms',
]

/**
 * Check if path should be excluded from locale routing
 */
function shouldExcludePath(pathname: string): boolean {
  return excludePatterns.some((pattern) => pattern.test(pathname))
}

/**
 * Extract locale from pathname
 */
function extractLocaleFromPath(pathname: string): {
  locale: Locale | null
  pathWithoutLocale: string
} {
  const match = pathname.match(localeRegex)
  if (match) {
    const locale = normalizeLocale(match[1]) as Locale
    const pathWithoutLocale = pathname.replace(match[0], '') || '/'
    return { locale, pathWithoutLocale }
  }
  return { locale: null, pathWithoutLocale: pathname }
}

/**
 * Detect locale from request
 */
function detectLocale(request: NextRequest): Locale {
  // Check cookie first (user's saved preference)
  const cookieLocale = request.cookies.get('finma_locale')?.value
  if (cookieLocale && isValidLocale(cookieLocale)) {
    return cookieLocale as Locale
  }

  // Parse Accept-Language header
  const acceptLanguage = request.headers.get('accept-language') || ''
  const detectedLocale = getLocaleFromAcceptLanguage(acceptLanguage)

  return normalizeLocale(detectedLocale) as Locale
}

/**
 * Check if path is public (doesn't require auth)
 */
function isPublicPath(pathname: string): boolean {
  // Remove locale prefix for check: /en/login → /login
  const { pathWithoutLocale } = extractLocaleFromPath(pathname)

  return (
    pathWithoutLocale === '/' ||
    publicPaths.some((p) => p !== '/' && pathWithoutLocale.startsWith(p))
  )
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('finma_token')?.value

  // Skip excluded paths (Next.js internals, static files, API)
  if (shouldExcludePath(pathname)) {
    return NextResponse.next()
  }

  const { locale, pathWithoutLocale } = extractLocaleFromPath(pathname)

  // ─── Step 1: Handle locale routing ───────────────────────────────────

  // If no locale in path, detect and redirect
  if (!locale) {
    const detectedLocale = detectLocale(request)
    const newPath = `/${detectedLocale}${pathname}`

    const response = NextResponse.redirect(new URL(newPath, request.url))

    // Set locale cookie
    response.cookies.set('finma_locale', detectedLocale, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      httpOnly: false, // Allow JS to read for client-side switching
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    })

    return response
  }

  // Path has locale, update cookie
  const response = NextResponse.next()
  response.cookies.set('finma_locale', locale, {
    maxAge: 60 * 60 * 24 * 7,
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })

  // ─── Step 2: Handle authentication ───────────────────────────────────

  const isPublic = isPublicPath(pathname)

  // If on login/landing and has token, redirect to dashboard
  if ((pathWithoutLocale === '/login' || pathWithoutLocale === '/') && token) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url))
  }

  // If not public and no token, redirect to landing page
  if (!isPublic && !token) {
    return NextResponse.redirect(new URL(`/${locale}/`, request.url))
  }

  return response
}

export const config = {
  matcher: [
    // Process all routes except Next.js internals and static files
    '/((?!_next/static|_next/image|icons|favicon\\.ico|manifest\\.webmanifest|api/).*)',
  ],
}
