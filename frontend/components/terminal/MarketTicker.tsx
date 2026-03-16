'use client'

import { cn } from '@/lib/utils'
import { useIndices } from '@/hooks/useMarketData'
import { mockIndices } from '@/lib/mock-data'

export function MarketTicker() {
  const { data: liveIndices } = useIndices()

  // Use live data if available, fallback to mock
  const indices = liveIndices && liveIndices.length > 0 ? liveIndices : mockIndices

  // Double the items for seamless scroll
  const items = [...indices, ...indices]

  return (
    <div className="h-full flex items-center overflow-hidden relative">
      {/* Gradient masks */}
      <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-finma-bg to-transparent z-10" />
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-finma-bg to-transparent z-10" />

      <div className="flex animate-ticker-scroll">
        {items.map((index, i) => (
          <div
            key={`${index.symbol}-${i}`}
            className="flex items-center gap-2 px-4 shrink-0 cursor-pointer hover:bg-white/5 h-full py-2 transition-colors"
          >
            <span className="text-xs font-semibold text-finma-text whitespace-nowrap">
              {index.symbol}
            </span>
            <span className="finma-number text-xs text-finma-text whitespace-nowrap">
              ${index.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span
              className={cn(
                'finma-number text-[11px] whitespace-nowrap',
                index.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red'
              )}
            >
              {index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
