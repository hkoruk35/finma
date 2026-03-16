'use client'

import { Badge } from '@/components/shared/Badge'
import { Card } from '@/components/shared/Card'
import { Flame } from 'lucide-react'

interface Candidate {
  ticker: string
  score: number
  price: number
  action: string
  potential_pct: number
  sector?: string
  entry_zone?: string
}

interface FeaturedStocksBarProps {
  candidates: Candidate[]
  maxVisible?: number
}

export function FeaturedStocksBar({ candidates, maxVisible = 10 }: FeaturedStocksBarProps) {
  const items = candidates.slice(0, maxVisible)

  if (items.length === 0) return null

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 px-1 pb-2 mb-2 border-b border-finma-border">
        <Flame className="w-4 h-4 text-orange-400" />
        <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
          Öne Çıkan Hisseler
        </span>
        <span className="ml-auto text-[10px] text-finma-text-dim">{items.length} hisse</span>
      </div>

      <div className="overflow-x-auto -mx-2 px-2 pb-1">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {items.map((c) => (
            <div
              key={c.ticker}
              className="bg-finma-bg/50 rounded-lg border border-finma-border/30 p-3 min-w-[160px] flex-shrink-0 hover:border-finma-primary/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <Badge variant={c.action === 'BUY' ? 'buy' : c.action === 'HOLD' ? 'hold' : 'sell'}>
                  {c.ticker}
                </Badge>
                <span className="text-[10px] text-finma-text-dim">{c.sector}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-finma-text-muted">
                  Skor: <span className="finma-number text-finma-primary font-semibold">{c.score?.toFixed(1)}</span>
                </span>
                <span className={`text-xs finma-number font-semibold ${c.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'}`}>
                  {c.potential_pct >= 0 ? '+' : ''}{c.potential_pct?.toFixed(1)}%
                </span>
              </div>
              <div className="text-[10px] text-finma-text-dim mt-1 finma-number">
                ${c.price?.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
