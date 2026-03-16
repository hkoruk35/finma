'use client'

import { useEffect } from 'react'
import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { MarketContext } from '@/components/terminal/MarketContext'
import { Card } from '@/components/shared/Card'
import { mockIndices } from '@/lib/mock-data'
import { useTerminalStore } from '@/store/terminal'
import { useIndices, useSectors } from '@/hooks/useMarketData'
import { Eye, Globe, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

/* Sektör verileri — mock fallback */
const mockSectorData = [
  { name: 'Teknoloji', etf: 'XLK', change: -0.98, leaders: ['AAPL', 'MSFT', 'NVDA'] },
  { name: 'Finans', etf: 'XLF', change: -0.38, leaders: ['JPM', 'BAC', 'WFC'] },
  { name: 'Sağlık', etf: 'XLV', change: -0.34, leaders: ['UNH', 'JNJ', 'LLY'] },
  { name: 'Tüketici İhtiyari', etf: 'XLY', change: -0.57, leaders: ['AMZN', 'TSLA', 'HD'] },
  { name: 'Sanayi', etf: 'XLI', change: -0.57, leaders: ['GE', 'CAT', 'UNP'] },
  { name: 'İletişim Hizmetleri', etf: 'XLC', change: -0.73, leaders: ['GOOG', 'META', 'NFLX'] },
  { name: 'Enerji', etf: 'XLE', change: 0.36, leaders: ['XOM', 'CVX', 'COP'] },
  { name: 'Kamu Hizmetleri', etf: 'XLU', change: 0.75, leaders: ['NEE', 'DUK', 'SO'] },
  { name: 'Gayrimenkul', etf: 'XLRE', change: 0.01, leaders: ['PLD', 'AMT', 'CCI'] },
  { name: 'Hammadde', etf: 'XLB', change: -2.98, leaders: ['LIN', 'APD', 'SHW'] },
  { name: 'Temel Tüketim', etf: 'XLP', change: 0.52, leaders: ['PG', 'KO', 'PEP'] },
]

// Sektör liderleri (statik — API'den gelmiyor)
const sectorLeaders: Record<string, string[]> = {
  XLK: ['AAPL', 'MSFT', 'NVDA'], XLF: ['JPM', 'BAC', 'WFC'], XLV: ['UNH', 'JNJ', 'LLY'],
  XLY: ['AMZN', 'TSLA', 'HD'], XLI: ['GE', 'CAT', 'UNP'], XLC: ['GOOG', 'META', 'NFLX'],
  XLE: ['XOM', 'CVX', 'COP'], XLU: ['NEE', 'DUK', 'SO'], XLRE: ['PLD', 'AMT', 'CCI'],
  XLB: ['LIN', 'APD', 'SHW'], XLP: ['PG', 'KO', 'PEP'],
}

export default function MarketPage() {
  const { setChartSymbol } = useTerminalStore()
  const { data: indicesData } = useIndices()
  const { data: sectorsData } = useSectors('1mo')

  const indices = indicesData && indicesData.length > 0 ? indicesData : mockIndices

  // Sektör verisini API'den veya mock'tan al
  const sectorData = sectorsData && sectorsData.length > 0
    ? sectorsData.map(s => ({
        name: s.sector_tr || s.sector,
        etf: s.etf,
        change: s.change_pct,
        price: s.price,
        leaders: sectorLeaders[s.etf] || [],
      }))
    : mockSectorData

  useEffect(() => {
    if (indices.length > 0) {
      setChartSymbol(indices[0].symbol)
    }
  }, [setChartSymbol, indices])

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa — Genel Bakış
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {updateTime}</span>
        </div>
      </div>

      {/* Piyasa Bağlamı — hover ile grafik değişir */}
      <MarketContext indices={indices} />

      {/* Grafik */}
      <div
        className="w-full bg-finma-card border border-finma-border rounded-lg overflow-hidden"
        style={{ height: '460px' }}
      >
        <TradingViewWidget />
      </div>

      {/* Sektörel Özet */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border">
          <Globe className="w-3.5 h-3.5 text-finma-cyan" />
          <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
            Sektörel Performans
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mt-3">
          {sectorData.map(sector => (
            <div
              key={sector.etf}
              onClick={() => setChartSymbol(sector.etf)}
              onMouseEnter={() => setChartSymbol(sector.etf)}
              className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 hover:border-finma-primary/40 hover:bg-finma-card-hover transition-all cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-finma-text">{sector.name}</span>
                <span className={cn(
                  'finma-number text-xs font-bold',
                  sector.change >= 0 ? 'text-finma-green' : 'text-finma-red'
                )}>
                  {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                </span>
              </div>
              {'price' in sector && (
                <div className="text-[10px] text-finma-text-dim mb-1">
                  Fiyat: <span className="finma-number">${(sector as any).price?.toFixed(2)}</span>
                </div>
              )}
              <div className="flex items-center gap-1 mt-1.5">
                <span className="text-[9px] text-finma-primary finma-number font-medium">{sector.etf}</span>
                <span className="text-[9px] text-finma-border">|</span>
                {sector.leaders.map(l => (
                  <span key={l} className="text-[9px] bg-finma-primary/10 text-finma-primary px-1.5 py-0.5 rounded finma-number">
                    {l}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
