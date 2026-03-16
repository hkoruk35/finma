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
  Target, Shield, BarChart2, Maximize2, Minimize2, Brain,
  Activity, Zap, Volume2, ArrowUpRight
} from 'lucide-react'
import Link from 'next/link'

/* Fallback mock data */
const MOCK_FEATURED = [
  { ticker: 'OUT', score: 12.7, price: 26.71, action: 'CLOSE', entry_zone: '28.37 - 29.25', stop_loss: 27.05, target: 32.34, potential_pct: 12.25, sector: 'Real Estate', trend_phase: 'Expansion', notes: ['RS: Strong Decoupling', 'Phase: EXPANSION'] },
  { ticker: 'FANG', score: 11.2, price: 182.43, action: 'BUY', entry_zone: '174.60 - 180.00', stop_loss: 168.50, target: 198, potential_pct: 4.48, sector: 'Energy', trend_phase: 'Expansion', notes: ['Enerji momentum güçlü', 'Hacim ortalamanın üzerinde'] },
  { ticker: 'GFS', score: 10.5, price: 41.88, action: 'BUY', entry_zone: '46.37 - 48.00', stop_loss: 43.20, target: 52.50, potential_pct: -9.68, sector: 'Technology', trend_phase: 'Recovery', notes: ['Breakout adayı', 'Sektör rotasyonu'] },
  { ticker: 'NOC', score: 9.8, price: 733.41, action: 'BUY', entry_zone: '728.99 - 735.00', stop_loss: 715, target: 765, potential_pct: 0.61, sector: 'Industrials', trend_phase: 'Expansion', notes: ['Savunma rallisi', 'RS: Pozitif'] },
  { ticker: 'OKE', score: 9.3, price: 85.36, action: 'BUY', entry_zone: '83.70 - 85.50', stop_loss: 81, target: 92, potential_pct: 1.99, sector: 'Energy', trend_phase: 'Expansion', notes: ['Temettü oyunu', 'Destek tutunuyor'] },
  { ticker: 'EQNR', score: 8.1, price: 35.25, action: 'BUY', entry_zone: '31.29 - 33.00', stop_loss: 29.50, target: 38.50, potential_pct: 12.66, sector: 'Energy', trend_phase: 'Recovery', notes: ['Düşük değerleme', 'Enerji toparlanması'] },
  { ticker: 'TIGO', score: 8.4, price: 72.16, action: 'BUY', entry_zone: '69.77 - 71.50', stop_loss: 66, target: 80, potential_pct: 3.43, sector: 'Communication', trend_phase: 'Expansion', notes: ['Gelişen pazar', 'Büyüme potansiyeli'] },
  { ticker: 'TGT', score: 7.5, price: 117.37, action: 'HOLD', entry_zone: '116.69 - 118.00', stop_loss: 112, target: 125, potential_pct: 0.58, sector: 'Consumer', trend_phase: 'Consolidation', notes: ['Perakende sıçrama', 'Destek testi'] },
  { ticker: 'DELL', score: 7.2, price: 151.70, action: 'BUY', entry_zone: '139.69 - 145.00', stop_loss: 132, target: 168, potential_pct: 8.60, sector: 'Technology', trend_phase: 'Expansion', notes: ['AI sunucu satışları güçlü', 'Kâr büyümesi'] },
  { ticker: 'LMT', score: 6.8, price: 646.10, action: 'HOLD', entry_zone: '642.21 - 648.00', stop_loss: 630, target: 670, potential_pct: 0.61, sector: 'Industrials', trend_phase: 'Consolidation', notes: ['Savunma sektörü', 'Bant hareketi'] },
]

