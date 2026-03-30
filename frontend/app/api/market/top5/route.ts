import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1 hour ISR cache

export interface Top5Item {
  rank: number
  ticker: string
  company: string
  sector: string
  price: number
  change_pct: number
  score: number // 0-100
  ai_reason?: string // PRO-only insight
}

export interface Top5Response {
  picks: Top5Item[]
  market_date: string
  timestamp: string
}

const FALLBACK: Top5Response = {
  picks: [
    {
      rank: 1,
      ticker: 'NVDA',
      company: 'NVIDIA Corporation',
      sector: 'Technology',
      price: 892.45,
      change_pct: 8.32,
      score: 96,
      ai_reason:
        'Blackwell GPU talebindeki artış kurumsal alımları tetikledi. Q1 earnings guidance beklentileri aştı.',
    },
    {
      rank: 2,
      ticker: 'TSLA',
      company: 'Tesla Inc.',
      sector: 'Technology',
      price: 187.23,
      change_pct: 5.67,
      score: 88,
      ai_reason:
        'Elektrikli araç satışlarındaki büyüme ivme kazanıyor. Giga Berlin kapasitesi beklentileri aşıyor.',
    },
    {
      rank: 3,
      ticker: 'MSFT',
      company: 'Microsoft Corporation',
      sector: 'Technology',
      price: 432.18,
      change_pct: 4.23,
      score: 85,
      ai_reason:
        'OpenAI partnership yeni gelir akışları yaratıyor. Cloud growth accelerating.',
    },
    {
      rank: 4,
      ticker: 'AAPL',
      company: 'Apple Inc.',
      sector: 'Technology',
      price: 156.89,
      change_pct: 3.45,
      score: 78,
      ai_reason:
        'iPhone 16 pre-orders beklentileri aştı. Services revenue kesintisiz büyüyor.',
    },
    {
      rank: 5,
      ticker: 'META',
      company: 'Meta Platforms Inc.',
      sector: 'Technology',
      price: 312.56,
      change_pct: 6.78,
      score: 82,
      ai_reason:
        'AI advertising tools marketer engagement artırıyor. Reels monetization hızlanıyor.',
    },
  ],
  market_date: new Date().toISOString().split('T')[0],
  timestamp: new Date().toISOString(),
}

async function fetchTop5Data(): Promise<Top5Response | null> {
  try {
    // Try to read from backend's top5_today.json file
    const paths = [
      '/c/Users/afksm/finma/backend/bots/output/top5_today.json',
      process.cwd() + '/../../backend/bots/output/top5_today.json',
      process.cwd() + '/../../../backend/bots/output/top5_today.json',
    ]

    let data = null
    for (const filePath of paths) {
      try {
        const fs = await import('fs/promises')
        const content = await fs.readFile(filePath, 'utf-8')
        const parsed = JSON.parse(content)

        if (parsed?.picks && Array.isArray(parsed.picks)) {
          data = parsed
          break
        }
      } catch {
        // Try next path
        continue
      }
    }

    if (!data) return null

    const response: Top5Response = {
      picks: data.picks.map((item: any) => ({
        rank: item.rank,
        ticker: item.ticker,
        company: item.company,
        sector: item.sector,
        price: item.price,
        change_pct: typeof item.change_pct === 'string' ? parseFloat(item.change_pct) : item.change_pct,
        score: item.score || 75,
        ai_reason: item.ai_reason,
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
  const data = await fetchTop5Data()

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
