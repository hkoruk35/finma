'use client'

import { useState } from 'react'
import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { Card } from '@/components/shared/Card'
import { useTerminalStore } from '@/store/terminal'
import { LineChart, Maximize2, Minimize2, Grid3x3, Clock, LayoutGrid, Columns2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const sectorETFs = [
  { symbol: 'XLK', label: 'Teknoloji' },
  { symbol: 'XLF', label: 'Finans' },
  { symbol: 'XLV', label: 'Sağlık' },
  { symbol: 'XLE', label: 'Enerji' },
  { symbol: 'XLI', label: 'Sanayi' },
  { symbol: 'XLY', label: 'Tüketici İhtiyari' },
  { symbol: 'XLP', label: 'Temel Tüketim' },
  { symbol: 'XLU', label: 'Kamu Hizmetleri' },
  { symbol: 'XLB', label: 'Hammadde' },
  { symbol: 'XLC', label: 'İletişim' },
  { symbol: 'XLRE', label: 'Gayrimenkul' },
]

type ChartMode = 'single' | 'dual' | 'quad'

export default function ChartsPage() {
  const { chartSymbol, setChartSymbol } = useTerminalStore()
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [chartMode, setChartMode] = useState<ChartMode>('single')
  // Çoklu grafik modunda seçili semboller
  const [multiSymbols, setMultiSymbols] = useState<string[]>(['XLK', 'XLF', 'XLE', 'XLV'])

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  const handleETFClick = (symbol: string) => {
    if (chartMode === 'single') {
      setChartSymbol(symbol)
    } else {
      // Çoklu modda: slotlara sırayla ekle
      const maxSlots = chartMode === 'dual' ? 2 : 4
      setMultiSymbols(prev => {
        const copy = [...prev]
        // Son slot'a ekle, taşarsa baştan
        const nextIdx = copy.length >= maxSlots ? 0 : copy.length
        copy[nextIdx % maxSlots] = symbol
        return copy.slice(0, maxSlots)
      })
    }
  }

  const chartCount = chartMode === 'quad' ? 4 : chartMode === 'dual' ? 2 : 1

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık + Kontroller */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <LineChart className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa — Sektör Grafikleri
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
            <Clock className="w-3 h-3" />
            <span className="finma-number">Son güncelleme: {updateTime}</span>
          </div>
          <div className="flex items-center gap-1 bg-finma-card rounded border border-finma-border">
            <button
              onClick={() => setChartMode('single')}
              className={cn(
                'px-2.5 py-1.5 text-[10px] font-medium rounded-l transition-colors',
                chartMode === 'single' ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text'
              )}
              title="Tek Grafik"
            >
              <Maximize2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setChartMode('dual')}
              className={cn(
                'px-2.5 py-1.5 text-[10px] font-medium transition-colors',
                chartMode === 'dual' ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text'
              )}
              title="2 Grafik"
            >
              <Columns2 className="w-3 h-3" />
            </button>
            <button
              onClick={() => setChartMode('quad')}
              className={cn(
                'px-2.5 py-1.5 text-[10px] font-medium rounded-r transition-colors',
                chartMode === 'quad' ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text'
              )}
              title="4 Grafik"
            >
              <LayoutGrid className="w-3 h-3" />
            </button>
          </div>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-finma-card border border-finma-border text-finma-text-dim hover:text-finma-text transition-colors"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            {isFullscreen ? 'Normal' : 'Tam Ekran'}
          </button>
        </div>
      </div>

      {/* Sektör seçici */}
      <div className="flex flex-wrap gap-1.5">
        {sectorETFs.map(etf => {
          const isActive = chartMode === 'single'
            ? chartSymbol === etf.symbol
            : multiSymbols.includes(etf.symbol)
          return (
            <button
              key={etf.symbol}
              onClick={() => handleETFClick(etf.symbol)}
              className={cn(
                'px-3 py-1.5 rounded text-[11px] font-medium border transition-all',
                isActive
                  ? 'bg-finma-primary/20 border-finma-primary/50 text-finma-primary'
                  : 'bg-finma-card border-finma-border text-finma-text-muted hover:text-finma-primary hover:border-finma-primary/50'
              )}
            >
              {etf.label} ({etf.symbol})
            </button>
          )
        })}
      </div>

      {/* Grafik(ler) */}
      {chartMode === 'single' ? (
        <div
          className={cn(
            'bg-finma-card border border-finma-border rounded-lg overflow-hidden transition-all',
            isFullscreen ? 'fixed inset-4 z-50' : 'h-[350px] md:h-[550px]'
          )}
        >
          <TradingViewWidget />
        </div>
      ) : (
        <div className={cn(
          'grid gap-3',
          chartMode === 'dual' ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2',
          isFullscreen && 'fixed inset-4 z-50 bg-finma-bg p-3'
        )}>
          {multiSymbols.slice(0, chartCount).map((sym, idx) => {
            const etfInfo = sectorETFs.find(e => e.symbol === sym)
            return (
              <div
                key={`${sym}-${idx}`}
                className={cn(
                  'bg-finma-card border border-finma-border rounded-lg overflow-hidden',
                  chartMode === 'dual' ? 'h-[280px] md:h-[420px]' : 'h-[220px] md:h-[320px]'
                )}
              >
                <div className="flex items-center justify-between px-3 py-1.5 border-b border-finma-border bg-finma-bg/50">
                  <div>
                    <span className="text-[11px] font-semibold text-finma-primary">{etfInfo?.label || sym}</span>
                    <span className="text-[10px] text-finma-text-dim ml-1.5">({sym})</span>
                  </div>
                  {/* Slot'a farklı sembol seçebilmek için dropdown */}
                  <select
                    value={sym}
                    onChange={(e) => {
                      const copy = [...multiSymbols]
                      copy[idx] = e.target.value
                      setMultiSymbols(copy)
                    }}
                    className="text-[10px] bg-finma-bg border border-finma-border rounded px-1.5 py-0.5 text-finma-text-muted"
                  >
                    {sectorETFs.map(etf => (
                      <option key={etf.symbol} value={etf.symbol}>{etf.label}</option>
                    ))}
                  </select>
                </div>
                <div style={{ height: 'calc(100% - 32px)' }}>
                  <MiniChart symbol={sym} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {isFullscreen && (
        <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsFullscreen(false)} />
      )}
    </div>
  )
}

/* Mini TradingView grafiği — çoklu mod için */
function MiniChart({ symbol }: { symbol: string }) {
  return (
    <div className="w-full h-full">
      <iframe
        src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_${symbol}&symbol=${symbol}&interval=D&theme=dark&style=1&locale=tr&toolbar_bg=%23111827&hide_top_toolbar=0&save_image=0&studies=%5B%22STD%3BBollinger_Bands%22%5D&backgroundColor=%23111827`}
        className="w-full h-full border-0"
        allow="autoplay"
      />
    </div>
  )
}
