'use client'

import { useState, useEffect } from 'react'
import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { Card } from '@/components/shared/Card'
import { ActionBadge, sectorLabel } from '@/components/shared/Badge'
import { useTerminalStore } from '@/store/terminal'
import { useFeaturedSignals } from '@/hooks/useSignals'
import { cn } from '@/lib/utils'
import {
  Star, Clock, Plus, ExternalLink, TrendingUp, TrendingDown,
  Target, Shield, BarChart2, Maximize2, Minimize2
} from 'lucide-react'
import Link from 'next/link'

/* Fallback mock data */
const MOCK_FEATURED = [
  { ticker: 'NVDA', score: 8.4, price: 912.45, action: 'BUY', entry_zone: '895 - 910', stop_loss: 865, target: 980, potential_pct: 7.41, sector: 'Technology', trend_phase: 'Expansion', notes: ['AI çip talebi güçlü'] },
  { ticker: 'FANG', score: 7.9, price: 182.43, action: 'BUY', entry_zone: '174 - 180', stop_loss: 168.50, target: 198, potential_pct: 8.53, sector: 'Energy', trend_phase: 'Expansion', notes: ['Enerji momentum güçlü'] },
  { ticker: 'LMT', score: 7.5, price: 646.10, action: 'BUY', entry_zone: '635 - 645', stop_loss: 620, target: 690, potential_pct: 6.80, sector: 'Industrials', trend_phase: 'Expansion', notes: ['Savunma harcamaları artışta'] },
  { ticker: 'EQNR', score: 7.2, price: 35.25, action: 'BUY', entry_zone: '31 - 33', stop_loss: 29.50, target: 38.50, potential_pct: 9.22, sector: 'Energy', trend_phase: 'Recovery', notes: ['Düşük değerleme'] },
  { ticker: 'DELL', score: 7.0, price: 151.70, action: 'BUY', entry_zone: '140 - 148', stop_loss: 132, target: 175, potential_pct: 15.36, sector: 'Technology', trend_phase: 'Expansion', notes: ['AI sunucu satışları güçlü'] },
]

