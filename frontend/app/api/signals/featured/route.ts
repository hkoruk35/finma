/**
 * GET /api/signals/featured?limit=5
 * Top N sinyalleri getir (landing page + dashboard)
 */

import signalsData from '@/data/signals-latest.json'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = parseInt(url.searchParams.get('limit') || '5')

  const candidates = (signalsData.candidates || [])
    .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
    .slice(0, limit)

  return Response.json(
    {
      timestamp: signalsData.timestamp,
      market_regime: signalsData.market_regime,
      vix_level: signalsData.vix_level,
      featured: candidates,
    },
    { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } }
  )
}
