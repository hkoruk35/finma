'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/shared/Card'
import { FinMAChart } from '@/components/terminal/FinMAChart'
import { cn } from '@/lib/utils'
import { Map, RefreshCw, TrendingUp, TrendingDown, Wifi } from 'lucide-react'
import { api } from '@/lib/api-client'

const SECTOR_NAMES: Record<string, string> = {
  XLK: 'Teknoloji', XLF: 'Finans', XLV: 'Sağlık', XLY: 'Tüketici İhtiyari',
  XLP: 'Temel Tüketim', XLI: 'Sanayi', XLC: 'İletişim', XLE: 'Enerji',
  XLU: 'Kamu Hizm.', XLRE: 'Gayrimenkul', XLB: 'Hammadde',
}

const SECTOR_STOCKS: Record<string, string[]> = {
  XLK: ['AAPL', 'MSFT', 'NVDA', 'GOOG', 'META', 'AVGO', 'AMD'],
  XLF: ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'BLK'],
  XLV: ['UNH', 'JNJ', 'LLY', 'ABBV', 'MRK'],
  XLY: ['AMZN', 'TSLA', 'HD', 'MCD', 'NKE'],
  XLI: ['GE', 'CAT', 'UNP', 'LMT', 'RTX'],
  XLC: ['GOOGL', 'NFLX', 'DIS', 'T'],
  XLP: ['PG', 'KO', 'PEP', 'WMT'],
  XLE: ['XOM', 'CVX', 'COP', 'SLB'],
  XLU: ['NEE', 'DUK', 'SO'],
  XLRE: ['PLD', 'AMT', 'CCI'],
  XLB: ['LIN', 'APD', 'NEM', 'FCX'],
}

const ETF_ORDER = ['XLK', 'XLF', 'XLV', 'XLY', 'XLI', 'XLC', 'XLP', 'XLE', 'XLU', 'XLRE', 'XLB']
const SECTOR_SIZES: Record<string, number> = {
  XLK: 30, XLF: 20, XLV: 17, XLY: 15, XLI: 13, XLC: 12, XLP: 10, XLE: 10, XLU: 6, XLRE: 6, XLB: 7,
}

const LS_SECTORS_KEY = 'finma_maps_sectors'
const LS_STOCKS_KEY  = 'finma_maps_stocks'
const LS_UPDATE_KEY  = 'finma_maps_updated'

interface SectorData { etf: string; sector: string; change_pct: number; price?: number }
interface QuoteData  { ticker: string; change_pct: number; price?: number }

function getHeatColor(change: number): string {
  if (change >= 2)     return '#16a34a'
  if (change >= 1)     return '#15803d'
  if (change >= 0.25)  return '#166534'
  if (change >= -0.25) return '#374151'
  if (change >= -1)    return '#7f1d1d'
  if (change >= -2)    return '#991b1b'
  return '#b91c1c'
}

function HeatCell({ label, sub, change, size, onClick, selected }: {
  label: string; sub?: string; change: number; size: number
  onClick: () => void; selected?: boolean
}) {
  const bg = getHeatColor(change)
  const textColor = Math.abs(change) > 1 ? '#fff' : change >= 0 ? '#bbf7d0' : '#fecaca'
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: bg, flex: `${size} 0 0`, minWidth: '44px' }}
      className={cn(
        'rounded px-1 py-1.5 text-center cursor-pointer hover:brightness-125 transition-all select-none',
        selected && 'ring-2 ring-white/80 z-10'
      )}
    >
      <div className="text-[10px] font-bold finma-number" style={{ color: textColor }}>{label}</div>
      {sub && <div className="text-[8px] mt-0.5" style={{ color: textColor + 'cc' }}>{sub}</div>}
      <div className="text-[10px] font-bold finma-number mt-0.5" style={{ color: textColor }}>
        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
      </div>
    </div>
  )
}

