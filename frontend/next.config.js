/** @type {import('next').NextConfig} */

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://finma-production.up.railway.app wss://finma-production.up.railway.app https://ciayyuhqulcdeyyosoiy.supabase.co https://accounts.google.com",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy',           value: CSP },
  { key: 'X-Frame-Options',                   value: 'DENY' },
  { key: 'X-Content-Type-Options',            value: 'nosniff' },
  { key: 'X-XSS-Protection',                  value: '1; mode=block' },
  { key: 'Referrer-Policy',                   value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',                value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security',         value: 'max-age=63072000; includeSubDomains; preload' },
]

const nextConfig = {
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  async rewrites() {
    return [
      {
        source: '/api/proxy/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'}/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
