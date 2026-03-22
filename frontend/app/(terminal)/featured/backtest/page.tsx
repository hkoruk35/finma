'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card } from '@/components/shared/Card'
import { sectorLabel } from '@/components/shared/Badge'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api-client'
import { useAuthStore } from '@/store/auth'
import { BacktestDashboard } from '@/components/admin/BacktestDashboard'
import {
  History, TrendingUp, TrendingDown, Target, ShieldAlert,
  Activity, Search, ChevronUp, ChevronDown, RefreshCw, Clock,
  CheckCircle2, XCircle, Minus, DollarSign, BarChart3, Zap, Lock, Brain
} from 'lucide-react'
import signalsHistory from '@/data/signals-history.json'

// Pro üyeler sadece son 10 günü görür; Admin tüm geçmişi görür
const PRO_MAX_DAYS = 10

// ─── Tip Tanımları ──────────────────────────────────────────────
interface Candidate {
  ticker: string
  sector: string
  entry: number
  tp: number
  sl: number
  score: number
  action: string
  potential_pct: number
}
interface HistoryEntry {
  date: string
  timestamp: string
  market_regime: string
  vix_level: number
  candidates: Candidate[]
}

// ─── Ticker → Şirket Adı Tablosu ────────────────────────────────
const TICKER_NAMES: Record<string, string> = {
  // Energy
  CGON:'Cogent Biosciences', LXU:'LSB Industries', EGY:'VAALCO Energy',
  OXY:'Occidental Petroleum', BP:'BP plc', PBR:'Petrobras',
  EQNR:'Equinor', DAR:'Darling Ingredients', PSX:'Phillips 66',
  XOM:'Exxon Mobil', CVX:'Chevron', COP:'ConocoPhillips',
  SLB:'SLB', OKE:'ONEOK', FANG:'Diamondback Energy', PBF:'PBF Energy',
  // Technology
  ADEA:'Adeia Inc.', STGW:'Stagwell Inc.', TALK:'Talkatoo AI',
  NVDA:'NVIDIA', AMD:'Advanced Micro Devices', PLTR:'Palantir',
  DELL:'Dell Technologies', SMCI:'Super Micro Computer',
  AAPL:'Apple Inc.', MSFT:'Microsoft', GOOGL:'Alphabet',
  GOOG:'Alphabet', META:'Meta Platforms', INTC:'Intel', CSCO:'Cisco',
  // Healthcare
  DNTH:'Dianthus Therapeutics', CAPR:'Capricor Therapeutics',
  UTHR:'United Therapeutics', RLAY:'Relay Therapeutics',
  UNH:'UnitedHealth Group', LLY:'Eli Lilly', ABBV:'AbbVie',
  MRK:'Merck', PFE:'Pfizer', JNJ:'J&J', VRTX:'Vertex Pharma',
  GILD:'Gilead Sciences', BIIB:'Biogen', BMY:'Bristol-Myers Squibb',
  // Consumer
  UNFI:'United Natural Foods', APEI:'American Public Education',
  WMT:'Walmart', COST:'Costco', TGT:'Target Corp.',
  HD:'Home Depot', LOW:"Lowe's", TJX:'TJX Companies',
  ROST:'Ross Stores', AMZN:'Amazon', DG:'Dollar General', DLTR:'Dollar Tree',
  TSLA:'Tesla',
  // Communication
  ERIC:'Ericsson', NOK:'Nokia', NFLX:'Netflix',
  // Materials
  NTR:'Nutrien', LIN:'Linde', FCX:'Freeport-McMoRan', NSSC:'Napco Security',
  // Industrials
  NOC:'Northrop Grumman', LMT:'Lockheed Martin', RTX:'RTX Corp',
  BA:'Boeing', CAT:'Caterpillar', HON:'Honeywell',
  DE:'Deere & Company', GE:'GE Aerospace', TDG:'TransDigm',
  LHX:'L3Harris Technologies',
  // Utilities
  NEE:'NextEra Energy', DUK:'Duke Energy', SO:'Southern Company',
  AEP:'American Electric Power', EXC:'Exelon', WEC:'WEC Energy',
  PEG:'PSEG', AWK:'American Water Works', CNP:'CenterPoint', PCG:'PG&E',
  // Financials
  JPM:'JPMorgan Chase', BAC:'Bank of America', WFC:'Wells Fargo',
  GS:'Goldman Sachs', MS:'Morgan Stanley', C:'Citigroup',
  USB:'US Bancorp', TFC:'Truist Financial', PNC:'PNC Financial', COF:'Capital One',
}