export default function FeaturedPage() {
  const { setChartSymbol } = useTerminalStore()
  const { data: featuredData } = useFeaturedSignals(10)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [addedToPortfolio, setAddedToPortfolio] = useState<Set<string>>(new Set())
  const [isFullscreen, setIsFullscreen] = useState(false)

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
            Öne Çıkanlar — Günlük AI Seçimleri
          </span>
          <span className="text-[9px] bg-finma-primary/20 text-finma-primary px-2 py-0.5 rounded-full font-medium ml-1">
            Bot 112
          </span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/featured/backtest"
            className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-medium bg-finma-purple/20 border border-finma-purple/30 text-finma-purple hover:bg-finma-purple/30 transition-all"
          >
            <BarChart2 className="w-3 h-3" />
            Backtest
          </Link>
          <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
            <Clock className="w-3 h-3" />
            <span className="finma-number">{updateTime}</span>
          </div>
        </div>
      </div>

      {/* Sol: Liste + Sağ: Grafik & AI Analiz */}
      <div className="grid grid-cols-12 gap-4">
        {/* Sol: 10 Hisse Listesi */}
        <div className="col-span-12 lg:col-span-5 space-y-1.5 max-h-[900px] overflow-y-auto pr-1">
          {featuredStocks.map((stock, idx) => {
            const isSelected = idx === selectedIdx

            return (
              <div
                key={stock.ticker}
                onClick={() => handleSelect(idx)}
                className={cn(
                  'bg-finma-card border rounded-lg p-3 cursor-pointer transition-all',
                  isSelected
                    ? 'border-finma-primary/60 bg-finma-primary/5 shadow-lg shadow-finma-primary/5'
                    : 'border-finma-border hover:border-finma-border-light hover:bg-finma-card-hover'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isSelected ? 'bg-finma-primary text-white' : idx < 3 ? 'bg-finma-primary/30 text-finma-primary' : 'bg-finma-bg text-finma-text-dim'
                  )}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-finma-primary finma-number">{stock.ticker}</span>
                      <ActionBadge action={stock.action} />
                      <span className="text-[9px] text-finma-text-dim">{sectorLabel(stock.sector)}</span>
                    </div>
                    <p className="text-[10px] text-finma-text-muted truncate">
                      {stock.notes?.join(' • ') || stock.trend_phase}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <div className={cn(
                      'finma-number text-sm font-bold px-2 py-0.5 rounded',
                      stock.score >= 10 ? 'bg-finma-green/20 text-finma-green' :
                      stock.score >= 8 ? 'bg-finma-primary/20 text-finma-primary' :
                      'bg-finma-yellow/20 text-finma-yellow'
                    )}>
                      {stock.score.toFixed(1)}
                    </div>
                    <span className={cn('finma-number text-[10px] font-medium', (stock.potential_pct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                      {(stock.potential_pct ?? 0) >= 0 ? '+' : ''}{(stock.potential_pct ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Sağ: Grafik + AI Detay */}
        <div className="col-span-12 lg:col-span-7 space-y-4">
          {/* Grafik */}
          <div className="relative">
            <div
              className={cn(
                'w-full bg-finma-card border border-finma-border rounded-lg overflow-hidden',
                isFullscreen ? 'fixed inset-4 z-50' : 'h-[300px] md:h-[420px]'
              )}
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

          {/* AI Tahmin & Analiz */}
          <Card padding="sm">
            <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
              <Brain className="w-4 h-4 text-finma-purple" />
              <span className="text-sm font-bold text-finma-text">
                AI Analiz — {selected.ticker}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 text-center">
                <div className="text-[9px] text-finma-text-dim uppercase mb-1">Giriş Aralığı</div>
                <div className="text-xs font-bold text-finma-primary finma-number">{selected.entry_zone}</div>
              </div>
              <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 text-center">
                <div className="text-[9px] text-finma-text-dim uppercase mb-1">Stop Loss</div>
                <div className="text-xs font-bold text-finma-red finma-number">${selected.stop_loss}</div>
              </div>
              <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 text-center">
                <div className="text-[9px] text-finma-text-dim uppercase mb-1">Hedef Fiyat</div>
                <div className="text-xs font-bold text-finma-green finma-number">${selected.target}</div>
              </div>
              <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 text-center">
                <div className="text-[9px] text-finma-text-dim uppercase mb-1">Potansiyel</div>
                <div className={cn('text-xs font-bold finma-number', (selected.potential_pct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                  {(selected.potential_pct ?? 0) >= 0 ? '+' : ''}{(selected.potential_pct ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* AI Yorumu */}
            <div className="mt-3 bg-finma-purple/5 border border-finma-purple/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="w-3.5 h-3.5 text-finma-purple" />
                <span className="text-xs font-semibold text-finma-purple">AI Tahmini</span>
              </div>
              <div className="text-xs text-finma-text-muted space-y-1.5">
                <p>• <span className="font-medium text-finma-text">{selected.ticker}</span> — {selected.notes?.[0] || 'Analiz devam ediyor...'}</p>
                <p>• Trend Fazı: <span className="text-finma-cyan font-medium">{selected.trend_phase}</span></p>
                <p>• Sektör: <span className="text-finma-primary">{sectorLabel(selected.sector)}</span> — {selected.sector === 'Energy' ? 'Enerji sektöründe momentum güçlü.' : selected.sector === 'Technology' ? 'Teknoloji sektöründe AI talebi artıyor.' : selected.sector === 'Industrials' ? 'Savunma harcamaları artışta.' : 'Sektörel dinamikler izleniyor.'}</p>
                {selected.notes?.map((n: string, i: number) => (
                  <p key={i}>• {n}</p>
                ))}
              </div>
            </div>

            {/* Etiketler */}
            <div className="flex flex-wrap gap-2 mt-3">
              {selected.score >= 9 && (
                <span className="text-[9px] bg-finma-green/10 text-finma-green px-2 py-1 rounded-full border border-finma-green/20 flex items-center gap-1">
                  <Zap className="w-3 h-3" /> Swing Potansiyeli
                </span>
              )}
              {(selected.potential_pct ?? 0) >= 8 && (
                <span className="text-[9px] bg-finma-primary/10 text-finma-primary px-2 py-1 rounded-full border border-finma-primary/20 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Uzun Vadeli Yatırım
                </span>
              )}
              {selected.trend_phase === 'Expansion' && (
                <span className="text-[9px] bg-finma-cyan/10 text-finma-cyan px-2 py-1 rounded-full border border-finma-cyan/20 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Genişleme Fazı
                </span>
              )}
              {selected.notes?.some((n: string) => n.toLowerCase().includes('hacim') || n.toLowerCase().includes('volume')) && (
                <span className="text-[9px] bg-orange-400/10 text-orange-400 px-2 py-1 rounded-full border border-orange-400/20 flex items-center gap-1">
                  <Volume2 className="w-3 h-3" /> Hacim Biriktirme
                </span>
              )}
            </div>

            {/* Aksiyon Butonları */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={(e) => handleAddPortfolio(selected.ticker, e)}
                disabled={addedToPortfolio.has(selected.ticker)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium border transition-all',
                  addedToPortfolio.has(selected.ticker)
                    ? 'bg-finma-green/20 text-finma-green border-finma-green/30 cursor-default'
                    : 'bg-finma-card border-finma-border text-finma-text-dim hover:text-finma-primary hover:border-finma-primary/50'
                )}
              >
                <Plus className="w-3.5 h-3.5" />
                {addedToPortfolio.has(selected.ticker) ? 'Portföye Eklendi' : 'Portföye Ekle'}
              </button>
              <Link
                href={`/stock-analysis?ticker=${selected.ticker}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium bg-finma-primary/20 border border-finma-primary/30 text-finma-primary hover:bg-finma-primary/30 transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Detay Analiz
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
