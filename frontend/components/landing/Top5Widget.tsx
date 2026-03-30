'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import type { Top5Item, Top5Response } from '@/app/api/market/top5/route'

const FALLBACK: Top5Item[] = [
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
    ai_reason: 'OpenAI partnership yeni gelir akışları yaratıyor. Cloud growth accelerating.',
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
]

interface Top5WidgetProps {
  className?: string
}

function Top5Card({
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
  const colorClass = isPositive ? 'text-green-500' : 'text-red-500'

  return (
    <div
      className={`rounded-lg border p-4 transition-all ${
        isVisible
          ? 'border-gray-700 bg-gray-900/50 hover:bg-gray-900/70'
          : 'border-gray-800 bg-gray-900/30'
      }`}
      style={{
        filter: isBlurred ? 'blur(4px)' : 'none',
        opacity: isBlurred ? 0.6 : 1,
        pointerEvents: isBlurred ? 'none' : 'auto',
      }}
    >
      {/* Header: Rank + Ticker */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 mb-1">#{rank}</div>
          <div className="font-mono font-bold text-lg text-white">{item.ticker}</div>
        </div>
        {isBlurred && (
          <div className="text-xs text-gray-400 px-2 py-1 bg-gray-800/50 rounded">
            🔒 PRO
          </div>
        )}
      </div>

      {/* Company Name */}
      <div className="text-sm text-gray-400 mb-3 truncate">
        {isBlurred ? '••••••••••' : item.company}
      </div>

      {/* Price Change % */}
      <div className={`text-2xl font-bold mb-3 ${colorClass}`}>
        {isPositive ? '+' : ''}
        {item.change_pct.toFixed(2)}%
      </div>

      {/* Score (Visible only for non-blurred) */}
      {!isBlurred && (
        <div className="flex items-center gap-2 mb-3">
          <div className="text-xs text-gray-500">Puan:</div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full"
              style={{ width: `${item.score}%` }}
            />
          </div>
          <div className="text-xs font-semibold text-blue-400 w-10 text-right">
            {item.score}
          </div>
        </div>
      )}

      {/* AI Reason (Visible only for non-blurred) */}
      {!isBlurred && item.ai_reason && (
        <div className="text-xs text-gray-400 italic leading-relaxed">
          "{item.ai_reason}"
        </div>
      )}

      {/* Sector Badge */}
      <div className="mt-3 pt-3 border-t border-gray-800">
        <span className="inline-block text-xs bg-gray-800/50 text-gray-400 px-2 py-1 rounded">
          {isBlurred ? '••••' : item.sector}
        </span>
      </div>
    </div>
  )
}

export function Top5Widget({ className = '' }: Top5WidgetProps) {
  const { user } = useAuthStore()
  const [items, setItems] = useState<Top5Item[]>(FALLBACK)
  const [isLoading, setIsLoading] = useState(true)

  // Determine user tier
  const isProUser = !!(user && (user.subscription_tier === 'pro' || user.role === 'admin'))
  const isAuthenticated = !!user

  useEffect(() => {
    const fetchTop5 = async () => {
      try {
        setIsLoading(true)
        const res = await fetch('/api/market/top5', { cache: 'no-store' })
        if (res.ok) {
          const data: Top5Response = await res.json()
          if (data?.picks && Array.isArray(data.picks) && data.picks.length > 0) {
            setItems(data.picks)
          }
        }
      } catch (err) {
        console.error('Failed to fetch top5:', err)
        // Keep fallback
      } finally {
        setIsLoading(false)
      }
    }

    fetchTop5()
    // Refresh every hour
    const interval = setInterval(fetchTop5, 3600 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading && items === FALLBACK) {
    return (
      <div className={`w-full ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-48 bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      {/* Header */}
      <div className="mb-4 px-4">
        <h3 className="text-xl font-bold text-white">
          Günün Top 5 AI Hissesi
          {!isProUser && <span className="text-sm font-normal text-gray-400"> (Kilidi Aç)</span>}
        </h3>
        {!isProUser && isAuthenticated && (
          <p className="text-xs text-gray-500 mt-1">
            PRO üyelik ile tüm 5 hisse analizi görebilirsiniz
          </p>
        )}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-4">
        {items.slice(0, 5).map((item, idx) => {
          // First card always visible
          const isFirstCard = idx === 0
          // Other cards visible only for PRO users
          const isVisible = isFirstCard || isProUser
          // Blur non-PRO cards (except first)
          const isBlurred = !isProUser && !isFirstCard

          return (
            <Top5Card
              key={item.ticker}
              item={item}
              rank={item.rank}
              isVisible={isVisible}
              isBlurred={isBlurred}
            />
          )
        })}
      </div>

      {/* CTA Footer */}
      {!isProUser && (
        <div className="p-4 border-t border-gray-800">
          {!isAuthenticated ? (
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Giriş Yap - Tüm Analizi Göster
            </a>
          ) : (
            <a
              href="/pricing"
              className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              PRO'ya Yükselt - Tüm Hisseleri Göster
            </a>
          )}
        </div>
      )}

      {isProUser && (
        <div className="p-4 border-t border-gray-800">
          <a
            href="/smart-track"
            className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Smart Track ile Takip Et
          </a>
        </div>
      )}
    </div>
  )
}
