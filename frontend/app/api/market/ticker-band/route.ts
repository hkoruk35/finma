import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1 hour ISR cache

export interface TickerItem {
  symbol: string
  label?: string
  price?: number
  pct: number // +3.2 veya -1.5
  dir: 'up' | 'down'
  category?: string
}

export interface TickerBandResponse {
  ticker_band: TickerItem[]
  market_date: string
  timestamp: string
}

// 5 indices + 11 ETFs (16 total)
const SYMBOLS = [
  // Indices
  { symbol: 'SPX', label: 'S&P 500' },
  { symbol: 'DJI', label: 'DOW' },
  { symbol: 'IXIC', label: 'NASDAQ' },
  { symbol: 'VIX', label: 'VIX' },
  { symbol: 'RUT', label: 'Russell 2K' },
  // ETFs
  { symbol: 'XLC', label: 'Communication' },
  { symbol: 'XLY', label: 'Consumer Discr.' },
  { symbol: 'XLE', label: 'Energy' },
  { symbol: 'XLF', label: 'Financials' },
  { symbol: 'XLV', label: 'Healthcare' },
  { symbol: 'XLI', label: 'Industrials' },
  { symbol: 'XLRE', label: 'Real Estate' },
  { symbol: 'XLK', label: 'Technology' },
  { symbol: 'XLP', label: 'Consumer Staples' },
  { symbol: 'XLU', label: 'Utilities' },
]

const FALLBACK: TickerBandResponse = {
  ticker_band: [
    { symbol: 'SPX', label: 'S&P 500', pct: 1.24, dir: 'up', category: 'Indices' },
    { symbol: 'DJI', label: 'DOW', pct: 0.87, dir: 'up', category: 'Indices' },
    { symbol: 'IXIC', label: 'NASDAQ', pct: 2.18, dir: 'up', category: 'Indices' },
    { symbol: 'VIX', label: 'VIX', pct: -5.32, dir: 'down', category: 'Indices' },
    { symbol: 'RUT', label: 'Russell 2K', pct: 1.45, dir: 'up', category: 'Indices' },
    { symbol: 'XLC', label: 'Communication', pct: 2.15, dir: 'up', category: 'ETF' },
    { symbol: 'XLY', label: 'Consumer Discr.', pct: 1.89, dir: 'up', category: 'ETF' },
    { symbol: 'XLE', label: 'Energy', pct: -0.45, dir: 'down', category: 'ETF' },
    { symbol: 'XLF', label: 'Financials', pct: 0.92, dir: 'up', category: 'ETF' },
    { symbol: 'XLV', label: 'Healthcare', pct: 1.23, dir: 'up', category: 'ETF' },
    { symbol: 'XLI', label: 'Industrials', pct: 1.56, dir: 'up', category: 'ETF' },
    { symbol: 'XLRE', label: 'Real Estate', pct: 0.78, dir: 'up', category: 'ETF' },
    { symbol: 'XLK', label: 'Technology', pct: 2.34, dir: 'up', category: 'ETF' },
    { symbol: 'XLP', label: 'Consumer Staples', pct: 0.45, dir: 'up', category: 'ETF' },
    { symbol: 'XLU', label: 'Utilities', pct: -0.23, dir: 'down', category: 'ETF' },
  ],
  market_date: new Date().toISOString().split('T')[0],
  timestamp: new Date().toISOString(),
}

async function fetchTickerBandData(): Promise<TickerBandResponse | null> {
  try {
    // Try to read from backend's ticker_band.json file
    const paths = [
      '/c/Users/afksm/finma/backend/bots/output/ticker_band.json',
      process.cwd() + '/../../backend/bots/output/ticker_band.json',
      process.cwd() + '/../../../backend/bots/output/ticker_band.json',
    ]

    let data = null
    for (const filePath of paths) {
      try {
        const fs = await import('fs/promises')
        const content = await fs.readFile(filePath, 'utf-8')
        const parsed = JSON.parse(content)

        if (parsed?.ticker_band && Array.isArray(parsed.ticker_band)) {
          data = parsed
          break
        }
      } catch {
        // Try next path
        continue
      }
    }

    if (!data) return null

    // Transform backend data to match our interface
    const response: TickerBandResponse = {
      ticker_band: data.ticker_band.map((item: any) => ({
        symbol: item.symbol,
        label: item.label,
        price: item.price,
        pct: typeof item.pct === 'string' ? parseFloat(item.pct) : item.pct,
        dir: item.pct >= 0 ? 'up' : 'down',
        category: item.category,
      })),
      market_date: data.market_date || new Date().toISOString().split('T')[0],
      timestamp: data.timestamp || new Date().toISOString(),
    }

    return response
  } catch {
    return null
  }
}

export async function GET() {
  const data = await fetchTickerBandData()

  if (data) {
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  return NextResponse.json(FALLBACK, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
