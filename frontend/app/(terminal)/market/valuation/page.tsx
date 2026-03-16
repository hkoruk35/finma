'use client'

import { useState } from 'react'
import { Card } from '@/components/shared/Card'
import { DollarSign, TrendingUp, TrendingDown, ArrowUpDown, Clock, Info, BarChart2, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ValuationRow {
  sector: string
  etf: string
  pe: number
  forwardPe: number
  peg: number
  ps: number
  pb: number
  divYield: number
  evEbitda: number
  roe: number
  debtEquity: number
  historicalPe: number // 5 yıllık ortalama F/K
}

const valuationData: ValuationRow[] = [
  { sector: 'Teknoloji', etf: 'XLK', pe: 32.4, forwardPe: 28.1, peg: 1.8, ps: 7.2, pb: 9.1, divYield: 0.8, evEbitda: 22.5, roe: 28.3, debtEquity: 0.85, historicalPe: 28.0 },
  { sector: 'Finans', etf: 'XLF', pe: 14.2, forwardPe: 12.8, peg: 1.1, ps: 3.1, pb: 1.4, divYield: 2.1, evEbitda: 8.5, roe: 12.8, debtEquity: 2.10, historicalPe: 15.5 },
  { sector: 'Sağlık', etf: 'XLV', pe: 22.8, forwardPe: 19.5, peg: 1.5, ps: 4.8, pb: 4.2, divYield: 1.5, evEbitda: 15.2, roe: 18.5, debtEquity: 0.92, historicalPe: 20.0 },
  { sector: 'Tüketici İhtiyari', etf: 'XLY', pe: 26.3, forwardPe: 22.1, peg: 1.9, ps: 2.8, pb: 6.3, divYield: 1.0, evEbitda: 18.1, roe: 22.1, debtEquity: 1.35, historicalPe: 22.5 },
  { sector: 'Sanayi', etf: 'XLI', pe: 20.1, forwardPe: 18.2, peg: 1.6, ps: 2.4, pb: 4.8, divYield: 1.4, evEbitda: 14.5, roe: 19.8, debtEquity: 1.12, historicalPe: 18.8 },
  { sector: 'İletişim Hizmetleri', etf: 'XLC', pe: 18.5, forwardPe: 16.4, peg: 1.2, ps: 4.1, pb: 3.5, divYield: 0.9, evEbitda: 12.8, roe: 16.2, debtEquity: 0.75, historicalPe: 19.0 },
  { sector: 'Enerji', etf: 'XLE', pe: 11.8, forwardPe: 10.2, peg: 0.9, ps: 1.5, pb: 2.1, divYield: 3.2, evEbitda: 6.2, roe: 15.5, debtEquity: 0.42, historicalPe: 15.0 },
  { sector: 'Kamu Hizmetleri', etf: 'XLU', pe: 19.3, forwardPe: 17.8, peg: 2.8, ps: 2.6, pb: 2.0, divYield: 3.5, evEbitda: 13.8, roe: 10.2, debtEquity: 1.55, historicalPe: 18.0 },
  { sector: 'Gayrimenkul', etf: 'XLRE', pe: 38.5, forwardPe: 35.2, peg: 3.1, ps: 8.4, pb: 2.8, divYield: 3.8, evEbitda: 25.0, roe: 8.5, debtEquity: 1.80, historicalPe: 32.0 },
  { sector: 'Hammadde', etf: 'XLB', pe: 16.7, forwardPe: 14.9, peg: 1.3, ps: 2.0, pb: 2.9, divYield: 1.8, evEbitda: 10.5, roe: 17.2, debtEquity: 0.68, historicalPe: 17.5 },
  { sector: 'Temel Tüketim', etf: 'XLP', pe: 23.1, forwardPe: 21.4, peg: 2.5, ps: 3.2, pb: 6.1, divYield: 2.6, evEbitda: 16.0, roe: 25.0, debtEquity: 1.05, historicalPe: 21.0 },
]

type SortKey = keyof Omit<ValuationRow, 'sector' | 'etf'>
type SortDir = 'asc' | 'desc'

/* ── Renk yardımcıları ── */
function pegColor(val: number) {
  if (val <= 1.0) return 'text-finma-green'
  if (val >= 2.5) return 'text-finma-red'
  return 'text-finma-yellow'
}
function divColor(val: number) {
  if (val >= 3.0) return 'text-finma-green'
  if (val >= 2.0) return 'text-finma-cyan'
  return 'text-finma-text-muted'
}
function peVsHistColor(pe: number, hist: number) {
  const diff = ((pe - hist) / hist) * 100
  if (diff > 10) return 'text-finma-red'
  if (diff < -10) return 'text-finma-green'
  return 'text-finma-yellow'
}
function roeColor(val: number) {
  if (val >= 20) return 'text-finma-green'
  if (val >= 12) return 'text-finma-cyan'
  return 'text-finma-text-muted'
}

export default function ValuationPage() {
  const [sortKey, setSortKey] = useState<SortKey>('pe')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...valuationData].sort((a, b) => {
    const mul = sortDir === 'asc' ? 1 : -1
    return (a[sortKey] - b[sortKey]) * mul
  })

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa — Değerleme Analizi
          </span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
          <Clock className="w-3 h-3" />
          <span className="finma-number">Son güncelleme: {updateTime}</span>
        </div>
      </div>

      {/* Özet Kartları */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-finma-green" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">En Ucuz (F/K)</span>
          </div>
          {[...valuationData].sort((a, b) => a.pe - b.pe).slice(0, 3).map(s => (
            <div key={s.sector} className="flex justify-between text-[11px] py-0.5">
              <span className="text-finma-text-muted">{s.sector}</span>
              <span className="finma-number text-finma-green font-semibold">{s.pe.toFixed(1)}</span>
            </div>
          ))}
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-finma-red" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">En Pahalı (F/K)</span>
          </div>
          {[...valuationData].sort((a, b) => b.pe - a.pe).slice(0, 3).map(s => (
            <div key={s.sector} className="flex justify-between text-[11px] py-0.5">
              <span className="text-finma-text-muted">{s.sector}</span>
              <span className="finma-number text-finma-red font-semibold">{s.pe.toFixed(1)}</span>
            </div>
          ))}
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart2 className="w-3 h-3 text-finma-green" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">Yüksek Temettü</span>
          </div>
          {[...valuationData].sort((a, b) => b.divYield - a.divYield).slice(0, 3).map(s => (
            <div key={s.sector} className="flex justify-between text-[11px] py-0.5">
              <span className="text-finma-text-muted">{s.sector}</span>
              <span className="finma-number text-finma-green font-semibold">%{s.divYield.toFixed(1)}</span>
            </div>
          ))}
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3 h-3 text-finma-cyan" />
            <span className="text-[10px] text-finma-text-dim uppercase font-medium">En İyi ROE</span>
          </div>
          {[...valuationData].sort((a, b) => b.roe - a.roe).slice(0, 3).map(s => (
            <div key={s.sector} className="flex justify-between text-[11px] py-0.5">
              <span className="text-finma-text-muted">{s.sector}</span>
              <span className="finma-number text-finma-cyan font-semibold">%{s.roe.toFixed(1)}</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Ana Tablo */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-2 border-b border-finma-border mb-1">
          <Info className="w-3 h-3 text-finma-text-dim" />
          <span className="text-[10px] text-finma-text-dim">
            Başlıklara tıklayarak sıralama yapabilirsiniz. Renkler: <span className="text-finma-green">olumlu</span> / <span className="text-finma-yellow">nötr</span> / <span className="text-finma-red">dikkatli</span>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[900px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-[#111827] border-b-2 border-finma-border">
                <Th>Sektör</Th>
                <ThSort label="F/K" sortKey="pe" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="İleri F/K" sortKey="forwardPe" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="5Y Ort. F/K" sortKey="historicalPe" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="PEG" sortKey="peg" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="F/S" sortKey="ps" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="F/DD" sortKey="pb" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="FD/FAVÖK" sortKey="evEbitda" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="Temettü" sortKey="divYield" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="ROE" sortKey="roe" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
                <ThSort label="Borç/Özsermaye" sortKey="debtEquity" currentKey={sortKey} dir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, idx) => {
                const peDiff = ((row.pe - row.historicalPe) / row.historicalPe * 100)
                return (
                  <tr key={row.sector} className={cn(
                    'border-b border-finma-border/30 hover:bg-finma-primary/10 transition-colors cursor-pointer',
                    idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.02]'
                  )}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="font-medium text-finma-text text-[11px]">{row.sector}</div>
                      <div className="text-[9px] text-finma-primary finma-number">{row.etf}</div>
                    </td>
                    <td className={cn('py-2.5 px-2 text-right finma-number font-medium', peVsHistColor(row.pe, row.historicalPe))}>
                      {row.pe.toFixed(1)}
                      <div className="text-[8px] text-finma-text-dim/60">
                        {peDiff >= 0 ? '+' : ''}{peDiff.toFixed(0)}% ort.
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-right finma-number text-finma-text-muted">{row.forwardPe.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-right finma-number text-finma-text-dim">{row.historicalPe.toFixed(1)}</td>
                    <td className={cn('py-2.5 px-2 text-right finma-number font-medium', pegColor(row.peg))}>{row.peg.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-right finma-number text-finma-text-muted">{row.ps.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-right finma-number text-finma-text-muted">{row.pb.toFixed(1)}</td>
                    <td className="py-2.5 px-2 text-right finma-number text-finma-text-muted">{row.evEbitda.toFixed(1)}</td>
                    <td className={cn('py-2.5 px-2 text-right finma-number font-medium', divColor(row.divYield))}>%{row.divYield.toFixed(1)}</td>
                    <td className={cn('py-2.5 px-2 text-right finma-number font-medium', roeColor(row.roe))}>%{row.roe.toFixed(1)}</td>
                    <td className={cn('py-2.5 px-2 text-right finma-number', row.debtEquity > 1.5 ? 'text-finma-red' : 'text-finma-text-muted')}>
                      {row.debtEquity.toFixed(2)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* ── Yardımcı bileşenler ── */
function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="text-left py-2.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-finma-text-dim whitespace-nowrap">
      {children}
    </th>
  )
}

function ThSort({ label, sortKey, currentKey, dir, onSort }: {
  label: string; sortKey: SortKey; currentKey: SortKey; dir: SortDir; onSort: (k: SortKey) => void
}) {
  const isActive = currentKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        'text-right py-2.5 px-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap cursor-pointer select-none transition-colors',
        isActive ? 'text-finma-primary' : 'text-finma-text-dim hover:text-finma-text'
      )}
    >
      <div className="flex items-center justify-end gap-1">
        {label}
        <ArrowUpDown className={cn('w-2.5 h-2.5', isActive ? 'text-finma-primary' : 'text-finma-text-dim/40')} />
        {isActive && <span className="text-[8px]">{dir === 'asc' ? '↑' : '↓'}</span>}
      </div>
    </th>
  )
}
