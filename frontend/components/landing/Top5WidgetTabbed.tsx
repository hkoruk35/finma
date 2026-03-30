'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Top5Item, Top5Response } from '@/app/api/market/top5/route'

interface Top5WidgetTabbedProps {
  className?: string
}

type TabType = 'top5' | 'gainers' | 'losers' | 'mosttraded'

// Base fallback data for today's top5
const FALLBACK_TOP5: Top5Item[] = [
  {
    rank: 1,
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    sector: 'Technology',
    price: 892.45,
    change_pct: 8.32,
    score: 96,
    ai_reason: 'Yapay zeka çipleri güçlü kurumsal talep görüyor.',
  },
  {
    rank: 2,
    ticker: 'TSLA',
    company: 'Tesla Inc.',
    sector: 'Technology',
    price: 187.23,
    change_pct: 5.67,
    score: 88,
    ai_reason: 'Tesla üretim kapasitesi tüm beklentileri aşıyor.',
  },
  {
    rank: 3,
    ticker: 'MSFT',
    company: 'Microsoft Corporation',
    sector: 'Technology',
    price: 432.18,
    change_pct: 4.23,
    score: 85,
    ai_reason: 'Microsoft bulut büyümesi kuvvetli.',
  },
  {
    rank: 4,
    ticker: 'AAPL',
    company: 'Apple Inc.',
    sector: 'Technology',
    price: 156.89,
    change_pct: 3.45,
    score: 78,
    ai_reason: 'Apple ürün döngüsü ivme kazanıyor.',
  },
  {
    rank: 5,
    ticker: 'META',
    company: 'Meta Platforms Inc.',
    sector: 'Technology',
    price: 312.56,
    change_pct: 6.78,
    score: 82,
    ai_reason: 'Meta reklam platformu iyileşiyor.',
  },
]

const FALLBACK_GAINERS: Top5Item[] = [
  { ...FALLBACK_TOP5[0], ai_reason: 'Yapay zeka talep döngüsü hızlanıyor ve marjlar iyileşiyor.' },
  { ...FALLBACK_TOP5[1], ai_reason: 'Enerji verimliliği yatırımları uzun vadeli alıcılar çekiyor.' },
  { ...FALLBACK_TOP5[2], ai_reason: 'Bulut altyapısı yatırımları kupon tarafından destekleniyor.' },
  {
    rank: 4,
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    sector: 'Technology',
    price: 892.45,
    change_pct: 8.32,
    score: 95,
    ai_reason: 'GPU kaynak kıtlığı fiyat gücünü artırıyor.',
  },
  {
    rank: 5,
    ticker: 'GOOGL',
    company: 'Alphabet Inc.',
    sector: 'Technology',
    price: 178.90,
    change_pct: 4.56,
    score: 87,
    ai_reason: 'Yapay zeka araştırması yeni ürün kanalları açıyor.',
  },
]

const FALLBACK_LOSERS: Top5Item[] = [
  {
    rank: 1,
    ticker: 'GS',
    company: 'Goldman Sachs',
    sector: 'Finance',
    price: 421.23,
    change_pct: -3.45,
    score: 45,
    ai_reason: 'Faiz oranları harcama baskısı oluşturuyor.',
  },
  {
    rank: 2,
    ticker: 'PG',
    company: 'Procter & Gamble',
    sector: 'Consumer',
    price: 168.34,
    change_pct: -2.11,
    score: 52,
    ai_reason: 'Tüketici harcamaları yavaşladığını düşüren yorumlar var.',
  },
  {
    rank: 3,
    ticker: 'XOM',
    company: 'Exxon Mobil',
    sector: 'Energy',
    price: 113.45,
    change_pct: -2.67,
    score: 48,
    ai_reason: 'Petrol fiyatları gerileme OPEC+ beklentileri üzerine.',
  },
  {
    rank: 4,
    ticker: 'JPM',
    company: 'JPMorgan Chase',
    sector: 'Finance',
    price: 195.67,
    change_pct: -1.89,
    score: 55,
    ai_reason: 'Resessyon endişeleri finansal hisse senetlerini baskılıyor.',
  },
  {
    rank: 5,
    ticker: 'BAC',
    company: 'Bank of America',
    sector: 'Finance',
    price: 45.23,
    change_pct: -1.56,
    score: 58,
    ai_reason: 'Faiz marjı sıkışması banka karlılığını tehdit ediyor.',
  },
]

