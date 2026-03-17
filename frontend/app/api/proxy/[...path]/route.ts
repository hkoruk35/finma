/**
 * Next.js API Proxy — Vercel Edge → Railway backend
 *
 * Flow: Browser → /api/proxy/market/quote/DELL → Railway /api/market/quote/DELL
 *
 * Avantajlar:
 * 1. Same-origin — CORS sorunları yok
 * 2. Vercel CDN edge cache (s-maxage)
 * 3. Backend URL gizli (güvenlik)
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'

// Cache süreleri (saniye) — path prefix match
const CACHE_RULES: [string, number][] = [
  ['/api/market/indices', 30],
  ['/api/market/sectors', 120],
  ['/api/market/regime', 60],
  ['/api/market/quote/', 15],
  ['/api/market/technicals/', 20],
  ['/api/market/analysis/', 30],
  ['/api/market/search', 300],       // 5dk — arama sonuçları nadiren değişir
  ['/api/market/price-changes/', 60], // 1dk — haftalık/aylık/yıllık oranlar
  ['/api/market/news/', 120],         // 2dk — haberler
  ['/api/market/insider/', 300],      // 5dk — insider nadiren değişir
  ['/api/market/earnings/', 300],     // 5dk — bilanço takvimi
  ['/api/market/history/', 600],      // 10dk — fiyat geçmişi yavaş değişir
  ['/api/market/holders/', 600],      // 10dk — sahiplik yavaş değişir
  ['/api/signals/', 60],
  ['/api/portfolio/', 0],
  ['/api/auth/', 0],
]

function getCacheDuration(path: string): number {
  for (const [prefix, ttl] of CACHE_RULES) {
    if (path === prefix || path.startsWith(prefix)) return ttl
  }
  return 0
}

async function handler(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params

  // path = ['api', 'market', 'quote', 'DELL'] → backendPath = '/api/market/quote/DELL'
  const backendPath = '/' + path.join('/')
  const url = new URL(request.url)
  const queryString = url.search

  const backendUrl = `${BACKEND_URL}${backendPath}${queryString}`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }

    const auth = request.headers.get('Authorization')
    if (auth) headers['Authorization'] = auth

    const fetchOptions: RequestInit = {
      method: request.method,
      headers,
    }

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      try {
        fetchOptions.body = await request.text()
      } catch {
        // No body
      }
    }

    const response = await fetch(backendUrl, {
      ...fetchOptions,
      signal: AbortSignal.timeout(25_000),
    })

    const data = await response.text()

    const cacheDuration = getCacheDuration(backendPath)
    const responseHeaders: Record<string, string> = {
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    }

    if (cacheDuration > 0 && request.method === 'GET' && response.ok) {
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
