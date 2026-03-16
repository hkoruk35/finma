'use client'

import { Card } from '@/components/shared/Card'
import { ActionBadge, sectorLabel } from '@/components/shared/Badge'
import { cn } from '@/lib/utils'
import { useTerminalStore } from '@/store/terminal'
import type { SignalReport } from '@/types'
import { Radio, ExternalLink } from 'lucide-react'
import Link from 'next/link'

interface CompactSignalsProps {
  data: SignalReport
  maxVisible?: number
}

export function CompactSignals({ data, maxVisible = 5 }: CompactSignalsProps) {
  const { setChartSymbol } = useTerminalStore()
  const visibleCandidates = data.candidates.slice(0, maxVisible)
  const hasMore = data.candidates.length > maxVisible

  return (
    <Card padding="sm" className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border">
        <Radio className="w-3.5 h-3.5 text-finma-primary" />
        <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">
          Piyasa Trendi
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] finma-number text-finma-text-dim">
            {data.candidates.length} aday
          </span>
          <Link
            href="/featured"
            className="text-[10px] text-finma-primary hover:text-finma-primary/80 flex items-center gap-0.5 transition-colors"
          >
            Tümü <ExternalLink className="w-3 h-3" />
          </Link>
        </span>
      </div>

      <div className="flex-1 mt-2 space-y-1 overflow-auto">
        {visibleCandidates.map((signal, idx) => (
          <div
            key={`${signal.ticker}-${idx}`}
            onClick={() => setChartSymbol(signal.ticker)}
            className="flex items-center justify-between px-2 py-1.5 rounded-md bg-finma-bg/50 hover:bg-finma-card-hover transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-finma-primary finma-number w-10">
                {signal.ticker}
              </span>
              <ActionBadge action={signal.action} />
              <span className="text-[9px] text-finma-text-dim truncate max-w-[60px]">
                {sectorLabel(signal.sector)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="finma-number text-[11px] text-finma-text">
                ${signal.price.toFixed(2)}
              </span>
              <span className={cn(
                'finma-number text-[10px] font-medium',
                signal.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'
              )}>
                {signal.potential_pct >= 0 ? '+' : ''}{signal.potential_pct.toFixed(1)}%
              </span>
              <span className={cn(
                'finma-number text-[9px] font-bold px-1 py-0.5 rounded',
                signal.score >= 10 ? 'bg-finma-green/20 text-finma-green' :
                signal.score >= 7 ? 'bg-finma-primary/20 text-finma-primary' :
                'bg-finma-yellow/20 text-finma-yellow'
              )}>
                {signal.score.toFixed(1)}
              </span>
            </div>
          </div>
        ))}

        {hasMore && (
          <Link
            href="/featured"
            className="block text-center py-2 text-[10px] text-finma-text-dim hover:text-finma-primary transition-colors border-t border-finma-border/30 mt-1"
          >
            +{data.candidates.length - maxVisible} daha fazla aday →
          </Link>
        )}
      </div>
    </Card>
  )
}
