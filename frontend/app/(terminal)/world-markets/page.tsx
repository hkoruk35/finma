'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useWorldMarkets, useWorldAnalysis, useSectors } from '@/hooks/useMarketData'
import {
  Globe2, Clock, TrendingUp, TrendingDown, Brain, Send,
  ArrowUp, ArrowDown, AlertTriangle, Lightbulb, Shield,
  ChevronDown, ChevronUp, BarChart3, Zap, RefreshCw,
  Play, Timer, Star, X, Loader2, Target, Building2,
  Globe, ShieldAlert, Sparkles, Sun, Sunset, Moon
} from 'lucide-react'

// ═══════════════════════════════════════════════════════════════════════
// STATUS BADGE
// ═══════════════════════════════════════════════════════════════════════

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    open: 'bg-finma-green/20 text-finma-green border-finma-green/30',
    pre: 'bg-finma-yellow/20 text-finma-yellow border-finma-yellow/30',
    post: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    closed: 'bg-finma-text-dim/15 text-finma-text-dim border-finma-text-dim/20',
    '24s': 'bg-finma-cyan/20 text-finma-cyan border-finma-cyan/30',
  }
  return (
    <span className={cn(
      'text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide border leading-none inline-flex items-center gap-1',
      styles[status] || styles.closed
    )}>
      {status === 'open' && <span className="inline-block w-1.5 h-1.5 bg-finma-green rounded-full animate-pulse" />}
      {label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SESSION PROGRESS BAR
// ═══════════════════════════════════════════════════════════════════════

function SessionProgress({ pct, phase }: { pct: number; phase: string }) {
  if (phase === 'kapali' || phase === 'acilis_oncesi' || phase === 'kapanis_sonrasi') return null

  const phaseColor = phase === 'acilis' ? 'bg-finma-yellow'
    : phase === 'kapanis' ? 'bg-orange-400'
    : phase === 'gun_ortasi' ? 'bg-finma-cyan'
    : 'bg-finma-green'

  return (
    <div className="w-full h-1 bg-finma-border/30 rounded-full overflow-hidden mt-1.5">
      <div
        className={cn('h-full rounded-full transition-all duration-1000', phaseColor)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// SESSION PHASE BADGE
// ═══════════════════════════════════════════════════════════════════════

function SessionPhaseBadge({ phase, pct }: { phase: string; pct: number }) {
  const phaseMap: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    acilis_oncesi: { label: 'Acilis Oncesi', icon: <Timer className="w-2.5 h-2.5" />, color: 'text-finma-yellow bg-finma-yellow/10' },
    acilis: { label: 'Acilis', icon: <Play className="w-2.5 h-2.5" />, color: 'text-finma-yellow bg-finma-yellow/10' },
    seans: { label: `Seans %${pct}`, icon: <BarChart3 className="w-2.5 h-2.5" />, color: 'text-finma-green bg-finma-green/10' },
    gun_ortasi: { label: 'Gun Ortasi', icon: <Clock className="w-2.5 h-2.5" />, color: 'text-finma-cyan bg-finma-cyan/10' },
    kapanis: { label: 'Kapanisa Yakin', icon: <AlertTriangle className="w-2.5 h-2.5" />, color: 'text-orange-400 bg-orange-400/10' },
    kapanis_sonrasi: { label: 'Kapanis Sonrasi', icon: <Clock className="w-2.5 h-2.5" />, color: 'text-finma-text-dim bg-finma-text-dim/10' },
    kapali: { label: 'Kapali', icon: null, color: '' },
  }

  const info = phaseMap[phase]
  if (!info || phase === 'kapali') return null

  return (
    <span className={cn('inline-flex items-center gap-1 text-[8px] font-bold px-1.5 py-0.5 rounded', info.color)}>
      {info.icon}
      {info.label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// AI GLOBAL SUMMARY BANNER
// ═══════════════════════════════════════════════════════════════════════

function AIGlobalSummary() {
  const { data, isLoading, isFetching } = useWorldAnalysis()
  const [expanded, setExpanded] = useState(true)

  if (isLoading) {
    return (
      <Card padding="none" className="overflow-hidden">
        <div className="p-4 space-y-3 animate-pulse">
          <div className="h-5 bg-finma-border/30 rounded w-48" />
          <div className="h-4 bg-finma-border/20 rounded w-full" />
          <div className="h-4 bg-finma-border/20 rounded w-3/4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-finma-border/20 rounded" />
            ))}
          </div>
        </div>
      </Card>
    )
  }

  if (!data) return null

  const trendColor = data.trend?.includes('YUKARI') ? 'text-finma-green' :
    data.trend?.includes('ASAGI') ? 'text-finma-red' : 'text-finma-yellow'
  const trendBg = data.trend?.includes('YUKARI') ? 'bg-finma-green/10 border-finma-green/30' :
    data.trend?.includes('ASAGI') ? 'bg-finma-red/10 border-finma-red/30' : 'bg-finma-yellow/10 border-finma-yellow/30'

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-finma-primary/10 via-finma-card to-finma-card border-b border-finma-border">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Brain className="w-5 h-5 text-finma-primary" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-finma-primary rounded-full animate-ping" />
          </div>
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">AI Global Istihbarat</span>
          {isFetching && (
            <div className="flex items-center gap-1 text-[9px] text-finma-primary">
              <RefreshCw className="w-3 h-3 animate-spin" />
              <span>Guncelleniyor</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Trend badge */}
          <div className={cn('flex items-center gap-1.5 px-3 py-1 rounded-full border', trendBg)}>
            {data.trend?.includes('YUKARI') ? <ArrowUp className="w-3.5 h-3.5" /> :
             data.trend?.includes('ASAGI') ? <ArrowDown className="w-3.5 h-3.5" /> :
             <BarChart3 className="w-3.5 h-3.5" />}
            <span className={cn('text-xs font-bold', trendColor)}>
              {data.trend || 'KARISIK'}
            </span>
          </div>
          <button onClick={() => setExpanded(!expanded)}
            className="text-finma-text-dim hover:text-finma-text transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-4">
          {/* Summary */}
          {data.summary && (
            <p className="text-[13px] text-finma-text leading-relaxed">{data.summary}</p>
          )}

          {/* 4-column grid: Strong / Weak / Risks / Opportunities */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            {data.strong && (
              <div className="p-3 rounded-lg bg-finma-green/5 border border-finma-green/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-finma-green" />
                  <span className="text-[11px] font-bold text-finma-green uppercase">Guclu</span>
                </div>
                <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-line">{data.strong}</p>
              </div>
            )}
            {data.weak && (
              <div className="p-3 rounded-lg bg-finma-red/5 border border-finma-red/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingDown className="w-3.5 h-3.5 text-finma-red" />
                  <span className="text-[11px] font-bold text-finma-red uppercase">Zayif</span>
                </div>
                <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-line">{data.weak}</p>
              </div>
            )}
            {data.risks && (
              <div className="p-3 rounded-lg bg-finma-yellow/5 border border-finma-yellow/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-finma-yellow" />
                  <span className="text-[11px] font-bold text-finma-yellow uppercase">Risk</span>
                </div>
                <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-line">{data.risks}</p>
              </div>
            )}
            {data.opportunities && (
              <div className="p-3 rounded-lg bg-finma-cyan/5 border border-finma-cyan/20">
                <div className="flex items-center gap-1.5 mb-2">
                  <Lightbulb className="w-3.5 h-3.5 text-finma-cyan" />
                  <span className="text-[11px] font-bold text-finma-cyan uppercase">Firsat</span>
                </div>
                <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-line">{data.opportunities}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// EXCHANGE CARD (v2 — session phase, open price, progress bar)
// ═══════════════════════════════════════════════════════════════════════

type Exchange = {
  id: string; symbol: string; name: string; full_name: string;
  country: string; city: string; flag: string;
  price: number; change: number; change_pct: number;
  prev_close: number; open_price: number; open_change_pct: number;
  day_high: number; day_low: number; volume: number;
  status: string; status_tr: string;
  session_phase: string; session_pct: number;
  local_open: string; local_close: string; tz: string;
}

function ExchangeCard({ ex, onClick }: { ex: Exchange; onClick?: () => void }) {
  const isUp = ex.change_pct >= 0
  const changeColor = isUp ? 'text-finma-green' : 'text-finma-red'
  const isOpen = ex.status === 'open'

  // Format price
  const formatPrice = (p: number) => {
    if (!p || p === 0) return '\u2014'
    if (p >= 10000) return p.toLocaleString('tr-TR', { maximumFractionDigits: 0 })
    if (p >= 100) return p.toLocaleString('tr-TR', { maximumFractionDigits: 1 })
    return p.toLocaleString('tr-TR', { maximumFractionDigits: 2 })
  }

  // Format volume
  const formatVol = (v: number) => {
    if (!v || v === 0) return null
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`
    return v.toString()
  }

  const vol = formatVol(ex.volume)
  const openChangeUp = ex.open_change_pct >= 0

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
      'relative p-3 rounded-lg border transition-all duration-200 group',
      'bg-finma-bg/50 hover:bg-finma-primary/5',
      onClick && 'cursor-pointer',
      isOpen
        ? 'border-finma-green/20 hover:border-finma-green/40'
        : ex.status === 'pre' ? 'border-finma-yellow/20'
        : ex.status === 'post' ? 'border-orange-500/20'
        : 'border-finma-border/30 hover:border-finma-primary/30'
    )}>
      {/* Open indicator line */}
      {isOpen && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-finma-green via-finma-green/50 to-transparent rounded-t-lg" />
      )}

      <div className="flex items-start justify-between gap-2">
        {/* Left: Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">{ex.flag}</span>
            <div className="min-w-0">
              <div className="text-xs font-bold text-finma-text truncate">{ex.name}</div>
              <div className="text-[10px] text-finma-text-dim">
                {ex.city} <span className="text-finma-text-dim/50">|</span> {ex.local_open}\u2013{ex.local_close} {ex.tz}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Price + Change */}
        <div className="text-right shrink-0">
          <div className="text-sm font-bold finma-number text-finma-text">
            {formatPrice(ex.price)}
          </div>
          <div className={cn('text-xs font-bold finma-number flex items-center justify-end gap-0.5', changeColor)}>
            {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isUp ? '+' : ''}{ex.change_pct.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Open price + intraday data (only when open or has data) */}
      {ex.open_price > 0 && isOpen && (
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-finma-text-dim">
          <span>
            Acilis: <span className="finma-number text-finma-text-muted">{formatPrice(ex.open_price)}</span>
          </span>
          <span>
            Acilistan:{' '}
            <span className={cn('finma-number font-medium', openChangeUp ? 'text-finma-green' : 'text-finma-red')}>
              {openChangeUp ? '+' : ''}{ex.open_change_pct.toFixed(2)}%
            </span>
          </span>
        </div>
      )}

      {/* Session progress bar */}
      {isOpen && <SessionProgress pct={ex.session_pct} phase={ex.session_phase} />}

      {/* Bottom row: status + session phase + volume + day range */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-finma-border/20">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={ex.status} label={ex.status_tr} />
          {isOpen && <SessionPhaseBadge phase={ex.session_phase} pct={ex.session_pct} />}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-finma-text-dim">
          {ex.day_high > 0 && ex.day_low > 0 && (
            <span className="finma-number">
              <span className="text-finma-red">{formatPrice(ex.day_low)}</span>
              <span className="mx-0.5">\u2014</span>
              <span className="text-finma-green">{formatPrice(ex.day_high)}</span>
            </span>
          )}
          {vol && <span className="finma-number text-finma-text-dim/70">Vol: {vol}</span>}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// EXCHANGE DETAIL MODAL
// ═══════════════════════════════════════════════════════════════════════

type ExchangeAnalysis = {
  exchange_id: string; exchange_name: string; exchange_country: string; exchange_flag: string;
  status: string; status_tr: string; price: number; change_pct: number;
  session_phase: string; session_pct: number;
  opening: string; midday: string; closing: string;
  sectors: string; companies: string; global_impact: string;
  risks: string; opportunities: string; raw: string;
}

function AnalysisSection({ icon, title, content, color }: {
  icon: React.ReactNode; title: string; content: string; color: string;
}) {
  if (!content) return null
  return (
    <div className={cn('p-3 rounded-lg border', color)}>
      <div className="flex items-center gap-1.5 mb-2">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">{title}</span>
      </div>
      <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-line">{content}</p>
    </div>
  )
}

function ExchangeDetailModal({ exchangeId, exchange, onClose }: {
  exchangeId: string; exchange: Exchange; onClose: () => void;
}) {
  const [analysis, setAnalysis] = useState<ExchangeAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Fetch analysis on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    api.getExchangeAnalysis(exchangeId).then(data => {
      if (!cancelled) { setAnalysis(data); setLoading(false) }
    }).catch(err => {
      if (!cancelled) { setError(err.message); setLoading(false) }
    })
    return () => { cancelled = true }
  }, [exchangeId])

  const isUp = exchange.change_pct >= 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8 px-4 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-3xl bg-finma-card border border-finma-border rounded-xl shadow-2xl animate-fade-in z-10">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-finma-border bg-gradient-to-r from-finma-primary/10 via-finma-card to-finma-card rounded-t-xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{exchange.flag}</span>
            <div>
              <div className="text-base font-bold text-finma-text">{exchange.name}</div>
              <div className="text-[11px] text-finma-text-dim">
                {exchange.country} &middot; {exchange.city} &middot; {exchange.local_open}&ndash;{exchange.local_close} {exchange.tz}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold finma-number text-finma-text">
                {exchange.price > 10000 ? exchange.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) : exchange.price.toFixed(2)}
              </div>
              <div className={cn('text-sm font-bold finma-number', isUp ? 'text-finma-green' : 'text-finma-red')}>
                {isUp ? '+' : ''}{exchange.change_pct.toFixed(2)}%
              </div>
            </div>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-finma-border/30 text-finma-text-dim hover:text-finma-text transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-b border-finma-border/50 bg-finma-bg/30">
          <StatusBadge status={exchange.status} label={exchange.status_tr} />
          {exchange.status === 'open' && <SessionPhaseBadge phase={exchange.session_phase} pct={exchange.session_pct} />}
          {exchange.open_price > 0 && (
            <>
              <span className="text-[10px] text-finma-text-dim">
                Acilis: <span className="finma-number text-finma-text-muted">{exchange.open_price > 10000 ? exchange.open_price.toLocaleString('tr-TR', {maximumFractionDigits: 0}) : exchange.open_price.toFixed(2)}</span>
              </span>
              <span className="text-[10px] text-finma-text-dim">
                Onceki: <span className="finma-number text-finma-text-muted">{exchange.prev_close > 10000 ? exchange.prev_close.toLocaleString('tr-TR', {maximumFractionDigits: 0}) : exchange.prev_close.toFixed(2)}</span>
              </span>
            </>
          )}
          {exchange.day_high > 0 && (
            <span className="text-[10px] finma-number">
              <span className="text-finma-red">{exchange.day_low > 10000 ? exchange.day_low.toLocaleString('tr-TR', {maximumFractionDigits: 0}) : exchange.day_low.toFixed(2)}</span>
              <span className="text-finma-text-dim mx-0.5">&ndash;</span>
              <span className="text-finma-green">{exchange.day_high > 10000 ? exchange.day_high.toLocaleString('tr-TR', {maximumFractionDigits: 0}) : exchange.day_high.toFixed(2)}</span>
            </span>
          )}
          {exchange.status === 'open' && (
            <div className="flex-1">
              <SessionProgress pct={exchange.session_pct} phase={exchange.session_phase} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-finma-primary animate-spin mb-3" />
              <p className="text-sm text-finma-text-dim">AI analiz hazirlaniyor...</p>
              <p className="text-[10px] text-finma-text-dim/60 mt-1">{exchange.name} detayli raporu yukleniyor</p>
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <AlertTriangle className="w-6 h-6 text-finma-yellow mx-auto mb-2" />
              <p className="text-sm text-finma-text-dim">Analiz yuklenemedi: {error}</p>
            </div>
          )}

          {analysis && !loading && (
            <div className="space-y-3">
              {/* Session analyses — 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <AnalysisSection
                  icon={<Sun className="w-3.5 h-3.5 text-finma-yellow" />}
                  title="Acilis Analizi"
                  content={analysis.opening}
                  color="bg-finma-yellow/5 border-finma-yellow/20"
                />
                <AnalysisSection
                  icon={<Clock className="w-3.5 h-3.5 text-finma-cyan" />}
                  title="Gun Ortasi"
                  content={analysis.midday}
                  color="bg-finma-cyan/5 border-finma-cyan/20"
                />
                <AnalysisSection
                  icon={<Sunset className="w-3.5 h-3.5 text-orange-400" />}
                  title="Kapanis"
                  content={analysis.closing}
                  color="bg-orange-400/5 border-orange-400/20"
                />
              </div>

              {/* Sectors + Companies — 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnalysisSection
                  icon={<Building2 className="w-3.5 h-3.5 text-finma-purple" />}
                  title="One Cikan Sektorler"
                  content={analysis.sectors}
                  color="bg-finma-purple/5 border-finma-purple/20"
                />
                <AnalysisSection
                  icon={<Star className="w-3.5 h-3.5 text-finma-primary" />}
                  title="One Cikan Sirketler"
                  content={analysis.companies}
                  color="bg-finma-primary/5 border-finma-primary/20"
                />
              </div>

              {/* Global Impact */}
              <AnalysisSection
                icon={<Globe className="w-3.5 h-3.5 text-finma-cyan" />}
                title="Dunya Ekonomisine Etki"
                content={analysis.global_impact}
                color="bg-finma-cyan/5 border-finma-cyan/20"
              />

              {/* Risk + Opportunity — 2 columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <AnalysisSection
                  icon={<ShieldAlert className="w-3.5 h-3.5 text-finma-red" />}
                  title="Risk Faktorleri"
                  content={analysis.risks}
                  color="bg-finma-red/5 border-finma-red/20"
                />
                <AnalysisSection
                  icon={<Sparkles className="w-3.5 h-3.5 text-finma-green" />}
                  title="Firsatlar"
                  content={analysis.opportunities}
                  color="bg-finma-green/5 border-finma-green/20"
                />
              </div>

              {/* AI badge */}
              <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-finma-text-dim/50">
                <Brain className="w-3 h-3" />
                <span>FinMA AI tarafindan uretildi &middot; 5 dakikada bir guncellenir</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// FEATURED STOCKS (Bellwether) PER REGION
// ═══════════════════════════════════════════════════════════════════════

type FeaturedStock = { symbol: string; name: string; price: number; change_pct: number }

function FeaturedStocksRow({ stocks }: { stocks: FeaturedStock[] }) {
  if (!stocks || stocks.length === 0) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-finma-bg/40 border-b border-finma-border/20 overflow-x-auto scrollbar-hide">
      <Star className="w-3 h-3 text-finma-yellow shrink-0" />
      <span className="text-[9px] text-finma-text-dim uppercase font-bold shrink-0 mr-1">One Cikanlar</span>
      {stocks.map(s => {
        const isUp = s.change_pct >= 0
        return (
          <div key={s.symbol} className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md border shrink-0 text-[10px]',
            isUp ? 'bg-finma-green/5 border-finma-green/15' : 'bg-finma-red/5 border-finma-red/15'
          )}>
            <span className="font-bold text-finma-text">{s.name}</span>
            <span className="finma-number text-finma-text-muted">${s.price >= 1000 ? s.price.toLocaleString('en-US', {maximumFractionDigits: 0}) : s.price.toFixed(2)}</span>
            <span className={cn('font-bold finma-number', isUp ? 'text-finma-green' : 'text-finma-red')}>
              {isUp ? '+' : ''}{s.change_pct.toFixed(2)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// REGION SECTION (v2 — with featured stocks)
// ═══════════════════════════════════════════════════════════════════════

type Region = {
  id: string; name: string; icon: string;
  open_count: number; total_count: number; avg_change_pct: number;
  featured_stocks: FeaturedStock[];
  exchanges: Exchange[];
}

function RegionSection({ region, aiComment, onExchangeClick }: { region: Region; aiComment?: string; onExchangeClick: (ex: Exchange) => void }) {
  const isUp = region.avg_change_pct >= 0
  const [showAI, setShowAI] = useState(true)

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Region Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-finma-border bg-finma-bg/30">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{region.icon}</span>
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">{region.name}</span>
          <div className="flex items-center gap-2 text-[10px]">
            <span className={cn(
              'font-bold finma-number px-2 py-0.5 rounded-full',
              isUp ? 'bg-finma-green/10 text-finma-green' : 'bg-finma-red/10 text-finma-red'
            )}>
              Ort: {isUp ? '+' : ''}{region.avg_change_pct.toFixed(2)}%
            </span>
            {region.open_count > 0 && (
              <span className="text-finma-green font-medium">
                {region.open_count}/{region.total_count} Acik
              </span>
            )}
            {region.open_count === 0 && (
              <span className="text-finma-text-dim font-medium">
                Tumu Kapali
              </span>
            )}
          </div>
        </div>
        {aiComment && (
          <button onClick={() => setShowAI(!showAI)}
            className="text-[10px] text-finma-primary/60 hover:text-finma-primary transition-colors flex items-center gap-1">
            <Brain className="w-3 h-3" />
            {showAI ? 'Gizle' : 'AI'}
          </button>
        )}
      </div>

      {/* Featured Stocks */}
      <FeaturedStocksRow stocks={region.featured_stocks} />

      {/* AI Comment */}
      {aiComment && showAI && (
        <div className="px-4 py-2.5 bg-finma-primary/5 border-b border-finma-border/30">
          <div className="flex items-start gap-2">
            <Brain className="w-3.5 h-3.5 text-finma-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-finma-text-muted leading-relaxed">{aiComment}</p>
          </div>
        </div>
      )}

      {/* Exchange Grid */}
      <div className="p-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {region.exchanges.map(ex => (
          <ExchangeCard key={ex.id} ex={ex} onClick={() => onExchangeClick(ex)} />
        ))}
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// US SECTOR BAR
// ═══════════════════════════════════════════════════════════════════════

function USSectorBar() {
  const { data } = useSectors('1d')

  if (!data || data.length === 0) return null

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-3.5 h-3.5 text-finma-primary" />
        <span className="text-[11px] font-bold text-finma-text uppercase tracking-wider">ABD Sektorleri (Gunluk)</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {data.slice(0, 11).map((s: any, i: number) => {
          const isUp = (s.change_pct || 0) >= 0
          return (
            <div key={i} className={cn(
              'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[11px]',
              isUp ? 'bg-finma-green/5 border-finma-green/20' : 'bg-finma-red/5 border-finma-red/20'
            )}>
              <span className="text-finma-text-muted font-medium">{s.sector_tr || s.sector}</span>
              <span className={cn('font-bold finma-number', isUp ? 'text-finma-green' : 'text-finma-red')}>
                {isUp ? '+' : ''}{(s.change_pct || 0).toFixed(2)}%
              </span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// COMMODITIES SECTION
// ═══════════════════════════════════════════════════════════════════════

type Commodity = {
  id: string; symbol: string; name: string; flag: string; type: string;
  price: number; change_pct: number; status: string;
}

function CommoditiesSection({ commodities, aiComment }: { commodities: Commodity[]; aiComment?: string }) {
  const typeOrder = ['emtia', 'doviz', 'kripto']
  const typeLabels: Record<string, string> = { emtia: 'Emtia', doviz: 'Doviz', kripto: 'Kripto' }

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-finma-border bg-finma-bg/30">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">💰</span>
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">Emtia, Doviz & Kripto</span>
        </div>
        <StatusBadge status="24s" label="24 Saat" />
      </div>

      {/* AI Comment */}
      {aiComment && (
        <div className="px-4 py-2.5 bg-finma-primary/5 border-b border-finma-border/30">
          <div className="flex items-start gap-2">
            <Brain className="w-3.5 h-3.5 text-finma-primary shrink-0 mt-0.5" />
            <p className="text-[12px] text-finma-text-muted leading-relaxed">{aiComment}</p>
          </div>
        </div>
      )}

      <div className="p-3">
        {typeOrder.map(type => {
          const items = commodities.filter(c => c.type === type)
          if (items.length === 0) return null
          return (
            <div key={type} className="mb-3 last:mb-0">
              <div className="text-[10px] text-finma-text-dim uppercase font-bold mb-1.5 px-1">{typeLabels[type]}</div>
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2">
                {items.map(c => {
                  const isUp = c.change_pct >= 0
                  return (
                    <div key={c.id} className="flex items-center justify-between p-2.5 rounded-lg bg-finma-bg/50 border border-finma-border/30 hover:border-finma-primary/30 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{c.flag}</span>
                        <span className="text-[11px] font-medium text-finma-text">{c.name}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-[11px] font-bold finma-number text-finma-text">
                          {c.type === 'doviz' ? c.price.toFixed(4) :
                           c.price >= 1000 ? c.price.toLocaleString('tr-TR', { maximumFractionDigits: 0 }) :
                           c.price.toFixed(2)}
                        </div>
                        <div className={cn('text-[10px] font-bold finma-number', isUp ? 'text-finma-green' : 'text-finma-red')}>
                          {isUp ? '+' : ''}{c.change_pct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// AI ASK SECTION
// ═══════════════════════════════════════════════════════════════════════

function AIAskSection() {
  const [question, setQuestion] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const quickQuestions = [
    'Bugun piyasa neden dusuyuyor?',
    'Hangi sektor guclu?',
    'VIX ne diyor?',
    'Asya piyasalarini analiz et',
  ]

  const handleAsk = async (q: string) => {
    if (!q.trim()) return
    setLoading(true)
    try {
      const result = await api.chatWithAI(q, [])
      setResponse(result.response)
    } catch {
      setResponse('AI yanit su an kullanilamiyor. Lutfen tekrar deneyin.')
    }
    setLoading(false)
    setQuestion('')
  }

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
        <Brain className="w-4 h-4 text-finma-purple" />
        <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">AI&apos;a Sor</span>
        <span className="ml-auto text-[10px] text-finma-text-dim">FinMA AI destekli</span>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {quickQuestions.map(q => (
          <button key={q} onClick={() => handleAsk(q)}
            className="text-[11px] px-3 py-2 rounded-lg bg-finma-bg border border-finma-border text-finma-text-dim hover:text-finma-primary hover:border-finma-primary/50 transition-all">
            {q}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input type="text" value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk(question)}
          placeholder="Dunya piyasalari hakkinda soru sorun..."
          className="finma-input flex-1 text-sm" />
        <button onClick={() => handleAsk(question)} disabled={loading}
          className="finma-btn-primary p-2.5">
          {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {response && (
        <div className="mt-3 p-4 bg-finma-bg rounded-lg border border-finma-border/50">
          <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-wrap">{response}</p>
        </div>
      )}
    </Card>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// GLOBAL SUMMARY STATS
// ═══════════════════════════════════════════════════════════════════════

function GlobalStats({ totalExchanges, totalOpen, regions }: {
  totalExchanges: number; totalOpen: number;
  regions: Array<{ avg_change_pct: number; exchanges: Exchange[] }>;
}) {
  // Calculate global average
  const allExchanges = regions.flatMap(r => r.exchanges)
  const upCount = allExchanges.filter(e => e.change_pct > 0).length
  const downCount = allExchanges.filter(e => e.change_pct < 0).length
  const globalAvg = allExchanges.length > 0
    ? allExchanges.reduce((sum, e) => sum + e.change_pct, 0) / allExchanges.length
    : 0

  // Count how many are in each session phase
  const openExchanges = allExchanges.filter(e => e.status === 'open')
  const acilisCount = openExchanges.filter(e => e.session_phase === 'acilis').length
  const seansCount = openExchanges.filter(e => e.session_phase === 'seans' || e.session_phase === 'gun_ortasi').length
  const kapanisCount = openExchanges.filter(e => e.session_phase === 'kapanis').length

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
        <div className="text-[10px] text-finma-text-dim uppercase">Takip Edilen</div>
        <div className="text-lg font-bold finma-number text-finma-text">{totalExchanges}</div>
        <div className="text-[10px] text-finma-text-dim">borsa</div>
      </div>
      <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
        <div className="text-[10px] text-finma-text-dim uppercase">Su An Acik</div>
        <div className="text-lg font-bold finma-number text-finma-green">{totalOpen}</div>
        <div className="text-[10px] text-finma-text-dim">borsa</div>
      </div>
      <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
        <div className="text-[10px] text-finma-text-dim uppercase">Yukselis / Dusus</div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-lg font-bold finma-number text-finma-green">{upCount}</span>
          <span className="text-finma-text-dim">/</span>
          <span className="text-lg font-bold finma-number text-finma-red">{downCount}</span>
        </div>
      </div>
      <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
        <div className="text-[10px] text-finma-text-dim uppercase">Seans Durumu</div>
        <div className="flex items-center justify-center gap-2 text-[11px] font-bold finma-number">
          {acilisCount > 0 && <span className="text-finma-yellow">{acilisCount} Acilis</span>}
          {seansCount > 0 && <span className="text-finma-green">{seansCount} Seans</span>}
          {kapanisCount > 0 && <span className="text-orange-400">{kapanisCount} Kapanis</span>}
          {totalOpen === 0 && <span className="text-finma-text-dim">Hepsi Kapali</span>}
        </div>
      </div>
      <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
        <div className="text-[10px] text-finma-text-dim uppercase">Global Ortalama</div>
        <div className={cn('text-lg font-bold finma-number', globalAvg >= 0 ? 'text-finma-green' : 'text-finma-red')}>
          {globalAvg >= 0 ? '+' : ''}{globalAvg.toFixed(2)}%
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function WorldMarketsPage() {
  const { data: marketData, isLoading, isFetching, dataUpdatedAt } = useWorldMarkets()
  const { data: analysisData } = useWorldAnalysis()
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null)

  const handleExchangeClick = useCallback((ex: Exchange) => {
    setSelectedExchange(ex)
  }, [])

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : timeStr

  if (isLoading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-finma-cyan" />
          <span className="text-base font-bold text-finma-text uppercase tracking-wider">Global Piyasa Istihbarat Merkezi</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-finma-card border border-finma-border rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-finma-card border border-finma-border rounded-lg animate-pulse" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-64 bg-finma-card border border-finma-border rounded-lg animate-pulse" />
        ))}
      </div>
    )
  }

  if (!marketData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-finma-text-dim">
        <Globe2 className="w-10 h-10 mb-3" />
        <p>Dunya borsalari verisi yuklenemedi. Lutfen tekrar deneyin.</p>
      </div>
    )
  }

  // Stale data warning
  const isStale = marketData._stale

  // Region order for display (follows market open times, East -> West)
  const regionOrder = ['okyanusya', 'asya', 'orta_dogu', 'afrika', 'avrupa', 'g_amerika', 'k_amerika']
  const orderedRegions = regionOrder
    .map(id => marketData.regions.find(r => r.id === id))
    .filter(Boolean) as Region[]

  return (
    <div className="space-y-4 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Globe2 className="w-5 h-5 text-finma-cyan" />
          <span className="text-base font-bold text-finma-text uppercase tracking-wider">
            Global Piyasa Istihbarat Merkezi
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isStale && (
            <div className="flex items-center gap-1.5 text-[10px] text-finma-yellow">
              <AlertTriangle className="w-3 h-3" />
              <span>Eski veri gosteriliyor</span>
            </div>
          )}
          {isFetching && (
            <div className="flex items-center gap-1.5 text-[10px] text-finma-primary">
              <div className="w-2 h-2 rounded-full bg-finma-primary animate-pulse" />
              Guncelleniyor
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[11px] text-finma-text-dim">
            <Clock className="w-3.5 h-3.5" />
            <span className="finma-number">Son guncelleme: {lastUpdate}</span>
          </div>
          <span className="text-[9px] px-2 py-0.5 bg-finma-primary/10 text-finma-primary rounded-full border border-finma-primary/20 font-medium">
            3 dk&apos;da bir guncellenir
          </span>
        </div>
      </div>

      {/* GLOBAL STATS */}
      <GlobalStats
        totalExchanges={marketData.total_exchanges}
        totalOpen={marketData.total_open}
        regions={marketData.regions as any}
      />

      {/* AI GLOBAL SUMMARY */}
      <AIGlobalSummary />

      {/* REGIONS (East -> West order) */}
      {orderedRegions.map(region => (
        <div key={region.id}>
          <RegionSection
            region={region}
            aiComment={analysisData?.regions?.[region.id] || undefined}
            onExchangeClick={handleExchangeClick}
          />
          {/* US Sectors — right after K. Amerika */}
          {region.id === 'k_amerika' && <div className="mt-3"><USSectorBar /></div>}
        </div>
      ))}

      {/* COMMODITIES / FX / CRYPTO */}
      {marketData.commodities && marketData.commodities.length > 0 && (
        <CommoditiesSection
          commodities={marketData.commodities}
          aiComment={analysisData?.regions?.emtia || undefined}
        />
      )}

      {/* AI ASK */}
      <AIAskSection />

      {/* EXCHANGE DETAIL MODAL */}
      {selectedExchange && (
        <ExchangeDetailModal
          exchangeId={selectedExchange.id}
          exchange={selectedExchange}
          onClose={() => setSelectedExchange(null)}
        />
      )}

      {/* DISCLAIMER */}
      <div className="text-center py-2">
        <p className="text-[11px] text-finma-text-dim">
          Bu bir yatirim tavsiyesi degildir. Tum analizler bilgilendirme amaclidir.
          Veriler Yahoo Finance&apos;ten alinmaktadir. Piyasa saatleri yerel saat dilimine gore hesaplanmaktadir.
        </p>
      </div>
    </div>
  )
}
