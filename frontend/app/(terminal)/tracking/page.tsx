'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Activity, Plus, Trash2, RefreshCw, AlertTriangle,
  TrendingUp, TrendingDown, Minus, Shield, Clock,
  ChevronRight, Target, Zap, X, BarChart3, Lock,
} from 'lucide-react'

/* ── Tipler ────────────────────────────────────────────────────────────────── */

type Profile = 'day' | 'swing'

interface TrackingItem {
  ticker:       string
  entry_price:  number
  profile:      Profile
  has_position: boolean
  added_at:     string
  state?: {
    directive:   string
    text:        string
    color:       string
    score:       number
    tp:          number
    sl:          number
    price:       number
    rsi:         number
    rvol:        number
    computed_at: string
  }
}

type Directive =
  | 'TAKIP_ET' | 'BEKLE' | 'KADEMELI_AL' | 'AL'
  | 'TUT' | 'MALIYET_DUS' | 'KADEMELI_SAT' | 'SAT'

/* ── Direktif renkleri / metinleri ─────────────────────────────────────────── */

const DIRECTIVE_META: Record<Directive, {
  label: string; desc: string;
  bg: string; text: string; border: string; icon: React.ElementType
}> = {
  TAKIP_ET:      { label: 'TAKİP ET',      desc: 'Yapı gözlem modunda. Şu an netleşme bekleniyor.',                         bg: 'bg-gray-500/10',           text: 'text-gray-400',         border: 'border-gray-500/30',         icon: Activity    },
  BEKLE:         { label: 'BEKLE',          desc: 'Fiyat hareketleniyor ancak hacim teyit etmiyor.',                         bg: 'bg-finma-yellow/10',       text: 'text-finma-yellow',     border: 'border-finma-yellow/30',     icon: Clock       },
  KADEMELI_AL:   { label: 'KADEMELİ AL',   desc: 'Bazı yatırımcılar bu bölgede kademeli yaklaşımı tercih edebilir.',       bg: 'bg-finma-cyan/10',         text: 'text-finma-cyan',       border: 'border-finma-cyan/30',       icon: TrendingUp  },
  AL:            { label: 'AL',             desc: 'Kırılım yapısı güçleniyor. Momentum artışı izleniyor.',                  bg: 'bg-finma-green/10',        text: 'text-finma-green',      border: 'border-finma-green/30',      icon: TrendingUp  },
  TUT:           { label: 'TUT',            desc: 'Mevcut yapı devam ediyor. İzleme önerilir.',                             bg: 'bg-finma-green/10',        text: 'text-finma-green',      border: 'border-finma-green/30',      icon: Minus       },
  MALIYET_DUS:   { label: 'MALİYET DÜŞÜR', desc: 'Bazı yatırımcılar mevcut seviyeyi ortalama için değerlendiriyor.',       bg: 'bg-finma-yellow/10',       text: 'text-finma-yellow',     border: 'border-finma-yellow/30',     icon: BarChart3   },
  KADEMELI_SAT:  { label: 'KADEMELİ SAT',  desc: 'Güç kaybı görülüyor. Bazı yatırımcılar pozisyon küçültebilir.',         bg: 'bg-orange-500/10',         text: 'text-orange-400',       border: 'border-orange-500/30',       icon: TrendingDown},
  SAT:           { label: 'SAT',            desc: 'Risk referans seviyesi test edildi. Yapı zayıflama sinyali veriyor.',    bg: 'bg-finma-red/10',          text: 'text-finma-red',        border: 'border-finma-red/30',        icon: TrendingDown},
}

function getDirectiveMeta(d?: string) {
  return DIRECTIVE_META[(d ?? '') as Directive] ?? DIRECTIVE_META.TAKIP_ET
}

/* ── API yardimci ──────────────────────────────────────────────────────────── */

