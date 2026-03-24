'use client'

import { useEffect, useRef } from 'react'
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Finma514Stock, FinmaLang } from '@/types/finma514'
import { TAG_CONFIG } from '@/types/finma514'
import { TierBadge } from './TierBadge'
import { ScoreBarDetailed } from './ScoreBar'
import { AITextPanel } from './AITextPanel'
import { LangSelector } from './LangSelector'
import { useTerminalStore } from '@/store/terminal'

interface StockDetailModalProps {
  stock: Finma514Stock
  lang: FinmaLang
  onClose: () => void
  onLangChange: (lang: FinmaLang) => void
}

function pct(val: number) {
  const color = val >= 0 ? 'text-finma-green' : 'text-finma-red'
  const icon  = val >= 0
    ? <TrendingUp className="w-3 h-3" />
    : <TrendingDown className="w-3 h-3" />
  return (
    <span className={cn('flex items-center gap-0.5 finma-number', color)}>
      {icon}{Math.abs(val).toFixed(2)}%
    </span>
  )
}

export function StockDetailModal({ stock, lang, onClose, onLangChange }: StockDetailModalProps) {
  const { setChartSymbol } = useTerminalStore()
  const overlayRef = useRef<HTMLDivElement>(null)

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const tagCfg  = TAG_CONFIG[stock.tag]
  const aiText  = stock.ai_text

  const interestZoneStr = typeof stock.interest_zone === 'string'
    ? stock.interest_zone
    : stock.interest_zone
      ? `$${(stock.interest_zone as any).low?.toFixed(2)} – $${(stock.interest_zone as any).high?.toFixed(2)}`
      : '—'

  return (
    <div
      ref={overlayRef}
      onClick={e => { if (e.target === overlayRef.current) onClose() }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 animate-fade-in"
    >
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-finma-card border border-finma-border
                      rounded-xl shadow-2xl overflow-hidden flex flex-col">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-start justify-between p-4 border-b border-finma-border shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl font-bold text-white finma-number">{stock.ticker}</span>
              <TierBadge tier={stock.tier} score={stock.score} size="md" />
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full border',
                tagCfg ? `${tagCfg.color} border-current/20 bg-current/5` : 'text-finma-text-dim')}>
                {tagCfg?.label ?? stock.tag}
              </span>
            </div>
            <p className="text-sm text-finma-text-dim mt-0.5 truncate">{stock.company_name}</p>
            <p className="text-[11px] text-finma-text-dim/60">
              {stock.sector} · {stock.exchange} · {stock.market_cap_fmt}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            <LangSelector value={lang} onChange={onLangChange} />
            <button
              onClick={() => { setChartSymbol(stock.ticker); onClose() }}
              className="p-1.5 text-finma-text-dim hover:text-finma-primary transition-colors"
              title="Grafikte Aç"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button onClick={onClose} className="p-1.5 text-finma-text-dim hover:text-finma-text transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="overflow-y-auto flex-1 p-4 space-y-4">

          {/* Fiyat & değişimler */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-finma-bg rounded-lg p-3 border border-finma-border/60">
              <div className="text-[10px] text-finma-text-dim">Fiyat</div>
              <div className="finma-number font-bold text-white text-base">${stock.price.toFixed(2)}</div>
            </div>
            <div className="bg-finma-bg rounded-lg p-3 border border-finma-border/60">
              <div className="text-[10px] text-finma-text-dim">Günlük</div>
              <div className="text-sm mt-0.5">{pct(stock.change_1d)}</div>
            </div>
            <div className="bg-finma-bg rounded-lg p-3 border border-finma-border/60">
              <div className="text-[10px] text-finma-text-dim">5 Gün</div>
              <div className="text-sm mt-0.5">{pct(stock.change_5d)}</div>
            </div>
            <div className="bg-finma-bg rounded-lg p-3 border border-finma-border/60">
              <div className="text-[10px] text-finma-text-dim">1 Ay</div>
              <div className="text-sm mt-0.5">{pct(stock.change_1m)}</div>
            </div>
          </div>

          {/* Teknik göstergeler */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { l: 'RSI',      v: stock.rsi?.toFixed(1) },
              { l: 'ADX',      v: stock.adx?.toFixed(1) },
              { l: 'RVOL',     v: stock.rvol?.toFixed(2) + 'x' },
              { l: 'ATR%',     v: stock.atr_pct?.toFixed(2) + '%' },
              { l: 'BB Width', v: stock.bb_width?.toFixed(3) },
              { l: 'EMA20',    v: '$' + stock.ema20?.toFixed(2) },
              { l: 'EMA50',    v: '$' + stock.ema50?.toFixed(2) },
              { l: 'EMA200',   v: '$' + stock.ema200?.toFixed(2) },
            ].map(({ l, v }) => (
              <div key={l} className="flex justify-between px-2 py-1 bg-finma-bg rounded border border-finma-border/40">
                <span className="text-finma-text-dim">{l}</span>
                <span className="finma-number text-finma-text">{v ?? '—'}</span>
              </div>
            ))}
          </div>

          {/* Seviyeler */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { l: 'İlgi Bölgesi', v: interestZoneStr, color: 'text-finma-cyan' },
              { l: 'Stop Referansı', v: '$' + stock.stop_loss?.toFixed(2), color: 'text-finma-red' },
              { l: 'Hedef 1', v: '$' + stock.target_1?.toFixed(2), color: 'text-finma-green' },
            ].map(({ l, v, color }) => (
              <div key={l} className="bg-finma-bg rounded-lg p-2.5 border border-finma-border/60 text-center">
                <div className="text-[10px] text-finma-text-dim mb-1">{l}</div>
                <div className={cn('finma-number font-bold text-sm', color)}>{v}</div>
              </div>
            ))}
          </div>

          {/* Skor breakdown */}
          <div className="bg-finma-bg rounded-lg p-3 border border-finma-border/60">
            <p className="text-[10px] font-semibold text-finma-text-dim uppercase tracking-wider mb-2">Skor Analizi</p>
            <ScoreBarDetailed score={stock.score} breakdown={stock.score_breakdown} />
          </div>

          {/* AI Metin */}
          {aiText && (
            <div>
              <p className="text-[10px] font-semibold text-finma-text-dim uppercase tracking-wider mb-2">AI Analiz</p>
              <AITextPanel aiText={aiText} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
