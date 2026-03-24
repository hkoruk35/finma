'use client'

import { useFinma514Categories } from '@/hooks/useFinma514'
import { TierBadge } from '@/components/terminal/finma514/TierBadge'
import { ScoreBarCompact } from '@/components/terminal/finma514/ScoreBar'
import { cn } from '@/lib/utils'
import { BarChart3, TrendingUp, TrendingDown, ChevronRight, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Finma514Stock } from '@/types/finma514'

/* ── Sektör badge renkleri ─────────────────────────────────────────────────── */

const SECTOR_COLOR: Record<string, string> = {
  Technology:            'bg-blue-500/10 border-blue-500/20 text-blue-400',
  Healthcare:            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  Financials:            'bg-finma-primary/10 border-finma-primary/20 text-finma-primary',
  'Consumer Discretionary': 'bg-orange-500/10 border-orange-500/20 text-orange-400',
  'Consumer Staples':    'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
  Energy:                'bg-red-500/10 border-red-500/20 text-red-400',
  Industrials:           'bg-cyan-500/10 border-cyan-500/20 text-cyan-400',
  Materials:             'bg-purple-500/10 border-purple-500/20 text-purple-400',
  Utilities:             'bg-teal-500/10 border-teal-500/20 text-teal-400',
  'Real Estate':         'bg-pink-500/10 border-pink-500/20 text-pink-400',
  'Communication Services': 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
}

function sectorColor(sector: string) {
  return SECTOR_COLOR[sector] ?? 'bg-white/5 border-white/10 text-finma-text-dim'
}

/* ── Hisse Kartı ───────────────────────────────────────────────────────────── */

function SectorCard({ stock }: { stock: Finma514Stock }) {
  const router = useRouter()
  const change = stock.change_1d ?? 0

  return (
    <button
      onClick={() => router.push(`/stock/${stock.ticker}`)}
      className="finma-card w-full text-left hover:border-finma-primary/30 transition-all group"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white finma-number group-hover:text-finma-primary transition-colors">
              {stock.ticker}
            </span>
            <TierBadge tier={stock.tier} />
          </div>
          <p className="text-xs text-finma-text-dim mt-0.5 truncate max-w-[160px]">
            {stock.company_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-white finma-number">${stock.price?.toFixed(2)}</p>
          <p className={cn(
            'text-xs font-semibold finma-number',
            change >= 0 ? 'text-finma-green' : 'text-finma-red'
          )}>
            {change >= 0 ? '+' : ''}{change.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Sektör badge */}
      <div className="mb-3">
        <span className={cn(
          'text-xs px-2 py-0.5 rounded-full border',
          sectorColor(stock.sector)
        )}>
          {stock.sector}
        </span>
      </div>

      {/* Skor */}
      <ScoreBarCompact score={stock.score} />

      {/* Metrikler */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <div>
          <p className="text-xs text-finma-text-dim">RSI</p>
          <p className={cn(
            'text-xs font-semibold finma-number',
            stock.rsi < 30 ? 'text-finma-red' : stock.rsi > 70 ? 'text-finma-yellow' : 'text-finma-green'
          )}>
            {stock.rsi?.toFixed(1)}
          </p>
        </div>
        <div>
          <p className="text-xs text-finma-text-dim">RVOL</p>
          <p className="text-xs font-semibold text-white finma-number">{stock.rvol?.toFixed(2)}x</p>
        </div>
        <div>
          <p className="text-xs text-finma-text-dim">5G %</p>
          <p className={cn(
            'text-xs font-semibold finma-number',
            (stock.change_5d ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red'
          )}>
            {(stock.change_5d ?? 0) >= 0 ? '+' : ''}{(stock.change_5d ?? 0).toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end mt-3">
        <span className="text-xs text-finma-text-dim group-hover:text-finma-primary transition-colors flex items-center gap-1">
          Detay <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </button>
  )
}

/* ── Ana Sayfa ─────────────────────────────────────────────────────────────── */

export default function SectorsPage() {
  const { data, isLoading, isError } = useFinma514Categories('tr')

  const leaders = (data?.categories?.sector_leaders ?? []) as Finma514Stock[]

  // Sektöre göre grupla
  const bySector = leaders.reduce((acc: Record<string, Finma514Stock[]>, s: Finma514Stock) => {
    const key = s.sector || 'Diger'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {} as Record<string, Finma514Stock[]>)

  const sectorNames = Object.keys(bySector).sort()

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── Baslik ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-finma-primary" />
          <h1 className="text-base font-bold text-white">Sektör Liderleri</h1>
          {!isLoading && (
            <span className="text-xs text-finma-text-dim px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
              {leaders.length} hisse · {sectorNames.length} sektör
            </span>
          )}
        </div>
        <p className="text-xs text-finma-text-dim">Her sektörden en yüksek skorlu hisse</p>
      </div>

      {/* ── Yukleniyor ── */}
      {isLoading && (
        <div className="finma-card flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-finma-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Hata ── (soft) */}
      {isError && !isLoading && leaders.length === 0 && (
        <div className="finma-card text-center py-12 space-y-3">
          <BarChart3 className="w-10 h-10 text-finma-text-dim mx-auto" />
          <p className="text-sm font-semibold text-white">Veri Yükleniyor</p>
          <p className="text-xs text-finma-text-dim">
            Veriler bağlanıyor, lütfen bekleyin veya sayfayı yenileyin.
          </p>
        </div>
      )}

      {/* ── Sektör grupları ── */}
      {!isLoading && leaders.length > 0 && sectorNames.map(sector => (
        <div key={sector} className="space-y-3">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-xs px-2.5 py-1 rounded-full border font-semibold',
              sectorColor(sector)
            )}>
              {sector}
            </span>
            <span className="text-xs text-finma-text-dim">
              {bySector[sector].length} hisse
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {(bySector[sector] as Finma514Stock[]).map((s: Finma514Stock) => (
              <SectorCard key={s.ticker} stock={s} />
            ))}
          </div>
        </div>
      ))}

      {/* ── Bot bekleniyor ── */}
      {!isLoading && !isError && !leaders.length && (
        <div className="finma-card text-center py-16 space-y-3">
          <BarChart3 className="w-10 h-10 text-finma-text-dim mx-auto" />
          <p className="text-sm font-semibold text-white">Veri Bekleniyor</p>
          <p className="text-xs text-finma-text-dim">
            FinMA514 botu NY 06:30 ve 12:00'de çalışır.
            <br />İlk çalışmadan sonra sektör verileri burada görünecek.
          </p>
        </div>
      )}
    </div>
  )
}