async function apiCall(method: string, path: string, body?: object) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('finma_token') : null
  const baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : '/api/proxy'
  const res = await fetch(`${baseUrl}/api/tracking${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

/* ── Hisse Ekle Modal ──────────────────────────────────────────────────────── */

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [ticker,      setTicker]      = useState('')
  const [entryPrice,  setEntryPrice]  = useState('')
  const [profile,     setProfile]     = useState<Profile>('swing')
  const [hasPosition, setHasPosition] = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  async function submit() {
    if (!ticker || !entryPrice) { setError('Ticker ve giriş fiyatı zorunlu'); return }
    setLoading(true)
    setError('')
    try {
      await apiCall('POST', '/add', {
        ticker:       ticker.toUpperCase(),
        entry_price:  parseFloat(entryPrice),
        profile,
        has_position: hasPosition,
      })
      onAdded()
      onClose()
    } catch (e: any) {
      setError(e.message || 'Eklenirken hata oluştu')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-finma-surface border border-white/10 rounded-xl p-6 w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white">Hisse Ekle</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-finma-text-dim" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Ticker</label>
            <input
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              placeholder="NVDA"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-finma-text-dim/50 focus:outline-none focus:border-finma-primary"
            />
          </div>

          <div>
            <label className="text-xs text-finma-text-dim block mb-1">Giriş Fiyatı ($)</label>
            <input
              type="number"
              value={entryPrice}
              onChange={e => setEntryPrice(e.target.value)}
              placeholder="0.00"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-finma-text-dim/50 focus:outline-none focus:border-finma-primary finma-number"
            />
          </div>

          <div>
            <label className="text-xs text-finma-text-dim block mb-2">Profil</label>
            <div className="grid grid-cols-2 gap-2">
              {(['swing', 'day'] as Profile[]).map(p => (
                <button
                  key={p}
                  onClick={() => setProfile(p)}
                  className={cn(
                    'py-2 rounded-lg text-xs font-semibold border transition-all',
                    profile === p
                      ? 'bg-finma-primary/20 border-finma-primary/50 text-finma-primary'
                      : 'bg-white/5 border-white/10 text-finma-text-dim'
                  )}
                >
                  {p === 'swing' ? 'Swing (3-10G)' : 'Day-Trade (1G)'}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPosition}
              onChange={e => setHasPosition(e.target.checked)}
              className="rounded"
            />
            <span className="text-xs text-finma-text-dim">Pozisyon açık</span>
          </label>
        </div>

        {error && <p className="text-xs text-finma-red">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 text-xs text-finma-text-dim hover:bg-white/10">
            İptal
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="flex-1 py-2 rounded-lg finma-btn-primary text-xs"
          >
            {loading ? 'Ekleniyor...' : 'Ekle'}
          </button>
        </div>

        {/* Yasal uyarı */}
        <p className="text-xs text-finma-text-dim/50 text-center leading-relaxed">
          Direktifler yatırım tavsiyesi değildir. Bilgilendirme amaçlıdır.
        </p>
      </div>
    </div>
  )
}

/* ── Takip Kartı ───────────────────────────────────────────────────────────── */

function TrackingCard({ item, onRemove, onCompute }: {
  item:      TrackingItem
  onRemove:  (t: string) => void
  onCompute: (t: string) => void
}) {
  const meta  = getDirectiveMeta(item.state?.directive)
  const Icon  = meta.icon
  const state = item.state
  const cfg   = item.profile === 'day'
    ? { sl_pct: 0.02, tp_pct: 0.03 }
    : { sl_pct: 0.05, tp_pct: 0.08 }

  const tp = state?.tp ?? item.entry_price * (1 + cfg.tp_pct)
  const sl = state?.sl ?? item.entry_price * (1 - cfg.sl_pct)

  const pricePct = state?.price
    ? ((state.price - item.entry_price) / item.entry_price) * 100
    : 0

  return (
    <div className="finma-card space-y-4">
      {/* Baslik */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-white finma-number">{item.ticker}</span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full font-semibold border',
              item.profile === 'day'
                ? 'text-finma-yellow border-finma-yellow/30 bg-finma-yellow/10'
                : 'text-finma-cyan border-finma-cyan/30 bg-finma-cyan/10'
            )}>
              {item.profile === 'day' ? 'Day' : 'Swing'}
            </span>
            {item.has_position && (
              <span className="text-xs text-finma-green border border-finma-green/30 bg-finma-green/10 px-2 py-0.5 rounded-full">Pozisyon</span>
            )}
          </div>
          <p className="text-xs text-finma-text-dim mt-0.5 finma-number">
            Giriş: ${item.entry_price.toFixed(2)}
            {state?.price && (
              <span className={cn('ml-2', pricePct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                {pricePct >= 0 ? '+' : ''}{pricePct.toFixed(2)}%
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onCompute(item.ticker)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-finma-text-dim hover:text-white transition-colors"
            title="Direktif hesapla"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onRemove(item.ticker)}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-finma-red/20 text-finma-text-dim hover:text-finma-red transition-colors"
            title="Listeden çıkar"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Direktif */}
      <div className={cn('rounded-xl border p-4 space-y-1', meta.border, meta.bg)}>
        <div className={cn('flex items-center gap-2', meta.text)}>
          <Icon className="w-4 h-4" />
          <span className="text-sm font-bold">{meta.label}</span>
        </div>
        <p className="text-xs text-finma-text-dim leading-relaxed">{meta.desc}</p>
        {state && (
          <p className="text-xs text-finma-text-dim/50 mt-1">
            Skor: {state.score} · RSI: {state.rsi} · RVOL: {state.rvol}x
          </p>
        )}
      </div>

      {/* Seviyeler — görsel bar */}
      <div className="space-y-2">
        <p className="text-xs text-finma-text-dim">Anahtar Seviyeler</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-finma-green/5 border border-finma-green/20 p-2">
            <p className="text-xs text-finma-text-dim mb-0.5">Hedef</p>
            <p className="text-sm font-bold text-finma-green finma-number">${tp.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-white/5 border border-white/10 p-2">
            <p className="text-xs text-finma-text-dim mb-0.5">Giriş</p>
            <p className="text-sm font-bold text-white finma-number">${item.entry_price.toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-finma-red/5 border border-finma-red/20 p-2">
            <p className="text-xs text-finma-text-dim mb-0.5">Stop</p>
            <p className="text-sm font-bold text-finma-red finma-number">${sl.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Hesaplanma zamanı */}
      {state?.computed_at && (
        <p className="text-xs text-finma-text-dim/40 text-right">
          <Clock className="w-3 h-3 inline mr-1" />
          {new Date(state.computed_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}

/* ── Ana Sayfa ─────────────────────────────────────────────────────────────── */

export default function TrackingPage() {
  const router = useRouter()
  const [items,      setItems]      = useState<TrackingItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showAdd,    setShowAdd]    = useState(false)
  const [computing,  setComputing]  = useState<string | null>(null)

  const fetchList = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/list')
      setItems(data.items || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchList() }, [fetchList])

  async function removeItem(ticker: string) {
    try {
      await apiCall('DELETE', `/${ticker}`)
      setItems(prev => prev.filter(i => i.ticker !== ticker))
    } catch { /* ignore */ }
  }

  async function computeState(ticker: string) {
    setComputing(ticker)
    try {
      const state = await apiCall('POST', `/${ticker}/compute`)
      setItems(prev => prev.map(i => i.ticker === ticker ? { ...i, state } : i))
    } catch { /* ignore */ }
    finally { setComputing(null) }
  }

  const stats = {
    al:    items.filter(i => i.state?.directive === 'AL' || i.state?.directive === 'KADEMELI_AL').length,
    tut:   items.filter(i => i.state?.directive === 'TUT').length,
    sat:   items.filter(i => i.state?.directive === 'SAT' || i.state?.directive === 'KADEMELI_SAT').length,
    bekle: items.filter(i => !i.state || i.state.directive === 'BEKLE' || i.state.directive === 'TAKIP_ET').length,
  }

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Baslik ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-finma-primary" />
          <h1 className="text-base font-bold text-white">Smart Tracking</h1>
          <span className="text-xs text-finma-text-dim px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            {items.length} hisse
          </span>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="finma-btn-primary flex items-center gap-1.5 text-xs px-3 py-2"
        >
          <Plus className="w-3.5 h-3.5" />
          Hisse Ekle
        </button>
      </div>

      {/* ── Ozet istatistikler ── */}
      {items.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Al Sinyali',  val: stats.al,    color: 'text-finma-green'  },
            { label: 'Tut',         val: stats.tut,   color: 'text-finma-primary'},
            { label: 'Bekle',       val: stats.bekle, color: 'text-finma-yellow' },
            { label: 'Sat/Azalt',   val: stats.sat,   color: 'text-finma-red'    },
          ].map(({ label, val, color }) => (
            <div key={label} className="finma-card text-center py-3">
              <p className={cn('text-lg font-bold finma-number', color)}>{val}</p>
              <p className="text-xs text-finma-text-dim">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Yukleniyor ── */}
      {loading && (
        <div className="finma-card flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-finma-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Bos liste ── */}
      {!loading && items.length === 0 && (
        <div className="finma-card text-center py-16 space-y-4">
          <Target className="w-10 h-10 text-finma-text-dim mx-auto" />
          <div>
            <p className="text-sm font-semibold text-white">Takip listesi boş</p>
            <p className="text-xs text-finma-text-dim mt-1">
              FinMA514 listesinden beğendiğin hisseleri ekle,
              <br />sistem her 5 dakikada bir direktif günceller.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="finma-btn-primary flex items-center gap-1.5 text-xs px-4 py-2"
            >
              <Plus className="w-3.5 h-3.5" /> İlk Hisseni Ekle
            </button>
            <button
              onClick={() => router.push('/finma514')}
              className="text-xs text-finma-primary hover:underline flex items-center gap-1"
            >
              FinMA514 Listesine Bak <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* ── Takip kartlari ── */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map(item => (
            <TrackingCard
              key={item.ticker}
              item={computing === item.ticker ? { ...item, state: undefined } : item}
              onRemove={removeItem}
              onCompute={computeState}
            />
          ))}
        </div>
      )}

      {/* ── Profil aciklamasi ── */}
      <div className="finma-card">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-finma-primary" />
          <p className="text-xs font-semibold text-white">Profil Farklılıkları</p>
        </div>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-1.5">
            <p className="text-finma-yellow font-semibold">Day-Trade</p>
            <p className="text-finma-text-dim">SL: -%2  |  TP: +%3</p>
            <p className="text-finma-text-dim">Cooldown: 30 dakika</p>
            <p className="text-finma-text-dim">Zaman ufku: 1 gün içi</p>
          </div>
          <div className="space-y-1.5">
            <p className="text-finma-cyan font-semibold">Swing</p>
            <p className="text-finma-text-dim">SL: -%5  |  TP: +%8</p>
            <p className="text-finma-text-dim">Cooldown: 60 dakika</p>
            <p className="text-finma-text-dim">Zaman ufku: 3-10 gün</p>
          </div>
        </div>
      </div>

      {/* ── Yasal Uyarı ── */}
      <div className="rounded-xl border border-white/5 bg-white/2 p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-3.5 h-3.5 text-finma-text-dim" />
          <p className="text-xs font-semibold text-finma-text-dim">Yasal Uyarı</p>
        </div>
        <p className="text-xs text-finma-text-dim/60 leading-relaxed">
          Direktifler yatırım tavsiyesi değildir. Karar destek aracıdır.
          Tüm finansal kararlar kullanıcının kendi sorumluluğundadır.
          Piyasalarda kayıp yaşanabilir. Geçmiş performans geleceği garanti etmez.
        </p>
      </div>

      {/* ── Modal ── */}
      {showAdd && (
        <AddModal onClose={() => setShowAdd(false)} onAdded={fetchList} />
      )}
    </div>
  )
}
