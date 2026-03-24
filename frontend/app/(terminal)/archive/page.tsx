'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { TierGate } from '@/components/auth/TierGate'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { Finma514Table } from '@/components/terminal/finma514/Finma514Table'
import {
  Archive, RefreshCw, X, ChevronRight, Database,
  TrendingUp, AlertCircle, FileText, Calendar,
  Clock, BarChart3,
} from 'lucide-react'

/* ── API yardımcı ──────────────────────────────────────────────────────────── */
async function apiFetch(path: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('finma_token') : null
  const baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '/api/proxy'
  const res = await fetch(`${baseUrl}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/* ── Tipler ────────────────────────────────────────────────────────────────── */
interface ArchiveRun {
  filename:      string
  market_date:   string
  run_time_ny:   string
  market_regime: string
  vix:           number
  file_size_kb:  number
  modified_at:   string
}

function regimeColor(regime: string) {
  const r = (regime || '').toUpperCase()
  if (r.includes('BULL')) return 'bull'
  if (r.includes('BEAR')) return 'bear'
  return 'default'
}

/* ── Detail Modal ──────────────────────────────────────────────────────────── */
function ArchiveDetailModal({ run, onClose }: { run: ArchiveRun; onClose: () => void }) {
  const [payload, setPayload] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    apiFetch(`/api/finma514/archive/${run.filename}`)
      .then(d => setPayload(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [run.filename])

  const stocks = payload?.all_54 ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
      <div className="bg-finma-surface border border-white/10 rounded-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-finma-border shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-4 h-4 text-finma-primary" />
            <div>
              <h2 className="text-sm font-bold text-white finma-number">{run.market_date}</h2>
              <p className="text-[10px] text-finma-text-dim">
                NY {run.run_time_ny} · {run.market_regime} · VIX {run.vix} · {stocks.length} hisse
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-finma-text-dim hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* İçerik */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-finma-primary/30 border-t-finma-primary rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-8 h-8 text-finma-red/60" />
              <p className="text-sm text-finma-text-dim">Dosya yüklenemedi: {error}</p>
            </div>
          ) : (
            <Finma514Table
              stocks={stocks}
              lang="tr"
              onLangChange={() => {}}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Ana Sayfa ─────────────────────────────────────────────────────────────── */
function ArchiveContent() {
  const [runs,     setRuns]     = useState<ArchiveRun[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [selected, setSelected] = useState<ArchiveRun | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await apiFetch('/api/finma514/archive')
      setRuns(data.runs ?? [])
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Archive className="w-5 h-5 text-finma-primary" />
          <h1 className="text-base font-bold text-white">Veri Arşivi</h1>
          <span className="text-xs text-finma-text-dim px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            {runs.length} kayıt
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-finma-text-dim hover:text-finma-text transition-colors px-2 py-1.5 rounded hover:bg-white/5"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Yenile
        </button>
      </div>

      {/* Açıklama */}
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-finma-primary/5 border border-finma-primary/20 text-xs text-finma-text-dim">
        <Database className="w-3.5 h-3.5 text-finma-primary shrink-0 mt-0.5" />
        <p>Her bot çalışmasının anlık görüntüsü saklanır. Backtest ve karşılaştırmalı analiz için geçmiş verilere erişin.</p>
      </div>

      {/* İçerik */}
      {loading ? (
        <Card padding="sm">
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-finma-primary/30 border-t-finma-primary rounded-full animate-spin" />
          </div>
        </Card>
      ) : error ? (
        <Card padding="sm">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertCircle className="w-8 h-8 text-finma-red/60" />
            <p className="text-sm text-finma-text-dim">Arşiv yüklenemedi: {error}</p>
            <button onClick={load} className="finma-btn-primary text-xs px-3 py-1.5">Tekrar Dene</button>
          </div>
        </Card>
      ) : runs.length === 0 ? (
        <Card padding="sm">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Archive className="w-8 h-8 text-finma-text-dim/40" />
            <p className="text-sm text-finma-text-dim">Henüz arşiv dosyası yok.</p>
            <p className="text-xs text-finma-text-dim/60">Bot ilk çalıştığında veriler burada görünecek.</p>
          </div>
        </Card>
      ) : (
        <Card padding="sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="bg-[#0f1520] border-b border-finma-border text-[10px] text-finma-text-dim uppercase">
                  <th className="px-3 py-2.5 text-left font-medium">
                    <div className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Tarih</div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> NY Saat</div>
                  </th>
                  <th className="px-3 py-2.5 text-left font-medium">
                    <div className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Rejim</div>
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium finma-number">VIX</th>
                  <th className="px-3 py-2.5 text-right font-medium finma-number hidden sm:table-cell">Boyut</th>
                  <th className="px-3 py-2.5 text-right font-medium hidden sm:table-cell">Değiştirilme</th>
                  <th className="px-3 py-2.5 text-center font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <tr
                    key={run.filename}
                    className={cn(
                      'border-b border-finma-border/20 hover:bg-white/3 transition-colors',
                      i % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.015]'
                    )}
                  >
                    <td className="px-3 py-2.5 finma-number font-semibold text-white">
                      {run.market_date || run.filename.replace('finma514_', '').replace('.json', '')}
                    </td>
                    <td className="px-3 py-2.5 finma-number text-finma-text-dim">
                      {run.run_time_ny || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={regimeColor(run.market_regime) as any}>
                        {run.market_regime || 'UNKNOWN'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right finma-number text-finma-text-dim">
                      {run.vix > 0 ? run.vix.toFixed(2) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right finma-number text-finma-text-dim hidden sm:table-cell">
                      {run.file_size_kb} KB
                    </td>
                    <td className="px-3 py-2.5 text-right text-finma-text-dim hidden sm:table-cell">
                      {run.modified_at
                        ? new Date(run.modified_at).toLocaleString('tr-TR', {
                            month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => setSelected(run)}
                        className="flex items-center gap-1 text-[10px] text-finma-primary hover:text-finma-primary/80 transition-colors px-2 py-1 rounded bg-finma-primary/10 hover:bg-finma-primary/20 mx-auto"
                      >
                        Görüntüle <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[10px] text-finma-text-dim mt-2">{runs.length} kayıt listeleniyor</p>
        </Card>
      )}

      {/* Detail Modal */}
      {selected && (
        <ArchiveDetailModal run={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}

export default function ArchivePage() {
  return (
    <TierGate tier="admin">
      <ArchiveContent />
    </TierGate>
  )
}