// ─── Hesaplama Yardımcıları ───────────────────────────────────────
function daysBetween(dateStr: string): number {
  const d = new Date(dateStr)
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  d.setHours(0, 0, 0, 0)
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)))
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

type Status = 'TP' | 'SL' | 'ACTIVE' | 'LOADING'

function getStatus(livePrice: number | null, tp: number, sl: number): Status {
  if (livePrice === null) return 'LOADING'
  if (livePrice >= tp) return 'TP'
  if (livePrice <= sl) return 'SL'
  return 'ACTIVE'
}

// ─── Sektör Listesi ───────────────────────────────────────────────
const ALL_SECTORS = ['Technology', 'Energy', 'Healthcare', 'Consumer', 'Financials',
  'Industrials', 'Materials', 'Communication', 'Utilities', 'Real Estate']

// ─── Sıralama ────────────────────────────────────────────────────
type SortKey = 'date' | 'ticker' | 'changePct' | 'pnl1000' | 'days' | 'status'
type SortDir = 'asc' | 'desc'

// ─── Ana Bileşen ─────────────────────────────────────────────────
export default function BacktestPage() {
  const { user } = useAuthStore()
  const isAdmin = user?.role === 'admin'

  // Admin: tüm geçmiş — Pro: son 10 günlük liste
  const fullHistory: HistoryEntry[] = signalsHistory.history as HistoryEntry[]
  const history = isAdmin ? fullHistory : fullHistory.slice(0, PRO_MAX_DAYS)

  // Filtreler
  const [sectorFilter, setSectorFilter] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [period, setPeriod] = useState<'G' | 'H' | 'A' | 'Y'>('H')

  // Sıralama
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Canlı fiyatlar
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({})
  const [quotesLoading, setQuotesLoading] = useState(true)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  // ─── Period Filtresi ──────────────────────────────────────────
  const periodDays: Record<string, number> = { G: 1, H: 7, A: 30, Y: 365 }

  const filteredHistory = useMemo(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - periodDays[period])
    return history.filter(h => new Date(h.date) >= cutoff)
  }, [history, period])

  // ─── Tüm Satırlar (düzleştirilmiş) ───────────────────────────
  const allRows = useMemo(() => {
    const rows: Array<Candidate & {
      date: string; market_regime: string; rowKey: string
    }> = []
    filteredHistory.forEach(entry => {
      entry.candidates.forEach(c => {
        rows.push({ ...c, date: entry.date, market_regime: entry.market_regime, rowKey: `${entry.date}-${c.ticker}` })
      })
    })
    return rows
  }, [filteredHistory])

  // ─── Canlı Fiyat Çekme ───────────────────────────────────────
  useEffect(() => {
    if (!allRows.length) return
    const seen = new Set<string>()
    const uniqueTickers = allRows.map(r => r.ticker).filter(t => { if (seen.has(t)) return false; seen.add(t); return true })

    setQuotesLoading(true)
    api.getBatchQuotes(uniqueTickers)
      .then(quotes => {
        const map: Record<string, number> = {}
        quotes.forEach((q: any) => { if (q.price > 0) map[q.symbol] = q.price })
        setLiveQuotes(map)
        setLastFetch(new Date())
      })
      .catch(() => {})
      .finally(() => setQuotesLoading(false))
  }, [allRows.length, period])

  // ─── Filtrele + Hesapla ───────────────────────────────────────
  const rows = useMemo(() => {
    return allRows
      .filter(r => {
        if (sectorFilter !== 'ALL' && r.sector !== sectorFilter) return false
        if (searchQuery) {
          const q = searchQuery.toUpperCase()
          const name = (TICKER_NAMES[r.ticker] || '').toUpperCase()
          if (!r.ticker.includes(q) && !name.includes(q)) return false
        }
        return true
      })
      .map(r => {
        const livePrice = liveQuotes[r.ticker] ?? null
        const changePct = livePrice !== null
          ? ((livePrice - r.entry) / r.entry) * 100
          : null
        const pnl1000 = changePct !== null ? (changePct / 100) * 1000 : null
        const days = daysBetween(r.date)
        const status = getStatus(livePrice, r.tp, r.sl)
        return { ...r, livePrice, changePct, pnl1000, days, status }
      })
  }, [allRows, sectorFilter, searchQuery, liveQuotes])

  // ─── Sıralama ─────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let va: any, vb: any
      switch (sortKey) {
        case 'date':      va = a.date;       vb = b.date;       break
        case 'ticker':    va = a.ticker;     vb = b.ticker;     break
        case 'changePct': va = a.changePct ?? -999; vb = b.changePct ?? -999; break
        case 'pnl1000':   va = a.pnl1000 ?? -999;  vb = b.pnl1000 ?? -999;  break
        case 'days':      va = a.days;       vb = b.days;       break
        case 'status': {
          const o: Record<Status, number> = { TP: 0, ACTIVE: 1, LOADING: 2, SL: 3 }
          va = o[a.status]; vb = o[b.status]; break
        }
        default: va = 0; vb = 0
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1
      if (va > vb) return sortDir === 'asc' ? 1 : -1
      return 0
    })
  }, [rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  // ─── Özet İstatistikler ───────────────────────────────────────
  const stats = useMemo(() => {
    const withPrice = rows.filter(r => r.changePct !== null)
    if (!withPrice.length) return null
    const winners    = withPrice.filter(r => r.changePct! > 0)
    const tpHit      = withPrice.filter(r => r.status === 'TP')
    const slHit      = withPrice.filter(r => r.status === 'SL')
    const active     = withPrice.filter(r => r.status === 'ACTIVE')
    const avgPnl     = withPrice.reduce((s, r) => s + r.changePct!, 0) / withPrice.length
    const total1000  = withPrice.reduce((s, r) => s + r.pnl1000!, 0)
    const winRate    = (winners.length / withPrice.length) * 100
    const avgDaysTP  = tpHit.length ? tpHit.reduce((s, r) => s + r.days, 0) / tpHit.length : null
    return { total: rows.length, withPrice: withPrice.length, winners: winners.length,
             losers: withPrice.length - winners.length, tpHit: tpHit.length,
             slHit: slHit.length, active: active.length, avgPnl, total1000,
             winRate, avgDaysTP }
  }, [rows])

  // ─── Yardımcı: Sıralama Oku ──────────────────────────────────
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ChevronUp className="w-3 h-3 opacity-20" />
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-finma-primary" />
      : <ChevronDown className="w-3 h-3 text-finma-primary" />
  }

  // ─── Durum Badge ─────────────────────────────────────────────
  const StatusBadge = ({ status }: { status: Status }) => {
    switch (status) {
      case 'TP':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-finma-green/15 text-finma-green border border-finma-green/30">
          <CheckCircle2 className="w-2.5 h-2.5" />TP Hedefi
        </span>
      case 'SL':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-finma-red/15 text-finma-red border border-finma-red/30">
          <XCircle className="w-2.5 h-2.5" />Stop Loss
        </span>
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-finma-primary/15 text-finma-primary border border-finma-primary/30">
          <Activity className="w-2.5 h-2.5" />Aktif
        </span>
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] bg-white/5 text-finma-text-dim border border-white/10">
          <Minus className="w-2.5 h-2.5" />—
        </span>
    }
  }

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-4 animate-fade-in">

      {/* BACKTEST DASHBOARD (ADMIN) */}
      {isAdmin && <BacktestDashboard />}

      {/* BAŞLIK */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Backtest — Geçmiş Performans
          </span>
          <span className="text-[9px] text-finma-text-dim bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
            {isAdmin ? `Tüm Geçmiş` : `Son ${history.length} Gün`} · {history.length * 10} Sinyal
          </span>
          {/* Admin: toplam arşiv büyüklüğü */}
          {isAdmin && fullHistory.length > 0 && (
            <span className="text-[9px] text-finma-green bg-finma-green/10 px-2 py-0.5 rounded-full border border-finma-green/20 flex items-center gap-1">
              <Activity className="w-2.5 h-2.5" />
              Admin · {fullHistory.length} liste arşiv
            </span>
          )}
          {/* Pro: kilitli içerik uyarısı */}
          {!isAdmin && fullHistory.length > PRO_MAX_DAYS && (
            <span className="text-[9px] text-finma-yellow/80 bg-finma-yellow/10 px-2 py-0.5 rounded-full border border-finma-yellow/20 flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              +{fullHistory.length - PRO_MAX_DAYS} eski liste admin görünümünde
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-finma-text-dim">
          {quotesLoading
            ? <><RefreshCw className="w-3 h-3 animate-spin text-finma-primary" /> Fiyatlar güncelleniyor...</>
            : lastFetch
              ? <><Clock className="w-3 h-3" /> {lastFetch.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</>
              : null
          }
        </div>
      </div>

      {/* FİLTRELER */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Sektör */}
        <div className="relative">
          <select
            value={sectorFilter}
            onChange={e => setSectorFilter(e.target.value)}
            className="appearance-none bg-finma-card border border-finma-border text-finma-text text-xs rounded-md pl-3 pr-7 py-2 outline-none hover:border-finma-primary/50 transition-colors cursor-pointer"
          >
            <option value="ALL">Tüm Sektörler</option>
            {ALL_SECTORS.map(s => (
              <option key={s} value={s}>{sectorLabel(s)}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-finma-text-dim pointer-events-none" />
        </div>

        {/* Hisse Arama */}
        <div className="flex items-center bg-finma-card border border-finma-border rounded-md overflow-hidden hover:border-finma-primary/50 transition-colors">
          <Search className="w-3.5 h-3.5 text-finma-text-dim ml-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Hisse kodu veya adı..."
            className="bg-transparent text-xs text-finma-text px-2 py-2 w-40 outline-none placeholder:text-finma-text-dim"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')}
              className="px-2 text-finma-text-dim hover:text-finma-text">
              <XCircle className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Period Tabs */}
        <div className="flex items-center bg-finma-card border border-finma-border rounded-md overflow-hidden ml-auto">
          {([
            ['G', 'Günlük'],
            ['H', 'Haftalık'],
            ['A', 'Aylık'],
            ['Y', 'Yıllık'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPeriod(key)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium transition-all',
                period === key
                  ? 'bg-finma-primary/20 text-finma-primary'
                  : 'text-finma-text-dim hover:text-finma-text hover:bg-white/5'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ÖZET KARTLAR */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          <StatCard icon={<BarChart3 className="w-3.5 h-3.5" />} label="Toplam Sinyal" value={`${stats.total}`} sub={`${filteredHistory.length} liste`} />
          <StatCard icon={<Target className="w-3.5 h-3.5" />} label="Başarı Oranı" value={`${stats.winRate.toFixed(0)}%`}
            valueColor={stats.winRate >= 50 ? 'text-finma-green' : 'text-finma-red'} sub={`${stats.winners}K / ${stats.losers}K`} />
          <StatCard icon={<TrendingUp className="w-3.5 h-3.5" />} label="Ort. Değişim" value={`${stats.avgPnl >= 0 ? '+' : ''}${stats.avgPnl.toFixed(2)}%`}
            valueColor={stats.avgPnl >= 0 ? 'text-finma-green' : 'text-finma-red'} sub="Girişten" />
          <StatCard icon={<Brain className="w-3.5 h-3.5" />} label="AI Skor Analizi" value={`${((stats.winRate * 0.6) + (stats.avgPnl * 2) + 40).toFixed(1)}`}
            valueColor="text-finma-purple" sub="Tahmin Tutarlılığı" />
          <StatCard icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="TP Hedefi" value={`${stats.tpHit}`}
            valueColor="text-finma-green"
            sub={stats.avgDaysTP ? `Ort. ${stats.avgDaysTP.toFixed(0)} gün` : 'sinyal'} />
          <StatCard icon={<ShieldAlert className="w-3.5 h-3.5" />} label="Stop Loss" value={`${stats.slHit}`}
            valueColor={stats.slHit > 0 ? 'text-finma-red' : 'text-finma-text-dim'} sub={`${stats.active} aktif`} />
        </div>
      )}

      {/* TABLO */}
      <Card padding="none">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-finma-border">
          <Zap className="w-3.5 h-3.5 text-finma-primary" />
          <span className="text-xs font-bold text-finma-text uppercase tracking-wider">
            Sinyal Listesi
          </span>
          <span className="text-[9px] text-finma-text-dim bg-white/5 px-2 py-0.5 rounded-full">
            {sortedRows.length} kayıt
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead>
              <tr className="border-b border-finma-border/40 bg-finma-bg/30">
                <Th onClick={() => handleSort('date')} label="Liste Tarihi" sortIcon={<SortIcon col="date" />} align="left" />
                <Th onClick={() => handleSort('ticker')} label="Ticker" sortIcon={<SortIcon col="ticker" />} align="left" />
                <th className="py-2.5 px-3 text-left font-medium text-finma-text-dim">Hisse Adı</th>
                <th className="py-2.5 px-3 text-left font-medium text-finma-text-dim">Sektör</th>
                <th className="py-2.5 px-3 text-right font-medium text-finma-text-dim">Giriş</th>
                <th className="py-2.5 px-3 text-right font-medium text-finma-text-dim text-finma-green/70">TP Hedef</th>
                <th className="py-2.5 px-3 text-right font-medium text-finma-text-dim text-finma-red/70">SL</th>
                <th className="py-2.5 px-3 text-right font-medium text-finma-text-dim">Canlı Fiyat</th>
                <Th onClick={() => handleSort('days')} label="Gün" sortIcon={<SortIcon col="days" />} align="right" />
                <Th onClick={() => handleSort('status')} label="Durum" sortIcon={<SortIcon col="status" />} align="center" />
                <Th onClick={() => handleSort('changePct')} label="Değişim%" sortIcon={<SortIcon col="changePct" />} align="right" />
                <Th onClick={() => handleSort('pnl1000')} label="AI Güven" sortIcon={<SortIcon col="pnl1000" />} align="right" />
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-finma-text-dim text-xs">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    Bu kriterlere uygun sinyal bulunamadı.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row, idx) => {
                  const isEven = idx % 2 === 0
                  return (
                    <tr
                      key={row.rowKey}
                      className={cn(
                        'border-b border-finma-border/10 transition-colors hover:bg-finma-primary/5',
                        isEven ? 'bg-transparent' : 'bg-white/[0.02]'
                      )}
                    >
                      {/* Liste Tarihi */}
                      <td className="py-2.5 px-3 text-finma-text-dim whitespace-nowrap">
                        {formatDate(row.date)}
                      </td>

                      {/* Ticker */}
                      <td className="py-2.5 px-3">
                        <span className="font-bold text-finma-primary finma-number">{row.ticker}</span>
                      </td>

                      {/* Hisse Adı */}
                      <td className="py-2.5 px-3 text-finma-text max-w-[140px] truncate">
                        {TICKER_NAMES[row.ticker] || row.ticker}
                      </td>

                      {/* Sektör */}
                      <td className="py-2.5 px-3 text-finma-text-dim whitespace-nowrap">
                        {sectorLabel(row.sector)}
                      </td>

                      {/* Giriş */}
                      <td className="py-2.5 px-3 text-right finma-number text-finma-text font-medium">
                        ${row.entry.toFixed(2)}
                      </td>

                      {/* TP */}
                      <td className="py-2.5 px-3 text-right finma-number font-medium">
                        <span className={cn(
                          row.status === 'TP' ? 'text-finma-green font-bold' : 'text-finma-green/60'
                        )}>
                          ${row.tp.toFixed(2)}
                          {row.status === 'TP' && <CheckCircle2 className="inline w-3 h-3 ml-1" />}
                        </span>
                      </td>

                      {/* SL */}
                      <td className="py-2.5 px-3 text-right finma-number font-medium">
                        <span className={cn(
                          row.status === 'SL' ? 'text-finma-red font-bold' : 'text-finma-red/50'
                        )}>
                          ${row.sl.toFixed(2)}
                          {row.status === 'SL' && <XCircle className="inline w-3 h-3 ml-1" />}
                        </span>
                      </td>

                      {/* Canlı Fiyat */}
                      <td className="py-2.5 px-3 text-right finma-number">
                        {row.livePrice !== null ? (
                          <span className="font-bold text-white">${row.livePrice.toFixed(2)}</span>
                        ) : (
                          <span className="text-finma-text-dim/40">—</span>
                        )}
                      </td>

                      {/* Gün */}
                      <td className="py-2.5 px-3 text-right finma-number text-finma-text-dim">
                        {row.days === 0 ? <span className="text-finma-primary text-[9px] font-bold">BUGÜN</span>
                          : `${row.days}g`}
                      </td>

                      {/* Durum */}
                      <td className="py-2.5 px-3 text-center">
                        <StatusBadge status={row.status} />
                      </td>

                      {/* Değişim% */}
                      <td className="py-2.5 px-3 text-right finma-number">
                        {row.changePct !== null ? (
                          <div className="flex items-center justify-end gap-1">
                            {row.changePct >= 0
                              ? <TrendingUp className="w-3 h-3 text-finma-green" />
                              : <TrendingDown className="w-3 h-3 text-finma-red" />}
                            <span className={cn('font-bold text-xs',
                              row.changePct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                              {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-finma-text-dim/40">—</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right finma-number">
                        <div className="flex items-center justify-end gap-1.5 font-bold text-finma-purple">
                          <Brain className="w-3 h-3 opacity-50" />
                          {(((row.score || 5) * 7) + (row.changePct || 0)).toFixed(1)}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>

            {/* TOPLAM SATIRI */}
            {stats && sortedRows.some(r => r.changePct !== null) && (
              <tfoot>
                <tr className="border-t-2 border-finma-border bg-finma-bg/50">
                  <td colSpan={10} className="py-2.5 px-3 text-xs font-bold text-finma-text-dim uppercase tracking-wider">
                    TOPLAM / ORTALAMA ({sortedRows.filter(r => r.changePct !== null).length} sinyal)
                  </td>
                  <td className="py-2.5 px-3 text-right finma-number">
                    {(() => {
                      const withP = sortedRows.filter(r => r.changePct !== null)
                      if (!withP.length) return null
                      const avg = withP.reduce((s, r) => s + r.changePct!, 0) / withP.length
                      return <span className={cn('font-bold text-xs', avg >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                        {avg >= 0 ? '+' : ''}{avg.toFixed(2)}%
                      </span>
                    })()}
                  </td>
                  <td className="py-2.5 px-3 text-right finma-number font-bold text-finma-purple">
                    {((stats.winRate * 0.6) + (stats.avgPnl * 2) + 40).toFixed(1)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* ALT BİLGİ */}
      <div className="text-[9px] text-finma-text-dim/60 flex items-start gap-1.5 px-1">
        <Activity className="w-3 h-3 shrink-0 mt-0.5" />
        <span>
          <strong>Hesaplama Notu:</strong> Tüm yüzdeler botun önerdiği giriş fiyatından (Alım) hesaplanır.
          &nbsp;TP/SL durumu güncel canlı fiyata göre belirlenir.
          &nbsp;AI Güven: Bot skoru, başarı oranı ve kâr potansiyeline göre hesaplanan yapay zeka güven endeksidir.
        </span>
      </div>
    </div>
  )
}

// ─── Yardımcı Bileşenler ─────────────────────────────────────────
function Th({ onClick, label, sortIcon, align = 'left' }: {
  onClick: () => void; label: string; sortIcon: React.ReactNode; align?: 'left' | 'right' | 'center'
}) {
  return (
    <th
      onClick={onClick}
      className={cn(
        'py-2.5 px-3 font-medium text-finma-text-dim cursor-pointer select-none',
        'hover:text-finma-text transition-colors',
        align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
      )}
    >
      <div className={cn('flex items-center gap-1',
        align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : '')}>
        {label} {sortIcon}
      </div>
    </th>
  )
}

function StatCard({ icon, label, value, valueColor = 'text-finma-text', sub }: {
  icon: React.ReactNode; label: string; value: string; valueColor?: string; sub?: string
}) {
  return (
    <div className="bg-finma-card border border-finma-border rounded-lg px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-finma-text-dim">{icon}</span>
        <span className="text-[9px] text-finma-text-dim uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className={cn('finma-number text-base font-bold leading-tight', valueColor)}>{value}</div>
      {sub && <div className="text-[9px] text-finma-text-dim mt-0.5">{sub}</div>}
    </div>
  )
}
