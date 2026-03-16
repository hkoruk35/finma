/**
 * POST /api/signals/push
 * Bot sonuçlarını Supabase'e yaz (Railway bypass — kalıcı depolama)
 * Header: X-Api-Key: <BOT_API_KEY>
 */

const SUPABASE_URL = process.env.SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_KEY!
const BOT_API_KEY = process.env.BOT_API_KEY || 'finma-bot-2026'

export async function POST(request: Request) {
  // API Key dogrulama
  const apiKey = request.headers.get('X-Api-Key')
  if (apiKey !== BOT_API_KEY) {
    return Response.json({ error: 'Gecersiz API anahtari' }, { status: 401 })
  }

  try {
    const payload = await request.json()
    const { bot_name = 'swing112', market_regime = 'Bull', vix_level = 20.0, candidates = [] } = payload

    if (!candidates.length) {
      return Response.json({ error: 'Aday listesi bos' }, { status: 400 })
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19)

    // Kandidatlari Supabase formatina donustur
    const rows = candidates.map((c: any) => {
      const entry = c.entry || c.price
      const tp1 = c.tp1 || entry * 1.04
      const tp2 = c.tp2 || c.target || entry * 1.10

      return {
        bot_name,
        timestamp,
        market_regime,
        vix_level,
        ticker: (c.ticker || '').toUpperCase(),
        score: Math.round((c.score || 0) * 10) / 10,
        price: c.price,
        action: (c.action || 'BUY').toUpperCase(),
        entry_zone: c.entry_zone || `${entry.toFixed(2)} - ${tp1.toFixed(2)}`,
        stop_loss: c.stop_loss,
        target: tp2,
        potential_pct: c.potential_pct || (entry > 0 ? Math.round(((tp2 - entry) / entry) * 10000) / 100 : 0),
        sector: c.sector || 'Unknown',
        trend_phase: c.trend_phase || 'Expansion',
        notes: c.notes || [`Swing112 skor: ${c.score}`],
      }
    })

    // Supabase'e yaz
    const res = await fetch(`${SUPABASE_URL}/rest/v1/signals`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(rows),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Supabase write error:', err)
      return Response.json({ error: 'DB yazma hatasi', detail: err }, { status: 500 })
    }

    console.log(`✅ ${rows.length} sinyal push edildi — bot: ${bot_name}`)
    return Response.json({ status: 'ok', count: rows.length, timestamp })
  } catch (e: any) {
    console.error('Push error:', e.message)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
