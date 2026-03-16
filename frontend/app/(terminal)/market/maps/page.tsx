'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/shared/Card'
import { useTerminalStore } from '@/store/terminal'
import { Map, Clock, Maximize2, Minimize2, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Sektör → ETF eşlemesi ── */
const sectorETF: Record<string, string> = {
  'Teknoloji':           'XLK',
  'Finans':              'XLF',
  'Sağlık':              'XLV',
  'Tüketici İhtiyari':   'XLY',
  'Temel Tüketim':       'XLP',
  'Sanayi':              'XLI',
  'İletişim Hizmetleri': 'XLC',
  'Enerji':              'XLE',
  'Kamu Hizmetleri':     'XLU',
  'Gayrimenkul':         'XLRE',
  'Hammadde':            'XLB',
}

/* ── Tam ısı haritası verisi ── */
const heatmapData = [
  { sector: 'Teknoloji', change: -0.98, size: 30, stocks: [
    { ticker: 'AAPL',  change: -0.45, size: 9 },
    { ticker: 'MSFT',  change: -1.20, size: 8 },
    { ticker: 'NVDA',  change: -2.10, size: 7 },
    { ticker: 'GOOG',  change: -0.35, size: 5 },
    { ticker: 'META',  change:  0.15, size: 4 },
    { ticker: 'AVGO',  change: -1.55, size: 4 },
    { ticker: 'AMD',   change: -2.30, size: 3 },
  ]},
  { sector: 'Finans', change: -0.38, size: 20, stocks: [
    { ticker: 'JPM',   change: -0.52, size: 6 },
    { ticker: 'BAC',   change: -0.18, size: 5 },
    { ticker: 'WFC',   change:  0.22, size: 4 },
    { ticker: 'GS',    change: -0.65, size: 4 },
    { ticker: 'MS',    change: -0.42, size: 3 },
    { ticker: 'BLK',   change:  0.38, size: 3 },
  ]},
  { sector: 'Sağlık', change: -0.34, size: 17, stocks: [
    { ticker: 'UNH',   change:  0.12, size: 6 },
    { ticker: 'JNJ',   change: -0.55, size: 5 },
    { ticker: 'LLY',   change: -0.78, size: 6 },
    { ticker: 'ABBV',  change:  0.45, size: 4 },
    { ticker: 'MRK',   change: -0.30, size: 3 },
  ]},
  { sector: 'Tüketici İhtiyari', change: -0.57, size: 15, stocks: [
    { ticker: 'AMZN',  change: -0.82, size: 6 },
    { ticker: 'TSLA',  change: -1.45, size: 5 },
    { ticker: 'HD',    change:  0.18, size: 4 },
    { ticker: 'MCD',   change: -0.25, size: 3 },
    { ticker: 'NKE',   change: -0.60, size: 3 },
  ]},
  { sector: 'Sanayi', change: -0.57, size: 13, stocks: [
    { ticker: 'GE',    change:  0.35, size: 4 },
    { ticker: 'CAT',   change: -1.10, size: 4 },
    { ticker: 'UNP',   change: -0.42, size: 3 },
    { ticker: 'LMT',   change:  0.22, size: 3 },
    { ticker: 'RTX',   change:  0.48, size: 3 },
  ]},
  { sector: 'İletişim Hizmetleri', change: -0.73, size: 12, stocks: [
    { ticker: 'GOOGL', change: -0.38, size: 5 },
    { ticker: 'NFLX',  change: -1.25, size: 4 },
    { ticker: 'DIS',   change: -0.55, size: 3 },
    { ticker: 'T',     change:  0.12, size: 3 },
  ]},
  { sector: 'Temel Tüketim', change: 0.52, size: 10, stocks: [
    { ticker: 'PG',    change:  0.65, size: 4 },
    { ticker: 'KO',    change:  0.42, size: 3 },
    { ticker: 'PEP',   change:  0.38, size: 3 },
    { ticker: 'WMT',   change:  0.78, size: 4 },
  ]},
  { sector: 'Enerji', change: 0.36, size: 10, stocks: [
    { ticker: 'XOM',   change:  0.55, size: 4 },
    { ticker: 'CVX',   change:  0.28, size: 3 },
    { ticker: 'COP',   change:  0.15, size: 3 },
    { ticker: 'SLB',   change:  0.42, size: 3 },
  ]},
  { sector: 'Kamu Hizmetleri', change: 0.75, size: 6, stocks: [
    { ticker: 'NEE',   change:  0.95, size: 3 },
    { ticker: 'DUK',   change:  0.42, size: 3 },
    { ticker: 'SO',    change:  0.68, size: 2 },
  ]},
  { sector: 'Gayrimenkul', change: 0.01, size: 6, stocks: [
    { ticker: 'PLD',   change:  0.08, size: 3 },
    { ticker: 'AMT',   change: -0.05, size: 3 },
    { ticker: 'CCI',   change:  0.12, size: 2 },
  ]},
  { sector: 'Hammadde', change: -2.98, size: 7, stocks: [
    { ticker: 'LIN',   change: -2.50, size: 3 },
    { ticker: 'APD',   change: -3.20, size: 3 },
    { ticker: 'NEM',   change: -1.85, size: 2 },
    { ticker: 'FCX',   change: -3.50, size: 2 },
  ]},
]

function getHeatColor(change: number): string {
  if (change >= 2)     return 'bg-green-600'
  if (change >= 1)     return 'bg-green-700'
  if (change >= 0.25)  return 'bg-green-800'
  if (change >= -0.25) return 'bg-gray-700'
  if (change >= -1)    return 'bg-red-900'
  if (change >= -2)    return 'bg-red-800'
  return 'bg-red-700'
}

export default function MapsPage() {
  const { setChartSymbol } = useTerminalStore()
  const [activeSymbol, setActiveSymbol] = useState('XLK')
  const [activeLabel, setActiveLabel]   = useState('Teknoloji — XLK')
  const [selectedSector, setSelectedSector] = useState('Teknoloji')
  const [isFullscreen, setIsFullscreen] = useState(false)

  /* İlk açılışta ilk sektör grafiği */
  useEffect(() => {
    setChartSymbol('XLK')
  }, [setChartSymbol])

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const handleSectorClick = (sector: string) => {
    const etf = sectorETF[sector]
    if (!etf) return
    setActiveSymbol(etf)
    setActiveLabel(`${sector} — ${etf}`)
    setSelectedSector(sector)
    setChartSymbol(etf)
  }

  const handleTickerClick = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setActiveSymbol(ticker)
    setActiveLabel(ticker)
    setSelectedSector('')
    setChartSymbol(ticker)
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Başlık ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa — Sektör Haritası
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {updateTime}</span>
        </div>
      </div>

      {/* ── Isı Haritası (yatayda tam kaydırmalı) ── */}
      <Card padding="sm">
        <div className="flex items-center flex-wrap gap-2 pb-2 border-b border-finma-border mb-3">
          <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
            Sektörel Isı Haritası — Günlük Performans
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-[9px] text-finma-text-dim">
            <span className="flex items-center gap-0.5 text-finma-text-dim/60 mr-1">
              <ChevronRight className="w-3 h-3" /> Kaydırarak tüm sektörleri görün · Tıklayarak grafiği açın
            </span>
            {[
              { color: 'bg-green-600', label: '+2%'   },
              { color: 'bg-green-800', label: '+0.25%' },
              { color: 'bg-gray-700',  label: '0'      },
              { color: 'bg-red-900',   label: '-1%'    },
              { color: 'bg-red-700',   label: '-2%'    },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-0.5 ml-1">
                <span className={cn('w-3 h-3 rounded-sm inline-block', color)} />{label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            {heatmapData.map(sector => (
              <div
                key={sector.sector}
                className="flex flex-col gap-0.5"
                style={{ width: `${Math.max(sector.size * 5, 100)}px` }}
              >
                {/* Sektör başlığı */}
                <div
                  onClick={() => handleSectorClick(sector.sector)}
                  className={cn(
                    'rounded-t-md px-2 py-2.5 text-center cursor-pointer transition-all hover:brightness-125 select-none',
                    getHeatColor(sector.change),
                    selectedSector === sector.sector
                      ? 'ring-2 ring-finma-primary ring-offset-1 ring-offset-finma-bg'
                      : ''
                  )}
                >
                  <div className="text-[11px] font-bold text-white leading-tight">{sector.sector}</div>
                  <div className="text-[10px] text-white/75 finma-number">{sectorETF[sector.sector]}</div>
                  <div className="text-[11px] font-bold text-white finma-number mt-0.5">
                    {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                  </div>
                </div>

                {/* Hisse kartları */}
                <div className="flex flex-wrap gap-0.5">
                  {sector.stocks.map(stock => (
                    <div
                      key={stock.ticker}
                      onClick={(e) => handleTickerClick(stock.ticker, e)}
                      className={cn(
                        'rounded-sm px-1 py-1.5 text-center cursor-pointer hover:brightness-125 transition-all select-none',
                        getHeatColor(stock.change),
                        activeSymbol === stock.ticker && !selectedSector
                          ? 'ring-2 ring-white/80' : ''
                      )}
                      style={{ flex: `${stock.size} 0 0`, minWidth: '44px' }}
                    >
                      <div className="text-[10px] font-bold text-white finma-number">{stock.ticker}</div>
                      <div className="text-[9px] text-white/75 finma-number mt-0.5">
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ── Tek Büyük Grafik Ekranı ── */}
      <div className={cn(
          'bg-finma-card border border-finma-border rounded-lg overflow-hidden relative',
          isFullscreen ? 'fixed inset-4 z-50' : 'h-[350px] md:h-[560px]'
        )}
      >
        {/* Grafik toolbar */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-1.5 bg-finma-bg/90 backdrop-blur-sm border-b border-finma-border/50">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-finma-primary">{activeLabel}</span>
            <span className="text-[9px] text-finma-text-dim/60">
              · Isı haritasından sektör veya hisse seçin
            </span>
          </div>
          <button
            onClick={() => setIsFullscreen(f => !f)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-medium bg-finma-card border border-finma-border text-finma-text-dim hover:text-finma-text hover:border-finma-primary/50 transition-colors"
          >
            {isFullscreen
              ? <><Minimize2 className="w-3 h-3" /> Küçült</>
              : <><Maximize2 className="w-3 h-3" /> Tam Ekran</>
            }
          </button>
        </div>

        {/* TradingView iframe — key ile sembol değişince yeniden yüklenir */}
        <div className="w-full h-full pt-8">
          <iframe
            key={activeSymbol}
            src={`https://s.tradingview.com/widgetembed/?frameElementId=tv_maps_main&symbol=${activeSymbol}&interval=D&theme=dark&style=1&locale=tr&toolbar_bg=%23111827&hide_top_toolbar=0&save_image=0&studies=%5B%22STD%3ABollinger_Bands%22%2C%22STD%3ARSI%22%5D&backgroundColor=%23111827&withdateranges=1&allow_symbol_change=1`}
            className="w-full h-full border-0"
            allow="autoplay"
          />
        </div>
      </div>

      {/* Tam ekran arka plan overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/70 z-40"
          onClick={() => setIsFullscreen(false)}
        />
      )}

    </div>
  )
}
