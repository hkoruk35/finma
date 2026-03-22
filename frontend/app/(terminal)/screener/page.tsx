'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  Search, Filter, RefreshCw, TrendingUp, TrendingDown, BarChart3,
  Lock, ChevronDown, AlertCircle, Star, Zap, Eye
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface ScreenerResult {
  ticker: string
  company_name: string
  sector: string
  price: number
  score: number
  score_breakdown: {
    trend: number
    volume: number
    momentum: number
    context: number
  }
  change_pct: number
  market_cap?: number
  reason: string
}

const SECTORS = ['Tümü', 'Technology', 'Energy', 'Healthcare', 'Financials', 'Consumer', 'Industrials', 'Materials', 'Utilities']
const SORT_OPTIONS = [
  { value: 'score', label: 'FinMA Skor' },
  { value: 'change_pct', label: 'Günlük Değişim' },
  { value: 'volume', label: 'Hacim' },
]

export default function ScreenerPage() {
  const router = useRouter()
  const { canAccess, user } = useAuthStore()
  const isPro = canAccess('pro')
  const isAdmin = canAccess('admin')
  const tier = user?.subscription_tier || 'free'

  const [results, setResults] = useState<ScreenerResult[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [credits, setCredits] = useState<{ remaining: number; limit: number; tier: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(true)

  // Filters
  const [sector, setSector] = useState('Tümü')
  const [minScore, setMinScore] = useState('')
  const [minChange, setMinChange] = useState('')
  const [sortBy, setSortBy] = useState('score')

  const getHeaders = () => {
    const token = localStorage.getItem('finma_token')
    return {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'Content-Type': 'application/json',
    }
  }

  const fetchCredits = async () => {
    try {
      const res = await fetch(`${API_URL}/api/screener/credits`, { headers: getHeaders() })
      if (res.ok) setCredits(await res.json())
    } catch {}
  }

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/screener/history`, { headers: getHeaders() })
      if (res.ok) {
        const d = await res.json()
        setHistory(d.history || [])
      }
    } catch {}
  }

  useEffect(() => {
    fetchCredits()
    fetchHistory()
  }, [])

  const runScan = async () => {
    if (credits && credits.remaining <= 0 && !isAdmin) return
    setLoading(true)
    try {
      const filters: any = { sort_by: sortBy }
      if (sector !== 'Tümü') filters.sector = sector
      if (minScore) filters.min_score = parseFloat(minScore)
      if (minChange) filters.min_change_pct = parseFloat(minChange)

      const res = await fetch(`${API_URL}/api/screener/run`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(filters),
      })
      if (res.ok) {
        const d = await res.json()
        setResults(d.results || [])
        fetchCredits()
        fetchHistory()
      }
    } catch {}
    setLoading(false)
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-finma-green'
    if (score >= 50) return 'text-finma-primary'
    if (score >= 25) return 'text-finma-yellow'
    return 'text-finma-text-dim'
  }

  const getScoreBg = (score: number) => {
    if (score >= 75) return 'bg-finma-green/10 border-finma-green/30'
    if (score >= 50) return 'bg-finma-primary/10 border-finma-primary/30'
    if (score >= 25) return 'bg-finma-yellow/10 border-finma-yellow/30'
    return 'bg-finma-border/20 border-finma-border/30'
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-lg font-bold text-white">Hisse Tarama</h1>
            <p className="text-xs text-finma-text-dim">FinMA Skorlama Motoru (0–100)</p>
          </div>
        </div>
        {credits && (
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
            credits.remaining > 0 ? 'border-finma-primary/30 bg-finma-primary/5 text-finma-primary' : 'border-finma-red/30 bg-finma-red/5 text-finma-red'
          )}>
            <Zap className="w-3.5 h-3.5" />
            {isAdmin ? 'Sınırsız tarama' : `${credits.remaining}/${credits.limit} tarama kaldı`}
            {!isPro && <span className="text-finma-text-dim ml-1">(Haftalık)</span>}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Filters sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <Card padding="sm">
            <button
              onClick={() => setFiltersOpen(v => !v)}
              className="w-full flex items-center justify-between text-sm font-semibold text-finma-text mb-2"
            >
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filtreler
              </div>
              <ChevronDown className={cn('w-4 h-4 transition-transform', filtersOpen && 'rotate-180')} />
            </button>

            {filtersOpen && (
              <div className="space-y-3">
                {/* Sector */}
                <div>
                  <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-1.5 block">Sektör</label>
                  <select
                    value={sector}
                    onChange={e => setSector(e.target.value)}
                    className="w-full bg-finma-bg border border-finma-border rounded-md px-2.5 py-2 text-xs text-finma-text focus:outline-none focus:border-finma-primary"
                  >
                    {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                {/* Min Score */}
                <div>
                  <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-1.5 block">Min. Skor (0-100)</label>
                  <input
                    value={minScore}
                    onChange={e => setMinScore(e.target.value)}
                    type="number"
                    min="0" max="100"
                    placeholder="0"
                    className="w-full bg-finma-bg border border-finma-border rounded-md px-2.5 py-2 text-xs text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
                  />
                </div>

                {/* Min Change */}
                <div>
                  <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-1.5 block">Min. Değişim %</label>
                  <input
                    value={minChange}
                    onChange={e => setMinChange(e.target.value)}
                    type="number"
                    step="0.1"
                    placeholder="-100"
                    className="w-full bg-finma-bg border border-finma-border rounded-md px-2.5 py-2 text-xs text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
                  />
                </div>

                {/* Sort */}
                <div>
                  <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-1.5 block">Sıralama</label>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value)}
                    className="w-full bg-finma-bg border border-finma-border rounded-md px-2.5 py-2 text-xs text-finma-text focus:outline-none focus:border-finma-primary"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>

                <button
                  onClick={runScan}
                  disabled={loading || (!isAdmin && credits?.remaining === 0)}
                  className={cn(
                    'w-full py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2',
                    (!isAdmin && credits?.remaining === 0)
                      ? 'bg-finma-border/30 text-finma-text-dim cursor-not-allowed'
                      : 'bg-finma-primary text-white hover:bg-finma-primary/90'
                  )}
                >
                  {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  {loading ? 'Taranıyor...' : 'Tara'}
                </button>

                {!isPro && credits?.remaining === 0 && (
                  <p className="text-[10px] text-finma-yellow text-center">Haftalık limit doldu. Pro'ya geçin.</p>
                )}
              </div>
            )}
          </Card>

          {/* Recent scans */}
          {history.length > 0 && (
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2">Son Taramalar</div>
              <div className="space-y-1.5">
                {history.slice(0, 5).map((h: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-xs text-finma-text-dim">
                    <span>{new Date(h.scanned_at).toLocaleDateString('tr-TR')}</span>
                    <span className="text-finma-primary font-medium">{h.result_count} sonuç</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-3 mb-1 border-b border-finma-border">
              <BarChart3 className="w-4 h-4 text-finma-primary" />
              <span className="text-sm font-bold text-finma-text">Sonuçlar</span>
              {results.length > 0 && (
                <span className="ml-2 text-xs text-finma-text-dim">{results.length} hisse</span>
              )}
            </div>

            {results.length === 0 ? (
              <div className="text-center py-12 text-finma-text-dim">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Filtre seçin ve Tara butonuna basın</p>
                <p className="text-xs mt-1 text-finma-text-dim/60">FinMA Skorlama: Trend %30 + Hacim %25 + Momentum %32 + Bağlam %13</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-finma-text-dim bg-finma-bg/80">
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">#</th>
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">Hisse</th>
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">Sektör</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Fiyat</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">Değişim</th>
                      <th className="text-right py-2.5 px-3 border border-finma-border/50">FinMA Skor</th>
                      <th className="text-left py-2.5 px-3 border border-finma-border/50">Skor Dağılımı</th>
                      <th className="text-center py-2.5 px-3 border border-finma-border/50">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => (
                      <tr key={r.ticker}
                        className="hover:bg-finma-primary/5 transition-colors cursor-pointer"
                        onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                        <td className="py-2.5 px-3 border border-finma-border/50 finma-number text-finma-text-dim">{idx + 1}</td>
                        <td className="py-2.5 px-3 border border-finma-border/50">
                          <div className="flex flex-col">
                            <span className="font-bold text-finma-primary finma-number text-sm">{r.ticker}</span>
                            <span className="text-finma-text-dim text-[10px]">{r.company_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 border border-finma-border/50">
                          <span className="text-[9px] px-1.5 py-0.5 rounded border font-bold uppercase bg-white/5 text-finma-text-dim border-white/10">
                            {r.sector}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-white font-bold">
                          ${r.price?.toFixed(2)}
                        </td>
                        <td className={cn(
                          'py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold',
                          (r.change_pct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red'
                        )}>
                          {(r.change_pct ?? 0) >= 0 ? '+' : ''}{(r.change_pct ?? 0).toFixed(1)}%
                        </td>
                        <td className="py-2.5 px-3 border border-finma-border/50 text-right">
                          <span className={cn(
                            'finma-number font-bold text-sm px-2 py-0.5 rounded border',
                            getScoreBg(r.score), getScoreColor(r.score)
                          )}>
                            {r.score?.toFixed(0)}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 border border-finma-border/50">
                          {r.score_breakdown && (
                            <div className="flex gap-2 text-[9px] text-finma-text-dim">
                              <span>T:{r.score_breakdown.trend?.toFixed(0)}</span>
                              <span>H:{r.score_breakdown.volume?.toFixed(0)}</span>
                              <span>M:{r.score_breakdown.momentum?.toFixed(0)}</span>
                              <span>B:{r.score_breakdown.context?.toFixed(0)}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-3 border border-finma-border/50 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/watchlist?add=${r.ticker}`)}
                            className="text-[10px] px-2 py-1 rounded bg-finma-primary/20 text-finma-primary border border-finma-primary/30 hover:bg-finma-primary/40 transition-colors"
                          >
                            + Takibe Al
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
