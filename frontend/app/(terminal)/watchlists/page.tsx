'use client'

import { Card } from '@/components/shared/Card'
import { useLatestSignals } from '@/hooks/useSignals'
import { mockWatchlist } from '@/lib/mock-data'
import { cn, getPnlColor } from '@/lib/utils'
import { List, Plus, Upload, Download } from 'lucide-react'
import { TierGate } from '@/components/auth/TierGate'

export default function WatchlistsPage() {
  return (
    <TierGate tier="pro">
      <WatchlistsContent />
    </TierGate>
  )
}

function WatchlistsContent() {
  const { data: signalsData } = useLatestSignals()

  // Sinyal adaylarından watchlist oluştur veya mock fallback
  const watchlist = signalsData?.candidates && signalsData.candidates.length > 0
    ? signalsData.candidates.map(c => ({
        symbol: c.ticker,
        entry: parseFloat(c.entry_zone.split(' - ')[0]) || c.price,
        live: c.price,
        pnl: c.price - (parseFloat(c.entry_zone.split(' - ')[0]) || c.price),
        pnl_pct: c.potential_pct,
        sector: c.sector,
      }))
    : mockWatchlist

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <List className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Takip Listeleri</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Upload className="w-3 h-3" />
            İçe Aktar
          </button>
          <button className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Plus className="w-3 h-3" />
            Yeni Liste
          </button>
        </div>
      </div>

      {/* Watchlist tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {['Ana Liste', 'Swing Adayları', 'Opsiyon Adayları', 'Kripto'].map((name, i) => (
          <button
            key={name}
            className={cn(
              'px-4 py-2 rounded-md text-xs font-medium transition-colors shrink-0 whitespace-nowrap',
              i === 0
                ? 'bg-finma-primary/15 text-finma-primary border border-finma-primary/30'
                : 'bg-finma-card text-finma-text-muted hover:text-finma-text border border-finma-border hover:border-finma-border-light'
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Watchlist table */}
      <Card padding="sm">
        <div className="flex items-center justify-between px-1 pb-2 border-b border-finma-border">
          <span className="text-xs font-semibold uppercase tracking-wider">Ana Liste</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-finma-text-dim finma-number">{watchlist.length} sembol</span>
            <button className="text-finma-text-dim hover:text-finma-text transition-colors">
              <Download className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        <div className="overflow-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="w-8 px-2 py-2">
                  <input type="checkbox" className="rounded border-finma-border" />
                </th>
                <th className="text-left px-3 py-2">Sembol</th>
                <th className="text-left px-2 py-2 hidden md:table-cell">Sektör</th>
                <th className="text-right px-2 py-2">Giriş</th>
                <th className="text-right px-2 py-2">Canlı</th>
                <th className="text-right px-2 py-2">PnL$</th>
                <th className="text-right px-2 py-2">PnL%</th>
              </tr>
            </thead>
            <tbody>
              {watchlist.map((item) => (
                <tr key={item.symbol} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors cursor-pointer">
                  <td className="px-2 py-2">
                    <input type="checkbox" className="rounded border-finma-border" />
                  </td>
                  <td className="px-3 py-2 font-semibold text-finma-primary finma-number">{item.symbol}</td>
                  <td className="px-2 py-2 text-finma-text-dim hidden md:table-cell">{item.sector}</td>
                  <td className="px-2 py-2 text-right finma-number">${item.entry.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right finma-number text-white">${item.live.toFixed(2)}</td>
                  <td className={cn('px-2 py-2 text-right finma-number font-semibold', getPnlColor(item.pnl))}>
                    {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
                  </td>
                  <td className={cn('px-2 py-2 text-right finma-number', getPnlColor(item.pnl_pct))}>
                    {item.pnl_pct >= 0 ? '+' : ''}{item.pnl_pct.toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
