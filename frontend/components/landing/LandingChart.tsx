'use client'

import { useEffect, useRef, useState } from 'react'
import { createChart, ColorType, CrosshairMode, IChartApi } from 'lightweight-charts'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-production.up.railway.app'

interface OHLCV {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

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

interface LandingChartProps {
  ticker: string
}

export default function LandingChart({ ticker }: LandingChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)

  useEffect(() => {
    if (!containerRef.current || !ticker) return

    setLoading(true)
    setEmpty(false)

    let destroyed = false

    async function load() {
      try {
        const res = await fetch(
          `${API_URL}/api/market/history/${ticker}?period=1mo&interval=1d`
        )
        if (!res.ok) throw new Error('no data')
        const raw = await res.json()
        const candles: OHLCV[] = (raw.history || raw.data || raw || []).filter(
          (d: any) => d.open && d.close && d.high && d.low && d.time
        )
        if (candles.length === 0) throw new Error('empty')

        if (destroyed || !containerRef.current) return

        // Destroy previous chart
        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }

        const chart = createChart(containerRef.current, {
          width: containerRef.current.clientWidth,
          height: 200,
          layout: {
            background: { type: ColorType.Solid, color: '#0C1017' },
            textColor: '#4C5A6B',
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.04)' },
            horzLines: { color: 'rgba(255,255,255,0.04)' },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            scaleMargins: { top: 0.08, bottom: 0.08 },
          },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.06)',
            timeVisible: true,
            secondsVisible: false,
          },
          handleScroll: false,
          handleScale: false,
        })

        chartRef.current = chart

        const candleSeries = chart.addCandlestickSeries({
          upColor: '#10B981',
          downColor: '#F43F5E',
          borderUpColor: '#10B981',
          borderDownColor: '#F43F5E',
          wickUpColor: '#10B981',
          wickDownColor: '#F43F5E',
        })

        candleSeries.setData(
          candles.map(c => ({
            time: c.time as any,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
          }))
        )

        // EMA20 overlay
        const closes = candles.map(c => c.close)
        const ema20 = calcEMA(closes, 20)
        const emaSeries = chart.addLineSeries({
          color: 'rgba(45,126,248,0.7)',
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        })
        emaSeries.setData(
          candles.map((c, i) => ({ time: c.time as any, value: ema20[i] }))
        )

        chart.timeScale().fitContent()

        // Resize observer
        const ro = new ResizeObserver(() => {
          if (containerRef.current && chartRef.current) {
            chartRef.current.applyOptions({ width: containerRef.current.clientWidth })
          }
        })
        if (containerRef.current) ro.observe(containerRef.current)

        setLoading(false)
      } catch {
        if (!destroyed) {
          setEmpty(true)
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      destroyed = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [ticker])

  if (empty) return null

  return (
    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', background: '#0C1017' }}>
      {loading && (
        <div style={{
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0C1017',
        }}>
          <div style={{
            width: '100%',
            height: 200,
            background: '#0C1017',
            opacity: 0.8,
          }} />
        </div>
      )}
      <div ref={containerRef} style={{ display: loading ? 'none' : 'block' }} />
    </div>
  )
}
