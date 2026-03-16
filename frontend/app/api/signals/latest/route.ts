/**
 * GET /api/signals/latest
 * Supabase'den en son bot raporunu getir (Railway bypass)
 */

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY!

async function supaFetch(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    // 1. En son timestamp'i bul
    const latest = await supaFetch(
      'signals?select=timestamp,bot_name,market_regime,vix_level&order=created_at.desc&limit=1'
    )
    if (!latest?.length) {
      return Response.json(FALLBACK, { headers: noCache() })
    }

    const ts = latest[0].timestamp
    if (!ts) return Response.json(FALLBACK, { headers: noCache() })

    // 2. O timestamp'e ait tüm adayları getir
    const rows = await supaFetch(
      `signals?timestamp=eq.${encodeURIComponent(ts)}&order=score.desc`
    )

    if (!rows?.length) return Response.json(FALLBACK, { headers: noCache() })

    const meta = rows[0]
    const candidates = rows.map((r: any) => ({
      ticker: r.ticker,
      score: r.score,
      price: r.price,
      action: r.action,
      entry_zone: r.entry_zone,
      stop_loss: r.stop_loss,
      target: r.target,
      potential_pct: r.potential_pct,
      sector: r.sector,
      trend_phase: r.trend_phase,
      rvol: r.rvol,
      notes: r.notes,
    }))

    return Response.json(
      {
        timestamp: ts,
        bot_name: meta.bot_name || 'swing112',
        market_regime: meta.market_regime || 'Bull',
        vix_level: meta.vix_level || 20.0,
        candidates,
      },
      { headers: noCache() }
    )
  } catch (e: any) {
    console.error('Signals latest error:', e.message)
    return Response.json(FALLBACK, { headers: noCache() })
  }
}

function noCache() {
  return { 'Cache-Control': 'no-store, max-age=0' }
}

// Fallback: real Swing112 bot output
const FALLBACK = {
  timestamp: '2026-03-16 14:35:59',
  bot_name: 'swing112',
  market_regime: 'Bull',
  vix_level: 20.5,
  candidates: [
    { ticker: 'CGON', score: 35.1, price: 64.82, action: 'BUY', entry_zone: '64.82 - 67.41', stop_loss: 58.41, target: 71.30, potential_pct: 10.00, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'LXU', score: 33.5, price: 14.75, action: 'BUY', entry_zone: '14.75 - 15.34', stop_loss: 13.02, target: 16.23, potential_pct: 10.03, sector: 'Materials', trend_phase: 'Expansion' },
    { ticker: 'ADEA', score: 32.5, price: 23.10, action: 'BUY', entry_zone: '23.10 - 24.02', stop_loss: 21.07, target: 25.41, potential_pct: 9.96, sector: 'Technology', trend_phase: 'Expansion' },
    { ticker: 'PBR', score: 30.4, price: 18.57, action: 'BUY', entry_zone: '18.57 - 19.14', stop_loss: 17.43, target: 19.99, potential_pct: 7.65, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'STGW', score: 30.0, price: 5.95, action: 'BUY', entry_zone: '5.95 - 6.19', stop_loss: 5.17, target: 6.55, potential_pct: 10.08, sector: 'Technology', trend_phase: 'Expansion' },
    { ticker: 'BP', score: 29.6, price: 42.67, action: 'BUY', entry_zone: '42.67 - 43.65', stop_loss: 40.70, target: 45.13, potential_pct: 5.76, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'DNTH', score: 29.3, price: 78.89, action: 'BUY', entry_zone: '78.89 - 82.04', stop_loss: 68.49, target: 86.77, potential_pct: 9.99, sector: 'Healthcare', trend_phase: 'Expansion' },
    { ticker: 'UNFI', score: 27.8, price: 41.69, action: 'BUY', entry_zone: '41.69 - 43.36', stop_loss: 37.98, target: 45.86, potential_pct: 10.00, sector: 'Consumer', trend_phase: 'Expansion' },
    { ticker: 'OXY', score: 27.4, price: 57.33, action: 'BUY', entry_zone: '57.33 - 59.26', stop_loss: 53.48, target: 62.15, potential_pct: 8.41, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'EGY', score: 27.3, price: 5.49, action: 'BUY', entry_zone: '5.49 - 5.70', stop_loss: 4.91, target: 6.03, potential_pct: 9.84, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'ERIC', score: 27.2, price: 11.89, action: 'BUY', entry_zone: '11.89 - 12.20', stop_loss: 11.26, target: 12.67, potential_pct: 6.56, sector: 'Communication', trend_phase: 'Expansion' },
    { ticker: 'CAPR', score: 26.9, price: 30.65, action: 'BUY', entry_zone: '30.65 - 31.88', stop_loss: 26.15, target: 33.72, potential_pct: 10.02, sector: 'Healthcare', trend_phase: 'Expansion' },
    { ticker: 'UTHR', score: 26.8, price: 533.37, action: 'BUY', entry_zone: '533.37 - 551.08', stop_loss: 497.95, target: 577.64, potential_pct: 8.30, sector: 'Healthcare', trend_phase: 'Expansion' },
    { ticker: 'NOK', score: 26.5, price: 8.64, action: 'BUY', entry_zone: '8.64 - 8.98', stop_loss: 7.95, target: 9.49, potential_pct: 9.84, sector: 'Communication', trend_phase: 'Expansion' },
    { ticker: 'DAR', score: 26.0, price: 54.57, action: 'BUY', entry_zone: '54.57 - 56.36', stop_loss: 50.99, target: 59.05, potential_pct: 8.21, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'NSSC', score: 25.6, price: 42.99, action: 'BUY', entry_zone: '42.99 - 44.61', stop_loss: 39.76, target: 47.03, potential_pct: 9.40, sector: 'Industrials', trend_phase: 'Expansion' },
    { ticker: 'RLAY', score: 25.0, price: 10.30, action: 'BUY', entry_zone: '10.30 - 10.71', stop_loss: 8.80, target: 11.32, potential_pct: 9.90, sector: 'Healthcare', trend_phase: 'Expansion' },
    { ticker: 'APEI', score: 24.7, price: 54.12, action: 'BUY', entry_zone: '54.12 - 55.32', stop_loss: 48.55, target: 57.13, potential_pct: 5.56, sector: 'Consumer', trend_phase: 'Expansion' },
    { ticker: 'PSX', score: 24.5, price: 173.67, action: 'BUY', entry_zone: '173.67 - 178.93', stop_loss: 163.14, target: 186.83, potential_pct: 7.58, sector: 'Energy', trend_phase: 'Expansion' },
    { ticker: 'TALK', score: 23.7, price: 5.14, action: 'BUY', entry_zone: '5.14 - 5.35', stop_loss: 4.73, target: 5.66, potential_pct: 10.12, sector: 'Technology', trend_phase: 'Expansion' },
  ],
}
