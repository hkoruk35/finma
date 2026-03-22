'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  List, Plus, Trash2, Bell, TrendingUp, TrendingDown,
  Lock, RefreshCw, Star, Eye, AlertCircle, X
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface WatchItem {
  id: string
  ticker: string
  alert_price?: number
  notes?: string
  added_at: string
  current_price?: number
  change_pct?: number
}

const TIER_LIMITS: Record<string, number> = { free: 1, pro: 10, admin: 999 }

export default function WatchlistPage() {
  return (
    <Suspense fallback={<div className="text-finma-text-dim text-sm p-4">Yükleniyor...</div>}>
      <WatchlistContent />
    </Suspense>
  )
}

function WatchlistContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { canAccess, user } = useAuthStore()
  const isPro = canAccess('pro')
  const tier = user?.subscription_tier || 'free'
  const limit = TIER_LIMITS[tier] || 1

  const [items, setItems] = useState<WatchItem[]>([])
  const [loading, setLoading] = useState(true)
  const [addTicker, setAddTicker] = useState(searchParams?.get('add') || '')
  const [addAlert, setAddAlert] = useState('')
  const [addNotes, setAddNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [showAddForm, setShowAddForm] = useState(!!searchParams?.get('add'))
  const [usedSlots, setUsedSlots] = useState(0)

  const getHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('finma_token')
    return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }
  }

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/watchlist`, { headers: getHeaders() })
      if (res.ok) {
        const data = await res.json()
        setItems(data.items || [])
        setUsedSlots(data.used || (data.items || []).length)
      }
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchList() }, [])

  const handleAdd = async () => {
    if (!addTicker.trim()) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/watchlist`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          ticker: addTicker.toUpperCase().trim(),
          alert_price: addAlert ? parseFloat(addAlert) : undefined,
          notes: addNotes || undefined,
        }),
      })
      if (res.ok) {
        setAddTicker('')
        setAddAlert('')
        setAddNotes('')
        setShowAddForm(false)
        fetchList()
      } else {
        const d = await res.json()
        setError(d.detail || 'Eklenemedi')
      }
    } catch { setError('Sunucu hatası') }
    setAdding(false)
  }

  const handleRemove = async (ticker: string) => {
    const token = localStorage.getItem('finma_token')
    await fetch(`${API_URL}/api/watchlist/${ticker}`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    fetchList()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <List className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-lg font-bold text-white">Akıllı Takip Listesi</h1>
            <p className="text-xs text-finma-text-dim">
              {usedSlots}/{limit} slot kullanılıyor
              {!isPro && <span className="ml-2 text-finma-yellow">(Free: 1 slot)</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchList}
            className="p-2 rounded-lg border border-finma-border text-finma-text-muted hover:text-finma-text transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => setShowAddForm(v => !v)}
            disabled={usedSlots >= limit}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
              usedSlots >= limit
                ? 'bg-finma-border/30 text-finma-text-dim cursor-not-allowed'
                : 'bg-finma-primary text-white hover:bg-finma-primary/90'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            Hisse Ekle
          </button>
        </div>
      </div>

      {/* Add form */}
      {showAddForm && usedSlots < limit && (
        <Card padding="sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-finma-text">Yeni Takip Ekle</span>
            <button onClick={() => setShowAddForm(false)} className="text-finma-text-dim hover:text-finma-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-finma-text-dim mb-1 block">Ticker *</label>
              <input
                value={addTicker}
                onChange={e => setAddTicker(e.target.value.toUpperCase())}
                placeholder="AAPL"
                className="w-full bg-finma-bg border border-finma-border rounded-md px-3 py-2 text-sm text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
            <div>
              <label className="text-xs text-finma-text-dim mb-1 block">Alarm Fiyatı (opsiyonel)</label>
              <input
                value={addAlert}
                onChange={e => setAddAlert(e.target.value)}
                placeholder="150.00"
                type="number"
                step="0.01"
                className="w-full bg-finma-bg border border-finma-border rounded-md px-3 py-2 text-sm text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
              />
            </div>
            <div>
              <label className="text-xs text-finma-text-dim mb-1 block">Not (opsiyonel)</label>
              <input
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="ATMACA sinyali..."
                className="w-full bg-finma-bg border border-finma-border rounded-md px-3 py-2 text-sm text-finma-text placeholder-finma-text-dim/40 focus:outline-none focus:border-finma-primary"
              />
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 mt-2 text-finma-red text-xs">
              <AlertCircle className="w-3.5 h-3.5" />
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleAdd}
              disabled={adding || !addTicker}
              className="px-4 py-2 rounded-lg bg-finma-primary text-white text-xs font-medium hover:bg-finma-primary/90 disabled:opacity-50 transition-colors"
            >
              {adding ? 'Ekleniyor...' : 'Ekle'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg border border-finma-border text-xs text-finma-text-muted hover:text-finma-text transition-colors">
              İptal
            </button>
          </div>
        </Card>
      )}

      {/* Limit reached banner */}
      {usedSlots >= limit && !isPro && (
        <div className="flex items-center gap-4 px-4 py-3 rounded-lg bg-finma-yellow/5 border border-finma-yellow/20">
          <Lock className="w-5 h-5 text-finma-yellow shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-finma-yellow">Slot limitine ulaştınız (1/{limit})</p>
            <p className="text-xs text-finma-text-dim mt-0.5">Pro'ya geçerek 10 slot kullanabilirsiniz.</p>
          </div>
          <button
            onClick={() => router.push('/settings?upgrade=1')}
            className="px-4 py-2 rounded-lg bg-finma-yellow text-black text-xs font-bold hover:bg-finma-yellow/90 transition-colors whitespace-nowrap"
          >
            Pro'ya Geç
          </button>
        </div>
      )}

      {/* Watchlist table */}
      <Card padding="sm">
        <div className="flex items-center gap-2 pb-3 mb-1 border-b border-finma-border">
          <Star className="w-4 h-4 text-finma-yellow" />
          <span className="text-sm font-bold text-finma-text">Takip Listesi</span>
          <span className="ml-auto text-xs text-finma-text-dim">{usedSlots}/{limit} slot</span>
        </div>

        {loading ? (
          <div className="text-center py-8 text-finma-text-dim text-sm">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-50" />
            Yükleniyor...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-10 text-finma-text-dim text-sm">
            <List className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p>Takip listesi boş.</p>
            <p className="text-xs mt-1 text-finma-text-dim/60">Hisse eklemek için yukarıdaki butonu kullanın.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-finma-text-dim bg-finma-bg/80">
                  <th className="text-left py-2.5 px-3 border border-finma-border/50">Hisse</th>
                  <th className="text-right py-2.5 px-3 border border-finma-border/50">Fiyat</th>
                  <th className="text-right py-2.5 px-3 border border-finma-border/50">Değişim</th>
                  <th className="text-right py-2.5 px-3 border border-finma-border/50">Alarm</th>
                  <th className="text-left py-2.5 px-3 border border-finma-border/50">Not</th>
                  <th className="text-left py-2.5 px-3 border border-finma-border/50">Eklenme</th>
                  <th className="text-center py-2.5 px-3 border border-finma-border/50">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.ticker}
                    className="hover:bg-finma-primary/5 transition-colors cursor-pointer"
                    onClick={() => router.push(`/stock-analysis?ticker=${item.ticker}`)}>
                    <td className="py-2.5 px-3 border border-finma-border/50 font-bold text-finma-primary finma-number text-sm">
                      {item.ticker}
                    </td>
                    <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-white font-bold">
                      {item.current_price ? `$${item.current_price.toFixed(2)}` : '—'}
                    </td>
                    <td className={cn(
                      'py-2.5 px-3 border border-finma-border/50 text-right finma-number font-bold',
                      (item.change_pct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red'
                    )}>
                      {item.change_pct !== undefined ? (
                        <div className="flex items-center justify-end gap-1">
                          {item.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {item.change_pct >= 0 ? '+' : ''}{item.change_pct.toFixed(1)}%
                        </div>
                      ) : '—'}
                    </td>
                    <td className="py-2.5 px-3 border border-finma-border/50 text-right finma-number text-finma-yellow">
                      {item.alert_price ? `$${item.alert_price.toFixed(2)}` : (
                        <span className="text-finma-text-dim/40">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 border border-finma-border/50 text-finma-text-dim max-w-[160px] truncate">
                      {item.notes || <span className="text-finma-text-dim/30">—</span>}
                    </td>
                    <td className="py-2.5 px-3 border border-finma-border/50 text-finma-text-dim">
                      {new Date(item.added_at).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="py-2.5 px-3 border border-finma-border/50 text-center" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleRemove(item.ticker)}
                        className="p-1.5 rounded hover:bg-finma-red/10 text-finma-text-dim hover:text-finma-red transition-colors"
                        title="Kaldır"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
