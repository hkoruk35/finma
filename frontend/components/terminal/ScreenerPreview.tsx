'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Filter, TrendingUp, TrendingDown, Target } from 'lucide-react'

/* Mock screened stocks */
const MOCK_SCREENED = [
  {
    ticker: 'NVDA',
    name: 'NVIDIA',
    sector: 'Teknoloji',
    price: 912.45,
    change_pct: 2.1,
    volume: '145M',
    score: 95,
    signals: ['Strong Buy', 'Momentum', 'Breakout']
  },
  {
    ticker: 'PLTR',
    name: 'Palantir',
    sector: 'Teknoloji',
    price: 78.50,
    change_pct: 8.7,
    volume: '88M',
    score: 92,
    signals: ['Buy', 'Volume Surge', 'Trend']
  },
  {
    ticker: 'ARM',
    name: 'ARM Holdings',
    sector: 'Teknoloji',
    price: 145.80,
    change_pct: 2.9,
    volume: '22M',
    score: 88,
    signals: ['Strong Buy', 'Oversold']
  },
  {
    ticker: 'SMCI',
    name: 'Super Micro',
    sector: 'Teknoloji',
    price: 892.40,
    change_pct: 14.2,
    volume: '42M',
    score: 91,
    signals: ['Strong Buy', 'Momentum']
  },
  {
    ticker: 'AMD',
    name: 'Advanced Micro',
    sector: 'Teknoloji',
    price: 168.30,
    change_pct: 1.8,
    volume: '78M',
    score: 85,
    signals: ['Buy', 'RSI Bounce']
  },
]

interface ScreenerFilter {
  minScore: number
}

export function ScreenerPreview() {
  const router = useRouter()
  const [filter, setFilter] = useState<ScreenerFilter>({ minScore: 80 })
  const [screened, setScreened] = useState(MOCK_SCREENED)

  useEffect(() => {
    // Filter stocks by minimum score
    const filtered = MOCK_SCREENED.filter(s => s.score >= filter.minScore)
    setScreened(filtered)
  }, [filter.minScore])

  return (
    <Card padding="sm">
      <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
        <Target className="w-5 h-5 text-finma-yellow" />
        <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
          Screener Sonuçları
        </span>
        <span className="text-[9px] bg-finma-yellow/10 text-finma-yellow px-2 py-0.5 rounded-full border border-finma-yellow/20 font-medium ml-1">
          Teknik Tarama
        </span>
        <span className="ml-auto text-[10px] text-finma-text-dim flex items-center gap-1.5">
          <Filter className="w-3 h-3" />
          Min Score: {filter.minScore}+
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-finma-text-dim bg-finma-bg/80">
              <th className="text-left py-2.5 px-3 font-bold border border-finma-border/50">#</th>
              <th className="text-left py-2.5 px-3 font-bold border border-finma-border/50">Hisse</th>
              <th className="text-left py-2.5 px-3 font-bold border border-finma-border/50">Sektör</th>
              <th className="text-right py-2.5 px-3 font-bold border border-finma-border/50">Fiyat</th>
              <th className="text-right py-2.5 px-3 font-bold border border-finma-border/50">Değişim</th>
              <th className="text-center py-2.5 px-3 font-bold border border-finma-border/50">Skor</th>
              <th className="text-left py-2.5 px-3 font-bold border border-finma-border/50">Sinyaller</th>
            </tr>
          </thead>
          <tbody>
            {screened.map((stock, idx) => (
              <tr
                key={stock.ticker}
                className="hover:bg-finma-primary/5 transition-colors cursor-pointer group"
                onClick={() => router.push(`/stock-analysis?ticker=${stock.ticker}`)}
              >
                <td className="py-2.5 px-3 border border-finma-border/50 finma-number text-finma-text-dim">
                  {idx + 1}
                </td>
                <td className="py-2.5 px-3 border border-finma-border/50">
                  <div className="flex flex-col">
                    <span className="font-bold text-finma-primary finma-number text-sm">
                      {stock.ticker}
                    </span>
                    <span className="text-finma-text-dim text-[10px] uppercase">
                      {stock.name}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 px-3 border border-finma-border/50">
                  <span className="text-[9px] px-1.5 py-0.5 rounded border bg-blue-500/10 text-blue-400 border-blue-500/20 font-bold uppercase">
                    {stock.sector}
                  </span>
                </td>
                <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-white font-bold">
                  ${stock.price.toFixed(2)}
                </td>
                <td className={cn(
                  'py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold flex items-center justify-end gap-1',
                  stock.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red'
                )}>
                  {stock.change_pct >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(1)}%
                </td>
                <td className="py-2.5 px-3 border border-finma-border/50 text-center">
                  <span className={cn(
                    'inline-block finma-number font-bold px-2 py-1 rounded',
                    stock.score >= 90 ? 'bg-finma-green/20 text-finma-green' :
                    stock.score >= 80 ? 'bg-finma-yellow/20 text-finma-yellow' :
                    'bg-finma-cyan/20 text-finma-cyan'
                  )}>
                    {stock.score}
                  </span>
                </td>
                <td className="py-2.5 px-3 border border-finma-border/50">
                  <div className="flex flex-wrap gap-1">
                    {stock.signals.slice(0, 2).map((signal, i) => (
                      <span key={i} className="text-[8px] px-1.5 py-0.5 rounded bg-finma-primary/20 text-finma-primary whitespace-nowrap">
                        {signal}
                      </span>
                    ))}
                    {stock.signals.length > 2 && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded bg-finma-border/20 text-finma-text-dim whitespace-nowrap">
                        +{stock.signals.length - 2}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between px-1">
        <div className="text-[10px] text-finma-text-dim">
          {screened.length} hisse tarandı • Tüm sonuçları görmek için Screener sayfasını ziyaret edin
        </div>
        <button
          onClick={() => router.push('/screener')}
          className="text-[10px] px-3 py-1.5 rounded border border-finma-border/30 hover:border-finma-primary/50 text-finma-primary hover:bg-finma-primary/5 transition-all font-medium"
        >
          Screener'a Git →
        </button>
      </div>
    </Card>
  )
}
