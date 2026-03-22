'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'
import {
  Search, Filter, RefreshCw, TrendingUp, TrendingDown, BarChart3,
  Lock, ChevronDown, AlertCircle, Star, Zap, Eye, X, Grid3x3, List, Table2,
  DollarSign, TrendIcon, Gauge, Flame, Lightning,
  LayoutGrid, Plus, Settings2, Check, CheckSquare, Square, Download,
  BookmarkPlus, Maximize2, ArrowRight
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface ScreenerResult {
  ticker: string
  company_name: string
  sector: string
  price: number
  score: number
  change_pct: number
  market_cap?: number
  reason: string
  performance_7d?: number[]
}

interface ActiveFilter {
  id: string
  label: string
  value: any
}

interface ColumnDef {
  id: string
  label: string
  enabled: boolean
}

const SECTORS = ['Tümü', 'Technology', 'Energy', 'Healthcare', 'Financials', 'Consumer', 'Industrials', 'Materials', 'Utilities']

// Candlestick patterns
const CANDLESTICK_PATTERNS = [
  { id: 'doji', label: 'Doji', icon: '◆' },
  { id: 'hammer', label: 'Çekiç', icon: '⌒' },
  { id: 'bullish_engulfing', label: 'Boğa Sarmalama', icon: '∩' },
  { id: 'bearish_engulfing', label: 'Ayı Sarmalama', icon: '∪' },
  { id: 'morning_star', label: 'Sabah Yıldızı', icon: '✦' },
  { id: 'evening_star', label: 'Akşam Yıldızı', icon: '★' },
  { id: 'shooting_star', label: 'Yıldız İzi', icon: '✻' },
]

// Chart patterns
const CHART_PATTERNS = [
  { id: 'cup_handle', label: 'Çanak ve Kulp', icon: '∪' },
  { id: 'double_bottom', label: 'İkili Dip', icon: '∩∩' },
  { id: 'double_top', label: 'İkili Tepe', icon: '⌢⌢' },
  { id: 'flag', label: 'Bayrak', icon: '▬' },
  { id: 'pennant', label: 'Flama', icon: '◁' },
  { id: 'triangle', label: 'Üçgen', icon: '△' },
]

// Presets
const PRESETS = [
  {
    id: 'dividend_hunters',
    name: 'Temettü Canavarları',
    description: 'Yüksek temettü verimli',
    emoji: '💰',
    filters: { minDividend: 3, maxDebtEquity: 1.5, minMarketCap: 1000 }
  },
  {
    id: 'momentum_breakout',
    name: 'Momentum Breakout',
    description: 'Güçlü trend ve hacim',
    emoji: '🚀',
    filters: { minRSI: 70, minFiftyTwoWeekChange: 50, minVolumeSpike: 1.5 }
  },
  {
    id: 'value_hunting',
    name: 'Değer Avcılığı',
    description: 'Düşük F/K, yüksek potansiyel',
    emoji: '💎',
    filters: { maxPE: null, minEPSGrowth: 10, maxPB: 1.5 }
  },
  {
    id: 'sustainable_growth',
    name: 'Sürdürülebilir Büyüme',
    description: 'Dengeli büyüme ve sağlık',
    emoji: '📈',
    filters: { minEPSGrowth: 15, maxDebtEquity: 1, minROE: 15 }
  },
]

// Available columns for customization
const AVAILABLE_COLUMNS: ColumnDef[] = [
  { id: 'ticker', label: 'Hisse', enabled: true },
  { id: 'company_name', label: 'Şirket Adı', enabled: true },
  { id: 'sector', label: 'Sektör', enabled: true },
  { id: 'price', label: 'Fiyat', enabled: true },
  { id: 'change', label: 'Değişim %', enabled: true },
  { id: 'sparkline', label: 'Performans', enabled: true },
  { id: 'score', label: 'Skor', enabled: true },
  { id: 'gauge', label: 'Signal Gauge', enabled: true },
]

// Scan limits by tier
const SCAN_LIMITS = {
  free: { scans_per_week: 2, scans_per_day: 1 },
  pro: { scans_per_week: 10, scans_per_day: 5 },
  admin: { scans_per_week: 999, scans_per_day: 999 }
}

export default function ScreenerPage() {
  const router = useRouter()
  const { canAccess, user } = useAuthStore()
  const isPro = canAccess('pro')
  const isAdmin = canAccess('admin')

  // State
  const [results, setResults] = useState<ScreenerResult[]>([])
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<'list' | 'heatmap' | 'table'>('list')
  const [activeTab, setActiveTab] = useState<'basics' | 'value' | 'trend'>('basics')
  const [credits, setCredits] = useState<{ remaining: number; limit: number } | null>(null)
  const [columns, setColumns] = useState<ColumnDef[]>(AVAILABLE_COLUMNS)
  const [selectedTickers, setSelectedTickers] = useState<string[]>([])
  const [showColumnSettings, setShowColumnSettings] = useState(false)

  // Filters state
  const [activeFilters, setActiveFilters] = useState<ActiveFilter[]>([])

  // Tab 1: Basics
  const [marketCapMin, setMarketCapMin] = useState(0)
  const [marketCapMax, setMarketCapMax] = useState(100)
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(['NYSE', 'NASDAQ'])
  const [selectedSector, setSelectedSector] = useState('Tümü')

  // Tab 2: Value
  const [peMin, setPEMin] = useState(0)
  const [peMax, setPEMax] = useState(50)
  const [pegMin, setPEGMin] = useState(0)
  const [pegMax, setPEGMax] = useState(5)
  const [debtEquityMax, setDebtEquityMax] = useState(2)
  const [roeMin, setROEMin] = useState(0)
  const [epsGrowthMin, setEPSGrowthMin] = useState(0)

  // Tab 3: Trend
  const [rsiBulls, setRSIBulls] = useState(false)
  const [rsiValue, setRSIValue] = useState(50)
  const [fiftyTwoWWeekMin, setFiftyTwoWWeekMin] = useState(-50)
  const [fiftyTwoWWeekMax, setFiftyTwoWWeekMax] = useState(100)
  const [volumeMin, setVolumeMin] = useState(1)
  const [selectedCandlesticks, setSelectedCandlesticks] = useState<string[]>([])
  const [selectedChartPatterns, setSelectedChartPatterns] = useState<string[]>([])

  // Fetch credits
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const token = localStorage.getItem('finma_token')
        const res = await fetch(`${API_URL}/api/screener/credits`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (res.ok) setCredits(await res.json())
      } catch {}
    }
    fetchCredits()
  }, [])

  const runScan = async () => {
    if (credits && credits.remaining <= 0 && !isAdmin) return
    setLoading(true)
    try {
      const filters: any = {
        market_cap_min: marketCapMin,
        market_cap_max: marketCapMax,
        sector: selectedSector !== 'Tümü' ? selectedSector : undefined,
        pe_min: peMin,
        pe_max: peMax,
        rsi_value: rsiValue,
        volume_multiplier_min: volumeMin,
      }

      const token = localStorage.getItem('finma_token')
      const res = await fetch(`${API_URL}/api/screener/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(filters),
      })

      if (res.ok) {
        const data = await res.json()
        setResults(data.results || [])
      }
    } catch (err) {
      console.error('Tarama hatası:', err)
    }
    setLoading(false)
  }

  const addFilter = (label: string, value: any) => {
    const newFilter: ActiveFilter = {
      id: Math.random().toString(36).substr(2, 9),
      label,
      value
    }
    setActiveFilters([...activeFilters, newFilter])
  }

  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id))
  }

  const applyPreset = (preset: typeof PRESETS[0]) => {
    setActiveFilters([])
    // Apply preset logic
    setMarketCapMin(preset.filters.minMarketCap || 0)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-finma-green bg-finma-green/15'
    if (score >= 65) return 'text-finma-primary bg-finma-primary/15'
    if (score >= 50) return 'text-finma-yellow bg-finma-yellow/15'
    return 'text-finma-text-muted bg-finma-border/10'
  }

  // Mini Sparkline Component
  const MiniSparkline = ({ data }: { data?: number[] }) => {
    if (!data || data.length === 0) {
      return <span className="text-[10px] text-finma-text-dim">—</span>
    }
    const trend = data[data.length - 1] - data[0]
    return (
      <div className="flex items-center gap-1">
        {trend >= 0 ? (
          <TrendingUp className="w-3 h-3 text-finma-green" />
        ) : (
          <TrendingDown className="w-3 h-3 text-finma-red" />
        )}
        <span className={cn('text-[10px] font-medium finma-number', trend >= 0 ? 'text-finma-green' : 'text-finma-red')}>
          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
        </span>
      </div>
    )
  }

  // Signal Score Gauge Component
  const SignalGauge = ({ score }: { score: number }) => {
    const percentage = (score / 100) * 100
    const gaugeColor = score >= 80 ? 'finma-green' : score >= 65 ? 'finma-primary' : score >= 50 ? 'finma-yellow' : 'finma-red'

    return (
      <div className="flex items-center gap-2">
        <div className="w-12 h-2 bg-finma-border/20 rounded-full overflow-hidden">
          <div
            className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-300',
              score >= 80 ? 'from-finma-green to-finma-green/60' :
              score >= 65 ? 'from-finma-primary to-finma-primary/60' :
              score >= 50 ? 'from-finma-yellow to-finma-yellow/60' :
              'from-finma-red to-finma-red/60'
            )}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className={cn('text-[10px] font-bold finma-number w-8 text-right',
          score >= 80 ? 'text-finma-green' :
          score >= 65 ? 'text-finma-primary' :
          score >= 50 ? 'text-finma-yellow' :
          'text-finma-red'
        )}>
          {score.toFixed(0)}
        </span>
      </div>
    )
  }

  const toggleSelectAll = () => {
    if (selectedTickers.length === results.length) {
      setSelectedTickers([])
    } else {
      setSelectedTickers(results.map(r => r.ticker))
    }
  }

  const toggleSelect = (ticker: string) => {
    setSelectedTickers(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : [...prev, ticker]
    )
  }

  const bulkAddToWatchlist = async () => {
    for (const ticker of selectedTickers) {
      try {
        const token = localStorage.getItem('finma_token')
        await fetch(`${API_URL}/api/watchlist/add`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ ticker })
        })
      } catch (err) {
        console.error(`Failed to add ${ticker} to watchlist:`, err)
      }
    }
    setSelectedTickers([])
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Search className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-lg font-bold text-white">Hisse Tarama</h1>
            <p className="text-xs text-finma-text-dim">Gelişmiş Filtreleme Motoru</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="p-2 rounded border border-finma-border/30 hover:bg-finma-primary/10 transition-colors"
            title="Sütunları Özelleştir"
          >
            <Settings2 className="w-4 h-4 text-finma-text-muted" />
          </button>
          {credits && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs',
              credits.remaining > 0 ? 'border-finma-primary/30 bg-finma-primary/5 text-finma-primary' : 'border-finma-red/30 bg-finma-red/5 text-finma-red'
            )}>
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isAdmin ? 'Sınırsız' : `${credits.remaining}/${SCAN_LIMITS[user?.subscription_tier as keyof typeof SCAN_LIMITS]?.scans_per_week || 2}`}
                {!isAdmin && <span className="text-[10px] ml-1 text-finma-text-dim">/hafta</span>}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Column Customization Panel */}
      {showColumnSettings && (
        <Card padding="sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-finma-text">Sütun Ayarları</span>
            <button onClick={() => setShowColumnSettings(false)} className="text-finma-text-dim hover:text-finma-text">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {columns.map(col => (
              <button
                key={col.id}
                onClick={() => setColumns(columns.map(c => c.id === col.id ? { ...c, enabled: !c.enabled } : c))}
                className={cn(
                  'px-2.5 py-1.5 rounded text-xs font-medium border transition-colors',
                  col.enabled
                    ? 'bg-finma-primary/20 text-finma-primary border-finma-primary/30'
                    : 'bg-finma-border/20 text-finma-text-muted border-finma-border/30'
                )}
              >
                <div className="flex items-center gap-1.5">
                  {col.enabled ? (
                    <CheckSquare className="w-3.5 h-3.5" />
                  ) : (
                    <Square className="w-3.5 h-3.5" />
                  )}
                  {col.label}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Filters */}
        <div className="lg:col-span-1 space-y-3">
          <Card padding="sm">
            {/* Filter Tabs */}
            <div className="flex flex-col gap-2 mb-4">
              <button
                onClick={() => setActiveTab('basics')}
                className={cn(
                  'px-3 py-2 rounded text-xs font-medium transition-colors',
                  activeTab === 'basics'
                    ? 'bg-finma-primary text-white'
                    : 'bg-finma-border/20 text-finma-text-muted hover:bg-finma-border/30'
                )}
              >
                📍 Temel
              </button>
              <button
                onClick={() => setActiveTab('value')}
                className={cn(
                  'px-3 py-2 rounded text-xs font-medium transition-colors',
                  activeTab === 'value'
                    ? 'bg-finma-primary text-white'
                    : 'bg-finma-border/20 text-finma-text-muted hover:bg-finma-border/30'
                )}
              >
                💎 Değer
              </button>
              <button
                onClick={() => setActiveTab('trend')}
                className={cn(
                  'px-3 py-2 rounded text-xs font-medium transition-colors',
                  activeTab === 'trend'
                    ? 'bg-finma-primary text-white'
                    : 'bg-finma-border/20 text-finma-text-muted hover:bg-finma-border/30'
                )}
              >
                🔥 Trend
              </button>
            </div>

            {/* Tab Content */}
            <div className="space-y-4">
              {activeTab === 'basics' && (
                <div className="space-y-3">
                  {/* Market Cap */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      Piyasa Değeri: {marketCapMin}B - {marketCapMax}B
                    </label>
                    <input
                      type="range"
                      min="0" max="500" step="10"
                      value={marketCapMin}
                      onChange={e => setMarketCapMin(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded-lg appearance-none cursor-pointer accent-finma-primary"
                    />
                  </div>

                  {/* Exchanges */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">Borsa</label>
                    <div className="flex gap-2">
                      {['NYSE', 'NASDAQ', 'AMEX'].map(ex => (
                        <button
                          key={ex}
                          onClick={() => {
                            if (selectedExchanges.includes(ex)) {
                              setSelectedExchanges(selectedExchanges.filter(e => e !== ex))
                            } else {
                              setSelectedExchanges([...selectedExchanges, ex])
                            }
                          }}
                          className={cn(
                            'px-2.5 py-1 rounded text-[10px] font-bold transition-colors border',
                            selectedExchanges.includes(ex)
                              ? 'bg-finma-primary text-white border-finma-primary'
                              : 'bg-finma-border/20 text-finma-text-muted border-finma-border/30 hover:border-finma-primary/50'
                          )}
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Sector */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-1.5 block">Sektör</label>
                    <select
                      value={selectedSector}
                      onChange={e => setSelectedSector(e.target.value)}
                      className="w-full bg-finma-bg border border-finma-border rounded px-2.5 py-1.5 text-xs text-finma-text focus:outline-none focus:border-finma-primary"
                    >
                      {SECTORS.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {activeTab === 'value' && (
                <div className="space-y-3">
                  {/* P/E Ratio */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      F/K Oranı: {peMin}-{peMax}
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number" value={peMin} onChange={e => setPEMin(parseFloat(e.target.value))}
                        className="w-1/2 bg-finma-bg border border-finma-border rounded px-2 py-1 text-xs text-finma-text"
                        placeholder="Min"
                      />
                      <input
                        type="number" value={peMax} onChange={e => setPEMax(parseFloat(e.target.value))}
                        className="w-1/2 bg-finma-bg border border-finma-border rounded px-2 py-1 text-xs text-finma-text"
                        placeholder="Max"
                      />
                    </div>
                  </div>

                  {/* PEG Ratio */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      PEG: {pegMin.toFixed(1)}-{pegMax.toFixed(1)}
                    </label>
                    <input
                      type="range" min="0" max="5" step="0.5"
                      value={pegMin}
                      onChange={e => setPEGMin(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                  </div>

                  {/* Debt/Equity */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      Borç/Özkaynak: {debtEquityMax.toFixed(1)}
                    </label>
                    <input
                      type="range" min="0" max="5" step="0.5"
                      value={debtEquityMax}
                      onChange={e => setDebtEquityMax(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                  </div>

                  {/* ROE */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      ROE Min: {roeMin}%
                    </label>
                    <input
                      type="range" min="0" max="50" step="5"
                      value={roeMin}
                      onChange={e => setROEMin(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                  </div>

                  {/* EPS Growth */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      EPS Büyümesi Min: {epsGrowthMin}%
                    </label>
                    <input
                      type="range" min="0" max="100" step="10"
                      value={epsGrowthMin}
                      onChange={e => setEPSGrowthMin(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                  </div>
                </div>
              )}

              {activeTab === 'trend' && (
                <div className="space-y-3">
                  {/* RSI */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      RSI: {rsiValue}
                    </label>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={rsiValue}
                      onChange={e => setRSIValue(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                    <div className="text-[9px] text-finma-text-dim mt-1 text-center">
                      {rsiValue > 70 ? 'AŞIRI ALIM' : rsiValue < 30 ? 'AŞIRI SATUM' : 'NÖTR'}
                    </div>
                  </div>

                  {/* 52-Week */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      52H Değişim: {fiftyTwoWWeekMin}% ~ {fiftyTwoWWeekMax}%
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number" value={fiftyTwoWWeekMin} onChange={e => setFiftyTwoWWeekMin(parseFloat(e.target.value))}
                        className="w-1/2 bg-finma-bg border border-finma-border rounded px-2 py-1 text-xs"
                        placeholder="Min %"
                      />
                      <input
                        type="number" value={fiftyTwoWWeekMax} onChange={e => setFiftyTwoWWeekMax(parseFloat(e.target.value))}
                        className="w-1/2 bg-finma-bg border border-finma-border rounded px-2 py-1 text-xs"
                        placeholder="Max %"
                      />
                    </div>
                  </div>

                  {/* Volume Multiplier */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">
                      Hacim Çarpanı Min: {volumeMin.toFixed(1)}x
                    </label>
                    <input
                      type="range" min="0.5" max="5" step="0.5"
                      value={volumeMin}
                      onChange={e => setVolumeMin(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-finma-border rounded accent-finma-primary"
                    />
                  </div>

                  {/* Candlestick Patterns */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">Mum Formasyonları</label>
                    <div className="grid grid-cols-4 gap-1">
                      {CANDLESTICK_PATTERNS.map(pattern => (
                        <button
                          key={pattern.id}
                          onClick={() => {
                            setSelectedCandlesticks(
                              selectedCandlesticks.includes(pattern.id)
                                ? selectedCandlesticks.filter(p => p !== pattern.id)
                                : [...selectedCandlesticks, pattern.id]
                            )
                          }}
                          title={pattern.label}
                          className={cn(
                            'w-full aspect-square rounded border flex items-center justify-center text-lg transition-colors',
                            selectedCandlesticks.includes(pattern.id)
                              ? 'bg-finma-primary text-white border-finma-primary'
                              : 'bg-finma-border/20 text-finma-text-dim border-finma-border/30 hover:border-finma-primary/50'
                          )}
                        >
                          {pattern.icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart Patterns */}
                  <div>
                    <label className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2 block">Grafik Desenleri</label>
                    <div className="grid grid-cols-3 gap-1">
                      {CHART_PATTERNS.map(pattern => (
                        <button
                          key={pattern.id}
                          onClick={() => {
                            setSelectedChartPatterns(
                              selectedChartPatterns.includes(pattern.id)
                                ? selectedChartPatterns.filter(p => p !== pattern.id)
                                : [...selectedChartPatterns, pattern.id]
                            )
                          }}
                          title={pattern.label}
                          className={cn(
                            'w-full px-2 py-1.5 rounded border text-[9px] font-medium transition-colors text-center',
                            selectedChartPatterns.includes(pattern.id)
                              ? 'bg-finma-primary text-white border-finma-primary'
                              : 'bg-finma-border/20 text-finma-text-dim border-finma-border/30 hover:border-finma-primary/50'
                          )}
                        >
                          {pattern.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Scan Button */}
            <button
              onClick={runScan}
              disabled={loading || (!isAdmin && credits?.remaining === 0)}
              className={cn(
                'w-full mt-4 py-2.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2',
                (!isAdmin && credits?.remaining === 0)
                  ? 'bg-finma-border/30 text-finma-text-dim cursor-not-allowed'
                  : 'bg-finma-primary text-white hover:bg-finma-primary/90'
              )}
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              {loading ? 'Taranıyor...' : 'Tara'}
            </button>
          </Card>

          {/* Presets */}
          <Card padding="sm">
            <div className="text-[10px] text-finma-text-dim uppercase tracking-wider mb-2.5 font-bold">Ön Ayarlar</div>
            <div className="space-y-1.5">
              {PRESETS.map(preset => (
                <button
                  key={preset.id}
                  onClick={() => applyPreset(preset)}
                  className="w-full px-2.5 py-2 rounded border border-finma-border/30 hover:border-finma-primary/50 bg-finma-bg/50 hover:bg-finma-primary/5 transition-colors text-left"
                >
                  <div className="text-sm font-bold text-finma-text flex items-center gap-1.5">
                    <span>{preset.emoji}</span>
                    {preset.name}
                  </div>
                  <div className="text-[9px] text-finma-text-dim mt-0.5">{preset.description}</div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-4 space-y-3">
          {/* Active Filters Bar */}
          {activeFilters.length > 0 && (
            <Card padding="sm">
              <div className="flex items-center gap-2 flex-wrap">
                {activeFilters.map(filter => (
                  <div
                    key={filter.id}
                    className="flex items-center gap-1.5 px-2 py-1 rounded bg-finma-primary/15 text-finma-primary text-[9px] font-medium border border-finma-primary/30"
                  >
                    <span>{filter.label}</span>
                    <button
                      onClick={() => removeFilter(filter.id)}
                      className="ml-1 hover:text-finma-primary/60"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Bulk Actions Bar */}
          {selectedTickers.length > 0 && (
            <Card padding="sm" className="bg-finma-primary/5 border-finma-primary/30">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-finma-text">
                  {selectedTickers.length} hisse seçildi
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={bulkAddToWatchlist}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 border border-finma-primary/30 transition-colors"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    Takip Listesine Ekle
                  </button>
                  <button
                    onClick={() => router.push(`/portfolio?add=${selectedTickers.join(',')}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 border border-finma-primary/30 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Portföye Ekle
                  </button>
                  <button
                    onClick={() => setSelectedTickers([])}
                    className="px-2.5 py-1.5 rounded text-xs text-finma-text-dim hover:text-finma-text"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* View Switcher & Results Header */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-finma-border">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-finma-primary" />
                <span className="text-sm font-bold text-finma-text">
                  Sonuçlar {results.length > 0 && <span className="text-finma-text-dim">({results.length})</span>}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Select All Checkbox (for table view) */}
                {viewMode === 'table' && results.length > 0 && (
                  <button
                    onClick={toggleSelectAll}
                    className="p-1.5 hover:bg-finma-border/20 rounded transition-colors"
                    title={selectedTickers.length === results.length ? "Tüm seçimi kaldır" : "Tümünü seç"}
                  >
                    {selectedTickers.length === results.length ? (
                      <CheckSquare className="w-4 h-4 text-finma-primary" />
                    ) : (
                      <Square className="w-4 h-4 text-finma-text-dim" />
                    )}
                  </button>
                )}

                {/* View Mode Switcher */}
                <div className="flex gap-1 bg-finma-border/20 rounded p-1">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      viewMode === 'list'
                        ? 'bg-finma-primary text-white'
                        : 'text-finma-text-dim hover:text-finma-text'
                    )}
                    title="Liste Görünümü"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('heatmap')}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      viewMode === 'heatmap'
                        ? 'bg-finma-primary text-white'
                        : 'text-finma-text-dim hover:text-finma-text'
                    )}
                    title="Isı Haritası"
                  >
                    <Grid3x3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={cn(
                      'p-1.5 rounded transition-colors',
                      viewMode === 'table'
                        ? 'bg-finma-primary text-white'
                        : 'text-finma-text-dim hover:text-finma-text'
                    )}
                    title="Detaylı Tablo"
                  >
                    <Table2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Results Display */}
            {results.length === 0 ? (
              <div className="text-center py-12 text-finma-text-dim">
                <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Filtreleri ayarla ve Tara butonuna bas</p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-1.5">
                {results.map((r, idx) => (
                  <div
                    key={r.ticker}
                    onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}
                    className="p-2.5 rounded border border-finma-border/30 hover:border-finma-primary/50 bg-finma-bg/50 hover:bg-finma-primary/5 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-finma-text-dim w-5">#{idx + 1}</span>
                        <div>
                          <span className="text-sm font-bold text-finma-primary finma-number">{r.ticker}</span>
                          <span className="text-[9px] text-finma-text-dim ml-1.5">{r.company_name}</span>
                        </div>
                      </div>
                      <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold finma-number', getScoreColor(r.score))}>
                        {r.score.toFixed(0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-finma-text-muted pl-7">
                      <span>{r.sector}</span>
                      <span className={r.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red'}>
                        {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : viewMode === 'heatmap' ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {results.map(r => (
                  <div
                    key={r.ticker}
                    onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}
                    className={cn(
                      'p-3 rounded border cursor-pointer transition-colors',
                      r.score >= 80 ? 'bg-finma-green/15 border-finma-green/30 hover:border-finma-green/50' :
                      r.score >= 65 ? 'bg-finma-primary/15 border-finma-primary/30 hover:border-finma-primary/50' :
                      'bg-finma-yellow/15 border-finma-yellow/30 hover:border-finma-yellow/50'
                    )}
                  >
                    <div className="font-bold text-sm text-white finma-number mb-1">{r.ticker}</div>
                    <div className="text-[9px] text-finma-text-dim">{r.sector}</div>
                    <div className="text-[11px] font-bold mt-1 finma-number">{r.score.toFixed(0)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-finma-text-dim bg-finma-bg/50 border-b border-finma-border">
                      <th className="text-center py-2 px-2 w-8">
                        {results.length > 0 && (
                          <button onClick={toggleSelectAll} className="hover:text-finma-text">
                            {selectedTickers.length === results.length ? (
                              <CheckSquare className="w-4 h-4 text-finma-primary mx-auto" />
                            ) : (
                              <Square className="w-4 h-4 mx-auto" />
                            )}
                          </button>
                        )}
                      </th>
                      <th className="text-left py-2 px-2">#</th>
                      <th className="text-left py-2 px-2">Hisse</th>
                      {columns.find(c => c.id === 'company_name')?.enabled && <th className="text-left py-2 px-2">Şirket</th>}
                      {columns.find(c => c.id === 'sector')?.enabled && <th className="text-left py-2 px-2">Sektör</th>}
                      {columns.find(c => c.id === 'price')?.enabled && <th className="text-right py-2 px-2">Fiyat</th>}
                      {columns.find(c => c.id === 'change')?.enabled && <th className="text-right py-2 px-2">Değişim</th>}
                      {columns.find(c => c.id === 'sparkline')?.enabled && <th className="text-center py-2 px-2">Performans</th>}
                      {columns.find(c => c.id === 'score')?.enabled && <th className="text-right py-2 px-2">Skor</th>}
                      {columns.find(c => c.id === 'gauge')?.enabled && <th className="text-center py-2 px-2">Signal</th>}
                      <th className="text-center py-2 px-2">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-finma-border/30">
                    {results.map((r, idx) => (
                      <tr
                        key={r.ticker}
                        className="hover:bg-finma-primary/5 transition-colors group"
                      >
                        <td className="py-2 px-2 text-center" onClick={e => e.stopPropagation()}>
                          <button onClick={() => toggleSelect(r.ticker)} className="hover:text-finma-primary">
                            {selectedTickers.includes(r.ticker) ? (
                              <CheckSquare className="w-4 h-4 text-finma-primary mx-auto" />
                            ) : (
                              <Square className="w-4 h-4 mx-auto text-finma-text-dim group-hover:text-finma-text-muted" />
                            )}
                          </button>
                        </td>
                        <td className="py-2 px-2 text-finma-text-dim cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                          {idx + 1}
                        </td>
                        <td className="py-2 px-2 cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                          <div className="font-bold text-finma-primary finma-number">{r.ticker}</div>
                        </td>
                        {columns.find(c => c.id === 'company_name')?.enabled && (
                          <td className="py-2 px-2 text-finma-text-dim text-[9px] cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            {r.company_name}
                          </td>
                        )}
                        {columns.find(c => c.id === 'sector')?.enabled && (
                          <td className="py-2 px-2 text-finma-text-dim text-[9px] cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            {r.sector}
                          </td>
                        )}
                        {columns.find(c => c.id === 'price')?.enabled && (
                          <td className="py-2 px-2 text-right finma-number font-bold cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            ${r.price?.toFixed(2)}
                          </td>
                        )}
                        {columns.find(c => c.id === 'change')?.enabled && (
                          <td className={cn('py-2 px-2 text-right finma-number font-bold cursor-pointer', r.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red')} onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            {r.change_pct >= 0 ? '+' : ''}{r.change_pct.toFixed(1)}%
                          </td>
                        )}
                        {columns.find(c => c.id === 'sparkline')?.enabled && (
                          <td className="py-2 px-2 text-center cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            <MiniSparkline data={r.performance_7d} />
                          </td>
                        )}
                        {columns.find(c => c.id === 'score')?.enabled && (
                          <td className={cn('py-2 px-2 text-right font-bold finma-number cursor-pointer', getScoreColor(r.score))} onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            {r.score.toFixed(0)}
                          </td>
                        )}
                        {columns.find(c => c.id === 'gauge')?.enabled && (
                          <td className="py-2 px-2 cursor-pointer" onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}>
                            <SignalGauge score={r.score} />
                          </td>
                        )}
                        <td className="py-2 px-2 text-center" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => router.push(`/stock-analysis?ticker=${r.ticker}`)}
                            className="p-1 text-finma-text-dim hover:text-finma-primary hover:bg-finma-primary/10 rounded transition-colors"
                            title="Analiz Et"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
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
