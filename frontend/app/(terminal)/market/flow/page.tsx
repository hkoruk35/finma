'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import {
  Activity, TrendingUp, TrendingDown, BarChart2,
  RefreshCw, AlertCircle, ArrowRight, Flame, Building2,
  Zap, Clock, Wifi, Shield, ChevronDown, ChevronUp,
} from 'lucide-react'

// ─── LocalStorage keys ────────────────────────────────────────────────────────
const LS_FLOW_KEY    = 'finma_flow_data'
const LS_FLOW_UPDATE = 'finma_flow_updated'

// ─── Types ────────────────────────────────────────────────────────────────────
interface SectorFlow {
  etf: string; sector: string; change_pct: number; price: number;
  volume_ratio: number; flow: 'inflow' | 'outflow' | 'neutral'
}
interface Mover {
  ticker: string; price: number; change_pct: number; volume: number; rvol: number
}
interface Signal {
  ticker: string; price: number; change_pct: number; rvol: number;
  volume: number; signal: string; signal_type: 'buy' | 'sell'
}
interface InsiderTrade {
  ticker: string; insider_name: string; title: string; transaction_type: string;
  is_buy: boolean; shares: number; value: number; price: number; date: string
}
interface FlowSummary {
  inflow_sectors: number; outflow_sectors: number;
  insider_buys: number; insider_sells: number; unusual_signals: number
}
interface FlowData {
  updated_at: string | null; updated_ts: number | null;
  sector_flow: SectorFlow[]; gainers: Mover[]; losers: Mover[];
  high_volume: Mover[]; unusual_signals: Signal[]; insiders: InsiderTrade[];
  summary: FlowSummary; stale?: boolean
}

const EMPTY_FLOW: FlowData = {
  updated_at: null, updated_ts: null,
  sector_flow: [], gainers: [], losers: [],
  high_volume: [], unusual_signals: [], insiders: [],
  summary: { inflow_sectors: 0, outflow_sectors: 0, insider_buys: 0, insider_sells: 0, unusual_signals: 0 },
  stale: true,
}

// ─── Helper Components ────────────────────────────────────────────────────────

function FlowBar({ pct }: { pct: number }) {
  const w = Math.min(Math.abs(pct) * 10, 100)
  return (
    <div className="h-1.5 bg-finma-border/30 rounded-full overflow-hidden w-20 shrink-0">
      <div
        className={cn('h-full rounded-full transition-all', pct >= 0 ? 'bg-finma-green' : 'bg-finma-red')}
        style={{ width: `${w}%` }}
      />
    </div>
  )
}

function RvolBadge({ rvol }: { rvol: number }) {
  const color = rvol >= 3 ? 'text-finma-yellow bg-finma-yellow/10' : rvol >= 2 ? 'text-finma-primary bg-finma-primary/10' : 'text-finma-text-dim bg-finma-border/20'
  return (
    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded finma-number', color)}>
      {rvol.toFixed(1)}x
    </span>
  )
}

