'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { cn, formatCurrency, getPnlColor } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  Briefcase, Plus, TrendingUp, TrendingDown, RefreshCw,
  Star, Eye, BarChart2, PieChart, ChevronRight, Lock
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

const PORTFOLIO_LIMITS: Record<string, number> = { free: 1, pro: 10, admin: 999 }

interface Portfolio {
  id: string
  name: string
  description?: string
  created_at: string
  trade_count?: number
  total_pnl?: number
}

interface Trade {
  id: string
  ticker: string
  direction: 'LONG' | 'SHORT'
  entry_price: number
  current_price: number
  stop_loss: number
  target_price: number
  qty: number
  pnl: number
  pnl_pct: number
  status: string
  strategy: string
  product_type?: string
  entry_date: string
}

export default function PortfolioPage() {
  const router = useRouter()
  const { user, canAccess } = useAuthStore()
  const isPro = canAccess('pro')
  const tier = user?.subscription_tier || 'free'
  const limit = PORTFOLIO_LIMITS[tier] || 1

  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [tradesLoading, setTradesLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'open' | 'all'>('open')

  const getToken = () => localStorage.getItem('finma_token')
  const headers = (): Record<string, string> => {
    const t = getToken()
    return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  }

  const fetchPortfolios = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/portfolio/portfolios`, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        const list: Portfolio[] = data.portfolios || []
        setPortfolios(list)
        if (!activeId && list.length > 0) setActiveId(list[0].id)
      }
    } catch {}
    setLoading(false)
  }

  const fetchTrades = async (portfolioId: string) => {
    setTradesLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/portfolio/trades`, { headers: headers() })
      if (res.ok) {
        const data = await res.json()
        setTrades(data.trades || [])
      }
    } catch {}
    setTradesLoading(false)
  }

  useEffect(() => { fetchPortfolios() }, [])
  useEffect(() => { if (activeId) fetchTrades(activeId) }, [activeId])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`${API_URL}/api/portfolio/portfolios`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ name: newName.trim() }),
      })
      if (res.ok) {
        const data = await res.json()
        setNewName('')
        setShowCreateForm(false)
        await fetchPortfolios()
        setActiveId(data.id)
      }
    } catch {}
    setCreating(false)
  }

  const activePf = portfolios.find(p => p.id === activeId)
  const filteredTrades = tab === 'open' ? trades.filter(t => t.status === 'OPEN') : trades
  const openTrades = trades.filter(t => t.status === 'OPEN')
  const totalPnl = openTrades.reduce((s, t) => s + t.pnl, 0)
  const winners = openTrades.filter(t => t.pnl > 0).length
  const winRate = openTrades.length > 0 ? Math.round((winners / openTrades.length) * 100) : 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Briefcase className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-lg font-bold text-white">Portföy Yönetimi</h1>
            <p className="text-xs text-finma-text-dim">{portfolios.length}/{limit} portföy</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPortfolios}
            className="p-2 rounded-lg border border-finma-border text-finma-text-muted hover:text-finma-text transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => router.push('/operations')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-finma-primary text-white text-xs font-medium hover:bg-finma-primary/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Pozisyon Ekle
          </button>
        </div>
      </div>

      {/* Portfolio Tabs */}
      <div className="flex items-center gap-1 flex-wrap">
        {loading ? (
          <div className="h-8 w-32 bg-finma-border/30 rounded-lg animate-pulse" />
        ) : (
          portfolios.map(pf => (
            <button
              key={pf.id}
              onClick={() => setActiveId(pf.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                activeId === pf.id
                  ? 'bg-finma-primary border-finma-primary text-white'
                  : 'border-finma-border text-finma-text-dim hover:text-finma-text hover:border-finma-border/80'
              )}
            >
              {pf.name}
            </button>
          ))
        )}

        {/* Add portfolio button */}
        {portfolios.length < limit ? (
          <button
            onClick={() => setShowCreateForm(v => !v)}
            className="px-3 py-1.5 rounded-lg text-xs border border-dashed border-finma-border text-finma-text-dim hover:text-finma-text hover:border-finma-primary/50 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            Yeni Portföy
          </button>
        ) : !isPro ? (
          <button
            onClick={() => router.push('/settings?upgrade=1')}
            className="px-3 py-1.5 rounded-lg text-xs border border-finma-yellow/30 text-finma-yellow hover:bg-finma-yellow/5 transition-colors flex items-center gap-1"
          >
            <Lock className="w-3 h-3" />
            Pro ile daha fazla
          </button>
        ) : null}
      </div>

      {/* Create form */}
      {showCreateForm && (
        <Card padding="sm">
          <div className="flex items-center gap-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Portföy adı (örn: Swing Portföyü)"
              className="flex-1 bg-finma-bg border border-finma-border rounded-lg px-3 py-2 text-sm text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 rounded-lg bg-finma-primary text-white text-xs font-medium hover:bg-finma-primary/90 disabled:opacity-50 transition-colors"
            >
              {creating ? 'Oluşturuluyor...' : 'Oluştur'}
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-3 py-2 rounded-lg border border-finma-border text-xs text-finma-text-dim hover:text-finma-text transition-colors"
            >
              İptal
            </button>
          </div>
        </Card>
      )}

      {/* Portfolio Summary Cards */}
      {activePf && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card padding="sm">
            <span className="text-[10px] text-finma-text-dim uppercase tracking-wider">Açık Pozisyon</span>
            <div className="text-xl font-bold finma-number text-white mt-1">{openTrades.length}</div>
          </Card>
          <Card padding="sm">
            <span className="text-[10px] text-finma-text-dim uppercase tracking-wider">Toplam PnL</span>
            <div className={cn('text-xl font-bold finma-number mt-1', getPnlColor(totalPnl))}>
              {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
            </div>
          </Card>
          <Card padding="sm">
            <span className="text-[10px] text-finma-text-dim uppercase tracking-wider">Kazanma Oranı</span>
            <div className={cn('text-xl font-bold finma-number mt-1', winRate >= 50 ? 'text-finma-green' : 'text-finma-red')}>
              %{winRate}
            </div>
          </Card>
          <Card padding="sm">
            <span className="text-[10px] text-finma-text-dim uppercase tracking-wider">Kazanan/Kaybeden</span>
            <div className="text-lg font-bold finma-number mt-1 text-white">
              <span className="text-finma-green">{winners}</span>
              <span className="text-finma-text-dim mx-1">/</span>
              <span className="text-finma-red">{openTrades.length - winners}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Trades table */}
      <Card padding="sm">
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-finma-border">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-finma-primary" />
            <span className="text-sm font-bold text-finma-text">
              {activePf ? activePf.name : 'Pozisyonlar'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setTab('open')}
              className={cn('px-3 py-1 rounded-md transition-colors', tab === 'open' ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text')}
            >
              Açık
            </button>
            <button
              onClick={() => setTab('all')}
              className={cn('px-3 py-1 rounded-md transition-colors', tab === 'all' ? 'bg-finma-primary text-white' : 'text-finma-text-dim hover:text-finma-text')}
            >
              Tümü
            </button>
          </div>
        </div>

        {tradesLoading ? (
          <div className="text-center py-8 text-finma-text-dim text-sm">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-50" />
            Yükleniyor...
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="text-center py-10 text-finma-text-dim text-sm">
            <Briefcase className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>{tab === 'open' ? 'Açık pozisyon yok.' : 'Henüz işlem yok.'}</p>
            <button
              onClick={() => router.push('/operations')}
              className="mt-2 text-xs text-finma-primary hover:underline flex items-center gap-1 mx-auto"
            >
              <Plus className="w-3 h-3" /> Pozisyon ekle
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-finma-text-dim bg-finma-bg/80">
                  <th className="text-left py-2 px-3 border border-finma-border/50">Sembol</th>
                  <th className="text-left py-2 px-2 border border-finma-border/50">Ürün</th>
                  <th className="text-left py-2 px-2 border border-finma-border/50">Yön</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">Giriş</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">Güncel</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">Adet</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">PnL $</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">PnL %</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50 hidden md:table-cell">Stop</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50 hidden md:table-cell">Hedef</th>
                  <th className="text-left py-2 px-2 border border-finma-border/50 hidden md:table-cell">Strateji</th>
                  <th className="text-center py-2 px-2 border border-finma-border/50">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filteredTrades.map(trade => (
                  <tr
                    key={trade.id}
                    className="hover:bg-finma-primary/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/stock-analysis?ticker=${trade.ticker}`)}
                  >
                    <td className="py-2.5 px-3 border border-finma-border/50 font-bold text-finma-primary finma-number text-sm">
                      {trade.ticker}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-finma-text-dim">
                      {trade.product_type || 'Stock'}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50">
                      <Badge variant={trade.direction === 'LONG' ? 'buy' : 'sell'}>{trade.direction}</Badge>
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-right finma-number">
                      ${trade.entry_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-right finma-number text-white font-bold">
                      ${trade.current_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-right finma-number">
                      {trade.qty}
                    </td>
                    <td className={cn('py-2.5 px-2 border border-finma-border/50 text-right finma-number font-bold', getPnlColor(trade.pnl))}>
                      {trade.pnl >= 0 ? '+' : ''}{formatCurrency(trade.pnl)}
                    </td>
                    <td className={cn('py-2.5 px-2 border border-finma-border/50 text-right finma-number', getPnlColor(trade.pnl_pct))}>
                      {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct.toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-right finma-number text-finma-red hidden md:table-cell">
                      ${trade.stop_loss.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-right finma-number text-finma-green hidden md:table-cell">
                      ${trade.target_price.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-finma-text-dim hidden md:table-cell">
                      {trade.strategy}
                    </td>
                    <td className="py-2.5 px-2 border border-finma-border/50 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => router.push(`/watchlist?add=${trade.ticker}`)}
                        className="p-1.5 rounded hover:bg-finma-primary/10 text-finma-text-dim hover:text-finma-primary transition-colors"
                        title="Takibe Al"
                      >
                        <Star className="w-3.5 h-3.5" />
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
  )
}
