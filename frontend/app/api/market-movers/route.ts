import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface Mover {
  symbol: string
  name: string
  sector: string
  price: number
  change_pct: number
  volume: number
  market_cap: number
}

interface MoversData {
  gainers: Mover[]
  losers: Mover[]
  volume: Mover[]
  updated_at: string
}

interface MoversResponse {
  gainers: Mover[]
  losers: Mover[]
  mostActive: Mover[]
  updatedAt: string
}

const FALLBACK: MoversResponse = {
  gainers: [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', price: 167.52, change_pct: 3.2, volume: 194056113, market_cap: 4071573684224 },
    { symbol: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services', price: 525.72, change_pct: 1.8, volume: 28975085, market_cap: 1329837768704 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 356.77, change_pct: 1.5, volume: 37661564, market_cap: 2651649474560 },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', price: 274.34, change_pct: 1.2, volume: 35491598, market_cap: 3318691135488 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical', price: 199.34, change_pct: 0.9, volume: 55772474, market_cap: 2139899035648 },
  ],
  losers: [
    { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Cyclical', price: 361.83, change_pct: -3.31, volume: 60637943, market_cap: 1357742342144 },
    { symbol: 'JPM', name: 'JPMorgan Chase & Co.', sector: 'Financial Services', price: 282.84, change_pct: -3.45, volume: 6995384, market_cap: 762828619776 },
    { symbol: 'V', name: 'Visa Inc.', sector: 'Financial Services', price: 295.52, change_pct: -3.42, volume: 9970427, market_cap: 569774243840 },
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 248.8, change_pct: -2.39, volume: 46525772, market_cap: 3656844050432 },
    { symbol: 'BRK-B', name: 'Berkshire Hathaway Inc.', sector: 'Financial Services', price: 468.49, change_pct: -1.61, volume: 5330301, market_cap: 1010472452096 },
  ],
  mostActive: [
    { symbol: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', price: 167.52, change_pct: 3.2, volume: 194056113, market_cap: 4071573684224 },
    { symbol: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Cyclical', price: 361.83, change_pct: -3.31, volume: 60637943, market_cap: 1357742342144 },
    { symbol: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Cyclical', price: 199.34, change_pct: -4.18, volume: 55772474, market_cap: 2139899035648 },
    { symbol: 'AAPL', name: 'Apple Inc.', sector: 'Technology', price: 248.8, change_pct: -2.39, volume: 46525772, market_cap: 3656844050432 },
    { symbol: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', price: 356.77, change_pct: -2.76, volume: 37661564, market_cap: 2651649474560 },
  ],
  updatedAt: new Date().toISOString(),
}

export async function GET() {
  try {
    // Try to read from backend output directory
    const backendPath = path.join(process.cwd(), '..', 'backend', 'bots', 'output', 'movers_901.json')
    let data: MoversData | null = null

    if (fs.existsSync(backendPath)) {
      const fileContent = fs.readFileSync(backendPath, 'utf-8')
      data = JSON.parse(fileContent)
    }

    if (!data?.gainers || !data?.losers || !data?.volume) {
      return NextResponse.json(FALLBACK, {
        headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Take top 5 from each category
    const response: MoversResponse = {
      gainers: data.gainers.slice(0, 5),
      losers: data.losers.slice(0, 5),
      mostActive: data.volume.slice(0, 5),
      updatedAt: data.updated_at,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  } catch (error) {
    console.error('Market movers fetch error:', error)
    return NextResponse.json(FALLBACK, {
      headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
    })
  }
}
