'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart,
  ColorType,
  CrosshairMode,
  IChartApi,
  Time,
} from 'lightweight-charts'
import { cn } from '@/lib/utils'
import { RefreshCw, Maximize2, Minimize2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

// ─── Types ───
interface OHLCV {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type Timeframe = '1D' | '1W' | '1M' | '1Y' | '5Y' | '10Y'
type Indicator = 'EMA20' | 'EMA50' | 'EMA200' | 'BB' | 'RSI' | 'MACD' | 'ADX' | 'OBV' | 'VOL'

const TF_LABELS: Record<Timeframe, string> = {
  '1D': '1G', '1W': '1H', '1M': '1A', '1Y': '1Y', '5Y': '5Y', '10Y': '10Y',
}
const TF_TO_PERIOD: Record<Timeframe, string> = {
  '1D': '1d', '1W': '5d', '1M': '1mo', '1Y': '1y', '5Y': '5y', '10Y': '10y',
}
const TF_TO_INTERVAL: Record<Timeframe, string> = {
  '1D': '5m', '1W': '30m', '1M': '1d', '1Y': '1wk', '5Y': '1wk', '10Y': '1mo',
}

// ─── EMA calculation ───
function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  let ema = data[0]
  for (let i = 0; i < data.length; i++) {
    ema = data[i] * k + ema * (1 - k)
    result.push(ema)
  }
  return result
}

// ─── Bollinger Bands ───
function calcBollinger(closes: number[], period = 20, mult = 2) {
  const upper: number[] = []
  const middle: number[] = []
  const lower: number[] = []
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN); middle.push(NaN); lower.push(NaN)
      continue
    }
    const slice = closes.slice(i - period + 1, i + 1)
    const sma = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + (b - sma) ** 2, 0) / period
    const stddev = Math.sqrt(variance)
    upper.push(sma + mult * stddev)
    middle.push(sma)
    lower.push(sma - mult * stddev)
  }
  return { upper, middle, lower }
}

// ─── RSI calculation ───
function calcRSI(closes: number[], period = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN)
  let gains = 0, losses = 0
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff; else losses -= diff
  }
  let avgGain = gains / period
  let avgLoss = losses / period
  result[period] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10))
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1]
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period
    result[i] = 100 - 100 / (1 + avgGain / (avgLoss || 1e-10))
  }
  return result
}

// ─── MACD ───
function calcMACD(closes: number[]) {
  const ema12 = calcEMA(closes, 12)
  const ema26 = calcEMA(closes, 26)
  const macdLine = ema12.map((v, i) => v - ema26[i])
  const signal = calcEMA(macdLine, 9)
  const histogram = macdLine.map((v, i) => v - signal[i])
  return { macdLine, signal, histogram }
}

// ─── Pattern detection (basic) ───
function detectPatterns(data: OHLCV[]): { time: string; name: string; color: string }[] {
  const patterns: { time: string; name: string; color: string }[] = []
  for (let i = 1; i < data.length; i++) {
    const c = data[i], p = data[i - 1]
    const body = Math.abs(c.close - c.open)
    const range = c.high - c.low
    const upperWick = c.high - Math.max(c.close, c.open)
    const lowerWick = Math.min(c.close, c.open) - c.low

    // Doji
    if (body < range * 0.05 && range > 0) {
      patterns.push({ time: c.time, name: 'Doji', color: '#fbbf24' })
    }
    // Hammer (bullish)
    else if (lowerWick > body * 2 && upperWick < body * 0.5 && c.close > c.open) {
      patterns.push({ time: c.time, name: 'Hammer', color: '#22c55e' })
    }
    // Shooting Star (bearish)
    else if (upperWick > body * 2 && lowerWick < body * 0.5 && c.close < c.open) {
      patterns.push({ time: c.time, name: 'Shooting Star', color: '#ef4444' })
    }
  }
  return patterns
}

// ─── Chart theme ───
const CHART_THEME = {
  layout: {
    background: { type: ColorType.Solid, color: '#0a0f1a' },
    textColor: '#9ca3af',
  },
  grid: {
    vertLines: { color: '#1a2332' },
    horzLines: { color: '#1a2332' },
  },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: {
    borderColor: '#1e2d3d',
    textColor: '#9ca3af',
  },
  timeScale: {
    borderColor: '#1e2d3d',
    textColor: '#9ca3af',
    timeVisible: true,
    secondsVisible: false,
  },
}

