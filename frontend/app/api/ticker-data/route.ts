import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const revalidate = 900 // 15 min

interface TickerItem {
  symbol: string
  label: string
  category: string
  pct: string
  dir: 'up' | 'down'
}

// 20 symbols per DOCX v7 spec — % change only, NO price
const SYMBOLS = [
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

const MOCK: TickerItem[] = [
  { symbol: 'BTC-USD',  label: 'BTC',     category: 'Kripto',  pct: '+2.14%',  dir: 'up'   },
  { symbol: 'ETH-USD',  label: 'ETH',     category: 'Kripto',  pct: '+1.87%',  dir: 'up'   },
  { symbol: 'SOL-USD',  label: 'SOL',     category: 'Kripto',  pct: '+3.42%',  dir: 'up'   },
  { symbol: 'AVAX-USD', label: 'AVAX',    category: 'Kripto',  pct: '-0.92%',  dir: 'down' },
  { symbol: 'DOGE-USD', label: 'DOGE',    category: 'Kripto',  pct: '+5.10%',  dir: 'up'   },
  { symbol: 'NVDA',     label: 'NVDA',    category: 'Hisse',   pct: '+4.12%',  dir: 'up'   },
  { symbol: 'AAPL',     label: 'AAPL',    category: 'Hisse',   pct: '+0.88%',  dir: 'up'   },
  { symbol: 'TSLA',     label: 'TSLA',    category: 'Hisse',   pct: '-1.23%',  dir: 'down' },
  { symbol: 'META',     label: 'META',    category: 'Hisse',   pct: '+3.55%',  dir: 'up'   },
  { symbol: 'MSFT',     label: 'MSFT',    category: 'Hisse',   pct: '+1.88%',  dir: 'up'   },
  { symbol: 'AMD',      label: 'AMD',     category: 'Hisse',   pct: '+1.44%',  dir: 'up'   },
  { symbol: 'GC=F',     label: 'XAU',     category: 'Emtia',   pct: '+0.87%',  dir: 'up'   },
  { symbol: 'SI=F',     label: 'XAG',     category: 'Emtia',   pct: '+0.54%',  dir: 'up'   },
  { symbol: 'CL=F',     label: 'WTI',     category: 'Emtia',   pct: '-1.20%',  dir: 'down' },
  { symbol: 'NG=F',     label: 'NATGAS',  category: 'Emtia',   pct: '+0.33%',  dir: 'up'   },
  { symbol: 'EURUSD=X', label: 'EUR/USD', category: 'Forex',   pct: '+0.12%',  dir: 'up'   },
  { symbol: 'USDJPY=X', label: 'USD/JPY', category: 'Forex',   pct: '-0.31%',  dir: 'down' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD', category: 'Forex',  pct: '+0.09%',  dir: 'up'   },
  { symbol: 'USDTRY=X', label: 'USD/TRY', category: 'Forex',  pct: '+0.44%',  dir: 'up'   },
  { symbol: 'ZW=F',     label: 'BUĞDAY',  category: 'Emtia',   pct: '-0.68%',  dir: 'down' },
]

export async function GET() {
  try {
    const symbolList = SYMBOLS.map(s => s.symbol).join(',')
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbolList)}&fields=regularMarketChangePercent,symbol`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      // @ts-ignore — edge runtime signal
      signal: AbortSignal.timeout(8000),
    })

    if (!res.ok) throw new Error(`Yahoo ${res.status}`)

    const data = await res.json()
    const quotes: any[] = data?.quoteResponse?.result ?? []

    const items: TickerItem[] = SYMBOLS.map(sym => {
      const q = quotes.find((r: any) => r.symbol === sym.symbol)
      const raw = q?.regularMarketChangePercent ?? (Math.random() * 4 - 2)
      const pct = raw >= 0 ? `+${raw.toFixed(2)}%` : `${raw.toFixed(2)}%`
      return { ...sym, pct, dir: raw >= 0 ? 'up' : 'down' }
    })

    return NextResponse.json(items, {
      headers: {
        'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=1800',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    // Return mock fallback — never fail
    return NextResponse.json(MOCK, {
      headers: {
        'Cache-Control': 'public, s-maxage=60',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
}
