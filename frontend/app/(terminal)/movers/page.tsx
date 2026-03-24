'use client'

import { useState } from 'react'
import { useFinma514Categories } from '@/hooks/useFinma514'
import { TierBadge } from '@/components/terminal/finma514/TierBadge'
import { ScoreBarCompact } from '@/components/terminal/finma514/ScoreBar'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Flame, AlertCircle, ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Finma514Stock } from '@/types/finma514'

/* ── Tab tanımları ─────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'high_volume',     label: 'Yüksek Hacim',  icon: Flame,       color: 'text-finma-yellow' },
  { key: 'top_gainers',     label: 'En Yükselenler', icon: TrendingUp,  color: 'text-finma-green'  },
  { key: 'oversold_losers', label: 'Aşırı Satım',   icon: TrendingDown, color: 'text-finma-red'   },
] as const

type TabKey = typeof TABS[number]['key']

/* ── Satır bileşeni ────────────────────────────────────────────────────────── */

function MoverRow({ stock, rank }: { stock: Finma514Stock; rank: number }) {
  const router  = useRouter()
  const change  = stock.change_1d ?? 0
  const isUp    = change >= 0

  return (
    <button
      onClick={() => router.push(`/stock/${stock.ticker}`)}
      className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/3 hover:bg-white/8 border border-white/5 hover:border-finma-primary/20 transition-all group text-left"
    >
      {/* Sıra numarası */}
      <span className="text-xs font-bold text-finma-text-dim/50 w-5 text-center finma-number shrink-0">
        {rank}
      </span>

      {/* Ticker + şirket */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white finma-number group-hover:text-finma-primary transition-colors">
            {stock.ticker}
          </span>
          <TierBadge tier={stock.tier} />
        </div>
        <p className="text-xs text-finma-text-dim truncate">{stock.company_name}</p>
      </div>

      {/* Skor */}
      <div className="w-20 hidden sm:block">
        <ScoreBarCompact score={stock.score} />
      </div>

      {/* RVOL */}
      <div className="text-center w-14 hidden md:block">
        <p className="text-xs text-finma-text-dim">RVOL</p>
        <p className="text-xs font-semibold text-finma-yellow finma-number">{stock.rvol?.toFixed(1)}x</p>
      </div>

      {/* RSI */}
      <div className="text-center w-14 hidden md:block">
        <p className="text-xs text-finma-text-dim">RSI</p>
        <p className={cn(
          'text-xs font-semibold finma-number',
          stock.rsi < 30 ? 'text-finma-red' : stock.rsi > 70 ? 'text-finma-yellow' : 'text-finma-green'
        )}>
          {stock.rsi?.toFixed(1)}
        </p>
      </div>

      {/* Fiyat + değişim */}
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-white finma-number">${stock.price?.toFixed(2)}</p>
        <p className={cn('text-xs font-semibold finma-number', isUp ? 'text-finma-green' : 'text-finma-red')}>
          {isUp ? '+' : ''}{change.toFixed(2)}%
        </p>
      </div>

      <ChevronRight className="w-3.5 h-3.5 text-finma-text-dim group-hover:text-finma-primary transition-colors shrink-0" />
    </button>
  )
}

/* ── Ana Sayfa ─────────────────────────────────────────────────────────────── */

export default function MoversPage() {
  const [tab, setTab] = useState<TabKey>('high_volume')
  const { data, isLoading, isError } = useFinma514Categories('tr')

  const cats = data?.categories
  const stocks: Finma514Stock[] = cats
    ? ((cats[tab as keyof typeof cats] ?? []) as Finma514Stock[])
    : []

  const activeTab = TABS.find(t => t.key === tab)!

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Baslik ── */}
      <div className="flex items-center gap-2">
        <activeTab.icon className={cn('w-5 h-5', activeTab.color)} />
        <h1 className="text-base font-bold text-white">Market Movers</h1>
        {!isLoading && (
          <span className="text-xs text-finma-text-dim px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            {stocks.length} hisse
          </span>
        )}
      </div>

      {/* ── Tablar ── */}
      <div className="flex gap-2 bg-white/3 rounded-xl p-1 border border-white/5">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all',
                tab === t.key
                  ? 'bg-finma-surface border border-white/10 text-white shadow-sm'
                  : 'text-finma-text-dim hover:text-white'
              )}
            >
              <Icon className={cn('w-3.5 h-3.5', tab === t.key ? t.color : '')} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── Tab aciklamasi ── */}
      <div className={cn(
        'text-xs px-3 py-2 rounded-lg border',
        tab === 'high_volume'
          ? 'text-finma-yellow border-finma-yellow/20 bg-finma-yellow/5'
          : tab === 'top_gainers'
          ? 'text-finma-green border-finma-green/20 bg-finma-green/5'
          : 'text-finma-red border-finma-red/20 bg-finma-red/5'
      )}>
        {tab === 'high_volume'  && 'Günlük ortalama hacmin en az 1.5x üzerinde işlem gören 7 hisse'}
        {tab === 'top_gainers'  && 'Günlük yüzde kazanç sıralamasında öne çıkan 7 hisse'}
        {tab === 'oversold_losers' && 'RSI < 30 ve günlük kayıp liderliği gösteren 7 hisse'}
      </div>

      {/* ── Yukleniyor ── */}
      {isLoading && (
        <div className="finma-card flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-finma-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Hata ── (soft — isError tek başına kırmızı gösterme) */}
      {isError && !isLoading && stocks.length === 0 && (
        <div className="finma-card text-center py-12 space-y-3">
          <activeTab.icon className="w-10 h-10 text-finma-text-dim mx-auto" />
          <p className="text-sm font-semibold text-white">Veri Yükleniyor</p>
          <p className="text-xs text-finma-text-dim">
            Veriler bağlanıyor, lütfen bekleyin veya sayfayı yenileyin.
          </p>
        </div>
      )}

      {/* ── Liste ── */}
      {!isLoading && stocks.length > 0 && (
        <div className="space-y-2">
          {/* Header */}
          <div className="flex items-center gap-3 px-3 text-xs text-finma-text-dim/60">
            <span className="w-5">#</span>
            <span className="flex-1">Hisse</span>
            <span className="w-20 hidden sm:block">Skor</span>
            <span className="w-14 hidden md:block text-center">RVOL</span>
            <span className="w-14 hidden md:block text-center">RSI</span>
            <span className="w-20 text-right">Fiyat</span>
            <span className="w-4" />
          </div>
          {stocks.map((s, i) => (
            <MoverRow key={s.ticker} stock={s} rank={i + 1} />
          ))}
        </div>
      )}

      {/* ── Bot bekleniyor ── */}
      {!isLoading && !isError && !stocks.length && (
        <div className="finma-card text-center py-16 space-y-3">
          <activeTab.icon className="w-10 h-10 text-finma-text-dim mx-auto" />
          <p className="text-sm font-semibold text-white">Veri Bekleniyor</p>
          <p className="text-xs text-finma-text-dim">
            FinMA514 botu NY 06:30 ve 12:00'de çalışır.
          </p>
        </div>
      )}
    </div>
  )
}
