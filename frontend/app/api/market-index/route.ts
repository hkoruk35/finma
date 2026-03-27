import { NextResponse } from 'next/server'

// Force dynamic — no ISR caching, always fresh
export const dynamic = 'force-dynamic'

export interface IndexItem {
  symbol: string
  label: string
  sublabel: string
  pct: string
  dir: 'up' | 'down'
  comment: string
}

const SYMBOLS = [
  { symbol: '^GSPC',     label: 'S&P 500',  sublabel: 'SPX'   },
  { symbol: '^IXIC',     label: 'NASDAQ',   sublabel: 'COMP'  },
  { symbol: '^DJI',      label: 'DOW',      sublabel: 'DJI'   },
  { symbol: 'DX-Y.NYB',  label: 'DOLAR',    sublabel: 'DXY'   },
  { symbol: '^VIX',      label: 'VIX',      sublabel: 'KORKU' },
]

const FALLBACK: IndexItem[] = [
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',   pct: '+0.82%', dir: 'up',   comment: 'Yükselen trend'   },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP',  pct: '+1.34%', dir: 'up',   comment: 'Momentum güçlü'   },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',   pct: '-0.21%', dir: 'down', comment: 'Temkinli seyir'   },
  { symbol: 'DX-Y.NYB', label: 'DOLAR',   sublabel: 'DXY',   pct: '-0.31%', dir: 'down', comment: 'Zayıflama devam' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'KORKU', pct: '+4.20%', dir: 'up',   comment: 'Risk iştahı ↓'   },
]

function getComment(label: string, pct: number, value?: number): string {
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
    // VIX level-based comment (value = absolute level)
    const v = value ?? 20
    if (v > 35)  return 'Panik seviyesi'
    if (v > 25)  return 'Yüksek korku'
    if (v > 20)  return 'Risk iştahı ↓'
    if (v > 15)  return 'Normal volatilite'
    return 'Düşük korku'
  }
  return pct >= 0 ? 'Yükseliyor' : 'Geriyor'
}

async function fetchIndexData(): Promise<IndexItem[] | null> {
  const symbolList = SYMBOLS.map(s => s.symbol).join(',')
  const fields = 'regularMarketChangePercent,regularMarketPrice,symbol'
  const urls = [
    `https://query1.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
    `https://query2.finance.yahoo.com/v8/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=${fields}`,
  ]

  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://finance.yahoo.com',
    'Referer': 'https://finance.yahoo.com/',
  }

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(6000) })
      if (!res.ok) continue

      const data = await res.json()
      const quotes: any[] = data?.quoteResponse?.result ?? []
      if (quotes.length === 0) continue

      const items: IndexItem[] = SYMBOLS.map(sym => {
        const q = quotes.find((r: any) => r.symbol === sym.symbol)
        const raw: number | undefined = q?.regularMarketChangePercent
        const level: number | undefined = q?.regularMarketPrice

        if (raw === undefined || raw === null) {
          return FALLBACK.find(f => f.symbol === sym.symbol) ?? {
            ...sym, pct: '0.00%', dir: 'up' as const, comment: '—'
          }
        }

        const pct = raw >= 0 ? `+${raw.toFixed(2)}%` : `${raw.toFixed(2)}%`
        return {
          ...sym,
          pct,
          dir: raw >= 0 ? 'up' : 'down',
          comment: getComment(sym.label, raw, level),
        }
      })

      return items
    } catch {
      // try next url
    }
  }
  return null
}

export async function GET() {
  const items = await fetchIndexData()

  const noCache = {
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'Access-Control-Allow-Origin': '*',
  }

  if (items) {
    return NextResponse.json(items, { headers: noCache })
  }

  return NextResponse.json(FALLBACK, { headers: noCache })
}
