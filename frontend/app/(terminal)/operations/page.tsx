'use client'

import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { cn, formatCurrency, getPnlColor } from '@/lib/utils'
import { usePortfolioSummary, useTrades } from '@/hooks/usePortfolio'
import { mockTrades, mockPortfolio } from '@/lib/mock-data'
import { useTerminalStore } from '@/store/terminal'
import type { PortfolioSnapshot } from '@/types'
import { Zap } from 'lucide-react'

export default function OperationsPage() {
  const { data: portfolioData } = usePortfolioSummary()
  const { data: tradesData } = useTrades('OPEN')
  const { setChartSymbol } = useTerminalStore()

  const portfolio = (portfolioData || mockPortfolio) as PortfolioSnapshot
  const allTrades = tradesData || mockTrades
  const openTrades = allTrades.filter((t) => t.status === 'OPEN')
  const totalPnl = openTrades.reduce((sum, t) => sum + t.pnl, 0)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Üst Özet Kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Açık Pozisyon</span>
          <span className="finma-number text-xl font-bold text-white">{openTrades.length}</span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Toplam PnL</span>
          <span className={cn('finma-number text-xl font-bold', getPnlColor(totalPnl))}>
            {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
          </span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Net Likidite</span>
          <span className="finma-number text-xl font-bold text-white">
            {formatCurrency(portfolio.net_liquidation)}
          </span>
        </Card>
        <Card padding="sm" className="flex flex-col gap-1">
          <span className="text-[10px] text-finma-text-dim uppercase">Marjin Kullanımı</span>
          <span className="finma-number text-xl font-bold text-white">
            {formatCurrency(portfolio.margin_used)}
          </span>
        </Card>
      </div>

      {/* Grafik */}
      <Card padding="sm">
        <div className="h-[40vh] min-h-[280px] md:h-[55vh] md:min-h-[400px]">
          <TradingViewWidget />
        </div>
      </Card>

      {/* Detaylı Aktif Operasyonlar Listesi */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Zap className="w-4 h-4 text-finma-yellow" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Aktif Operasyonlar - Detay
          </span>
          <span className="ml-auto text-[10px] finma-number text-finma-text-dim">
            {openTrades.length} açık pozisyon
          </span>
        </div>

        <div className="overflow-auto mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-finma-border text-finma-text-dim">
                <th className="text-left px-3 py-2 font-medium">Sembol</th>
                <th className="text-left px-2 py-2 font-medium">Yön</th>
                <th className="text-left px-2 py-2 font-medium hidden md:table-cell">Strateji</th>
                <th className="text-right px-2 py-2 font-medium">Adet</th>
                <th className="text-right px-2 py-2 font-medium">Giriş Fiyatı</th>
                <th className="text-right px-2 py-2 font-medium">Güncel Fiyat</th>
                <th className="text-right px-2 py-2 font-medium">Stop Loss</th>
                <th className="text-right px-2 py-2 font-medium">Hedef</th>
                <th className="text-right px-2 py-2 font-medium">PnL ($)</th>
                <th className="text-right px-2 py-2 font-medium">PnL (%)</th>
                <th className="text-right px-2 py-2 font-medium hidden md:table-cell">Giriş Tarihi</th>
              </tr>
            </thead>
            <tbody>
              {openTrades.map((trade) => (
                <tr
                  key={trade.id}
                  onClick={() => setChartSymbol(trade.ticker)}
                  className="border-b border-finma-border/50 hover:bg-finma-card-hover cursor-pointer transition-colors"
                >
                  <td className="px-3 py-3">
                    <span className="font-bold text-finma-primary finma-number">{trade.ticker}</span>
                  </td>
                  <td className="px-2 py-3">
                    <Badge variant={trade.direction === 'LONG' ? 'buy' : 'sell'}>
                      {trade.direction}
                    </Badge>
                  </td>
                  <td className="px-2 py-3 text-finma-text-muted hidden md:table-cell">{trade.strategy}</td>
                  <td className="px-2 py-3 text-right finma-number text-white">{trade.qty}</td>
                  <td className="px-2 py-3 text-right finma-number text-finma-text">${trade.entry_price.toFixed(2)}</td>
                  <td className="px-2 py-3 text-right finma-number text-white font-semibold">${trade.current_price.toFixed(2)}</td>
                  <td className="px-2 py-3 text-right finma-number text-finma-red">${trade.stop_loss.toFixed(2)}</td>
                  <td className="px-2 py-3 text-right finma-number text-finma-green">${trade.target_price.toFixed(2)}</td>
                  <td className={cn('px-2 py-3 text-right finma-number font-semibold', getPnlColor(trade.pnl))}>
                    {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                  </td>
                  <td className={cn('px-2 py-3 text-right finma-number', getPnlColor(trade.pnl_pct))}>
                    {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                  </td>
                  <td className="px-2 py-3 text-right finma-number text-finma-text-dim hidden md:table-cell">{trade.entry_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {openTrades.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-finma-text-dim">Henüz açık pozisyon bulunmuyor.</span>
          </div>
        )}
      </Card>
    </div>
  )
}
