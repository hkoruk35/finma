import { NextResponse, NextRequest } from 'next/server'

export const revalidate = 3600 // 1 hour ISR cache

export interface Top5Item {
  rank: number
  ticker: string
  company: string
  sector: string
  price: number
  change_pct: number
  score: number // 0-100
  ai_reason?: string // AI analysis
}

export interface Top5Response {
  picks: Top5Item[]
  market_date: string
  timestamp: string
  type: 'today' | 'yesterday' // Specify which list type
}

// Today's picks - SAME 5 stocks, but analysis changes hourly (9:00-17:00 ET)
// Analysis rotates every hour based on current time
const getTodaysAnalysis = () => {
  const now = new Date()
  // Get ET hour (approximation - in production use proper timezone conversion)
  const etHour = now.getUTCHours() - 5 // Rough ET calculation

  // Array of analyses for each hour (9-17)
  const analyses = [
    [
      "Yapay zeka çipleri güçlü kurumsal talep görüyor. Yapay zeka veri merkezi harcamaları hızlanıyor.",
      "Tesla üretim kapasitesi tüm beklentileri aşıyor. Elektrikli araç pazarı ivme kazanıyor.",
      "Microsoft bulut büyümesi kuvvetli. Kurumsal yazılım harcamaları artıyor.",
      "Apple ürün döngüsü ivme kazanıyor. Hizmetler geliri güçlü.",
      "Meta reklam platformu iyileşiyor. Yapay zeka reklam hedeflemesi etkili.",
    ],
    [
      "Blackwell GPU talep tüm kapasiteyi tükeniyor. Veri merkezi kurumsal faturalandırma hızlanıyor.",
      "Tesla yeni fabrikalar ile üretim hedeflerini tutturmuştur. Fiyatlandırma stratejisi etkili.",
      "Azure büyümesi beklentileri geçiyor. Kurumsal dijitalleşme hızlanıyor.",
      "iPhone 16 satış döngüsü güçlü. Kurumsal satın alma hızlanıyor.",
      "Instagram reklamcılığı iyileşiyor. Mağaza özelliği satış destekliyor.",
    ],
    [
      "Veri merkezi talep ağlığında Nvidia kârlılık artışı. Makine öğrenmesi altyapısı talep güçlü.",
      "Tesla marjları baskı altında değil. Maliyet kontrol başarılı.",
      "Office 365 abonelik sayısı artıyor. Kurumsal müşteri değeri yüksek.",
      "iPhone servisler geliri dayanıklı. Abonelik geliri büyüyor.",
      "Reels monetization hızlanıyor. Kurumsal reklam harcamaları artıyor.",
    ],
    [
      "Çip üreticilerinin sipariş defterleri dolmuş. Yapay zeka devletleri talep artırıyor.",
      "Tesla kâr marjları stabilleşiyor. Elektrikli araç penetrasyonu artıyor.",
      "Dynamics365 satışı güçlü. Kurumsal yazılım talebi süregelen.",
      "Wearable ürün kategorisi büyüyor. Ekosistem değeri artıyor.",
      "Advertiser bütçesi meta platformuna akıyor. Reklamcı memnuniyeti yüksek.",
    ],
  ]

  // Clamp hour to 0-3 (4 analysis slots for 9-17 range)
  const analysisIndex = Math.min(Math.floor(etHour / 2), 3)
  const index = Math.max(0, analysisIndex)

  return analyses[index]
}

const FALLBACK_TODAY: Top5Response = {
  type: 'today',
  picks: [
    {
      rank: 1,
      ticker: 'NVDA',
      company: 'NVIDIA Corporation',
      sector: 'Technology',
      price: 892.45,
      change_pct: 8.32,
      score: 96,
      ai_reason: getTodaysAnalysis()[0],
    },
    {
      rank: 2,
      ticker: 'TSLA',
      company: 'Tesla Inc.',
      sector: 'Technology',
      price: 187.23,
      change_pct: 5.67,
      score: 88,
      ai_reason: getTodaysAnalysis()[1],
    },
    {
      rank: 3,
      ticker: 'MSFT',
      company: 'Microsoft Corporation',
      sector: 'Technology',
      price: 432.18,
      change_pct: 4.23,
      score: 85,
      ai_reason: getTodaysAnalysis()[2],
    },
    {
      rank: 4,
      ticker: 'AAPL',
      company: 'Apple Inc.',
      sector: 'Technology',
      price: 156.89,
      change_pct: 3.45,
      score: 78,
      ai_reason: getTodaysAnalysis()[3],
    },
    {
      rank: 5,
      ticker: 'META',
      company: 'Meta Platforms Inc.',
      sector: 'Technology',
      price: 312.56,
      change_pct: 6.78,
      score: 82,
      ai_reason: getTodaysAnalysis()[4],
    },
  ],
  market_date: new Date().toISOString().split('T')[0],
  timestamp: new Date().toISOString(),
}