export default function MapsPage() {
  // LocalStorage'dan anlık yükle (sayfayı anında göster)
  const [sectors, setSectors] = useState<SectorData[]>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_SECTORS_KEY) : null
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  })
  const [stocks, setStocks] = useState<Record<string, QuoteData>>(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(LS_STOCKS_KEY) : null
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  const [refreshing, setRefreshing] = useState(false) // arka plan yenileme
  const [lastUpdate, setLastUpdate] = useState(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem(LS_UPDATE_KEY) || '') : ''
    } catch { return '' }
  })
  const [selected, setSelected] = useState('XLK')
  const isFetching = useRef(false)

  // Arka planda veri çek — loading spinnerı GÖSTERMEZ, sadece veriler güncellenir
  const fetchData = async (showSpinner = false) => {
    if (isFetching.current) return
    isFetching.current = true
    if (showSpinner) setRefreshing(true)

    try {
      // Sektörler (backend cache'den çok hızlı gelir — startup'ta ısındı)
      const sData = await api.getSectors('1d')
      if (sData && sData.length > 0) {
        setSectors(sData)
        try { localStorage.setItem(LS_SECTORS_KEY, JSON.stringify(sData)) } catch {}
      }

      // Bireysel hisse kotasyonları (batch)
      const allTickers = Object.values(SECTOR_STOCKS).flat()
      const unique = Array.from(new Set(allTickers))
      const bData = await api.getBatchQuotes(unique)
      const map: Record<string, QuoteData> = {}
      ;(Array.isArray(bData) ? bData : []).forEach((q: any) => {
        if (q.symbol) map[q.symbol] = { ticker: q.symbol, change_pct: q.change_pct || 0, price: q.price }
      })
      if (Object.keys(map).length > 0) {
        setStocks(map)
        try { localStorage.setItem(LS_STOCKS_KEY, JSON.stringify(map)) } catch {}
      }

      const now = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      setLastUpdate(now)
      try { localStorage.setItem(LS_UPDATE_KEY, now) } catch {}
    } catch (e) {
      console.error('Heatmap veri hatası:', e)
    }

    isFetching.current = false
    setRefreshing(false)
  }

  useEffect(() => {
    // Sayfa açılınca: eğer localStorage'da eski veri varsa hemen gösterilir (state init),
    // ardından arka planda yenile (kullanıcı spinner görmez)
    fetchData(false)

    // Her 1 dakikada otomatik yenile (arka planda, sessiz)
    const interval = setInterval(() => fetchData(false), 60_000)
    return () => clearInterval(interval)
  }, [])

  const heatmapData = ETF_ORDER.map(etf => {
    const apiSector = sectors.find(s => s.etf === etf)
    const sectorChange = apiSector?.change_pct ?? 0
    const stockList = SECTOR_STOCKS[etf] || []
    return {
      etf,
      name: SECTOR_NAMES[etf] || etf,
      change: sectorChange,
      size: SECTOR_SIZES[etf] || 8,
      stocks: stockList.map(t => ({ ticker: t, change: stocks[t]?.change_pct ?? 0 })),
    }
  })

  const gainers = [...heatmapData].sort((a, b) => b.change - a.change).slice(0, 3)
  const losers  = [...heatmapData].sort((a, b) => a.change - b.change).slice(0, 3)
  const hasData = sectors.length > 0

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">Sektör Haritası</span>
          {lastUpdate && (
            <span className="flex items-center gap-1 text-[10px] text-finma-text-dim">
              <Wifi className="w-2.5 h-2.5" />
              Son: {lastUpdate}
            </span>
          )}
          {refreshing && (
            <span className="text-[10px] text-finma-primary animate-pulse">güncelleniyor…</span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-1.5 text-finma-text-dim hover:text-finma-text transition-colors rounded border border-finma-border"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Quick summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3.5 h-3.5 text-finma-green" />
            <span className="text-[10px] font-bold text-finma-green uppercase">En Güçlü Sektörler</span>
          </div>
          {gainers.map(s => (
            <div key={s.etf} className="flex items-center justify-between py-0.5">
              <button onClick={() => setSelected(s.etf)} className="text-xs font-bold finma-number text-finma-primary hover:underline">{s.etf}</button>
              <span className="text-xs text-finma-text-dim truncate mx-2 flex-1">{s.name}</span>
              <span className="text-xs font-bold finma-number text-finma-green">+{s.change.toFixed(2)}%</span>
            </div>
          ))}
        </Card>
        <Card padding="sm">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-finma-red" />
            <span className="text-[10px] font-bold text-finma-red uppercase">En Zayıf Sektörler</span>
          </div>
          {losers.map(s => (
            <div key={s.etf} className="flex items-center justify-between py-0.5">
              <button onClick={() => setSelected(s.etf)} className="text-xs font-bold finma-number text-finma-primary hover:underline">{s.etf}</button>
              <span className="text-xs text-finma-text-dim truncate mx-2 flex-1">{s.name}</span>
              <span className="text-xs font-bold finma-number text-finma-red">{s.change.toFixed(2)}%</span>
            </div>
          ))}
        </Card>
      </div>

      {/* Heatmap */}
      <Card padding="sm">
        <div className="flex items-center justify-between pb-2 border-b border-finma-border mb-3 flex-wrap gap-2">
          <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">Sektörel Isı Haritası — Günlük</span>
          <div className="flex items-center gap-1 text-[9px]">
            {[['#16a34a', '+2%'], ['#166534', '+0.25%'], ['#374151', '0'], ['#991b1b', '-1%'], ['#b91c1c', '-2%']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-0.5 ml-1">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: c }} />{l}
              </span>
            ))}
          </div>
        </div>

        {/* İlk yüklemede (localStorage yok) kısa bir iskelet göster */}
        {!hasData ? (
          <div className="flex gap-1.5">
            {ETF_ORDER.map(etf => (
              <div
                key={etf}
                className="rounded animate-pulse bg-finma-border/20"
                style={{ width: `${Math.max(SECTOR_SIZES[etf] * 5, 100)}px`, height: '56px' }}
              />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
            <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
              {heatmapData.map(sector => (
                <div key={sector.etf} className="flex flex-col gap-0.5" style={{ width: `${Math.max(sector.size * 5, 100)}px` }}>
                  <HeatCell
                    label={sector.name}
                    sub={sector.etf}
                    change={sector.change}
                    size={1}
                    onClick={() => setSelected(sector.etf)}
                    selected={selected === sector.etf}
                  />
                  <div className="flex flex-wrap gap-0.5">
                    {sector.stocks.map(s => (
                      <HeatCell
                        key={s.ticker}
                        label={s.ticker}
                        change={s.change}
                        size={1}
                        onClick={() => setSelected(s.ticker)}
                        selected={selected === s.ticker}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* FinMAChart for selected */}
      <div>
        <div className="text-xs text-finma-text-dim mb-2 px-1">
          Seçili: <span className="text-finma-primary font-bold finma-number">{selected}</span>
          {SECTOR_NAMES[selected] && <span className="ml-1 text-finma-text-dim">— {SECTOR_NAMES[selected]}</span>}
          <span className="ml-2 text-finma-text-dim/50">· Isı haritasından farklı bir sektör veya hisse seçin</span>
        </div>
        <FinMAChart ticker={selected} height={420} showControls={true} />
      </div>
    </div>
  )
}
