'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Top5Item, Top5Response } from '@/app/api/market/top5/route'

interface Top5WidgetTabbedProps {
  className?: string
}

type TabType = 'gainers' | 'losers' | 'mosttraded'

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
  const [activeTab, setActiveTab] = useState<'top5' | TabType>('top5')
  const [todayData, setTodayData] = useState<Top5Item[]>([])
  const [yesterdayData, setYesterdayData] = useState<Top5Item[]>([])
  const [otherTabs, setOtherTabs] = useState<Record<TabType, Top5Item[]>>({
    gainers: [],
    losers: [],
    mosttraded: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  // Determine user tier
  const isProUser = !!(user && (user.subscription_tier === 'pro' || user.subscription_tier === 'pro+' || user.role === 'admin'))
  const isAuthenticated = !!user

  // Determine which list to show based on tier
  const showTodayList = isProUser && isAuthenticated
  const topTabLabel = showTodayList ? "Günün Top 5 AI Hissesi" : "Dünün Top 5 AI Hissesi"
  const currentTopData = showTodayList ? todayData : yesterdayData

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true)

        // Fetch today's and yesterday's picks
        const [todayRes, yesterdayRes] = await Promise.all([
          fetch('/api/market/top5?type=today', { cache: 'no-store' }),
          fetch('/api/market/top5?type=yesterday', { cache: 'no-store' }),
        ])

        if (todayRes.ok) {
          const data: Top5Response = await todayRes.json()
          if (data?.picks && Array.isArray(data.picks)) {
            setTodayData(data.picks)
          }
        }

        if (yesterdayRes.ok) {
          const data: Top5Response = await yesterdayRes.json()
          if (data?.picks && Array.isArray(data.picks)) {
            setYesterdayData(data.picks)
          }
        }

        // For other tabs, we can fetch from the same endpoints if needed
        // or use local mock data (keeping existing tabs for now)
        setOtherTabs({
          gainers: todayData.slice(0, 5), // Placeholder
          losers: todayData.slice(0, 5), // Placeholder
          mosttraded: todayData.slice(0, 5), // Placeholder
        })
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
  }, [])

  // Determine which data to show based on active tab
  let currentItems: Top5Item[] = []
  if (activeTab === 'top5') {
    currentItems = currentTopData
  } else {
    currentItems = otherTabs[activeTab as TabType] || []
  }

  // Build tabs - first tab changes based on user tier
  const tabs: { id: 'top5' | TabType; label: string; icon: string }[] = [
    { id: 'top5', label: topTabLabel, icon: '⭐' },
    { id: 'gainers', label: 'Yükselenler', icon: '📈' },
    { id: 'losers', label: 'Düşenler', icon: '📉' },
    { id: 'mosttraded', label: 'En Çok İşlem Görenler', icon: '💹' },
  ]

  if (isLoading && !currentTopData.length) {
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
        {/* Left Column - 5 stocks (now fully visible for all users) */}
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
        {activeTab === 'top5' && (
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
                {['Technology'].map((sector) => (
                  <div key={sector} className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">{sector}</span>
                    <span className="text-gray-300">5/5</span>
                  </div>
                ))}
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
          </div>
        )}
      </div>
    </div>
  )
}
