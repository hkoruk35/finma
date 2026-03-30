'use client'

import { useEffect, useState } from 'react'
import type { MarketPulseResponse } from '@/app/api/market/pulse/route'

const FALLBACK_SUMMARY =
  'S&P 500 bugün teknoloji sektörünün güçlü performansı ile yükselişe geçti. Yapay zeka ve bulut hizmetlerine olan kurumsal talep kazançları tetikledi. Enerji sektöründe ise hafif baskı görülürken, finansal hisse senetleri dengeli bir seyir izledi.'

interface MarketSummaryHeroProps {
  className?: string
}

export function MarketSummaryHero({ className = '' }: MarketSummaryHeroProps) {
  const [data, setData] = useState<MarketPulseResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPulse = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/market/pulse', { cache: 'no-store' })
        if (res.ok) {
          const pulseData: MarketPulseResponse = await res.json()
          if (pulseData?.ai_summary) {
            setData(pulseData)
          }
        } else {
          setError('Piyasa analizi yüklenemeyen')
        }
      } catch (err) {
        console.error('Failed to fetch market pulse:', err)
        setError('Piyasa analizi yüklenemeyen')
      } finally {
        setIsLoading(false)
      }
    }

    fetchPulse()
    // Refresh every hour
    const interval = setInterval(fetchPulse, 3600 * 1000)
    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div
        className={`w-full py-8 px-6 rounded-lg ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(99, 102, 241, 0.1) 100%)',
          borderLeft: '4px solid rgba(59, 130, 246, 0.5)',
        }}
      >
        <div className="space-y-4">
          <div className="h-6 bg-gray-700 rounded w-1/2 animate-pulse" />
          <div className="h-4 bg-gray-700 rounded animate-pulse" />
          <div className="h-4 bg-gray-700 rounded w-5/6 animate-pulse" />
        </div>
      </div>
    )
  }

  const summary = data?.ai_summary || FALLBACK_SUMMARY
  const sentiment = data?.sentiment || 'neutral'
  const timestamp = data?.timestamp
  const estTime = timestamp
    ? new Date(timestamp).toLocaleTimeString('tr-TR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/New_York',
      })
    : 'Bilinmiyor'

  // Determine colors based on sentiment
  let sentimentColor = 'rgba(107, 114, 128, 0.5)' // neutral gray
  let sentimentBorderColor = 'rgba(107, 114, 128, 0.2)'
  let sentimentTextColor = 'text-gray-400'

  if (sentiment === 'bullish') {
    sentimentColor = 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(74, 222, 128, 0.1) 100%)'
    sentimentBorderColor = 'rgba(34, 197, 94, 0.3)'
    sentimentTextColor = 'text-green-500'
  } else if (sentiment === 'bearish') {
    sentimentColor = 'linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(248, 113, 113, 0.1) 100%)'
    sentimentBorderColor = 'rgba(239, 68, 68, 0.3)'
    sentimentTextColor = 'text-red-500'
  }

  const sentimentLabel =
    sentiment === 'bullish' ? '🟢 Boğa' : sentiment === 'bearish' ? '🔴 Ayı' : '⚪ Nötr'

  return (
    <div
      className={`w-full py-8 px-6 rounded-lg transition-all ${className}`}
      style={{
        background: sentimentColor,
        borderLeft: `4px solid ${sentimentBorderColor}`,
      }}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-3xl lg:text-4xl font-bold text-white leading-tight">
          ABD Borsasında
          <br />
          <span className={`${sentimentTextColor}`}>Fırsatları Bul.</span>
        </h2>
      </div>

      {/* Summary Text */}
      <p className="text-gray-300 text-sm lg:text-base leading-relaxed mb-6">
        {error ? (
          <span className="text-gray-400">Piyasa analizi geçici olarak kullanılıyor...</span>
        ) : (
          summary
        )}
      </p>

      {/* Metadata Footer */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-gray-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sentiment:</span>
            <span className={`text-sm font-semibold ${sentimentTextColor}`}>{sentimentLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>AI Analiz • EST {estTime}</span>
          </div>
        </div>

        <div className="text-xs text-gray-600">
          {data?.market_date && `Tarih: ${new Date(data.market_date).toLocaleDateString('tr-TR')}`}
        </div>
      </div>
    </div>
  )
}
