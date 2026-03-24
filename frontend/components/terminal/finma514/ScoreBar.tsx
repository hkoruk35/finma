import { cn } from '@/lib/utils'
import type { ScoreBreakdown } from '@/types/finma514'

interface ScoreBarProps {
  score: number
  breakdown?: ScoreBreakdown
  compact?: boolean
}

const COMPONENTS = [
  { key: 'trend',    label: 'Trend',    max: 30, color: 'bg-finma-primary' },
  { key: 'volume',   label: 'Hacim',    max: 25, color: 'bg-finma-cyan' },
  { key: 'momentum', label: 'Momentum', max: 32, color: 'bg-finma-purple' },
  { key: 'context',  label: 'Bağlam',   max: 13, color: 'bg-finma-yellow' },
] as const

function scoreColor(score: number) {
  if (score >= 90) return 'text-finma-green'
  if (score >= 75) return 'text-finma-primary'
  if (score >= 60) return 'text-finma-yellow'
  return 'text-finma-text-dim'
}

function barColor(score: number) {
  if (score >= 90) return 'bg-finma-green'
  if (score >= 75) return 'bg-finma-primary'
  if (score >= 60) return 'bg-finma-yellow'
  return 'bg-finma-text-dim'
}

/** Tek çubuk (tablo için kompakt) */
export function ScoreBarCompact({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', barColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className={cn('finma-number text-[10px] font-bold', scoreColor(score))}>
        {score}
      </span>
    </div>
  )
}

/** 4 bileşenli detaylı skor gösterimi (modal için) */
export function ScoreBarDetailed({ score, breakdown, compact = false }: ScoreBarProps) {
  return (
    <div className="space-y-2">
      {/* Toplam skor */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-finma-text-dim">Toplam Skor</span>
        <span className={cn('finma-number text-xl font-bold', scoreColor(score))}>
          {score}<span className="text-xs text-finma-text-dim font-normal">/100</span>
        </span>
      </div>

      {/* Genel bar */}
      <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Bileşen breakdown */}
      {breakdown && !compact && (
        <div className="space-y-1.5 pt-1">
          {COMPONENTS.map(({ key, label, max, color }) => {
            const val = breakdown[key] ?? 0
            const pct = (val / max) * 100
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] text-finma-text-dim w-16 shrink-0">{label}</span>
                <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full', color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="finma-number text-[10px] text-finma-text w-10 text-right shrink-0">
                  {val}/{max}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
