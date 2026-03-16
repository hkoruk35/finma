'use client'

import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { HUDMetrics } from '@/components/terminal/HUDMetrics'
import { usePortfolioSummary, useTrades } from '@/hooks/usePortfolio'
import { mockPortfolio, mockTrades, mockWatchlist } from '@/lib/mock-data'
import { cn, formatCurrency, getPnlColor } from '@/lib/utils'
import type { PortfolioSnapshot } from '@/types'
import { Briefcase, Plus, TrendingUp } from 'lucide-react'

export default function PortfolioPage() {
  const { data: portfolioData } = usePortfolioSummary()
  const { data: tradesData } = useTrades('OPEN')

  const portfolio = (portfolioData || mockPortfolio) as PortfolioSnapshot
  const trades = tradesData || mockTrades
  const openTrades = trades.filter(t => t.status === 'OPEN')

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Portföy Yönetimi</h1>
        </div>
        <button className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5">
          <Plus className="w-3 h-3" />
          Pozisyon Ekle
        </button>
      </div>

      <HUDMetrics data={portfolio} />

      {/* Open Positions */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border">
          <TrendingUp className="w-3.5 h-3.5 text-finma-green" />
          <span className="text-xs font-semibold uppercase tracking-wider">Açık Pozisyonlar</span>
          <span className="ml-auto text-[10px] finma-number text-finma-text-dim">{openTrades.length} pozisyon</span>
        </div>
        <div className="overflow-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2">Sembol</th>
                <th className="text-left px-2 py-2">Yön</th>
                <th className="text-right px-2 py-2">Giriş</th>
                <th className="text-right px-2 py-2">Canlı</th>
                <th className="text-right px-2 py-2">Adet</th>
                <th className="text-right px-2 py-2">PnL</th>
                <th className="text-right px-2 py-2">PnL%</th>
                <th className="text-right px-2 py-2">Stop</th>
                <th className="text-right px-2 py-2">Hedef</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((trade) => (
                <tr key={trade.id} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors">
                  <td className="px-3 py-2 font-semibold text-finma-primary finma-number">{trade.ticker}</td>
                  <td className="px-2 py-2">
                    <Badge variant={trade.direction === 'LONG' ? 'buy' : 'sell'}>{trade.direction}</Badge>
                  </td>
                  <td className="px-2 py-2 text-right finma-number">${trade.entry_price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right finma-number text-white">${trade.current_price.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right finma-number">{trade.qty}</td>
                  <td className={cn('px-2 py-2 text-right finma-number font-semibold', getPnlColor(trade.pnl))}>
                    {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                  </td>
                  <td className={cn('px-2 py-2 text-right finma-number', getPnlColor(trade.pnl_pct))}>
                    {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                  </td>
                  <td className="px-2 py-2 text-right finma-number text-finma-red">${trade.stop_loss.toFixed(2)}</td>
                  <td className="px-2 py-2 text-right finma-number text-finma-green">${trade.target_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {openTrades.length === 0 && (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-finma-text-dim">Henüz açık pozisyon bulunmuyor.</span>
            </div>
          )}
        </div>
      </Card>

      {/* Watchlist Preview */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border">
          <span className="text-xs font-semibold uppercase tracking-wider">Takip Listesi</span>
          <span className="text-[10px] text-finma-text-dim finma-number">{mockWatchlist.length} sembol</span>
        </div>
        <div className="overflow-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2">Sembol</th>
                <th className="text-left px-2 py-2">Sektör</th>
                <th className="text-right px-2 py-2">Giriş</th>
                <th className="text-right px-2 py-2">Canlı</th>
                <th className="text-right px-2 py-2">PnL$</th>
                <th className="text-right px-2 py-2">PnL%</th>
              </tr>
            </thead>
            <tbody>
              {mockWatchlist.map((item) => (
                <tr key={item.symbol} className="border-b border-finma-border/50 hover:bg-finma-card-hover transition-colors cursor-pointer">
                  <td className="px-3 py-2 font-semibold text-finma-primary finma-number">{item.symbol}</td>
                  <td className="px-2 py-2 text-finma-text-dim">{item.sector}</td>
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
