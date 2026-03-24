import { cn } from '@/lib/utils'
import { TIER_CONFIG } from '@/types/finma514'
import type { FinmaTier } from '@/types/finma514'

interface TierBadgeProps {
  tier: FinmaTier
  score?: number
  size?: 'sm' | 'md'
}

export function TierBadge({ tier, score, size = 'sm' }: TierBadgeProps) {
  const cfg = TIER_CONFIG[tier] ?? TIER_CONFIG.WATCH

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono font-semibold',
      cfg.bg,
      cfg.color,
      size === 'sm' ? 'text-[9px]' : 'text-[11px]'
    )}>
      {cfg.label}
      {score !== undefined && (
        <span className="opacity-70">{score}</span>
      )}
    </span>
  )
}

/** Küçük renkli nokta (tablo satırı için) */
export function TierDot({ tier }: { tier: FinmaTier }) {
  const colors: Record<FinmaTier, string> = {
    STRONG: 'bg-finma-green',
    HIGH:   'bg-finma-primary',
    WATCH:  'bg-finma-yellow',
    IGNORE: 'bg-finma-text-dim',
  }
  return (
    <span className={cn('inline-block w-1.5 h-1.5 rounded-full shrink-0', colors[tier])} />
  )
}
