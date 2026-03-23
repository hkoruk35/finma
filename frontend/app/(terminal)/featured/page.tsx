'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'
import { FinMAChart } from '@/components/terminal/FinMAChart'
import {
  Star, TrendingUp, TrendingDown, RefreshCw, Maximize2, Minimize2,
  LayoutGrid, Columns2, Square, Activity, Lock, BarChart3, Zap
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Opportunity {
  rank: number
  ticker: string
  company_name: string
  sector: string
  price: number
  score: number
  entry_zone: string
  stop_loss: number
  target: number
  potential_pct: number
  reason?: string
}

interface LiveQuote { price: number; change_pct: number }
type LayoutMode = 1 | 2 | 4

// ─── Sector Badge Colors ─────────────────────────────────────────────────────
const SECTOR_COLORS: Record<string, string> = {
  Technology: 'bg-blue-900/30 text-blue-400 border-blue-700/40',
  Energy: 'bg-amber-900/30 text-amber-400 border-amber-700/40',
  Healthcare: 'bg-green-900/30 text-green-400 border-green-700/40',
  Financials: 'bg-cyan-900/30 text-cyan-400 border-cyan-700/40',
  'Consumer Discretionary': 'bg-purple-900/30 text-purple-400 border-purple-700/40',
  Industrials: 'bg-orange-900/30 text-orange-400 border-orange-700/40',
  Materials: 'bg-yellow-900/30 text-yellow-400 border-yellow-700/40',
  'Communication Services': 'bg-pink-900/30 text-pink-400 border-pink-700/40',
  'Real Estate': 'bg-teal-900/30 text-teal-400 border-teal-700/40',
  Utilities: 'bg-lime-900/30 text-lime-400 border-lime-700/40',
  'Consumer Staples': 'bg-rose-900/30 text-rose-400 border-rose-700/40',
}

const sectorLabel = (s: string) => {
  const map: Record<string, string> = {
    Technology: 'Teknoloji', Energy: 'Enerji', Healthcare: 'Sağlık',
    Financials: 'Finans', 'Consumer Discretionary': 'Tük. İhtiyari',
    Industrials: 'Sanayi', Materials: 'Hammadde',
    'Communication Services': 'İletişim', 'Real Estate': 'Gayrimenkul',
    Utilities: 'Kamu Hiz.', 'Consumer Staples': 'Temel Tük.',
  }
  return map[s] || s
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────
export default function FeaturedPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isPro = user?.subscription_tier === 'pro' || isAdmin

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [runAt, setRunAt] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingWatchlist, setAddingWatchlist] = useState<string | null>(null)
  const [watchStatus, setWatchStatus] = useState<{ ticker: string; ok: boolean } | null>(null)

  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(1)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const chartPanelRef = useRef<HTMLDivElement>(null)
  const [liveQuotes, setLiveQuotes] = useState<Record<string, LiveQuote>>({})

  // ─── Veri Yükleme ──────────────────────────────────────────────────────
  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getOpportunities()
      const opps: Opportunity[] = data?.opportunities || []
      setOpportunities(opps)
      setRunAt(data?.run_at || '')

      if (opps.length > 0) {
        const tickers = opps.map((o) => o.ticker).slice(0, 10)
        try {
          const quotes = await api.getBatchQuotes(tickers)
          const map: Record<string, LiveQuote> = {}
          quotes.forEach((q: any) => {
            if (q.symbol && q.price > 0)
              map[q.symbol] = { price: q.price, change_pct: q.change_pct || 0 }
          })
          setLiveQuotes(map)
        } catch {}
      }
    } catch {
      setError('Veri alınamadı')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchOpportunities() }, [fetchOpportunities])

  // ─── Ticker Seçimi ────────────────────────────────────────────────────
  const handleSelectTicker = (ticker: string) => {
    setSelectedTickers(prev => {
      if (prev[0] === ticker) return prev
      return [ticker, ...prev.filter(t => t !== ticker)].slice(0, 4)
    })
  }

  // ─── Akıllı Takip ────────────────────────────────────────────────────
  const handleAddToWatchlist = async (opp: Opportunity) => {
    setAddingWatchlist(opp.ticker)
    try {
      await api.addToWatchlist({
        ticker: opp.ticker,
        company_name: opp.company_name,
        entry_price: opp.price,
        target_price: opp.target,
        stop_loss: opp.stop_loss,
        notes: `ATMACA V113 - Rank ${opp.rank}`,
      })
      setWatchStatus({ ticker: opp.ticker, ok: true })
    } catch {
      setWatchStatus({ ticker: opp.ticker, ok: false })
    } finally {
      setAddingWatchlist(null)
      setTimeout(() => setWatchStatus(null), 3000)
    }
  }

  // ─── Fullscreen ───────────────────────────────────────────────────────
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      chartPanelRef.current?.requestFullscreen?.().catch(() => {})
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.().catch(() => {})
      setIsFullscreen(false)
    }
  }

  const chartGridClass = layoutMode === 4 ? 'grid-cols-2 grid-rows-2' : layoutMode === 2 ? 'grid-cols-2' : 'grid-cols-1'
  const filledTickers: (string | null)[] = [
    ...selectedTickers.slice(0, layoutMode),
    ...Array(Math.max(0, layoutMode - selectedTickers.length)).fill(null),
  ]

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">

      {/* BAŞLIK */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-finma-yellow" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Günlük Fırsatlar — ATMACA V113
          </span>
          <span className="text-[9px] text-finma-text-dim bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
            NY 11:00 · 13:05 · 15:00
          </span>
          {runAt && (
            <span className="text-[9px] text-finma-green bg-finma-green/10 px-2 py-0.5 rounded-full border border-finma-green/20">
              Son: {runAt}
            </span>
          )}
        </div>
        <button onClick={fetchOpportunities} disabled={loading}
          className="flex items-center gap-1.5 text-[10px] text-finma-text-dim hover:text-finma-text transition-colors">
          <RefreshCw className={cn('w-3 h-3', loading && 'animate-spin')} />
          Yenile
        </button>
      </div>

      {/* ANA İÇERİK */}
      <div className="flex gap-4" style={{ minHeight: 560 }}>

        {/* ─── Sol Panel ─────────────────────────────────────────────── */}
        <div className="w-[500px] shrink-0">
          <Card padding="none" className="h-full flex flex-col">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-5 h-5 animate-spin text-finma-primary" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-finma-text-dim text-xs">
                <Activity className="w-6 h-6 opacity-40" />
                {error}
                <button onClick={fetchOpportunities} className="text-finma-primary hover:underline text-[10px]">
                  Tekrar dene
                </button>
              </div>
            ) : opportunities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 gap-2 text-finma-text-dim text-xs">
                <BarChart3 className="w-6 h-6 opacity-30" />
                Henüz tarama yok. Bot NY 11:00, 13:05, 15:00'de çalışır.
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="grid gap-0 text-[9px] font-bold text-finma-text-dim uppercase tracking-wider px-3 py-2 border-b border-finma-border/50 bg-finma-bg/40"
                  style={{ gridTemplateColumns: '28px 1fr 80px 68px 66px 76px' }}>
                  <span>#</span><span>Hisse / Şirket</span><span>Sektör</span>
                  <span className="text-right">Alım</span>
                  <span className="text-right">24s</span>
                  <span className="text-center">İşlem</span>
                </div>
                {/* Rows */}
                <div className="overflow-y-auto flex-1">
                  {opportunities.map(opp => {
                    const lq = liveQuotes[opp.ticker]
                    const changePct = lq?.change_pct ?? 0
                    const livePrice = lq?.price ?? opp.price
                    const isSelected = selectedTickers[0] === opp.ticker
                    const isLocked = !isPro && opp.rank > 1

                    return (
                      <div
                        key={opp.ticker}
                        onClick={() => !isLocked && handleSelectTicker(opp.ticker)}
                        className={cn(
                          'grid gap-0 px-3 py-2.5 border-b border-finma-border/20 text-xs transition-all',
                          isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-finma-primary/5',
                          isSelected && 'bg-finma-primary/10 border-l-2 border-l-finma-primary'
                        )}
                        style={{ gridTemplateColumns: '28px 1fr 80px 68px 66px 76px' }}
                      >
                        {/* # */}
                        <span className="text-finma-text-dim finma-number text-[10px] self-center">
                          {isLocked ? <Lock className="w-3 h-3" /> : opp.rank}
                        </span>

                        {/* Hisse */}
                        <div className="flex flex-col gap-0.5 min-w-0 self-center">
                          <span className="font-bold text-finma-primary finma-number leading-none">{opp.ticker}</span>
                          <span className="text-finma-text-dim text-[9px] truncate leading-none">{opp.company_name}</span>
                        </div>

                        {/* Sektör */}
                        <div className="self-center">
                          <span className={cn('text-[8px] px-1.5 py-0.5 rounded border font-bold uppercase whitespace-nowrap',
                            SECTOR_COLORS[opp.sector] || 'bg-white/5 text-finma-text-dim border-white/10')}>
                            {sectorLabel(opp.sector)}
                          </span>
                        </div>

                        {/* Alım */}
                        <div className="text-right self-center">
                          <span className="finma-number text-white font-bold text-[10px]">${livePrice.toFixed(2)}</span>
                          <div className="text-[7px] text-finma-text-dim">Hdf: ${opp.target.toFixed(2)}</div>
                        </div>

                        {/* 24s */}
                        <div className={cn('text-right self-center finma-number font-bold text-[10px]',
                          changePct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                          <div className="flex items-center justify-end gap-0.5">
                            {changePct >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                          </div>
                          <div className="text-[7px] text-finma-green/70">+{opp.potential_pct.toFixed(1)}%↑</div>
                        </div>

                        {/* İşlem */}
                        <div className="text-center self-center" onClick={e => e.stopPropagation()}>
                          {isLocked ? (
                            <span className="text-[8px] text-finma-text-dim">Pro</span>
                          ) : watchStatus?.ticker === opp.ticker ? (
                            <span className={cn('text-[9px] font-bold',
                              watchStatus.ok ? 'text-finma-green' : 'text-finma-red')}>
                              {watchStatus.ok ? '✓ Eklendi' : '✗ Hata'}
                            </span>
                          ) : (
                            <button
                              onClick={() => handleAddToWatchlist(opp)}
                              disabled={addingWatchlist === opp.ticker}
                              className={cn(
                                'flex items-center gap-1 text-[9px] px-1.5 py-1 rounded font-medium transition-all mx-auto',
                                addingWatchlist === opp.ticker
                                  ? 'bg-finma-yellow/30 text-white cursor-not-allowed'
                                  : 'bg-finma-yellow/10 text-finma-yellow border border-finma-yellow/30 hover:bg-finma-yellow/25'
                              )}
                            >
                              <Star className="w-2.5 h-2.5" />
                              {addingWatchlist === opp.ticker ? '...' : 'Akıllı Takip'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* ─── Sağ Panel: Grafik ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0" ref={chartPanelRef}>
          <Card padding="sm" className="h-full flex flex-col">
            {/* Kontroller */}
            <div className="flex items-center justify-between mb-3 shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedTickers.length > 0
                  ? selectedTickers.slice(0, layoutMode).map(t => (
                    <span key={t} className="text-[10px] font-bold text-finma-primary finma-number bg-finma-primary/10 px-2 py-0.5 rounded border border-finma-primary/30">
                      {t}
                    </span>
                  ))
                  : <span className="text-[10px] text-finma-text-dim">← Soldan bir hisse seçin</span>
                }
              </div>
              <div className="flex items-center gap-1">
                <div className="flex items-center bg-finma-bg rounded border border-finma-border/30">
                  {([1, 2, 4] as LayoutMode[]).map(mode => (
                    <button key={mode} onClick={() => setLayoutMode(mode)}
                      className={cn('flex items-center justify-center w-7 h-6 transition-all',
                        layoutMode === mode ? 'bg-finma-primary/20 text-finma-primary' : 'text-finma-text-dim hover:text-finma-text')}
                      title={mode === 1 ? 'Tek' : mode === 2 ? 'İki' : 'Dört'}>
                      {mode === 1 ? <Square className="w-3 h-3" /> : mode === 2 ? <Columns2 className="w-3 h-3" /> : <LayoutGrid className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
                <button onClick={toggleFullscreen}
                  className="flex items-center justify-center w-7 h-6 text-finma-text-dim hover:text-finma-text bg-finma-bg rounded border border-finma-border/30 transition-all">
                  {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Grafik */}
            {selectedTickers.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-finma-text-dim gap-3">
                <BarChart3 className="w-12 h-12 opacity-10" />
                <span className="text-xs">Grafik için sol listeden bir hisse seçin</span>
              </div>
            ) : (
              <div className={cn('flex-1 grid gap-2', chartGridClass)}>
                {filledTickers.map((ticker, i) => (
                  <div key={i} className="min-h-0 overflow-hidden">
                    {ticker ? (
                      <FinMAChart
                        ticker={ticker}
                        height={layoutMode === 4 ? 220 : layoutMode === 2 ? 360 : 480}
                        showControls={layoutMode === 1}
                        className="h-full"
                      />
                    ) : (
                      <div className="h-full flex items-center justify-center border border-finma-border/20 rounded-lg bg-finma-bg/30 text-finma-text-dim text-xs min-h-[180px]">
                        Boş slot
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Alt Bilgi */}
      <div className="text-[9px] text-finma-text-dim/60 flex items-start gap-1.5 px-1">
        <Zap className="w-3 h-3 shrink-0 mt-0.5 text-finma-yellow" />
        <span>
          ATMACA V113 — Likidite → Momentum → Kompozit Skor (3 katmanlı filtre).
          &nbsp;Veriler bilgilendirme amaçlıdır, yatırım tavsiyesi değildir.
        </span>
      </div>
    </div>
  )
}
