import { NextResponse } from 'next/server'

export const revalidate = 300 // 5 min ISR cache

export interface IndexItem {
  symbol: string
  label: string
  sublabel: string
  pct: string
  dir: 'up' | 'down'
  comment: string
}

const SYMBOLS = [
  { symbol: '^GSPC',     label: 'S&P 500',     sublabel: 'SPX'    },
  { symbol: '^IXIC',     label: 'NASDAQ',      sublabel: 'COMP'   },
  { symbol: '^DJI',      label: 'DOW',         sublabel: 'DJI'    },
  { symbol: '^RUT',      label: 'Russell 2000', sublabel: 'RUT'   },
  { symbol: '^VIX',      label: 'VIX',         sublabel: 'VIX'    },
]

const FALLBACK: IndexItem[] = [
  { symbol: '^GSPC',    label: 'S&P 500', sublabel: 'SPX',  pct: '+0.98%', dir: 'up',   comment: 'Yükselen trend'    },
  { symbol: '^IXIC',    label: 'NASDAQ',  sublabel: 'COMP', pct: '+1.67%', dir: 'up',   comment: 'Momentum güçlü'   },
  { symbol: '^DJI',     label: 'DOW',     sublabel: 'DJI',  pct: '+0.45%', dir: 'up',   comment: 'Sanayi güçlü'     },
  { symbol: '^RUT',     label: 'Russell 2000', sublabel: 'RUT',  pct: '+0.76%', dir: 'up',   comment: 'Küçük cap güçlü' },
  { symbol: '^VIX',     label: 'VIX',     sublabel: 'VIX',  pct: '+3.82%', dir: 'up',   comment: 'Volatilite normal'  },
]

function getComment(label: string, pct: number): string {
  if (label === 'S&P 500') {
    if (pct > 1.5) return 'Güçlü ralli'
    if (pct > 0.5) return 'Yükselen trend'
    if (pct > 0)   return 'Hafif pozitif'
    if (pct > -0.5) return 'Temkinli seyir'
    if (pct > -1.5) return 'Baskı devam'
    return 'Sert satış'
  }
  if (label === 'NASDAQ') {
    if (pct > 1.5) return 'Tech rallisi'
    if (pct > 0.5) return 'Momentum güçlü'
    if (pct > 0)   return 'Hafif alım'
    if (pct > -0.5) return 'Duraksıyor'
    if (pct > -1.5) return 'Baskı var'
    return 'Tech satışı'
  }
  if (label === 'DOW') {
    if (pct > 1) return 'Sanayi güçlü'
    if (pct > 0) return 'Hafif pozitif'
    if (pct > -1) return 'Temkinli seyir'
    return 'Sanayi geriliyor'
  }
  if (label === 'VIX') {
    if (pct > 20) return 'Yüksek korku'
    if (pct > 15) return 'Korku artıyor'
    if (pct > 10) return 'Volatilite yükseliyor'
    if (pct > 0)  return 'Risk farkındalığı'
    if (pct > -10) return 'Sakinlik'
    return 'Çok sakin'
  }
  if (label === 'Russell 2000') {
    if (pct > 1.5) return 'Küçük cap rallisi'
    if (pct > 0.5) return 'Küçük cap güçlü'
    if (pct > 0)   return 'Hafif alım'
    if (pct > -0.5) return 'Temkinli'
    if (pct > -1.5) return 'Baskı var'
    return 'Küçük cap satışı'
  }
  return pct >= 0 ? 'Yükseliyor' : 'Geriyor'
}

async function fetchIndexData(): Promise<IndexItem[] | null> {
  const symbolList = SYMBOLS.map(s => s.symbol).join(',')
  const urls = [
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketChangePercent,symbol`,
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketChangePercent,symbol`,
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
          comment: getComment(sym.label, raw),
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

  if (items) {
    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  return NextResponse.json(FALLBACK, {
    headers: {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