function NextUpdateCountdown({ updatedTs }: { updatedTs: number | null }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const tick = () => {
      if (!updatedTs) { setRemaining('—'); return }
      const nextUpdateAt = updatedTs * 1000 + 4 * 60 * 60 * 1000 // +4 saat
      const diff = nextUpdateAt - Date.now()
      if (diff <= 0) { setRemaining('güncelleniyor…'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${h}s ${m}d ${s}sn`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [updatedTs])
  return <span className="text-[10px] text-finma-text-dim finma-number">Sonraki: {remaining}</span>
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MarketFlowPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // LocalStorage'dan anlık yükle (sayfayı anında göster)
  const [flowData, setFlowData] = useState<FlowData>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_FLOW_KEY) : null
      return raw ? JSON.parse(raw) : EMPTY_FLOW
    } catch { return EMPTY_FLOW }
  })
  const [lastUpdate, setLastUpdate] = useState(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem(LS_FLOW_UPDATE) || '') : ''
    } catch { return '' }
  })

  const [refreshing, setRefreshing]     = useState(false)
  const [triggering, setTriggering]     = useState(false)
  const [trigMsg, setTrigMsg]           = useState<string | null>(null)
  const [expandInsiders, setExpandInsiders] = useState(false)
  const isFetching = useRef(false)

  const fetchFlow = useCallback(async (showSpinner = false) => {
    if (isFetching.current) return
    isFetching.current = true
    if (showSpinner) setRefreshing(true)
    try {
      const data = await api.getFlowData()
      if (data && (data.sector_flow?.length > 0 || data.gainers?.length > 0 || data.insiders?.length > 0)) {
        setFlowData(data)
        try { localStorage.setItem(LS_FLOW_KEY, JSON.stringify(data)) } catch {}
        const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
        setLastUpdate(now)
        try { localStorage.setItem(LS_FLOW_UPDATE, now) } catch {}
      }
    } catch (e) {
      console.error('Flow veri hatası:', e)
    }
    isFetching.current = false
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchFlow(false) // Sayfa açılışında sessiz yenile
    // Her 4 saatte otomatik yenile (4 * 60 * 60 * 1000 ms)
    const interval = setInterval(() => fetchFlow(false), 4 * 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [fetchFlow])

  const handleAdminTrigger = async () => {
    setTriggering(true)
    setTrigMsg(null)
    try {
      const res = await api.refreshFlowData()
      setTrigMsg(`✅ ${res.message || 'Flow bot başlatıldı — 3-5 dakika içinde veriler güncellenir.'}`)
      // 5 dakika sonra otomatik yenile
      setTimeout(() => fetchFlow(true), 5 * 60 * 1000)
    } catch (e: any) {
      setTrigMsg(`❌ Başlatılamadı: ${e.message || 'Bilinmeyen hata'}`)
    } finally {
      setTriggering(false)
      setTimeout(() => setTrigMsg(null), 20_000)
    }
  }

  const { sector_flow, gainers, losers, high_volume, unusual_signals, insiders, summary } = flowData
  const inflowSectors  = sector_flow.filter(s => s.flow === 'inflow').sort((a, b) => b.change_pct - a.change_pct)
  const outflowSectors = sector_flow.filter(s => s.flow === 'outflow').sort((a, b) => a.change_pct - b.change_pct)
  const hasData        = sector_flow.length > 0 || gainers.length > 0 || insiders.length > 0

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-base font-bold text-white">Akıllı Para Akışı</h1>
            <p className="text-[10px] text-finma-text-dim">Kurumsal akış • Insider işlemleri • RVOL sinyalleri</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {lastUpdate && (
            <span className="flex items-center gap-1 text-[10px] text-finma-text-dim">
              <Wifi className="w-2.5 h-2.5" />Son: {lastUpdate}
            </span>
          )}
          {flowData.updated_ts && (
            <NextUpdateCountdown updatedTs={flowData.updated_ts} />
          )}
          {refreshing && (
            <span className="text-[10px] text-finma-primary animate-pulse">güncelleniyor…</span>
          )}
          {/* Sessiz arka plan yenileme butonu */}
          <button
            onClick={() => fetchFlow(true)}
            disabled={refreshing}
            className="p-1.5 rounded border border-finma-border text-finma-text-dim hover:text-finma-text transition-colors"
            title="Önbelleği yenile"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
          {/* Admin — manuel bot tetikleme */}
          {isAdmin && (
            <button
              onClick={handleAdminTrigger}
              disabled={triggering}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all',
                triggering
                  ? 'border-finma-border text-finma-text-dim cursor-not-allowed'
                  : 'border-finma-yellow/50 text-finma-yellow hover:border-finma-yellow hover:bg-finma-yellow/10'
              )}
            >
              <Shield className="w-3 h-3" />
              {triggering ? 'Çalışıyor…' : 'Manuel Güncelle'}
            </button>
          )}
        </div>
      </div>

      {/* Admin mesajı */}
      {trigMsg && (
        <div className={cn(
          'text-xs px-4 py-2 rounded-lg border',
          trigMsg.startsWith('✅')
            ? 'bg-finma-green/10 border-finma-green/30 text-finma-green'
            : 'bg-finma-red/10 border-finma-red/30 text-finma-red'
        )}>
          {trigMsg}
        </div>
      )}

      {/* Veri yoksa bilgi mesajı */}
      {!hasData && !refreshing && (
        <Card padding="sm">
          <div className="text-center py-10">
            <Clock className="w-8 h-8 mx-auto mb-3 text-finma-text-dim/40" />
            <p className="text-sm font-bold text-finma-text-dim mb-1">Flow verisi henüz hazır değil</p>
            <p className="text-xs text-finma-text-dim/60 mb-4">
              Flow Bot her 4 saatte bir çalışır. İlk veriyi almak için{' '}
              {isAdmin ? '"Manuel Güncelle" butonuna tıklayın.' : 'lütfen bekleyin veya bir sonraki döngüyü bekleyin.'}
            </p>
            {isAdmin && (
              <button
                onClick={handleAdminTrigger}
                disabled={triggering}
                className="px-4 py-2 bg-finma-primary/20 hover:bg-finma-primary/30 border border-finma-primary/40 rounded-lg text-sm text-finma-primary font-bold transition-all"
              >
                {triggering ? 'Bot başlatılıyor…' : 'Flow Bot\'u Başlat'}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* ── Özet Sayaçları ── */}
      {hasData && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {[
            { label: 'Inflow Sektör', value: summary.inflow_sectors, color: 'text-finma-green', icon: TrendingUp },
            { label: 'Outflow Sektör', value: summary.outflow_sectors, color: 'text-finma-red', icon: TrendingDown },
            { label: 'Insider Alış', value: summary.insider_buys, color: 'text-finma-green', icon: Building2 },
            { label: 'Insider Satış', value: summary.insider_sells, color: 'text-finma-red', icon: Building2 },
            { label: 'RVOL Sinyal', value: summary.unusual_signals, color: 'text-finma-yellow', icon: Zap },
          ].map(({ label, value, color, icon: Icon }) => (
            <Card key={label} padding="sm">
              <div className="flex items-center gap-2">
                <Icon className={cn('w-3.5 h-3.5', color)} />
                <div>
                  <div className={cn('text-lg font-bold finma-number leading-none', color)}>{value}</div>
                  <div className="text-[9px] text-finma-text-dim mt-0.5">{label}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Sektör Akışı ── */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Inflow */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
              <TrendingUp className="w-4 h-4 text-finma-green" />
              <span className="text-sm font-bold text-finma-green">Para Girişi (Inflow)</span>
              <span className="ml-auto text-[10px] text-finma-text-dim">{inflowSectors.length} sektör</span>
            </div>
            {inflowSectors.length === 0 ? (
              <div className="text-center py-4 text-finma-text-dim text-xs">Inflow sektör yok</div>
            ) : (
              <div className="space-y-2">
                {inflowSectors.map(s => (
                  <div key={s.etf} className="flex items-center gap-2 group">
                    <button
                      onClick={() => router.push(`/stock-analysis?ticker=${s.etf}`)}
                      className="text-xs font-bold finma-number text-finma-primary hover:underline w-10 shrink-0"
                    >
                      {s.etf}
                    </button>
                    <span className="text-xs text-finma-text-dim flex-1 truncate">{s.sector}</span>
                    <span className="text-[9px] text-finma-text-dim/60 finma-number shrink-0">{s.volume_ratio.toFixed(1)}x vol</span>
                    <FlowBar pct={s.change_pct} />
                    <span className="text-xs font-bold finma-number text-finma-green w-14 text-right shrink-0">
                      +{s.change_pct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Outflow */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
              <TrendingDown className="w-4 h-4 text-finma-red" />
              <span className="text-sm font-bold text-finma-red">Para Çıkışı (Outflow)</span>
              <span className="ml-auto text-[10px] text-finma-text-dim">{outflowSectors.length} sektör</span>
            </div>
            {outflowSectors.length === 0 ? (
              <div className="text-center py-4 text-finma-text-dim text-xs">Outflow sektör yok</div>
            ) : (
              <div className="space-y-2">
                {outflowSectors.map(s => (
                  <div key={s.etf} className="flex items-center gap-2 group">
                    <button
                      onClick={() => router.push(`/stock-analysis?ticker=${s.etf}`)}
                      className="text-xs font-bold finma-number text-finma-primary hover:underline w-10 shrink-0"
                    >
                      {s.etf}
                    </button>
                    <span className="text-xs text-finma-text-dim flex-1 truncate">{s.sector}</span>
                    <span className="text-[9px] text-finma-text-dim/60 finma-number shrink-0">{s.volume_ratio.toFixed(1)}x vol</span>
                    <FlowBar pct={s.change_pct} />
                    <span className="text-xs font-bold finma-number text-finma-red w-14 text-right shrink-0">
                      {s.change_pct.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Unusual Volume Sinyalleri ── */}
      {hasData && unusual_signals.length > 0 && (
        <Card padding="sm">
          <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
            <Zap className="w-4 h-4 text-finma-yellow" />
            <span className="text-sm font-bold text-finma-yellow">Anormal Hacim Sinyalleri</span>
            <span className="text-[10px] bg-finma-yellow/10 text-finma-yellow px-2 py-0.5 rounded ml-1">RVOL &gt; 2×</span>
            <span className="ml-auto text-[10px] text-finma-text-dim">{unusual_signals.length} sinyal</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {unusual_signals.map(sig => (
              <div
                key={sig.ticker}
                onClick={() => router.push(`/stock-analysis?ticker=${sig.ticker}`)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:brightness-110',
                  sig.signal_type === 'buy'
                    ? 'bg-finma-green/5 border-finma-green/20'
                    : 'bg-finma-red/5 border-finma-red/20'
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold finma-number text-finma-primary">{sig.ticker}</span>
                    <RvolBadge rvol={sig.rvol} />
                  </div>
                  <div className="text-[9px] text-finma-text-dim mt-0.5">{sig.signal}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-bold finma-number text-finma-text">${sig.price.toFixed(2)}</div>
                  <div className={cn('text-xs font-bold finma-number', sig.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {sig.change_pct >= 0 ? '+' : ''}{sig.change_pct.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Yükselenler / Düşenler / Hacim ── */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Gainers */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
              <Flame className="w-4 h-4 text-finma-yellow" />
              <span className="text-sm font-bold text-finma-text">En Çok Yükselenler</span>
            </div>
            <div className="space-y-1.5">
              {gainers.slice(0, 10).map((m, i) => (
                <div
                  key={m.ticker}
                  className="flex items-center gap-2 hover:bg-finma-primary/5 rounded px-1 py-1 cursor-pointer transition-colors"
                  onClick={() => router.push(`/stock-analysis?ticker=${m.ticker}`)}
                >
                  <span className="text-[10px] text-finma-text-dim w-4">{i + 1}</span>
                  <span className="text-xs font-bold finma-number text-finma-primary flex-1">{m.ticker}</span>
                  <RvolBadge rvol={m.rvol} />
                  <span className="text-xs finma-number text-finma-text-dim">${m.price.toFixed(2)}</span>
                  <span className="text-xs font-bold finma-number text-finma-green w-14 text-right">
                    +{m.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Losers */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
              <TrendingDown className="w-4 h-4 text-finma-red" />
              <span className="text-sm font-bold text-finma-text">En Çok Düşenler</span>
            </div>
            <div className="space-y-1.5">
              {losers.slice(0, 10).map((m, i) => (
                <div
                  key={m.ticker}
                  className="flex items-center gap-2 hover:bg-finma-red/5 rounded px-1 py-1 cursor-pointer transition-colors"
                  onClick={() => router.push(`/stock-analysis?ticker=${m.ticker}`)}
                >
                  <span className="text-[10px] text-finma-text-dim w-4">{i + 1}</span>
                  <span className="text-xs font-bold finma-number text-finma-primary flex-1">{m.ticker}</span>
                  <RvolBadge rvol={m.rvol} />
                  <span className="text-xs finma-number text-finma-text-dim">${m.price.toFixed(2)}</span>
                  <span className="text-xs font-bold finma-number text-finma-red w-14 text-right">
                    {m.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* High Volume */}
          <Card padding="sm">
            <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
              <BarChart2 className="w-4 h-4 text-finma-primary" />
              <span className="text-sm font-bold text-finma-text">Yüksek Hacimler</span>
              <span className="text-[10px] text-finma-text-dim/60 ml-1">RVOL ≥ 1.8×</span>
            </div>
            <div className="space-y-1.5">
              {high_volume.slice(0, 10).map((m, i) => (
                <div
                  key={m.ticker}
                  className="flex items-center gap-2 hover:bg-finma-primary/5 rounded px-1 py-1 cursor-pointer transition-colors"
                  onClick={() => router.push(`/stock-analysis?ticker=${m.ticker}`)}
                >
                  <span className="text-[10px] text-finma-text-dim w-4">{i + 1}</span>
                  <span className="text-xs font-bold finma-number text-finma-primary flex-1">{m.ticker}</span>
                  <RvolBadge rvol={m.rvol} />
                  <span className="text-xs finma-number text-finma-text-dim">${m.price.toFixed(2)}</span>
                  <span className={cn('text-xs font-bold finma-number w-14 text-right', m.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {m.change_pct >= 0 ? '+' : ''}{m.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Insider İşlemleri ── */}
      {hasData && (
        <Card padding="sm">
          <div
            className="flex items-center justify-between pb-2 mb-3 border-b border-finma-border cursor-pointer"
            onClick={() => setExpandInsiders(v => !v)}
          >
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-finma-primary" />
              <span className="text-sm font-bold text-finma-text">Insider İşlemleri</span>
              <span className="text-[10px] text-finma-text-dim bg-finma-border/30 px-2 py-0.5 rounded">yfinance</span>
            </div>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="text-finma-green font-bold">{summary.insider_buys} Alış</span>
              <span className="text-finma-red font-bold">{summary.insider_sells} Satış</span>
              {expandInsiders
                ? <ChevronUp className="w-3.5 h-3.5 text-finma-text-dim" />
                : <ChevronDown className="w-3.5 h-3.5 text-finma-text-dim" />}
            </div>
          </div>

          {insiders.length === 0 ? (
            <div className="text-center py-6 text-finma-text-dim text-xs">
              <AlertCircle className="w-5 h-5 mx-auto mb-2 opacity-30" />
              <p>Insider verisi henüz yok.</p>
              <p className="text-[10px] mt-1 text-finma-text-dim/60">Flow Bot bir sonraki çalışmada toplayacak.</p>
            </div>
          ) : (
            <>
              {/* Compact preview — always visible */}
              <div className="grid grid-cols-2 gap-1.5 mb-2">
                {insiders.slice(0, expandInsiders ? insiders.length : 6).map((ins, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer hover:brightness-110 transition-all',
                      ins.is_buy ? 'bg-finma-green/5 border-finma-green/20' : 'bg-finma-red/5 border-finma-red/20'
                    )}
                    onClick={() => router.push(`/stock-analysis?ticker=${ins.ticker}`)}
                  >
                    <span className="text-xs font-bold finma-number text-finma-primary w-12 shrink-0">{ins.ticker}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-finma-text-dim truncate">{ins.insider_name || '—'}</div>
                      <div className="text-[9px] text-finma-text-dim/60 truncate">{ins.title || '—'}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded',
                        ins.is_buy ? 'bg-finma-green/10 text-finma-green' : 'bg-finma-red/10 text-finma-red'
                      )}>
                        {ins.is_buy ? '▲ Alış' : '▼ Satış'}
                      </span>
                      {ins.value > 0 && (
                        <div className="text-[9px] text-finma-text-dim mt-0.5 finma-number">
                          ${(ins.value / 1e6).toFixed(2)}M
                        </div>
                      )}
                    </div>
                    <div className="text-[9px] text-finma-text-dim/50 shrink-0">{ins.date?.slice(0, 10) || '—'}</div>
                  </div>
                ))}
              </div>

              {insiders.length > 6 && (
                <button
                  onClick={() => setExpandInsiders(v => !v)}
                  className="w-full text-[10px] text-finma-text-dim hover:text-finma-primary py-1 transition-colors"
                >
                  {expandInsiders ? `▲ Daha az göster` : `▼ Tüm ${insiders.length} işlemi göster`}
                </button>
              )}
            </>
          )}
        </Card>
      )}

      {/* Güncelleme zamanı bilgisi */}
      {hasData && flowData.updated_at && (
        <div className="text-[10px] text-finma-text-dim/50 text-center pb-2">
          Flow verisi: {flowData.updated_at} · Her 4 saatte otomatik güncellenir
        </div>
      )}
    </div>
  )
}
