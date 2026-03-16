'use client'

import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import { useSectors } from '@/hooks/useMarketData'
import { BarChart3, Clock, TrendingUp, TrendingDown, Activity, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PerfRow {
  sector: string
  etf: string
  change: number
  price: number
}

const mockPerfData: PerfRow[] = [
  { sector: 'Enerji', etf: 'XLE', change: 0.36, price: 46.96 },
  { sector: 'Kamu Hizmetleri', etf: 'XLU', change: 0.75, price: 72.50 },
  { sector: 'Temel Tüketim', etf: 'XLP', change: 0.52, price: 78.30 },
  { sector: 'Gayrimenkul', etf: 'XLRE', change: 0.01, price: 40.20 },
  { sector: 'Sağlık', etf: 'XLV', change: -0.34, price: 149.80 },
  { sector: 'Finans', etf: 'XLF', change: -0.38, price: 48.89 },
  { sector: 'Tüketici İhtiyari', etf: 'XLY', change: -0.57, price: 118.86 },
  { sector: 'Sanayi', etf: 'XLI', change: -0.57, price: 164.65 },
  { sector: 'İletişim Hizmetleri', etf: 'XLC', change: -0.73, price: 84.74 },
  { sector: 'Teknoloji', etf: 'XLK', change: -0.98, price: 49.19 },
  { sector: 'Hammadde', etf: 'XLB', change: -2.98, price: 42.25 },
]

type PeriodKey = '1d' | '5d' | '1mo' | '3mo' | '6mo' | '1y' | 'ytd'

const periods: { key: PeriodKey; label: string }[] = [
  { key: '1d', label: '1 Gün' },
  { key: '5d', label: '1 Hafta' },
  { key: '1mo', label: '1 Ay' },
  { key: '3mo', label: '3 Ay' },
  { key: '6mo', label: '6 Ay' },
  { key: '1y', label: '1 Yıl' },
  { key: 'ytd', label: 'YBB' },
]

function PerfBar({ value, maxAbs }: { value: number; maxAbs: number }) {
  const pct = Math.abs(value) / maxAbs * 100
  return (
    <div className="flex items-center gap-1.5 flex-1">
      <div className="flex-1 h-4 bg-finma-bg rounded-sm overflow-hidden relative">
        <div
          className={cn(
            'h-full rounded-sm transition-all',
            value >= 0 ? 'bg-finma-green/50' : 'bg-finma-red/50'
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(
        'finma-number text-[11px] font-semibold w-14 text-right',
        value >= 0 ? 'text-finma-green' : 'text-finma-red'
      )}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  )
}

export default function PerformancePage() {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>('1mo')
  const { data: sectorsData, isLoading } = useSectors(selectedPeriod)

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  // API'den veya mock'tan veri al
  const perfData: PerfRow[] = sectorsData && sectorsData.length > 0
    ? sectorsData.map(s => ({
        sector: s.sector_tr || s.sector,
        etf: s.etf,
        change: s.change_pct,
        price: s.price,
      }))
    : mockPerfData

  const sorted = [...perfData].sort((a, b) => b.change - a.change)
  const maxAbs = Math.max(...sorted.map(r => Math.abs(r.change)), 0.01)

  const positiveCount = perfData.filter(r => r.change > 0).length
  const negativeCount = perfData.filter(r => r.change < 0).length
  const avgPerf = perfData.reduce((sum, r) => sum + r.change, 0) / perfData.length
  const bestSector = sorted[0]
  const worstSector = sorted[sorted.length - 1]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa — Sektörel Performans
          </span>
          {isLoading && <span className="text-[9px] text-finma-yellow animate-pulse">Yükleniyor...</span>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {updateTime}</span>
        </div>
      </div>

      {/* Periyot Seçici */}
      <div className="flex flex-wrap gap-1.5">
        {periods.map(p => (
          <button
            key={p.key}
            onClick={() => setSelectedPeriod(p.key)}
            className={cn(
              'px-4 py-2 rounded text-xs font-semibold transition-all',
              selectedPeriod === p.key
                ? 'bg-finma-primary text-white'
                : 'bg-finma-card border border-finma-border text-finma-text-muted hover:text-finma-text hover:border-finma-primary/50'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3 h-3 text-finma-text-dim" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">Ortalama</span>
          </div>
          <span className={cn('finma-number text-lg font-bold', avgPerf >= 0 ? 'text-finma-green' : 'text-finma-red')}>
            {avgPerf >= 0 ? '+' : ''}{avgPerf.toFixed(2)}%
          </span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3 h-3 text-finma-green" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">Yükselen</span>
          </div>
          <span className="finma-number text-lg font-bold text-finma-green">{positiveCount}</span>
          <span className="text-[10px] text-finma-text-dim ml-1">/ {perfData.length}</span>
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-1">
            <Award className="w-3 h-3 text-finma-cyan" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">En İyi</span>
          </div>
          {bestSector && (
            <>
              <div className="text-[11px] font-semibold text-finma-cyan">{bestSector.sector}</div>
              <span className="finma-number text-xs text-finma-green font-bold">
                {bestSector.change >= 0 ? '+' : ''}{bestSector.change.toFixed(2)}%
              </span>
            </>
          )}
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3 h-3 text-finma-red" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">En Kötü</span>
          </div>
          {worstSector && (
            <>
              <div className="text-[11px] font-semibold text-finma-red">{worstSector.sector}</div>
              <span className="finma-number text-xs text-finma-red font-bold">
                {worstSector.change.toFixed(2)}%
              </span>
            </>
          )}
        </Card>
      </div>

      {/* Performans Çubuk Grafiği */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border mb-3">
          <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
            {periods.find(p => p.key === selectedPeriod)?.label} Performans Sıralaması
          </span>
        </div>
        <div className="space-y-1">
          {sorted.map((row, idx) => (
            <div key={row.etf} className="flex items-center gap-3 hover:bg-finma-card-hover rounded-md px-3 py-2 transition-colors cursor-pointer">
              <span className="text-[10px] finma-number text-finma-text-dim w-4">{idx + 1}.</span>
              <span className="text-[11px] text-finma-text font-medium w-36 shrink-0">{row.sector}</span>
              <span className="text-[9px] text-finma-primary finma-number w-10 shrink-0">{row.etf}</span>
              <PerfBar value={row.change} maxAbs={maxAbs} />
              <span className="text-[9px] text-finma-text-dim finma-number w-16 text-right shrink-0">
                ${row.price.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