const FALLBACK_MOSTTRADED: Top5Item[] = [
  { ...FALLBACK_TOP5[0], ai_reason: 'Kurumsal alım hacmi rekor seviyelerde tetiklendi.' },
  {
    rank: 2,
    ticker: 'SPY',
    company: 'SPDR S&P 500',
    sector: 'Fonds',
    price: 589.23,
    change_pct: 1.24,
    score: 89,
    ai_reason: 'ETF akışları endeks ağırlıklı hisse senetlerine yönlendirildi.',
  },
  {
    rank: 3,
    ticker: 'QQQ',
    company: 'Invesco QQQ',
    sector: 'Fonds',
    price: 421.56,
    change_pct: 2.18,
    score: 91,
    ai_reason: 'NASDAQ ETF hacmi teknoloji seçimi güçlendiyor.',
  },
  { ...FALLBACK_TOP5[1], ai_reason: 'Opsiyonlar tarafından yönlendirilen hacim pozisyon alımı gösteriyor.' },
  { ...FALLBACK_TOP5[2], ai_reason: 'Kurumsal yeniden dengeleme MSFT tercihini artırıyor.' },
]

function StockRow({
  item,
  rank,
}: {
  item: Top5Item
  rank: number
}) {
  const isPositive = item.change_pct >= 0

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4 mb-3 transition-all">
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-lg font-bold text-blue-500 w-6">#{rank}</div>
          <div>
            <div className="font-semibold text-white">{item.ticker}</div>
            <div className="text-xs text-gray-500">{item.company}</div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={`font-bold text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{item.change_pct.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">${item.price.toFixed(2)}</div>
        </div>
      </div>

      {/* AI Commentary */}
      <div className="mt-3 pl-9">
        <p className="text-xs text-gray-400 italic">{item.ai_reason}</p>
      </div>

      {/* Score */}
      <div className="mt-2 pt-2 border-t border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">AI Skoru:</span>
          <div className="flex-1 bg-gray-800 rounded-full h-1.5 max-w-xs">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${item.score}%` }}
            />
          </div>
          <span className="text-xs font-semibold text-gray-400">{item.score}</span>
        </div>
      </div>
    </div>
  )
}

