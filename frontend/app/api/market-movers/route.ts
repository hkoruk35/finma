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

interface MoversFile {
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
    // Try multiple paths: relative to server, relative to package.json root
    const possiblePaths = [
      path.join(process.cwd(), '..', 'backend', 'bots', 'output', 'movers_901.json'),
      path.join(process.cwd(), '../../backend/bots/output/movers_901.json'),
      '/c/Users/afksm/finma/backend/bots/output/movers_901.json', // Absolute fallback
    ]

    let backendPath: string | null = null
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        backendPath = p
        break
      }
    }

    if (!backendPath) {
      return NextResponse.json(FALLBACK, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    const file: MoversFile = JSON.parse(fs.readFileSync(backendPath, 'utf-8'))

    if (!file?.gainers || !file?.losers || !file?.volume) {
      return NextResponse.json(FALLBACK, { headers: { 'Cache-Control': 'no-store' } })
    }

    // Filter true gainers (change_pct > 0) and true losers (change_pct < 0)
    const trueGainers = file.gainers.filter(m => m.change_pct > 0).slice(0, 5)
    const trueLosers = file.losers.filter(m => m.change_pct < 0).slice(0, 5)
    const mostActive = file.volume.slice(0, 5)

    // If not enough real data, return fallback
    if (!trueGainers.length || !trueLosers.length || !mostActive.length) {
      return NextResponse.json(FALLBACK, { headers: { 'Cache-Control': 'no-store' } })
    }

    const response: MoversResponse = {
      gainers: trueGainers,
      losers: trueLosers,
      mostActive,
      updatedAt: file.updated_at,
    }

    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json(FALLBACK, { headers: { 'Cache-Control': 'no-store' } })
  }
}