// Yesterday's picks - Different stocks selected based on previous day performance
const FALLBACK_YESTERDAY: Top5Response = {
  type: 'yesterday',
  picks: [
    {
      rank: 1,
      ticker: 'AVGO',
      company: 'Broadcom Inc.',
      sector: 'Technology',
      price: 645.32,
      change_pct: 4.56,
      score: 92,
      ai_reason: "Yapay zeka çipleri için önemli bileşen tedarikçisi. Yapay zeka altyapı talep artıyor.",
    },
    {
      rank: 2,
      ticker: "QCOM",
      company: "Qualcomm Inc.",
      sector: "Technology",
      price: 198.45,
      change_pct: 3.87,
      score: 84,
      ai_reason: "Yapay zeka mobil işlemciler için yeni pazar açılıyor. Mobil çip talep artıyor.",
    },
    {
      rank: 3,
      ticker: "AMD",
      company: "Advanced Micro Devices",
      sector: "Technology",
      price: 234.67,
      change_pct: 5.23,
      score: 87,
      ai_reason: "Yapay zeka GPUları veri merkezleri için talep görmüyor. GPU performansı önem kazanıyor.",
    },
    {
      rank: 4,
      ticker: "ADBE",
      company: "Adobe Inc.",
      sector: "Technology",
      price: 567.89,
      change_pct: 2.34,
      score: 81,
      ai_reason: "Kurumsal yazılım lisanslama kuvvetli. Abonelik modeli verimli çalışıyor.",
    },
    {
      rank: 5,
      ticker: "SNOW",
      company: "Snowflake Inc.",
      sector: "Technology",
      price: 134.56,
      change_pct: 6.12,
      score: 83,
      ai_reason: "Veri analitik platformu yapay zeka iş yükleri için talep görüyor. Bulut analitik büyüyor.",
    },
  ],
  market_date: new Date(new Date().getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  timestamp: new Date().toISOString(),
}

async function fetchTop5Data(type: 'today' | 'yesterday'): Promise<Top5Response | null> {
  try {
    // For today's picks, try to read from backend's top5_today.json
    // For yesterday's picks, try to read from backend's top5_yesterday.json
    const fileName = type === 'today' ? 'top5_today.json' : 'top5_yesterday.json'
    const paths = [
      `/c/Users/afksm/finma/backend/bots/output/${fileName}`,
      process.cwd() + `/../../backend/bots/output/${fileName}`,
      process.cwd() + `/../../../backend/bots/output/${fileName}`,
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

    // For today's picks, apply hourly analysis rotation
    if (type === 'today') {
      const analyses = getTodaysAnalysis()
      data.picks = data.picks.map((item: any, idx: number) => ({
        rank: item.rank,
        ticker: item.ticker,
        company: item.company,
        sector: item.sector,
        price: item.price,
        change_pct: typeof item.change_pct === 'string' ? parseFloat(item.change_pct) : item.change_pct,
        score: item.score || 75,
        ai_reason: analyses[idx] || item.ai_reason,
      }))
    } else {
      // For yesterday's picks, keep static analysis
      data.picks = data.picks.map((item: any) => ({
        rank: item.rank,
        ticker: item.ticker,
        company: item.company,
        sector: item.sector,
        price: item.price,
        change_pct: typeof item.change_pct === 'string' ? parseFloat(item.change_pct) : item.change_pct,
        score: item.score || 75,
        ai_reason: item.ai_reason,
      }))
    }

    const response: Top5Response = {
      type,
      picks: data.picks,
      market_date: data.market_date || new Date().toISOString().split('T')[0],
      timestamp: data.timestamp || new Date().toISOString(),
    }

    return response
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const type = (searchParams.get('type') as 'today' | 'yesterday') || 'today'

  const data = await fetchTop5Data(type)

  // Determine which fallback to use
  const fallback = type === 'yesterday' ? FALLBACK_YESTERDAY : FALLBACK_TODAY

  if (data) {
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }

  return NextResponse.json(fallback, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
