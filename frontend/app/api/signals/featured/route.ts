/**
 * GET /api/signals/featured?limit=5
 * Top N sinyalleri getir (landing page + dashboard)
 */

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '5')

  // /api/signals/latest'den veri al (ayni sunucu)
  const origin = url.origin
  try {
    const res = await fetch(`${origin}/api/signals/latest`, { next: { revalidate: 0 } })
    const data = await res.json()

    const candidates = (data.candidates || [])
      .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
      .slice(0, limit)

    return Response.json(
      {
        timestamp: data.timestamp,
        market_regime: data.market_regime,
        vix_level: data.vix_level,
        featured: candidates,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    )
  } catch (e: any) {
    return Response.json(
      { timestamp: '', market_regime: 'Bull', vix_level: 20, featured: [] },
      { status: 500 }
    )
  }
}
