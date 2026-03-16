'use client'

import { cn } from '@/lib/utils'
import { ActionBadge, sectorLabel } from '@/components/shared/Badge'
import { useTerminalStore } from '@/store/terminal'
import type { BotSignal, SignalReport } from '@/types'

interface SignalsTableProps {
  data: SignalReport
  compact?: boolean
}

const COL_WIDTHS = {
  ticker:   'w-16',
  sector:   'w-28',
  action:   'w-20',
  live:     'w-20',
  zone:     'w-32',
  stop:     'w-20',
  target:   'w-20',
  pot:      'w-16',
  score:    'w-14',
}

export function SignalsTable({ data, compact = false }: SignalsTableProps) {
  const { setChartSymbol } = useTerminalStore()
  const rows = compact ? data.candidates.slice(0, 10) : data.candidates

  return (
    /* overflow buraya verildi — sticky thead çalışması için */
    <div className="relative w-full">
    <div className="overflow-x-auto w-full" style={{ maxHeight: compact ? 'none' : '520px', overflowY: compact ? 'visible' : 'auto' }}>
      <table className="w-full min-w-[640px] text-xs border-collapse">

        {/* ── Başlık satırı ── */}
        <thead className="sticky top-0 z-10">
          <tr className="bg-[#111827] border-b-2 border-finma-border">
            <Th align="left"  cls={COL_WIDTHS.ticker}>Sembol</Th>
            <Th align="left"  cls={COL_WIDTHS.sector}>Sektör</Th>
            <Th align="center" cls={COL_WIDTHS.action}>Aksiyon</Th>
            <Th align="right" cls={COL_WIDTHS.live}>Canlı</Th>
            <Th align="right" cls={COL_WIDTHS.zone}>Giriş Bölgesi</Th>
            {!compact && <>
              <Th align="right" cls={COL_WIDTHS.stop}>Stop</Th>
              <Th align="right" cls={COL_WIDTHS.target}>Hedef</Th>
            </>}
            <Th align="right" cls={COL_WIDTHS.pot}>Pot.%</Th>
            <Th align="right" cls={COL_WIDTHS.score}>Skor</Th>
          </tr>
        </thead>

        {/* ── Veri satırları ── */}
        <tbody>
          {rows.map((signal, idx) => (
            <tr
              key={`${signal.ticker}-${idx}`}
              onClick={() => setChartSymbol(signal.ticker)}
              className={cn(
                'border-b border-finma-border/30 cursor-pointer transition-colors duration-100',
                idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]',
                'hover:bg-finma-primary/10'
              )}
            >
              {/* Sembol */}
              <td className="px-3 py-2.5 whitespace-nowrap">
                <span className="font-bold text-finma-primary finma-number text-[11px] tracking-wide">
                  {signal.ticker}
                </span>
              </td>

              {/* Sektör */}
              <td className="px-2 py-2.5 whitespace-nowrap">
                <span className="text-finma-text-dim text-[10px]">{sectorLabel(signal.sector)}</span>
              </td>

              {/* Aksiyon */}
              <td className="px-2 py-2.5 text-center whitespace-nowrap">
                <ActionBadge action={signal.action} />
              </td>

              {/* Canlı fiyat */}
              <td className="px-2 py-2.5 text-right finma-number text-finma-text font-medium whitespace-nowrap">
                ${signal.price.toFixed(2)}
              </td>

              {/* Giriş Bölgesi */}
              <td className="px-2 py-2.5 text-right finma-number text-finma-text-dim text-[10px] whitespace-nowrap">
                {signal.entry_zone}
              </td>

              {/* Stop / Hedef — sadece tam görünümde */}
              {!compact && <>
                <td className="px-2 py-2.5 text-right finma-number text-finma-red whitespace-nowrap">
                  ${signal.stop_loss.toFixed(2)}
                </td>
                <td className="px-2 py-2.5 text-right finma-number text-finma-green whitespace-nowrap">
                  ${signal.target.toFixed(2)}
                </td>
              </>}

              {/* Potansiyel % */}
              <td className={cn(
                'px-2 py-2.5 text-right finma-number font-semibold whitespace-nowrap',
                signal.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'
              )}>
                {signal.potential_pct >= 0 ? '+' : ''}{signal.potential_pct.toFixed(2)}%
              </td>

              {/* Skor */}
              <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <span className={cn(
                  'finma-number font-bold text-[10px] px-2 py-0.5 rounded',
                  signal.score >= 10 ? 'bg-finma-green/20 text-finma-green border border-finma-green/30' :
                  signal.score >= 7  ? 'bg-finma-primary/20 text-finma-primary border border-finma-primary/30' :
                                       'bg-finma-yellow/20 text-finma-yellow border border-finma-yellow/30'
                )}>
                  {signal.score.toFixed(1)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-finma-card to-transparent pointer-events-none md:hidden" />
    </div>
  )
}

/* ── Yardımcı: Başlık hücresi ── */
function Th({ children, align = 'left', cls = '' }: {
  children: React.ReactNode
  align?: 'left' | 'center' | 'right'
  cls?: string
}) {
  return (
    <th className={cn(
      'py-2.5 px-2 first:px-3 last:px-3',
      'text-[10px] font-semibold uppercase tracking-wider text-finma-text-dim',
      'border-b border-finma-border whitespace-nowrap',
      align === 'left'   && 'text-left',
      align === 'center' && 'text-center',
      align === 'right'  && 'text-right',
      cls
    )}>
      {children}
    </th>
  )
}
