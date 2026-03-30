import { NextResponse } from 'next/server'

export const revalidate = 3600 // 1 hour ISR cache

export interface MarketPulseResponse {
  ai_summary: string
  market_date: string
  timestamp: string
  sentiment?: 'bullish' | 'neutral' | 'bearish'
}

const FALLBACK_SUMMARIES = [
  {
    ai_summary:
      'S&P 500 bugün teknoloji sektörünün güçlü performansı ile yükselişe geçti. Yapay zeka ve bulut hizmetlerine olan kurumsal talep kazançları tetikledi. Enerji sektöründe ise hafif baskı görülürken, finansal hisse senetleri dengeli bir seyir izledi.',
    sentiment: 'bullish' as const,
  },
  {
    ai_summary:
      'Pazarlar bugün karışık sinyaller verdi. Makroekonomik veriler karşılaştırmalı sonuçlar gösterirken, Federal Reserve kararlarına ilişkin beklentiler fiyatlandırmayı etkiliyor. Yatırımcılar riski yönetmek amacıyla pozisyon ayarlamaları yapıyor.',
    sentiment: 'neutral' as const,
  },
  {
    ai_summary:
      'Korku göstergesi (VIX) yükselişe geçtiğinde, değerli hisse senetleri satış baskısı altında. Ekonomik büyüme beklentileri yumuşadığında, büyüme hisse senetleri geriliyor. Fed politikasının sıkı kalacağına dair endişeler yatırım stratejilerini şekillendiriyor.',
    sentiment: 'bearish' as const,
  },
]

async function fetchMarketPulse(): Promise<MarketPulseResponse | null> {
  try {
    // Try to read from backend's market_pulse.json file
    const paths = [
      '/c/Users/afksm/finma/backend/bots/output/market_pulse.json',
      process.cwd() + '/../../backend/bots/output/market_pulse.json',
      process.cwd() + '/../../../backend/bots/output/market_pulse.json',
    ]

    let data = null
    for (const filePath of paths) {
      try {
        const fs = await import('fs/promises')
        const content = await fs.readFile(filePath, 'utf-8')
        const parsed = JSON.parse(content)

        if (parsed?.ai_summary) {
          data = parsed
          break
        }
      } catch {
        // Try next path
        continue
      }
    }

    if (!data) return null

    const response: MarketPulseResponse = {
      ai_summary: data.ai_summary,
      market_date: data.market_date || new Date().toISOString().split('T')[0],
      timestamp: data.timestamp || new Date().toISOString(),
      sentiment: data.sentiment,
    }

    return response
  } catch {
    return null
  }
}

export async function GET() {
  const data = await fetchMarketPulse()

  if (data) {
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  // Use random fallback to vary the content
  const fallback = FALLBACK_SUMMARIES[Math.floor(Math.random() * FALLBACK_SUMMARIES.length)]

  return NextResponse.json(
    {
      ai_summary: fallback.ai_summary,
      market_date: new Date().toISOString().split('T')[0],
      timestamp: new Date().toISOString(),
      sentiment: fallback.sentiment,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Access-Control-Allow-Origin': '*',
      },
    }
  )
}