interface FinMAChartProps {
  ticker?: string
  className?: string
  height?: number
  showControls?: boolean
}

export function FinMAChart({ ticker = 'AAPL', className, height = 400, showControls = true }: FinMAChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tf, setTf] = useState<Timeframe>('1M')
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set(['VOL', 'EMA20', 'EMA50']))
  const [fullscreen, setFullscreen] = useState(false)
  const [patterns, setPatterns] = useState<{ time: string; name: string; color: string }[]>([])

  const toggleIndicator = (ind: Indicator) => {
    setIndicators(prev => {
      const next = new Set(prev)
      if (next.has(ind)) next.delete(ind)
      else next.add(ind)
      return next
    })
  }

  const loadChart = useCallback(async () => {
    if (!containerRef.current || !ticker) return
    setLoading(true)
    setError('')

    try {
      const token = localStorage.getItem('finma_token')
      const period = TF_TO_PERIOD[tf]
      const interval = TF_TO_INTERVAL[tf]
      const res = await fetch(
        `${API_URL}/api/market/history/${ticker}?period=${period}&interval=${interval}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      )
      if (!res.ok) throw new Error('Veri alınamadı')
      const raw = await res.json()
      const candles: OHLCV[] = (raw.history || raw.data || raw || []).filter(
        (d: any) => d.open && d.close && d.high && d.low
      )
      if (candles.length === 0) throw new Error('Veri boş')

      // Destroy previous chart
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      // Create chart
      const chartHeight = indicators.has('RSI') || indicators.has('MACD') ? Math.floor(height * 0.65) : height
      const chart = createChart(containerRef.current, {
        ...CHART_THEME,
        width: containerRef.current.clientWidth,
        height: chartHeight,
      })
      chartRef.current = chart

      // Candlestick series
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#22c55e',
        downColor: '#ef4444',
        borderUpColor: '#22c55e',
        borderDownColor: '#ef4444',
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
      })
      candleSeries.setData(candles.map(d => ({
        time: d.time as Time,
        open: d.open, high: d.high, low: d.low, close: d.close,
      })))

      const closes = candles.map(d => d.close)
      const times = candles.map(d => d.time as Time)

      // Volume
      if (indicators.has('VOL')) {
        const volSeries = chart.addHistogramSeries({
          color: '#22c55e',
          priceFormat: { type: 'volume' as const },
          priceScaleId: 'volume',
        } as any)
        chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } })
        volSeries.setData(candles.map(d => ({
          time: d.time as Time,
          value: d.volume,
          color: d.close >= d.open ? '#22c55e44' : '#ef444444',
        })))
      }

      // EMA20
      if (indicators.has('EMA20')) {
        const ema20 = calcEMA(closes, 20)
        const ema20Series = chart.addLineSeries({ color: '#3b82f6', lineWidth: 1 as any })
        ema20Series.setData(times.map((t, i) => ({ time: t, value: ema20[i] })).filter(d => !isNaN(d.value)))
      }
      // EMA50
      if (indicators.has('EMA50')) {
        const ema50 = calcEMA(closes, 50)
        const ema50Series = chart.addLineSeries({ color: '#f59e0b', lineWidth: 1 as any })
        ema50Series.setData(times.map((t, i) => ({ time: t, value: ema50[i] })).filter(d => !isNaN(d.value)))
      }
      // EMA200
      if (indicators.has('EMA200') && closes.length >= 200) {
        const ema200 = calcEMA(closes, 200)
        const ema200Series = chart.addLineSeries({ color: '#a855f7', lineWidth: 2 as any })
        ema200Series.setData(times.map((t, i) => ({ time: t, value: ema200[i] })).filter(d => !isNaN(d.value)))
      }
      // Bollinger Bands
      if (indicators.has('BB')) {
        const { upper, middle, lower } = calcBollinger(closes)
        const upper_s = chart.addLineSeries({ color: '#6b7280', lineWidth: 1 as any, lineStyle: 2 as any })
        const mid_s = chart.addLineSeries({ color: '#6b7280', lineWidth: 1 as any })
        const lower_s = chart.addLineSeries({ color: '#6b7280', lineWidth: 1 as any, lineStyle: 2 as any })
        upper_s.setData(times.map((t, i) => ({ time: t, value: upper[i] })).filter(d => !isNaN(d.value)))
        mid_s.setData(times.map((t, i) => ({ time: t, value: middle[i] })).filter(d => !isNaN(d.value)))
        lower_s.setData(times.map((t, i) => ({ time: t, value: lower[i] })).filter(d => !isNaN(d.value)))
      }

      // Pattern detection
      const detected = detectPatterns(candles)
      setPatterns(detected)

      // Fit content
      chart.timeScale().fitContent()

      // Responsive resize
      const ro = new ResizeObserver(() => {
        if (containerRef.current && chart) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      ro.observe(containerRef.current)

    } catch (e: any) {
      setError(e.message || 'Grafik yüklenemedi')
    }
    setLoading(false)
  }, [ticker, tf, indicators, height])

  useEffect(() => {
    loadChart()
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [loadChart])

  const INDICATOR_OPTIONS: { key: Indicator; label: string; color: string }[] = [
    { key: 'VOL', label: 'Hacim', color: '#22c55e' },
    { key: 'EMA20', label: 'EMA 20', color: '#3b82f6' },
    { key: 'EMA50', label: 'EMA 50', color: '#f59e0b' },
    { key: 'EMA200', label: 'EMA 200', color: '#a855f7' },
    { key: 'BB', label: 'Bollinger', color: '#6b7280' },
    { key: 'RSI', label: 'RSI', color: '#ec4899' },
    { key: 'MACD', label: 'MACD', color: '#06b6d4' },
  ]

  return (
    <div className={cn('bg-[#0a0f1a] rounded-lg border border-finma-border overflow-hidden', className, fullscreen && 'fixed inset-0 z-50')}>
      {showControls && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-finma-border flex-wrap">
          {/* Ticker */}
          <span className="text-sm font-bold text-finma-primary finma-number mr-2">{ticker}</span>

          {/* Timeframes */}
          <div className="flex bg-finma-bg/60 rounded-md p-0.5 gap-0.5">
            {(Object.keys(TF_LABELS) as Timeframe[]).map(t => (
              <button
                key={t}
                onClick={() => setTf(t)}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-bold finma-number transition-all',
                  tf === t ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text'
                )}
              >
                {TF_LABELS[t]}
              </button>
            ))}
          </div>

          {/* Indicators */}
          <div className="flex gap-1 flex-wrap">
            {INDICATOR_OPTIONS.map(ind => (
              <button
                key={ind.key}
                onClick={() => toggleIndicator(ind.key)}
                style={{ borderColor: indicators.has(ind.key) ? ind.color : undefined }}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium border transition-all',
                  indicators.has(ind.key)
                    ? 'text-white border-opacity-100'
                    : 'text-finma-text-dim border-finma-border/40 hover:text-finma-text'
                )}
              >
                {ind.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button onClick={loadChart} className="p-1.5 text-finma-text-dim hover:text-finma-text transition-colors">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
            <button onClick={() => setFullscreen(v => !v)} className="p-1.5 text-finma-text-dim hover:text-finma-text transition-colors">
              {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}

      {/* Chart container */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-[#0a0f1a]/70">
            <RefreshCw className="w-6 h-6 text-finma-primary animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center z-10 text-finma-text-dim text-sm">
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ height: fullscreen ? '100vh' : height }} />
      </div>

      {/* Pattern legend */}
      {patterns.length > 0 && showControls && (
        <div className="px-3 py-1.5 border-t border-finma-border flex items-center gap-3 flex-wrap">
          <span className="text-[10px] text-finma-text-dim">Desenler:</span>
          {[...new Set(patterns.map(p => p.name))].map(name => {
            const p = patterns.find(x => x.name === name)!
            return (
              <span key={name} className="text-[10px] font-medium" style={{ color: p.color }}>
                ● {name} ({patterns.filter(x => x.name === name).length})
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