export function Top5WidgetTabbed({ className = '' }: Top5WidgetTabbedProps) {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<TabType>('top5')
  const [items, setItems] = useState<Record<TabType, Top5Item[]>>({
    top5: FALLBACK_TOP5,
    gainers: FALLBACK_GAINERS,
    losers: FALLBACK_LOSERS,
    mosttraded: FALLBACK_MOSTTRADED,
  })
  const [isLoading, setIsLoading] = useState(true)

  // Determine user tier
  const isProUser = !!(user && (user.subscription_tier === 'pro' || user.subscription_tier === 'pro+' || user.role === 'admin'))
  const isAuthenticated = !!user

  // Determine which list to show based on tier
  const showTodayList = isProUser && isAuthenticated
  const topTabLabel = showTodayList ? "Günün Top 5 AI Hissesi" : "Dünün Top 5 AI Hissesi"

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch today's and yesterday's picks
        const todayRes = await fetch('/api/market/top5?type=today', { cache: 'no-store' })
        const yesterdayRes = await fetch('/api/market/top5?type=yesterday', { cache: 'no-store' })

        if (todayRes.ok) {
          const data: Top5Response = await todayRes.json()
          if (data?.picks && Array.isArray(data.picks)) {
            // Update top5 with today's or yesterday's data based on tier
            setItems(prev => ({
              ...prev,
              top5: showTodayList ? data.picks : prev.top5,
            }))
          }
        }

        if (yesterdayRes.ok && !showTodayList) {
          const data: Top5Response = await yesterdayRes.json()
          if (data?.picks && Array.isArray(data.picks)) {
            setItems(prev => ({
              ...prev,
              top5: data.picks,
            }))
          }
        }
      } catch (err) {
        console.error('Failed to fetch top5 data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    // Fetch data every hour
    const interval = setInterval(fetchData, 3600 * 1000)
    return () => clearInterval(interval)
  }, [showTodayList])

  const currentItems = items[activeTab]

  // Build tabs - first tab changes based on user tier
  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'top5', label: topTabLabel, icon: '⭐' },
    { id: 'gainers', label: 'Yükselenler', icon: '📈' },
    { id: 'losers', label: 'Düşenler', icon: '📉' },
    { id: 'mosttraded', label: 'En Çok İşlem Görenler', icon: '💹' },
  ]

  if (isLoading && !currentItems.length) {
    return (
      <div className={`w-full ${className}`}>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Tabs */}
      <div className="mb-6 flex gap-2 border-b border-gray-800 overflow-x-auto pb-0 scrollbar-hide">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm whitespace-nowrap transition-all border-b-2 ${
              activeTab === tab.id
                ? 'border-blue-500 text-white'
                : 'border-transparent text-gray-400 hover:text-gray-300'
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - 5 stocks (fully visible for all users) */}
        <div className="lg:col-span-2">
          {currentItems.slice(0, 5).map((item, idx) => (
            <StockRow
              key={item.ticker}
              item={item}
              rank={idx + 1}
            />
          ))}
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-4">
          {/* Market Summary */}
          <div className="rounded-lg border border-gray-700 bg-gray-900/30 p-4">
            <h3 className="text-sm font-semibold text-white mb-4">Piyasa Özeti</h3>

            {/* Average Change */}
            <div className="mb-4">
              <div className="text-xs text-gray-600 mb-1">Ortalama Değişim</div>
              <div className="text-lg font-bold text-green-500">
                {(currentItems.slice(0, 5).reduce((sum, item) => sum + item.change_pct, 0) / 5).toFixed(2)}%
              </div>
            </div>

            {/* Sector Distribution */}
            <div className="mb-4">
              <div className="text-xs text-gray-600 mb-2">Sektör Dağılımı</div>
              {Array.from(new Set(currentItems.slice(0, 5).map(item => item.sector))).map((sector) => {
                const count = currentItems.slice(0, 5).filter(item => item.sector === sector).length
                return (
                  <div key={sector} className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{sector}</span>
                    <span className="text-gray-300">{count}/5</span>
                  </div>
                )
              })}
            </div>

            {/* Average Score */}
            <div>
              <div className="text-xs text-gray-600 mb-1">Ortalama Skor</div>
              <div className="text-lg font-bold text-blue-400">
                {Math.round(currentItems.slice(0, 5).reduce((sum, item) => sum + item.score, 0) / 5)}
              </div>
            </div>
          </div>

          {/* Info Box - Tier specific */}
          {activeTab === 'top5' && (
            <>
              {showTodayList && (
                <div className="rounded-lg border border-blue-900/40 bg-blue-900/10 p-3">
                  <p className="text-xs text-gray-400">
                    ⚡ Günün Top 5 listesi pazar açılışında (9:00 ET) oluşturulur ve saatlik olarak analiz güncellenir.
                  </p>
                </div>
              )}

              {!showTodayList && isAuthenticated && (
                <div className="rounded-lg border border-blue-900/40 bg-blue-900/10 p-3">
                  <p className="text-xs text-gray-400">
                    📅 Dünün Top 5 listesi önceki pazar gününün kapanışında seçilmiş hisselerdir.
                  </p>
                </div>
              )}

              {!isAuthenticated && (
                <div className="rounded-lg border border-blue-900/40 bg-blue-900/10 p-3">
                  <p className="text-xs text-gray-400">
                    🔐 PRO üyelik ile Günün Top 5 AI Hissesi'ni saatlik güncellenen analizleriyle görebilirsiniz.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
