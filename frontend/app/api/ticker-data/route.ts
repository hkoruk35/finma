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

// 20 sembol — DOCX v7 spesifikasyonu (% değişim ONLY, fiyat YOK)
const SYMBOLS: Array<Omit<TickerItem, 'pct' | 'dir'>> = [
  { symbol: 'BTC-USD',   label: 'BTC',      category: 'Kripto'  },
  { symbol: 'ETH-USD',   label: 'ETH',      category: 'Kripto'  },
  { symbol: 'SOL-USD',   label: 'SOL',      category: 'Kripto'  },
  { symbol: 'AVAX-USD',  label: 'AVAX',     category: 'Kripto'  },
  { symbol: 'DOGE-USD',  label: 'DOGE',     category: 'Kripto'  },
  { symbol: 'NVDA',      label: 'NVDA',     category: 'Hisse'   },
  { symbol: 'AAPL',      label: 'AAPL',     category: 'Hisse'   },
  { symbol: 'TSLA',      label: 'TSLA',     category: 'Hisse'   },
  { symbol: 'META',      label: 'META',     category: 'Hisse'   },
  { symbol: 'MSFT',      label: 'MSFT',     category: 'Hisse'   },
  { symbol: 'AMD',       label: 'AMD',      category: 'Hisse'   },
  { symbol: 'GC=F',      label: 'XAU',      category: 'Emtia'   },
  { symbol: 'SI=F',      label: 'XAG',      category: 'Emtia'   },
  { symbol: 'CL=F',      label: 'WTI',      category: 'Emtia'   },
  { symbol: 'NG=F',      label: 'NATGAS',   category: 'Emtia'   },
  { symbol: 'EURUSD=X',  label: 'EUR/USD',  category: 'Forex'   },
  { symbol: 'USDJPY=X',  label: 'USD/JPY',  category: 'Forex'   },
  { symbol: 'GBPUSD=X',  label: 'GBP/USD',  category: 'Forex'   },
  { symbol: 'USDTRY=X',  label: 'USD/TRY',  category: 'Forex'   },
  { symbol: 'ZW=F',      label: 'BUĞDAY',   category: 'Emtia'   },
]

// Fallback — sadece Yahoo erişilemediğinde
const MOCK: TickerItem[] = [
  { symbol: 'BTC-USD',   label: 'BTC',      category: 'Kripto', pct: '+2.14%', dir: 'up'   },
  { symbol: 'ETH-USD',   label: 'ETH',      category: 'Kripto', pct: '+1.87%', dir: 'up'   },
  { symbol: 'SOL-USD',   label: 'SOL',      category: 'Kripto', pct: '+3.42%', dir: 'up'   },
  { symbol: 'AVAX-USD',  label: 'AVAX',     category: 'Kripto', pct: '-0.92%', dir: 'down' },
  { symbol: 'DOGE-USD',  label: 'DOGE',     category: 'Kripto', pct: '+5.10%', dir: 'up'   },
  { symbol: 'NVDA',      label: 'NVDA',     category: 'Hisse',  pct: '+4.12%', dir: 'up'   },
  { symbol: 'AAPL',      label: 'AAPL',     category: 'Hisse',  pct: '+0.88%', dir: 'up'   },
  { symbol: 'TSLA',      label: 'TSLA',     category: 'Hisse',  pct: '-1.23%', dir: 'down' },
  { symbol: 'META',      label: 'META',     category: 'Hisse',  pct: '+3.55%', dir: 'up'   },
  { symbol: 'MSFT',      label: 'MSFT',     category: 'Hisse',  pct: '+1.88%', dir: 'up'   },
  { symbol: 'AMD',       label: 'AMD',      category: 'Hisse',  pct: '+1.44%', dir: 'up'   },
  { symbol: 'GC=F',      label: 'XAU',      category: 'Emtia',  pct: '+0.87%', dir: 'up'   },
  { symbol: 'SI=F',      label: 'XAG',      category: 'Emtia',  pct: '+0.54%', dir: 'up'   },
  { symbol: 'CL=F',      label: 'WTI',      category: 'Emtia',  pct: '-1.20%', dir: 'down' },
  { symbol: 'NG=F',      label: 'NATGAS',   category: 'Emtia',  pct: '+0.33%', dir: 'up'   },
  { symbol: 'EURUSD=X',  label: 'EUR/USD',  category: 'Forex',  pct: '+0.12%', dir: 'up'   },
  { symbol: 'USDJPY=X',  label: 'USD/JPY',  category: 'Forex',  pct: '-0.31%', dir: 'down' },
  { symbol: 'GBPUSD=X',  label: 'GBP/USD',  category: 'Forex',  pct: '+0.09%', dir: 'up'   },
  { symbol: 'USDTRY=X',  label: 'USD/TRY',  category: 'Forex',  pct: '+0.44%', dir: 'up'   },
  { symbol: 'ZW=F',      label: 'BUĞDAY',   category: 'Emtia',  pct: '-0.68%', dir: 'down' },
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
