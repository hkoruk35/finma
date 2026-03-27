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

// yahoo symbol → stooq symbol (only for indices stooq actually has)
const STOOQ_SYMBOLS = [
  { yahoo: '^GSPC',    stooq: '^spx', label: 'S&P 500', sublabel: 'SPX'   },
  { yahoo: '^IXIC',    stooq: '^ndx', label: 'NASDAQ',  sublabel: 'COMP'  },
  { yahoo: '^DJI',     stooq: '^dji', label: 'DOW',     sublabel: 'DJI'   },
]

// VIX + DXY not on Stooq → use Yahoo Finance chart endpoint
const YAHOO_SYMBOLS = [
  { yahoo: 'DX-Y.NYB', label: 'DOLAR', sublabel: 'DXY'   },
  { yahoo: '^VIX',     label: 'VIX',   sublabel: 'KORKU' },
]

const ALL_ORDER = ['^GSPC', '^IXIC', '^DJI', 'DX-Y.NYB', '^VIX']

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

function makeItem(
  sym: { yahoo?: string; symbol?: string; label: string; sublabel: string },
  pct: number,
  price?: number,
): IndexItem {
  const symbol = sym.yahoo ?? sym.symbol ?? ''
  const pctStr = pct >= 0 ? `+${pct.toFixed(2)}%` : `${pct.toFixed(2)}%`
  return {
    symbol,
    label: sym.label,
    sublabel: sym.sublabel,
    pct: pctStr,
    dir: pct >= 0 ? 'up' : 'down',
    comment: getComment(sym.label, pct, price),
  }
}

// ── Stooq: one request per symbol (multi-symbol URL is broken on stooq) ──────
async function fetchOneStooq(
  sym: typeof STOOQ_SYMBOLS[number],
): Promise<IndexItem | null> {
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(sym.stooq)}&f=sd2t2cp&h&e=csv`
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bot)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const text = await res.text()
    // Header row + data row
    const lines = text.trim().split('\n')
    if (lines.length < 2) return null
    const parts = lines[1].split(',')
    if (parts.length < 5) return null
    const close = parseFloat(parts[3])
    const prev  = parseFloat(parts[4])
    if (isNaN(close) || isNaN(prev) || prev === 0) return null
    const pct = (close - prev) / prev * 100
    return makeItem(sym, pct, close)
  } catch {
    return null
  }
}

// ── Yahoo Finance chart: works for VIX + DXY (pct via chartPreviousClose) ────
async function fetchYahooChart(
  sym: typeof YAHOO_SYMBOLS[number],
): Promise<IndexItem | null> {
  const encoded = encodeURIComponent(sym.yahoo)
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=1d`,
  ]
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept': 'application/json',
    'Referer': 'https://finance.yahoo.com/',
  }
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, cache: 'no-store', signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const json = await res.json()
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) continue

      const price: number | null = meta.regularMarketPrice ?? null
      if (price == null) continue

      // Try direct pct first; fall back to chartPreviousClose calculation
      let pct: number | null = meta.regularMarketChangePercent ?? null
      if (pct == null) {
        const prev: number | null = meta.chartPreviousClose ?? meta.previousClose ?? null
        if (prev && prev !== 0) {
          pct = (price - prev) / prev * 100
        }
      }
      if (pct == null) continue

      return makeItem(sym, pct, price)
    } catch { /* next */ }
  }
  return null
}

export async function GET() {
  // Fetch all sources in parallel
  const [stooqResults, yahooResults] = await Promise.all([
    Promise.all(STOOQ_SYMBOLS.map(fetchOneStooq)),
    Promise.all(YAHOO_SYMBOLS.map(fetchYahooChart)),
  ])

  // Build lookup map
  const resultMap = new Map<string, IndexItem>()
  STOOQ_SYMBOLS.forEach((sym, i) => {
    if (stooqResults[i]) resultMap.set(sym.yahoo, stooqResults[i]!)
  })
  YAHOO_SYMBOLS.forEach((sym, i) => {
    if (yahooResults[i]) resultMap.set(sym.yahoo, yahooResults[i]!)
  })

  // Merge in canonical order, fallback per symbol if needed
  const items: IndexItem[] = ALL_ORDER.map((sym, i) => resultMap.get(sym) ?? FALLBACK[i])

  return NextResponse.json(items, {
    headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  })
}
