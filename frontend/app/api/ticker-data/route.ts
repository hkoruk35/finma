import { NextResponse } from 'next/server'

// nodejs runtime — Yahoo Finance CORS/IP block'u edge'de daha sık olur
export const revalidate = 900 // 15 min ISR cache

interface TickerItem {
  symbol: string
  label: string
  category: string
  pct: string
  dir: 'up' | 'down'
}

// 16 sembol — 5 Main Indices + 11 Sector ETFs (F-7 revision)
const SYMBOLS: Array<Omit<TickerItem, 'pct' | 'dir'>> = [
  // 5 Main Indices
  { symbol: '^GSPC',     label: 'S&P 500',    category: 'Endeks'  },
  { symbol: '^DJI',      label: 'DOW',        category: 'Endeks'  },
  { symbol: '^IXIC',     label: 'NASDAQ',     category: 'Endeks'  },
  { symbol: '^VIX',      label: 'VIX',        category: 'Endeks'  },
  { symbol: '^RUT',      label: 'Russell 2K', category: 'Endeks'  },
  // 11 Sector ETFs
  { symbol: 'XLC',       label: 'Communication', category: 'Sektor' },
  { symbol: 'XLY',       label: 'Consumer Disc.', category: 'Sektor' },
  { symbol: 'XLE',       label: 'Energy',     category: 'Sektor'  },
  { symbol: 'XLF',       label: 'Financials', category: 'Sektor'  },
  { symbol: 'XLV',       label: 'Healthcare', category: 'Sektor'  },
  { symbol: 'XLI',       label: 'Industrials', category: 'Sektor' },
  { symbol: 'XLRE',      label: 'Real Estate', category: 'Sektor' },
  { symbol: 'XLK',       label: 'Technology', category: 'Sektor'  },
  { symbol: 'XLP',       label: 'Cons. Staples', category: 'Sektor' },
  { symbol: 'XLU',       label: 'Utilities',  category: 'Sektor'  },
]

// Fallback — sadece Yahoo erişilemediğinde (5 indices + 11 sectors)
const MOCK: TickerItem[] = [
  // 5 Main Indices
  { symbol: '^GSPC',     label: 'S&P 500',    category: 'Endeks', pct: '+1.24%', dir: 'up'   },
  { symbol: '^DJI',      label: 'DOW',        category: 'Endeks', pct: '+0.87%', dir: 'up'   },
  { symbol: '^IXIC',     label: 'NASDAQ',     category: 'Endeks', pct: '+2.18%', dir: 'up'   },
  { symbol: '^VIX',      label: 'VIX',        category: 'Endeks', pct: '-5.32%', dir: 'down' },
  { symbol: '^RUT',      label: 'Russell 2K', category: 'Endeks', pct: '+1.45%', dir: 'up'   },
  // 11 Sector ETFs
  { symbol: 'XLC',       label: 'Communication', category: 'Sektor', pct: '+2.15%', dir: 'up'   },
  { symbol: 'XLY',       label: 'Consumer Disc.', category: 'Sektor', pct: '+1.89%', dir: 'up'   },
  { symbol: 'XLE',       label: 'Energy',     category: 'Sektor',  pct: '-0.45%', dir: 'down' },
  { symbol: 'XLF',       label: 'Financials', category: 'Sektor',  pct: '+0.92%', dir: 'up'   },
  { symbol: 'XLV',       label: 'Healthcare', category: 'Sektor',  pct: '+1.23%', dir: 'up'   },
  { symbol: 'XLI',       label: 'Industrials', category: 'Sektor', pct: '+1.56%', dir: 'up'   },
  { symbol: 'XLRE',      label: 'Real Estate', category: 'Sektor', pct: '+0.78%', dir: 'up'   },
  { symbol: 'XLK',       label: 'Technology', category: 'Sektor',  pct: '+2.34%', dir: 'up'   },
  { symbol: 'XLP',       label: 'Cons. Staples', category: 'Sektor', pct: '+0.45%', dir: 'up'   },
  { symbol: 'XLU',       label: 'Utilities',  category: 'Sektor',  pct: '-0.23%', dir: 'down' },
]

const MOCK_MAP = Object.fromEntries(MOCK.map(m => [m.symbol, m]))

async function fetchFromYahoo(): Promise<TickerItem[] | null> {
  const symbolList = SYMBOLS.map(s => s.symbol).join(',')

  // Yahoo Finance v8 — v7'ye göre daha az rate-limit
  const urls = [
    `https://query2.finance.yahoo.com/v8/finance/chart/${SYMBOLS[0].symbol}?range=1d&interval=1d`,
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

  // Try both query1 and query2 endpoints
  for (const url of urls.slice(1)) {
    try {
      const res = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(6000),
      })

      if (!res.ok) continue

      const data = await res.json()
      const quotes: any[] = data?.quoteResponse?.result ?? []

      if (quotes.length === 0) continue

      // Başarılı — sadece gerçek veriye sahip sembolleri map'le
      const items: TickerItem[] = SYMBOLS.map(sym => {
        const q = quotes.find((r: any) => r.symbol === sym.symbol)
        const raw: number | undefined = q?.regularMarketChangePercent

        // Gerçek veri yoksa MOCK'tan al — asla rastgele sayı üretme
        if (raw === undefined || raw === null) {
          return MOCK_MAP[sym.symbol] ?? { ...sym, pct: '0.00%', dir: 'up' as const }
        }

        const pct = raw >= 0 ? `+${raw.toFixed(2)}%` : `${raw.toFixed(2)}%`
        return { ...sym, pct, dir: raw >= 0 ? 'up' : 'down' }
      })

      return items
    } catch {
      // Bu endpoint başarısız, sonrakini dene
    }
  }

  return null
}

export async function GET() {
  const items = await fetchFromYahoo()

  if (items) {
    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // Yahoo tamamen erişilemez — MOCK döndür (asla hata verme)
  return NextResponse.json(MOCK, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
