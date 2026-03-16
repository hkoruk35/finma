'use client'

import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { cn, formatCurrency, getPnlColor } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal'
import type { Trade } from '@/types'
import { Zap, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface ActiveOperationsProps {
  trades: Trade[]
  maxVisible?: number
  fullPage?: boolean
}

export function ActiveOperations({ trades, maxVisible = 4, fullPage = false }: ActiveOperationsProps) {
  const { setChartSymbol } = useTerminalStore()
  const openTrades = trades.filter((t) => t.status === 'OPEN')
  const visibleTrades = fullPage ? openTrades : openTrades.slice(0, maxVisible)
  const hasMore = !fullPage && openTrades.length > maxVisible

  const handleClick = (ticker: string) => {
    setChartSymbol(ticker)
  }

  return (
    <Card padding="sm" className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border">
        <Zap className="w-3.5 h-3.5 text-finma-yellow" />
        <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
          Aktif Operasyonlar
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] finma-number text-finma-text-dim">
            {openTrades.length} açık
          </span>
          {!fullPage && (
            <Link
              href="/operations"
              className="text-[10px] text-finma-primary hover:text-finma-primary/80 flex items-center gap-0.5 transition-colors"
            >
              Tümü <ExternalLink className="w-3 h-3" />
            </Link>
          )}
        </span>
      </div>

      {openTrades.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <span className="text-sm text-finma-red">Açık pozisyon yok.</span>
        </div>
      ) : (
        <div className={cn(
          'flex-1 mt-2 space-y-1.5',
          fullPage ? 'overflow-auto max-h-none' : 'overflow-auto'
        )}>
          {visibleTrades.map((trade) => (
            <div
              key={trade.id}
              onClick={() => handleClick(trade.ticker)}
              className={cn(
                'flex items-center justify-between px-2 py-2 rounded-md bg-finma-bg/50 hover:bg-finma-card-hover transition-colors cursor-pointer',
                fullPage && 'py-3'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-finma-primary finma-number">
                  {trade.ticker}
                </span>
                <Badge variant={trade.direction === 'LONG' ? 'buy' : 'sell'}>
                  {trade.direction}
                </Badge>
                <span className="text-[10px] text-finma-text-dim">{trade.strategy}</span>
                {fullPage && (
                  <span className="text-[9px] text-finma-text-dim ml-1">({trade.entry_date})</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="finma-number text-[11px] text-finma-text-muted">
                  {trade.qty} @ ${trade.entry_price.toFixed(2)}
                </span>
                {fullPage && (
                  <span className="finma-number text-[10px] text-finma-text-dim">
                    Şuan: ${trade.current_price.toFixed(2)}
                  </span>
                )}
                <span className={cn('finma-number text-xs font-semibold', getPnlColor(trade.pnl))}>
                  {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                </span>
                <span className={cn('finma-number text-[10px]', getPnlColor(trade.pnl_pct))}>
                  ({trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%)
                </span>
                {fullPage && (
                  <>
                    <span className="finma-number text-[10px] text-finma-red">
                      SL: ${trade.stop_loss.toFixed(2)}
                    </span>
                    <span className="finma-number text-[10px] text-finma-green">
                      TP: ${trade.target_price.toFixed(2)}
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <Link
              href="/operations"
              className="block text-center py-2 text-[10px] text-finma-text-dim hover:text-finma-primary transition-colors border-t border-finma-border/30 mt-1"
            >
              +{openTrades.length - maxVisible} daha fazla işlem →
            </Link>
          )}
        </div>
      )}
    </Card>
  )
}
