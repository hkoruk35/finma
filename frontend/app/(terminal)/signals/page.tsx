'use client'

import { SignalsTable } from '@/components/terminal/SignalsTable'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { useLatestSignals } from '@/hooks/useSignals'
import { mockSignals } from '@/lib/mock-data'
import { Radio, Filter } from 'lucide-react'

export default function SignalsPage() {
  const { data: liveSignals } = useLatestSignals()
  const signals = (liveSignals || mockSignals) as import('@/types').SignalReport

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">Bot Sinyalleri</h1>
          <Badge variant={signals.market_regime === 'Bull' ? 'bull' : 'bear'}>
            {signals.market_regime}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-finma-text-dim finma-number">
            VIX: {signals.vix_level}
          </span>
          <button className="finma-btn-primary flex items-center gap-1.5 text-xs py-1.5">
            <Filter className="w-3 h-3" />
            Filtrele
          </button>
        </div>
      </div>

      {/* Signal Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Toplam Sinyal</div>
          <div className="finma-number text-xl font-bold text-white mt-1">{signals.candidates.length}</div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Al Sinyali</div>
          <div className="finma-number text-xl font-bold text-finma-green mt-1">
            {signals.candidates.filter((c: any) => c.action === 'BUY').length}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Tut Sinyali</div>
          <div className="finma-number text-xl font-bold text-finma-yellow mt-1">
            {signals.candidates.filter((c: any) => c.action === 'HOLD').length}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Sektör Liderleri</div>
          <div className="text-xs text-finma-text mt-1">{signals.sector_leaders?.join(', ') ?? 'N/A'}</div>
        </Card>
      </div>

      {/* Full Signals Table */}
      <Card padding="sm">
        <SignalsTable data={signals} />
      </Card>
    </div>
  )
}
