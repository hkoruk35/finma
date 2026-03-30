'use client'

import { useEffect, useState } from 'react'
import type { TickerItem, TickerBandResponse } from '@/app/api/market/ticker-band/route'

const FALLBACK: TickerItem[] = [
  { symbol: 'SPX', label: 'S&P 500', pct: 1.24, dir: 'up', category: 'Indices' },
  { symbol: 'DJI', label: 'DOW', pct: 0.87, dir: 'up', category: 'Indices' },
  { symbol: 'IXIC', label: 'NASDAQ', pct: 2.18, dir: 'up', category: 'Indices' },
  { symbol: 'VIX', label: 'VIX', pct: -5.32, dir: 'down', category: 'Indices' },
  { symbol: 'RUT', label: 'Russell 2K', pct: 1.45, dir: 'up', category: 'Indices' },
  { symbol: 'XLC', label: 'Communication', pct: 2.15, dir: 'up', category: 'ETF' },
  { symbol: 'XLY', label: 'Consumer Discr.', pct: 1.89, dir: 'up', category: 'ETF' },
  { symbol: 'XLE', label: 'Energy', pct: -0.45, dir: 'down', category: 'ETF' },
  { symbol: 'XLF', label: 'Financials', pct: 0.92, dir: 'up', category: 'ETF' },
  { symbol: 'XLV', label: 'Healthcare', pct: 1.23, dir: 'up', category: 'ETF' },
  { symbol: 'XLI', label: 'Industrials', pct: 1.56, dir: 'up', category: 'ETF' },
  { symbol: 'XLRE', label: 'Real Estate', pct: 0.78, dir: 'up', category: 'ETF' },
  { symbol: 'XLK', label: 'Technology', pct: 2.34, dir: 'up', category: 'ETF' },
  { symbol: 'XLP', label: 'Consumer Staples', pct: 0.45, dir: 'up', category: 'ETF' },
  { symbol: 'XLU', label: 'Utilities', pct: -0.23, dir: 'down', category: 'ETF' },
]

interface TickerBandProps {
  refreshInterval?: number // milliseconds, default: 3600000 (1 hour)
  className?: string
}

export function TickerBand({ refreshInterval = 3600000, className = '' }: TickerBandProps) {
  const [items, setItems] = useState<TickerItem[]>(FALLBACK)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchTickerBand = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const res = await fetch('/api/market/ticker-band', { cache: 'no-store' })
        if (res.ok) {
          const data: TickerBandResponse = await res.json()
          if (data?.ticker_band && Array.isArray(data.ticker_band) && data.ticker_band.length > 0) {
            setItems(data.ticker_band)
          }
        } else {
          setError('Ticker bandı yüklenemeyen')
        }
      } catch (err) {
        console.error('Failed to fetch ticker band:', err)
        setError('Ticker bandı yüklenemeyen')
      } finally {
        setIsLoading(false)
      }
    }

    fetchTickerBand()
    const interval = setInterval(fetchTickerBand, refreshInterval)
    return () => clearInterval(interval)
  }, [refreshInterval])

  if (isLoading && items === FALLBACK) {
    return (
      <div className={`w-full ${className}`}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 bg-gray-700 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (error && items === FALLBACK) {
    return (
      <div className={`w-full ${className}`}>
        <div className="p-4 bg-gray-800/50 rounded-lg text-center text-sm text-gray-400">
          {error} veya cache'den yükleniyor...
        </div>
      </div>
    )
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 p-4">
        {items.map((item) => {
          const pctValue = typeof item.pct === 'string' ? parseFloat(item.pct) : item.pct
          const isPositive = pctValue >= 0
          const colorClass = isPositive ? 'text-green-500' : 'text-red-500'
          const bgClass = isPositive ? 'border-green-900/30' : 'border-red-900/30'

          return (
            <div
              key={item.symbol}
              className={`border rounded-lg p-3 transition-all hover:bg-gray-800/50 cursor-default ${bgClass}`}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderColor: isPositive ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              }}
            >
              {/* Symbol */}
              <div className="font-mono font-bold text-sm text-white">
                {item.symbol}
              </div>

              {/* Label */}
              <div className="text-xs text-gray-400 mt-1 truncate">
                {item.label || item.symbol}
              </div>

              {/* Price change */}
              <div className={`text-lg font-bold mt-2 ${colorClass}`}>
                {isPositive ? '+' : ''}
                {pctValue.toFixed(2)}%
              </div>

              {/* Direction indicator */}
              <div className="text-xs text-gray-500 mt-1">
                {item.dir === 'up' ? '▲ Yükseliş' : '▼ Düşüş'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
