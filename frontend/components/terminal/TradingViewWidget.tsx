'use client'

import { useEffect, useRef } from 'react'
import { useTerminalStore } from '@/store/terminal'

export function TradingViewWidget() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { chartSymbol } = useTerminalStore()

  useEffect(() => {
    if (!containerRef.current) return

    // Clear previous widget
    containerRef.current.innerHTML = ''

    const script = document.createElement('script')
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js'
    script.type = 'text/javascript'
    script.async = true
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: chartSymbol,
      interval: '15',
      timezone: 'America/New_York',
      theme: 'dark',
      style: '1',
      locale: 'tr',
      backgroundColor: '#111827',
      gridColor: 'rgba(31, 41, 55, 0.5)',
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: 'https://www.tradingview.com',
      studies: [
        'STD;Bollinger_Bands',
        'STD;MACD',
        'STD;RSI',
      ],
      toolbar_bg: '#111827',
      enable_publishing: false,
      withdateranges: true,
      allow_symbol_change: true,
    })

    containerRef.current.appendChild(script)

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [chartSymbol])

  return (
    <div className="w-full h-full overflow-hidden bg-finma-card">
      <div className="tradingview-widget-container w-full h-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget w-full h-full" />
      </div>
    </div>
  )
}
