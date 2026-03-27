import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export interface IndexItem {
  symbol: string
  label: string
  sublabel: string
  pct: string
  dir: 'up' | 'down'
  comment: string
}

const SYMBOLS = [
  { symbol: '^GSPC',    stooq: '^spx', label: 'S&P 500', sublabel: 'SPX'   },
  { symbol: '^IXIC',    stooq: '^ndx', label: 'NASDAQ',  sublabel: 'COMP'  },
  { symbol: '^DJI',     stooq: '^dji', label: 'DOW',     sublabel: 'DJI'   },
  { symbol: 'DX-Y.NYB', stooq: 'dxy',  label: 'DOLAR',   sublabel: 'DXY'   },
  { symbol: '^VIX',     stooq: '^vix', label: 'VIX',     sublabel: 'KORKU' },
]

const FALLBACK: IndexItem[] = [
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',   pct: '+0.82%', dir: 'up',   comment: 'Yükselen trend'  },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP',  pct: '+1.34%', dir: 'up',   comment: 'Momentum güçlü'  },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',   pct: '-0.21%', dir: 'down', comment: 'Temkinli seyir'  },
  { symbol: 'DX-Y.NYB', label: 'DOLAR',   sublabel: 'DXY',   pct: '-0.31%', dir: 'down', comment: 'Zayıflama devam' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'KORKU', pct: '+4.20%', dir: 'up',   comment: 'Risk iştahı ↓'  },
]

function getComment(label: string, pct: number, price?: number): string {
  if (label === 'S&P 500') {
    if (pct > 1.5)  return 'Güçlü ralli'
    if (pct > 0.5)  return 'Yükselen trend'
    if (pct > 0)    return 'Hafif pozitif'
    if (pct > -0.5) return 'Temkinli seyir'
    if (pct > -1.5) return 'Baskı devam'
    return 'Sert satış'
  }
  if (label === 'NASDAQ') {
    if (pct > 1.5)  return 'Tech rallisi'
    if (pct > 0.5)  return 'Momentum güçlü'
    if (pct > 0)    return 'Hafif alım'
    if (pct > -0.5) return 'Duraksıyor'
    if (pct > -1.5) return 'Baskı var'
    return 'Tech satışı'
  }
  if (label === 'DOW') {
    if (pct > 1)  return 'Sanayi güçlü'
    if (pct > 0)  return 'Hafif pozitif'
    if (pct > -1) return 'Temkinli seyir'
    return 'Sanayi geriliyor'
  }
  if (label === 'DOLAR') {
    if (pct > 0.5)  return 'Dolar güçlü'
    if (pct > 0)    return 'Hafif güçlenme'
    if (pct > -0.5) return 'Zayıflama devam'
    return 'Dolar zayıf'
  }
  if (label === 'VIX') {
    const v = price ?? 20
    if (v > 35)  return 'Panik seviyesi'
    if (v > 25)  return 'Yüksek korku'
    if (v > 20)  return 'Risk iştahı ↓'
    if (v > 15)  return 'Normal volatilite'
    return 'Düşük korku'
  }
  return pct >= 0 ? 'Yükseliyor' : 'Geriyor'
}

function buildItem(sym: typeof SYMBOLS[number], pct: number, price?: number): IndexItem {
  const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
  return {
    symbol: sym.symbol,
    label: sym.label,
    sublabel: sym.sublabel,
    pct: pctStr,
    dir: pct >= 0 ? 'up' : 'down',
    comment: getComment(sym.label, pct, price),
  }
}

// ── Source 1: Stooq (no auth, cloud-IP friendly) ────────────────────────────
// Fields: s=symbol, d2=date, c=close, p=prevclose → calc pct ourselves
async function fetchStooq(): Promise<IndexItem[] | null> {
  const stooqList = SYMBOLS.map(s => s.stooq).join(',')
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqList)}&f=sd2t2cp&h&e=csv`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; finma/1.0)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(9000),
    })
    if (!res.ok) return null

    const text = await res.text()
    const lines = text.trim().split('\n')
    // First line is header: Symbol,Date,Time,Close,Open (or Close,Prev)
    if (lines.length < 2) return null

    // Build lookup: stooq_symbol → {close, prev}
    const map = new Map<string, { close: number; prev: number }>()
    for (const line of lines.slice(1)) {
      const parts = line.split(',')
      if (parts.length < 5) continue
      const sym    = parts[0].trim().toLowerCase()
      const close  = parseFloat(parts[3])
      const prev   = parseFloat(parts[4])
      if (!isNaN(close) && !isNaN(prev) && prev !== 0) {
        map.set(sym, { close, prev })
      }
    }
    if (map.size === 0) return null

    const items: IndexItem[] = SYMBOLS.map((sym, i) => {
      const entry = map.get(sym.stooq.toLowerCase())
      if (!entry) return FALLBACK[i]
      const pct = (entry.close - entry.prev) / entry.prev * 100
      return buildItem(sym, pct, entry.close)
    })

    // Reject if all values identical to fallback (fetch succeeded but data bad)
    const allFallback = items.every((item, i) => item.pct === FALLBACK[i].pct)
    return allFallback ? null : items
  } catch {
    return null
  }
}

// ── Source 2: Yahoo Finance chart per symbol (fallback) ──────────────────────
async function fetchYahooChart(sym: typeof SYMBOLS[number]): Promise<IndexItem | null> {
  const encoded = encodeURIComponent(sym.symbol)
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d&includePrePost=false`,
  ]
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(7000) })
      if (!res.ok) continue
      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) continue
      const raw: number | null = meta.regularMarketChangePercent ?? null
      if (raw == null) continue
      return buildItem(sym, raw, meta.regularMarketPrice)
    } catch { /* next */ }
  }
  return null
}

// ── Handler ──────────────────────────────────────────────────────────────────
export async function GET() {
  // Try Stooq first — reliable from Vercel IPs
  const stooqItems = await fetchStooq()
  if (stooqItems) {
    return NextResponse.json(stooqItems, {
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // Fallback: Yahoo Finance chart (parallel)
  const yahooResults = await Promise.all(SYMBOLS.map(fetchYahooChart))
  const merged: IndexItem[] = SYMBOLS.map((sym, i) => yahooResults[i] ?? FALLBACK[i])

  return NextResponse.json(merged, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  })
}
