/**
 * Next.js API Proxy — Vercel Edge'den Railway backend'e proxy
 *
 * Avantajlar:
 * 1. CORS sorunları ortadan kalkar (same-origin)
 * 2. Vercel CDN edge caching ile hız artar
 * 3. Backend URL client'a açıklanmaz (güvenlik)
 * 4. Yüzlerce concurrent user için Vercel edge'de scale edilir
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'

// Cache süreleri (saniye)
const CACHE_RULES: Record<string, number> = {
  '/api/market/indices': 30,
  '/api/market/sectors': 120,
  '/api/market/regime': 60,
  '/api/signals/latest': 300,
  '/api/signals/featured': 300,
}

function getCacheDuration(path: string): number {
  // Exact match
  if (CACHE_RULES[path]) return CACHE_RULES[path]
  // Quote ve technicals — 15sn cache
  if (path.startsWith('/api/market/quote/')) return 15
  if (path.startsWith('/api/market/technicals/')) return 20
  if (path.startsWith('/api/market/analysis/')) return 30
  // Signals — 5dk
  if (path.startsWith('/api/signals/')) return 300
  // Default
  return 0
}

async function handler(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params
  const backendPath = '/api/' + path.join('/')
  const url = new URL(request.url)
  const queryString = url.search

  const backendUrl = `${BACKEND_URL}${backendPath}${queryString}`

  try {
    // Forward request to backend
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    // Forward auth header
    const auth = request.headers.get('Authorization')
    if (auth) headers['Authorization'] = auth

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    }

    // Forward body for POST/PUT/DELETE
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        fetchOptions.body = await request.text()
      } catch {
        // No body
      }
    }

    const response = await fetch(backendUrl, {
      ...fetchOptions,
      signal: AbortSignal.timeout(25_000), // 25s timeout
    })

    const data = await response.text()

    // Build response with cache headers
    const cacheDuration = getCacheDuration(backendPath)
    const responseHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    if (cacheDuration > 0 && request.method === 'GET' && response.ok) {
      // s-maxage: Vercel CDN cache, stale-while-revalidate: arka planda güncelle
      responseHeaders['Cache-Control'] = `public, s-maxage=${cacheDuration}, stale-while-revalidate=${cacheDuration * 2}`
    } else {
      responseHeaders['Cache-Control'] = 'no-store'
    }

    return new Response(data, {
      status: response.status,
      headers: responseHeaders,
    })
  } catch (error: any) {
    console.error(`Proxy error [${backendPath}]:`, error.message)
    return new Response(
      JSON.stringify({ error: 'Backend bağlantı hatası', detail: error.message }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

export const GET = handler
export const POST = handler
export const PUT = handler
export const DELETE = handler
export const PATCH = handler
