'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { RefreshCw, AlertCircle, Download } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface NativeChartProps {
  ticker: string
  period?: '1y' | '6mo' | '3mo' | '1mo'
  interval?: '1d' | '1w' | '1mo'
  className?: string
}

export function NativeChart({
  ticker,
  period = '1y',
  interval = '1d',
  className
}: NativeChartProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadChart = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${API_URL}/api/chart/${ticker}?period=${period}&interval=${interval}`)
        if (!response.ok) {
          throw new Error('Grafik yüklenemedi')
        }
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setImageUrl(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Bilinmeyen hata')
      } finally {
        setLoading(false)
      }
    }

    loadChart()
  }, [ticker, period, interval])

  const handleRefresh = () => {
    setLoading(true)
    setImageUrl(null)
    setError(null)
    // Trigger reload
    window.location.href = window.location.href
  }

  const handleDownload = async () => {
    if (!imageUrl) return
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticker}_chart.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download failed:', err)
    }
  }

  return (
    <div className={cn('w-full bg-finma-card rounded-lg border border-finma-border overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-finma-border bg-finma-bg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-finma-text">{ticker}</span>
          <span className="text-[9px] text-finma-text-dim uppercase tracking-widest">FinMA Native Chart</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className={cn(
              'p-2 rounded-md transition-colors',
              loading
                ? 'text-finma-text-dim cursor-not-allowed opacity-50'
                : 'text-finma-text-dim hover:text-finma-primary hover:bg-finma-primary/10'
            )}
            title="Yenile"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          {imageUrl && (
            <button
              onClick={handleDownload}
              className="p-2 rounded-md text-finma-text-dim hover:text-finma-primary hover:bg-finma-primary/10 transition-colors"
              title="İndir"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="relative bg-finma-bg/30 min-h-[500px] flex items-center justify-center overflow-auto">
        {loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="w-8 h-8 border-4 border-finma-border border-t-finma-primary rounded-full animate-spin" />
            <p className="text-sm text-finma-text-dim">Grafik hazırlanıyor...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center gap-2 p-4">
            <AlertCircle className="w-8 h-8 text-finma-red" />
            <p className="text-sm text-finma-text">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-2 px-3 py-1.5 text-xs font-medium bg-finma-primary text-white rounded-md hover:bg-finma-primary/90 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        )}

        {imageUrl && !loading && (
          <img
            src={imageUrl}
            alt={`${ticker} Grafiği`}
            className="w-full h-full object-contain p-2"
          />
        )}
      </div>
    </div>
  )
}
