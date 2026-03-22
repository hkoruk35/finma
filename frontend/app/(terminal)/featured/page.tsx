'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  Star, Clock, TrendingUp, Target, Shield, BarChart3,
  Lock, Flame, ChevronRight, RefreshCw, Eye, History
} from 'lucide-react'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface Opportunity {
  rank: number
  ticker: string
  company_name: string
  sector: string
  price: number
  score: number
  entry_zone: string
  stop_loss: number
  target: number
  potential_pct: number
  reason: string
}

interface RunMeta {
  run_id: string
  run_at: string
  run_date: string
  run_time: string
  schedule_slot: string
  count: number
}

export default function FeaturedPage() {
  const router = useRouter()
  const { canAccess, user } = useAuthStore()
  const isPro = canAccess('pro')
  const isAdmin = canAccess('admin')

  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [runMeta, setRunMeta] = useState<{ run_at?: string; run_id?: string; schedule_slot?: string; total?: number } | null>(null)
  const [history, setHistory] = useState<RunMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTicker, setSelectedTicker] = useState<string | null>(null)

  const fetchOpportunities = async () => {
    setLoading(true)
    const token = localStorage.getItem('finma_token')
    const tier = user?.subscription_tier || 'free'
    try {
      const res = await fetch(`${API_URL}/api/signals/opportunities`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-User-Tier': tier,
        },
      })
      if (res.ok) {
        const data = await res.json()
        setOpportunities(data.opportunities || [])
        setRunMeta({ run_at: data.run_at, run_id: data.run_id, schedule_slot: data.schedule_slot, total: data.total })
      }
    } catch {}
    setLoading(false)
  }

  const fetchHistory = async () => {
    if (!isAdmin) return
    const token = localStorage.getItem('finma_token')
    try {
      const res = await fetch(`${API_URL}/api/signals/opportunities/history?limit=10`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (res.ok) {
        const data = await res.json()
        const runs: RunMeta[] = (data.runs || []).map((r: any) => {
          const dt = r.run_at ? new Date(r.run_at) : null
          return {
            ...r,
            run_date: dt ? dt.toLocaleDateString('tr-TR') : '—',
            run_time: dt ? dt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—',
          }
        })
        setHistory(runs)
      }
    } catch {}
  }

  useEffect(() => {
    fetchOpportunities()
    fetchHistory()
  }, [])

  const runAt = runMeta?.run_at ? new Date(runMeta.run_at) : null

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Flame className="w-5 h-5 text-orange-400" />
          <div>
            <h1 className="text-lg font-bold text-white">Öne Çıkanlar</h1>
            <p className="text-xs text-finma-text-dim">ATMACA Swing Tarayıcı — NY 11:00 / 13:05 / 15:00</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Link href="/featured/backtest" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-finma-border text-finma-text-muted hover:text-finma-text hover:border-finma-primary/40 transition-colors">
              <History className="w-3.5 h-3.5" />
              Geçmiş (Admin)
            </Link>
          )}
          <button
            onClick={fetchOpportunities}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-finma-border text-finma-text-muted hover:text-finma-text transition-colors"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Yenile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left sidebar: run history (admin only) */}
        {isAdmin && (
          <div className="lg:col-span-1">
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-finma-border">
                <History className="w-3.5 h-3.5 text-finma-text-dim" />
                <span className="text-xs font-semibold text-finma-text">Son Çalıştırmalar</span>
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-finma-text-dim text-center py-4">Geçmiş yok</p>
              ) : (
                <div className="space-y-1">
                  {history.map((run) => (
                    <div key={run.run_id} className="flex items-center gap-2 px-2 py-2 rounded hover:bg-finma-border/20 transition-colors cursor-pointer text-xs">
                      <div className="flex-1 min-w-0">
                        <div className="text-finma-text font-medium">{run.run_date}</div>
                        <div className="text-finma-text-dim font-mono">{run.run_time} <span className="text-finma-text-dim/60">{run.schedule_slot}</span></div>
                      </div>
                      <span className="text-finma-primary font-bold finma-number">{run.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Main content */}
        <div className={cn('space-y-4', isAdmin ? 'lg:col-span-3' : 'lg:col-span-4')}>
          {/* Run info */}
          {runMeta && (
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-lg bg-finma-surface border border-finma-border text-xs text-finma-text-muted">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              <span>
                Son güncelleme: <span className="text-finma-text font-medium">{runAt ? runAt.toLocaleDateString('tr-TR') : '—'}</span>
                <span className="mx-2 text-finma-border">|</span>
                Saat: <span className="text-finma-text font-mono">{runAt ? runAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                {runMeta.schedule_slot && (
                  <><span className="mx-2 text-finma-border">|</span>Slot: <span className="text-finma-yellow">{runMeta.schedule_slot}</span></>
                )}
                {runMeta.total !== undefined && (
                  <><span className="mx-2 text-finma-border">|</span>Toplam: <span className="text-finma-primary font-bold">{runMeta.total}</span></>
                )}
              </span>
              {!isPro && (
                <span className="ml-auto flex items-center gap-1 text-finma-yellow">
                  <Lock className="w-3 h-3" />
                  Free: Sadece #1 görünür
                </span>
              )}
            </div>
          )}

          {/* Opportunities table */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-3 mb-1 border-b border-finma-border">
              <Star className="w-4 h-4 text-finma-yellow" />
              <span className="text-sm font-bold text-finma-text">Fırsat Listesi</span>
              <span className="ml-auto text-xs text-finma-text-dim">
                {isPro ? 'Tüm fırsatlar' : 'Free: #1 fırsat'}
              </span>
            </div>

            {loading ? (
              <div className="text-center py-10 text-finma-text-dim text-sm">
                <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin opacity-50" />
                Yükleniyor...
              </div>
            ) : opportunities.length === 0 ? (
              <div className="text-center py-10 text-finma-text-dim text-sm">
                <Flame className="w-8 h-8 mx-auto mb-2 opacity-20 text-orange-400" />
                <p>Henüz fırsat yüklenmedi.</p>
                <p className="text-xs mt-1 text-finma-text-dim/60">Bot NY 11:00, 13:05, 15:00'da çalışır.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-finma-text-dim bg-finma-bg/80">
                      <th className="text-left py-2.5 px-3 border border-finma-border/50 w-8">#</th>
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">Hisse</th>
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">Sektör</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Fiyat</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Giriş Zonu</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Stop</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Hedef</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Potansiyel</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Skor</th>
                      <th className="text-center py-2.5 px-3 border border-finma-border/50">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Rank 1 — always visible */}
                    {opportunities.map((opp, idx) => {
                      const isVisible = isPro || opp.rank === 1
                      return (
                        <tr
                          key={opp.ticker}
                          className={cn(
                            'transition-colors border-b border-finma-border/30',
                            isVisible ? 'cursor-pointer hover:bg-finma-primary/5' : 'cursor-default',
                            selectedTicker === opp.ticker && 'bg-finma-primary/10'
                          )}
                          onClick={() => isVisible && router.push(`/stock-analysis?ticker=${opp.ticker}`)}
                        >
                          <td className="py-2.5 px-3 border border-finma-border/50 finma-number text-finma-text-dim">{opp.rank}</td>
                          <td className="py-2.5 px-3 border border-finma-border/50">
                            {isVisible ? (
                              <div className="flex flex-col">
                                <span className="font-bold text-finma-primary finma-number text-sm">{opp.ticker}</span>
                                <span className="text-finma-text-dim text-[10px]">{opp.company_name}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-finma-text-dim/40">
                                <Lock className="w-3 h-3" />
                                <span className="font-bold">PRO</span>
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50">
                            {isVisible ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-white/5 text-finma-text-dim border-white/10">
                                {opp.sector}
                              </span>
                            ) : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold text-white">
                            {isVisible ? `$${opp.price?.toFixed(2)}` : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-finma-text-muted">
                            {isVisible ? opp.entry_zone : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-finma-red">
                            {isVisible ? `$${opp.stop_loss?.toFixed(2)}` : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-finma-green">
                            {isVisible ? `$${opp.target?.toFixed(2)}` : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold text-finma-green">
                            {isVisible ? `+${opp.potential_pct?.toFixed(1)}%` : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold text-finma-primary">
                            {isVisible ? opp.score?.toFixed(1) : <BlurCell />}
                          </td>
                          <td className="py-2.5 px-3 border border-finma-border/50 text-center" onClick={e => e.stopPropagation()}>
                            {isVisible ? (
                              <button
                                onClick={() => router.push(`/watchlist?add=${opp.ticker}`)}
                                className="text-[10px] px-2 py-1 rounded bg-finma-primary/20 text-finma-primary border border-finma-primary/30 hover:bg-finma-primary/40 transition-colors whitespace-nowrap"
                              >
                                + Takibe Al
                              </button>
                            ) : (
                              <button
                                onClick={() => router.push('/settings?upgrade=1')}
                                className="text-[10px] px-2 py-1 rounded bg-finma-yellow/10 text-finma-yellow border border-finma-yellow/30 hover:bg-finma-yellow/20 transition-colors whitespace-nowrap"
                              >
                                Pro'ya Geç
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Pro upsell banner for free users */}
          {!isPro && opportunities.length > 1 && (
            <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-finma-yellow/5 border border-finma-yellow/20">
              <Lock className="w-5 h-5 text-finma-yellow shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-finma-yellow">
                  {(runMeta?.total ?? opportunities.length) - 1} fırsat daha Pro üyelikte görünür
                </p>
                <p className="text-xs text-finma-text-dim mt-0.5">
                  Tüm fırsatları, stop-loss ve hedef fiyatları görüntülemek için Pro'ya geçin.
                </p>
              </div>
              <button
                onClick={() => router.push('/settings?upgrade=1')}
                className="px-4 py-2 rounded-lg bg-finma-yellow text-black text-xs font-bold hover:bg-finma-yellow/90 transition-colors whitespace-nowrap"
              >
                Pro'ya Geç
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function BlurCell() {
  return (
    <span className="inline-block w-16 h-3.5 rounded bg-finma-border/40 blur-sm select-none" />
  )
}
