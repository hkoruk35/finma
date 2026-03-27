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
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX'   },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP'  },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI'   },
  { symbol: 'DX-Y.NYB', label: 'DOLAR',   sublabel: 'DXY'   },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'KORKU' },
]

const FALLBACK: IndexItem[] = [
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',   pct: '+0.82%', dir: 'up',   comment: 'Yükselen trend'  },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP',  pct: '+1.34%', dir: 'up',   comment: 'Momentum güçlü'  },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',   pct: '-0.21%', dir: 'down', comment: 'Temkinli seyir'  },
  { symbol: 'DX-Y.NYB', label: 'DOLAR',   sublabel: 'DXY',   pct: '-0.31%', dir: 'down', comment: 'Zayıflama devam' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'KORKU', pct: '+4.20%', dir: 'up',   comment: 'Risk iştahı ↓'  },
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const BASE_HEADERS: HeadersInit = {
  'User-Agent': UA,
  'Accept': 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
  'Origin': 'https://finance.yahoo.com',
}

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

function buildItem(
  sym: typeof SYMBOLS[number],
  raw: number,
  price?: number,
): IndexItem {
  const pct = raw >= 0 ? `+${raw.toFixed(2)}%` : `${raw.toFixed(2)}%`
  return {
    ...sym,
    pct,
    dir: raw >= 0 ? 'up' : 'down',
    comment: getComment(sym.label, raw, price),
  }
}

// ── Method 1: v8/finance/chart per symbol (no crumb needed) ─────────────────
async function fetchChart(sym: typeof SYMBOLS[number]): Promise<IndexItem | null> {
  const encoded = encodeURIComponent(sym.symbol)
  // Try both hosts
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1m&range=1d&includePrePost=false`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: BASE_HEADERS,
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
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

// ── Method 2: batch quote API (needs crumb on newer Yahoo infra) ─────────────
async function fetchQuoteBatch(): Promise<IndexItem[] | null> {
  const symbolList = SYMBOLS.map(s => s.symbol).join(',')
  const fields = 'regularMarketChangePercent,regularMarketPrice,symbol'
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
    `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
  ]
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: BASE_HEADERS,
        cache: 'no-store',
        signal: AbortSignal.timeout(7000),
      })
      if (!res.ok) continue
      const json = await res.json()
      const quotes: any[] = json?.quoteResponse?.result ?? []
      if (quotes.length === 0) continue

      const items: IndexItem[] = SYMBOLS.map(sym => {
        const q = quotes.find((r: any) => r.symbol === sym.symbol)
        const raw: number | null = q?.regularMarketChangePercent ?? null
        if (raw == null) return FALLBACK.find(f => f.symbol === sym.symbol)!
        return buildItem(sym, raw, q?.regularMarketPrice)
      })
      return items
    } catch { /* next */ }
  }
  return null
}

export async function GET() {
  // Try chart endpoint first (parallel, no auth)
  const chartResults = await Promise.all(SYMBOLS.map(fetchChart))
  const allFromChart = chartResults.every(r => r !== null)

  if (allFromChart) {
    return NextResponse.json(chartResults as IndexItem[], {
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  }

  // If some chart requests failed, fill gaps from batch quote
  const batchItems = await fetchQuoteBatch()

  const merged: IndexItem[] = SYMBOLS.map((sym, i) => {
    if (chartResults[i]) return chartResults[i]!
    if (batchItems)      return batchItems[i]
    return FALLBACK[i]
  })

  const anyReal = merged.some((item, i) => item.pct !== FALLBACK[i].pct)

  return NextResponse.json(merged, {
    headers: {
      'Cache-Control': anyReal ? 'no-store' : 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
