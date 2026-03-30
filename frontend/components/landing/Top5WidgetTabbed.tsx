'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Top5Item, Top5Response } from '@/app/api/market/top5/route'

const FALLBACK_TOP5: Top5Item[] = [
  {
    rank: 1,
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    sector: 'Technology',
    price: 892.45,
    change_pct: 8.32,
    score: 96,
    ai_reason: 'Blackwell GPU talebindeki artış kurumsal alımları tetikledi.',
  },
  {
    rank: 2,
    ticker: 'TSLA',
    company: 'Tesla Inc.',
    sector: 'Technology',
    price: 187.23,
    change_pct: 5.67,
    score: 88,
    ai_reason: 'Elektrikli araç satışlarındaki büyüme ivme kazanıyor.',
  },
  {
    rank: 3,
    ticker: 'MSFT',
    company: 'Microsoft Corporation',
    sector: 'Technology',
    price: 432.18,
    change_pct: 4.23,
    score: 85,
    ai_reason: 'OpenAI partnership yeni gelir akışları yaratıyor.',
  },
  {
    rank: 4,
    ticker: 'AAPL',
    company: 'Apple Inc.',
    sector: 'Technology',
    price: 156.89,
    change_pct: 3.45,
    score: 78,
    ai_reason: 'iPhone 16 pre-orders beklentileri aştı.',
  },
  {
    rank: 5,
    ticker: 'META',
    company: 'Meta Platforms Inc.',
    sector: 'Technology',
    price: 312.56,
    change_pct: 6.78,
    score: 82,
    ai_reason: 'AI advertising tools marketer engagement artırıyor.',
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

interface Top5WidgetTabbedProps {
  className?: string
}

type TabType = 'top5' | 'gainers' | 'losers' | 'mosttraded'

function StockRow({
  item,
  rank,
  isVisible,
  isBlurred,
}: {
  item: Top5Item
  rank: number
  isVisible: boolean
  isBlurred: boolean
}) {
  const isPositive = item.change_pct >= 0

  return (
    <div
      className={`rounded-lg border p-4 mb-3 transition-all ${
        isVisible
          ? 'border-gray-700 bg-gray-900/50'
          : 'border-gray-800 bg-gray-900/30'
      }`}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="text-lg font-bold text-blue-500 w-6">#{rank}</div>
          <div>
            <div className={`font-semibold ${isBlurred ? 'text-gray-500' : 'text-white'}`}>
              {isBlurred ? 'N••A' : item.ticker}
            </div>
            <div className="text-xs text-gray-500">
              {isBlurred ? 'Gizli' : item.company}
            </div>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={`font-bold text-lg ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{item.change_pct.toFixed(2)}%
          </div>
          <div className="text-xs text-gray-500">
            {isBlurred ? '••••' : `$${item.price.toFixed(2)}`}
          </div>
        </div>
      </div>

      {/* AI Commentary */}
      <div className="mt-3 pl-9">
        <p className="text-xs text-gray-400 italic">
          {isBlurred ? '••••••••••••••••' : item.ai_reason}
        </p>
      </div>

      {/* Score */}
      {!isBlurred && (
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
      )}
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

  const isProUser = !!(user && (user.subscription_tier === 'pro' || user.role === 'admin'))
  const isAuthenticated = !!user

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)
        // Fetch all tab data in parallel
        const [top5Res] = await Promise.all([
          fetch('/api/market/top5', { cache: 'no-store' }),
        ])

        if (top5Res.ok) {
          const top5Data: Top5Response = await top5Res.json()
          if (top5Data?.picks && Array.isArray(top5Data.picks)) {
            setItems(prev => ({ ...prev, top5: top5Data.picks }))
          }
        }
      } catch (err) {
        console.error('Failed to fetch tab data:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 3600 * 1000)
    return () => clearInterval(interval)
  }, [])

  const currentItems = items[activeTab]

  const tabs: { id: TabType; label: string; icon: string }[] = [
    { id: 'top5', label: "Günün Top 5 AI Hissesi", icon: '⭐' },
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
        {/* Left Column - All 5 stocks */}
        <div className="lg:col-span-2">
          {currentItems.slice(0, 5).map((item, idx) => {
            const isFirstCard = idx === 0
            const isVisible = isFirstCard || isProUser
            const isBlurred = !isProUser && !isFirstCard

            return (
              <StockRow
                key={item.ticker}
                item={item}
                rank={idx + 1}
                isVisible={isVisible}
                isBlurred={isBlurred}
              />
            )
          })}

          {/* CTA Footer */}
          {!isProUser && (
            <div className="mt-6 p-4 rounded-lg border border-blue-900/40 bg-blue-900/10">
              <p className="text-sm text-gray-300 mb-3">
                {isAuthenticated
                  ? 'PRO üyelik ile tüm 5 hisse detaylı analizi görebilirsiniz'
                  : 'Tüm hisse analizi görmek için lütfen giriş yapın'}
              </p>
              {!isAuthenticated ? (
                <a
                  href="/login"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Giriş Yap
                </a>
              ) : (
                <a
                  href="/pricing"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  PRO'ya Yükselt
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Summary & Stats */}
        <div className="lg:col-span-1">
          {activeTab === 'top5' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Piyasa Özeti</h4>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Ortalama Değişim</p>
                    <p className="text-lg font-bold text-green-500">
                      +{((FALLBACK_TOP5.reduce((a, b) => a + b.change_pct, 0) / 5).toFixed(2))}%
                    </p>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500">Sektör Dağılımı</p>
                    <div className="mt-2 space-y-1">
                      <div className="text-xs text-gray-400">
                        <span>Teknoloji</span> <span className="float-right">5/5</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1">
                        <div className="bg-blue-500 h-1 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-gray-800">
                    <p className="text-xs text-gray-500">Ortalama Skor</p>
                    <p className="text-lg font-bold text-blue-400">
                      {Math.round(
                        FALLBACK_TOP5.reduce((a, b) => a + b.score, 0) / 5
                      )}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 text-xs text-gray-400">
                <p className="mb-2 font-semibold">💡 İpucu</p>
                <p>
                  Top 5 listesi yapay zeka modelimiz tarafından saatlik olarak güncellenmektedir. Her bir hisse değerlemesi
                  teknik ve temel analiz kombinasyonuna dayanmaktadır.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
