'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useFinma514Stock } from '@/hooks/useFinma514'
import { TierBadge } from '@/components/terminal/finma514/TierBadge'
import { ScoreBarDetailed } from '@/components/terminal/finma514/ScoreBar'
import { LangSelector } from '@/components/terminal/finma514/LangSelector'
import { cn } from '@/lib/utils'
import {
  ArrowLeft, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Target, BookOpen, BarChart3,
  ExternalLink, Shield, RefreshCw,
} from 'lucide-react'
import type { FinmaLang, Finma514Stock } from '@/types/finma514'

/* ── Yardimci ──────────────────────────────────────────────────────────────── */

function fmt(n: number, dec = 2) {
  if (!n || isNaN(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

function pct(n: number) {
  if (!n || isNaN(n)) return '—'
  const sign = n >= 0 ? '+' : ''
  return `${sign}${n.toFixed(2)}%`
}

function fmtMcap(n: number) {
  if (!n) return '—'
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`
  return `$${n.toLocaleString()}`
}

/* ── Blok 1: Market Context ───────────────────────────────────────────────── */

function MarketContextBlock({ stock, lang }: { stock: Finma514Stock; lang: FinmaLang }) {
  const ai = stock.ai_text
  return (
    <div className="finma-card space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <BookOpen className="w-4 h-4 text-finma-primary" />
        <h3 className="text-sm font-semibold text-white">Market Context</h3>
      </div>

      <p className="text-sm text-finma-text-dim leading-relaxed">
        {ai?.market_context || 'Veri bekleniyor...'}
      </p>

      {ai?.interest_zone_text && (
        <div className="p-3 rounded-lg bg-finma-primary/5 border border-finma-primary/15">
          <p className="text-xs font-medium text-finma-primary mb-1">Yogun Islem Bolgesi</p>
          <p className="text-sm text-finma-text-dim">{ai.interest_zone_text}</p>
        </div>
      )}
    </div>
  )
}

/* ── Blok 2: Scenario Pathways ────────────────────────────────────────────── */

function ScenarioBlock({ stock }: { stock: Finma514Stock }) {
  const ai = stock.ai_text
  const scenarios = [
    {
      label:  'Yukselisi Senaryo',
      text:   ai?.scenario_bull,
      icon:   TrendingUp,
      color:  'text-finma-green',
      border: 'border-finma-green/20',
      bg:     'bg-finma-green/5',
    },
    {
      label:  'Dususu Senaryo',
      text:   ai?.scenario_bear,
      icon:   TrendingDown,
      color:  'text-finma-red',
      border: 'border-finma-red/20',
      bg:     'bg-finma-red/5',
    },
    {
      label:  'Yatay Senaryo',
      text:   ai?.scenario_neutral,
      icon:   Minus,
      color:  'text-finma-yellow',
      border: 'border-finma-yellow/20',
      bg:     'bg-finma-yellow/5',
    },
  ]

  return (
    <div className="finma-card space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <Target className="w-4 h-4 text-finma-primary" />
        <h3 className="text-sm font-semibold text-white">Scenario Pathways</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {scenarios.map(({ label, text, icon: Icon, color, border, bg }) => (
          <div key={label} className={cn('rounded-lg p-3 border', border, bg)}>
            <div className={cn('flex items-center gap-1.5 mb-2', color)}>
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs font-semibold">{label}</span>
            </div>
            <p className="text-xs text-finma-text-dim leading-relaxed">
              {text || '—'}
            </p>
          </div>
        ))}
      </div>

      {ai?.risk_reference && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-finma-red/5 border border-finma-red/15">
          <AlertTriangle className="w-3.5 h-3.5 text-finma-red mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-finma-red mb-0.5">Risk Referans Seviyesi</p>
            <p className="text-xs text-finma-text-dim">{ai.risk_reference}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Blok 3: Strategy Ideas ───────────────────────────────────────────────── */

function StrategyBlock({ stock }: { stock: Finma514Stock }) {
  const ai = stock.ai_text
  return (
    <div className="finma-card space-y-4">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3">
        <BarChart3 className="w-4 h-4 text-finma-primary" />
        <h3 className="text-sm font-semibold text-white">Strategy Ideas</h3>
      </div>

      {ai?.strategy_note ? (
        <p className="text-sm text-finma-text-dim leading-relaxed">
          {ai.strategy_note}
        </p>
      ) : (
        <p className="text-sm text-finma-text-dim">Veri bekleniyor...</p>
      )}

      {/* Teknik seviyeleri */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        <div className="text-center">
          <p className="text-xs text-finma-text-dim mb-1">Hedef 1</p>
          <p className="text-sm font-semibold text-finma-green finma-number">
            ${fmt(stock.target_1)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-finma-text-dim mb-1">Hedef 2</p>
          <p className="text-sm font-semibold text-finma-primary finma-number">
            ${fmt(stock.target_2)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-finma-text-dim mb-1">Stop Loss</p>
          <p className="text-sm font-semibold text-finma-red finma-number">
            ${fmt(stock.stop_loss)}
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Teknik metrikler ─────────────────────────────────────────────────────── */

function TechMetrics({ stock }: { stock: Finma514Stock }) {
  const metrics = [
    { label: 'RSI',       val: fmt(stock.rsi, 1) },
    { label: 'ADX',       val: fmt(stock.adx, 1) },
    { label: 'RVOL',      val: fmt(stock.rvol, 2) },
    { label: 'ATR%',      val: stock.atr_pct ? `${stock.atr_pct.toFixed(1)}%` : '—' },
    { label: 'EMA20',     val: `$${fmt(stock.ema20)}` },
    { label: 'EMA50',     val: `$${fmt(stock.ema50)}` },
    { label: 'EMA200',    val: `$${fmt(stock.ema200)}` },
    { label: '1G %',      val: pct(stock.change_1d), colored: true, val_raw: stock.change_1d },
    { label: '5G %',      val: pct(stock.change_5d), colored: true, val_raw: stock.change_5d },
    { label: '1A %',      val: pct(stock.change_1m), colored: true, val_raw: stock.change_1m },
    { label: 'Piyasa D.', val: fmtMcap(stock.market_cap) },
    { label: 'BB Width',  val: stock.bb_width ? fmt(stock.bb_width, 3) : '—' },
  ]

  return (
    <div className="finma-card">
      <div className="flex items-center gap-2 border-b border-white/5 pb-3 mb-4">
        <BarChart3 className="w-4 h-4 text-finma-text-dim" />
        <h3 className="text-sm font-semibold text-white">Teknik Metrikler</h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {metrics.map(({ label, val, colored, val_raw }) => (
          <div key={label} className="text-center">
            <p className="text-xs text-finma-text-dim mb-0.5">{label}</p>
            <p className={cn(
              'text-sm font-semibold finma-number',
              colored
                ? (val_raw ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red'
                : 'text-white'
            )}>
              {val}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Ana sayfa ────────────────────────────────────────────────────────────── */

export default function StockDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const ticker  = (params?.ticker as string)?.toUpperCase() || ''
  const [lang, setLang] = useState<FinmaLang>('tr')

  const { data: stock, isLoading, isError, refetch, isFetching } = useFinma514Stock(ticker, lang)

  return (
    <div className="space-y-4 animate-fade-in max-w-4xl">

      {/* ── Baslik ── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-finma-text-dim hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white finma-number">{ticker}</h1>
              {stock && <TierBadge tier={stock.tier} />}
            </div>
            {stock && (
              <p className="text-xs text-finma-text-dim mt-0.5">
                {stock.company_name} · {stock.sector} · {stock.exchange}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LangSelector value={lang} onChange={setLang} />
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-finma-text-dim hover:text-white transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Yukleniyor ── */}
      {isLoading && (
        <div className="finma-card flex items-center justify-center py-16">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-2 border-finma-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-finma-text-dim">Analiz yukleniyor...</p>
          </div>
        </div>
      )}

      {/* ── Hata ── */}
      {isError && !isLoading && (
        <div className="finma-card text-center py-12 space-y-3">
          <AlertTriangle className="w-8 h-8 text-finma-red mx-auto" />
          <p className="text-sm text-finma-text-dim">
            {ticker} icin veri bulunamadi.
          </p>
          <p className="text-xs text-finma-text-dim/60">
            Hisse FinMA514 listesinde olmayabilir veya bot henuz calismamis olabilir.
          </p>
          <button
            onClick={() => router.push('/finma514')}
            className="finma-btn-primary text-xs px-4 py-2"
          >
            Tum Listeye Don
          </button>
        </div>
      )}

      {/* ── Veri var ── */}
      {stock && !isLoading && (
        <>
          {/* Fiyat + Skor satiri */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="finma-card text-center">
              <p className="text-xs text-finma-text-dim mb-1">Fiyat</p>
              <p className="text-xl font-bold text-white finma-number">${fmt(stock.price)}</p>
              <p className={cn(
                'text-xs font-medium finma-number mt-0.5',
                stock.change_1d >= 0 ? 'text-finma-green' : 'text-finma-red'
              )}>
                {pct(stock.change_1d)}
              </p>
            </div>
            <div className="finma-card text-center">
              <p className="text-xs text-finma-text-dim mb-1">FinMA Skoru</p>
              <p className="text-xl font-bold text-finma-primary finma-number">{stock.score}</p>
              <p className="text-xs text-finma-text-dim">/ 100</p>
            </div>
            <div className="finma-card text-center">
              <p className="text-xs text-finma-text-dim mb-1">Kategori</p>
              <p className="text-sm font-semibold text-finma-primary">{stock.tag}</p>
              <p className="text-xs text-finma-text-dim">{stock.sector}</p>
            </div>
            <div className="finma-card text-center">
              <p className="text-xs text-finma-text-dim mb-1">RSI</p>
              <p className={cn(
                'text-xl font-bold finma-number',
                stock.rsi < 30 ? 'text-finma-red' : stock.rsi > 70 ? 'text-finma-yellow' : 'text-finma-green'
              )}>
                {fmt(stock.rsi, 1)}
              </p>
            </div>
          </div>

          {/* Skor detay */}
          <div className="finma-card">
            <p className="text-xs text-finma-text-dim mb-3">Skor Dagilimi</p>
            <ScoreBarDetailed score={stock.score} breakdown={stock.score_breakdown} />
          </div>

          {/* 3 Ana Blok */}
          <MarketContextBlock stock={stock} lang={lang} />
          <ScenarioBlock stock={stock} />
          <StrategyBlock stock={stock} />

          {/* Teknik Metrikler */}
          <TechMetrics stock={stock} />

          {/* Yasal Uyari — ZORUNLU */}
          <div className="rounded-xl border border-white/5 bg-white/2 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-finma-text-dim" />
              <p className="text-xs font-semibold text-finma-text-dim">Yasal Uyari / Legal Disclaimer</p>
            </div>
            <p className="text-xs text-finma-text-dim/70 leading-relaxed">
              Bu icerik yalnizca bilgilendirme amaclidir ve yatirim tavsiyesi niteliginde degildir.
              Tum finansal kararlar kullanicinin kendi sorumlulugundadir. Gecmis performans gelecegi
              garanti etmez. Piyasalarda kayip yasanabilir.
            </p>
            <p className="text-xs text-finma-text-dim/60">
              This content is for informational purposes only and does not constitute investment advice.
              All financial decisions are the sole responsibility of the user.
              Past performance is not indicative of future results.
            </p>
            <a
              href="/legal/risk"
              className="inline-flex items-center gap-1 text-xs text-finma-primary hover:underline mt-1"
            >
              Risk Aciklamasi <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </>
      )}
    </div>
  )
}