export default function FeaturedPage() {
  const { setChartSymbol } = useTerminalStore()
  const { data: featuredData } = useFeaturedSignals(5)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [addedToPortfolio, setAddedToPortfolio] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Use live data or fallback
  const featuredStocks = (featuredData?.featured && featuredData.featured.length > 0)
    ? featuredData.featured.map((s: any) => ({
        ticker: s.ticker, score: s.score, price: s.price, action: s.action,
        entry_zone: s.entry_zone, stop_loss: s.stop_loss, target: s.target,
        potential_pct: s.potential_pct, sector: s.sector,
        trend_phase: s.trend_phase || 'N/A',
        notes: s.notes || [],
      }))
    : MOCK_FEATURED

  const selected = featuredStocks[selectedIdx] || featuredStocks[0]

  useEffect(() => {
    if (featuredStocks[0]) setChartSymbol(featuredStocks[0].ticker)
  }, [setChartSymbol, featuredStocks[0]?.ticker])

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx)
    setChartSymbol(featuredStocks[idx].ticker)
  }

  const handleAddPortfolio = (ticker: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setAddedToPortfolio(prev => new Set(prev).add(ticker))
  }

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-finma-yellow" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Öne Çıkanlar — Günlük Seçimler
          </span>
          <span className="text-[10px] bg-finma-yellow/15 text-finma-yellow px-2 py-0.5 rounded font-semibold">
            inday312 Bot
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {updateTime}</span>
        </div>
      </div>

      {/* Grafik */}
      <div className="relative">
        <div
          className={cn(
            'w-full bg-finma-card border border-finma-border rounded-lg overflow-hidden',
            isFullscreen && 'fixed inset-4 z-50'
          )}
          style={{ height: isFullscreen ? 'auto' : '420px' }}
        >
          <div className="absolute top-2 right-2 z-20 flex items-center gap-2">
            <span className="text-[10px] bg-finma-primary/20 text-finma-primary px-2 py-1 rounded font-semibold">
              {selected.ticker} — {sectorLabel(selected.sector)}
            </span>
            <button
              onClick={() => setIsFullscreen(f => !f)}
              className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-finma-bg/80 backdrop-blur text-finma-text-dim hover:text-finma-text border border-finma-border/50 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {isFullscreen ? 'Küçült' : 'Tam Ekran'}
            </button>
          </div>
          <TradingViewWidget />
        </div>
        {isFullscreen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsFullscreen(false)} />}
      </div>

      {/* Öne Çıkan 5 Hisse Listesi */}
      <div className="space-y-2">
        {featuredStocks.map((stock, idx) => {
          const isSelected = idx === selectedIdx
          const isAdded = addedToPortfolio.has(stock.ticker)

          return (
            <div
              key={stock.ticker}
              onClick={() => handleSelect(idx)}
              className={cn(
                'bg-finma-card border rounded-lg p-4 cursor-pointer transition-all',
                isSelected
                  ? 'border-finma-primary/60 bg-finma-primary/5 shadow-lg shadow-finma-primary/5'
                  : 'border-finma-border hover:border-finma-border-light hover:bg-finma-card-hover'
              )}
            >
              <div className="flex items-start gap-4">
                {/* Sol: Sıra numarası */}
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0',
                  isSelected ? 'bg-finma-primary text-white' : 'bg-finma-bg text-finma-text-dim'
                )}>
                  {idx + 1}
                </div>

                {/* Orta: Hisse bilgileri */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-finma-primary finma-number">{stock.ticker}</span>
                    <ActionBadge action={stock.action} />
                    <span className="text-[9px] text-finma-text-dim">{sectorLabel(stock.sector)}</span>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] mb-2 flex-wrap">
                    <span className="finma-number font-semibold text-finma-text">${stock.price.toFixed(2)}</span>
                    <span className={cn('finma-number font-medium', (stock.potential_pct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                      Pot: {(stock.potential_pct ?? 0) >= 0 ? '+' : ''}{(stock.potential_pct ?? 0).toFixed(1)}%
                    </span>
                    <span className="text-finma-text-dim flex items-center gap-1">
                      <Target className="w-3 h-3" />Giriş: {stock.entry_zone}
                    </span>
                    <span className="text-finma-red flex items-center gap-1">
                      <Shield className="w-3 h-3" />Stop: ${stock.stop_loss}
                    </span>
                    <span className="text-finma-green flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />Hedef: ${stock.target}
                    </span>
                  </div>

                  <p className="text-[11px] text-finma-text-muted leading-relaxed">
                    {stock.notes?.join(' • ') || stock.trend_phase || 'Analiz bekleniyor...'}
                  </p>

                  {/* Göstergeler */}
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] text-finma-text-dim uppercase">Skor</span>
                      <div className="w-16 h-1.5 bg-finma-bg rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full', stock.score >= 7 ? 'bg-finma-green' : stock.score >= 5 ? 'bg-finma-yellow' : 'bg-finma-red')}
                          style={{ width: `${Math.min(stock.score * 10, 100)}%` }} />
                      </div>
                      <span className="text-[9px] finma-number text-finma-text-dim">{stock.score.toFixed(1)}</span>
                    </div>
                    <span className="text-[9px] text-finma-text-dim">Faz: <span className="text-finma-cyan">{stock.trend_phase || 'N/A'}</span></span>
                  </div>
                </div>

                {/* Sağ: Skor + Butonlar */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className={cn(
                    'finma-number text-lg font-bold px-3 py-1 rounded-lg',
                    stock.score >= 8 ? 'bg-finma-green/20 text-finma-green' :
                    stock.score >= 7 ? 'bg-finma-primary/20 text-finma-primary' :
                    'bg-finma-yellow/20 text-finma-yellow'
                  )}>
                    {stock.score.toFixed(1)}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => handleAddPortfolio(stock.ticker, e)}
                      disabled={isAdded}
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium border transition-all',
                        isAdded
                          ? 'bg-finma-green/20 text-finma-green border-finma-green/30 cursor-default'
                          : 'bg-finma-card border-finma-border text-finma-text-dim hover:text-finma-primary hover:border-finma-primary/50'
                      )}
                    >
                      <Plus className="w-3 h-3" />
                      {isAdded ? 'Eklendi' : 'Portföye Ekle'}
                    </button>
                    <Link
                      href={`/stock-analysis?ticker=${stock.ticker}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-medium bg-finma-primary/20 border border-finma-primary/30 text-finma-primary hover:bg-finma-primary/30 transition-all"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Detay Analiz
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
