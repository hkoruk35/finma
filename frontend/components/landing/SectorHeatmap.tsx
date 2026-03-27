'use client'

import { useState, useEffect, useRef } from 'react'
import { RefreshCw, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'
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

function HeatCell({ label, sub, change, size, onClick }: {
  label: string; sub?: string; change: number; size: number; onClick?: () => void
}) {
  const bg = getHeatColor(change)
  const textColor = Math.abs(change) > 1 ? '#fff' : change >= 0 ? '#bbf7d0' : '#fecaca'
  return (
    <div
      onClick={onClick}
      style={{ backgroundColor: bg, flex: `${size} 0 0`, minWidth: '44px' }}
      className="rounded px-1 py-1.5 text-center cursor-pointer hover:brightness-125 transition-all select-none"
    >
      <div className="text-[10px] font-bold finma-number" style={{ color: textColor }}>{label}</div>
      {sub && <div className="text-[8px] mt-0.5" style={{ color: textColor + 'cc' }}>{sub}</div>}
      <div className="text-[10px] font-bold finma-number mt-0.5" style={{ color: textColor }}>
        {change >= 0 ? '+' : ''}{change.toFixed(2)}%
      </div>
    </div>
  )
}

export function SectorHeatmap() {
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
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(() => {
    try {
      return typeof window !== 'undefined' ? (localStorage.getItem(LS_UPDATE_KEY) || '') : ''
    } catch { return '' }
  })
  const isFetching = useRef(false)

  const fetchData = async (showSpinner = false) => {
    if (isFetching.current) return
    isFetching.current = true
    if (showSpinner) setRefreshing(true)

    try {
      const sData = await api.getSectors('1d')
      if (sData && sData.length > 0) {
        setSectors(sData)
        try { localStorage.setItem(LS_SECTORS_KEY, JSON.stringify(sData)) } catch {}
      }

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
    fetchData(false)
    const interval = setInterval(() => fetchData(false), 3600_000)
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

  const hasData = sectors.length > 0

  return (
    <div style={{ marginTop: 80, marginBottom: 80, width: '100%' }}>
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-6">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 20, fontWeight: 700, color: '#f5f5f5' }}>
            📊 ABD Borsası Sektor Isı Haritası
          </span>
          {lastUpdate && (
            <span className="flex items-center gap-1 text-[11px] text-gray-500">
              <Wifi className="w-2.5 h-2.5" />
              {lastUpdate}
            </span>
          )}
          {refreshing && (
            <span className="text-[11px] text-emerald-500 animate-pulse">güncelleniyor…</span>
          )}
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-1.5 text-gray-500 hover:text-gray-300 transition-colors rounded border border-gray-700"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Renk skalası */}
      <div className="flex items-center gap-1 text-[9px] mb-4 flex-wrap">
        {([['#16a34a', '+2%↑'], ['#166534', '+0.25%'], ['#374151', '0'], ['#991b1b', '-1%'], ['#b91c1c', '-2%↓']] as [string, string][]).map(([c, l]) => (
          <span key={l} className="flex items-center gap-0.5 ml-1">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: c }} />
            <span className="text-gray-400">{l}</span>
          </span>
        ))}
      </div>

      {/* Heatmap */}
      {!hasData ? (
        <div className="flex gap-1.5">
          {ETF_ORDER.map(etf => (
            <div
              key={etf}
              className="rounded animate-pulse bg-gray-800"
              style={{ width: `${Math.max(SECTOR_SIZES[etf] * 5, 100)}px`, height: '56px' }}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            {heatmapData.map(sector => (
              <div key={sector.etf} className="flex flex-col gap-0.5" style={{ width: `${Math.max(sector.size * 5, 100)}px` }}>
                <HeatCell
                  label={sector.name}
                  sub={sector.etf}
                  change={sector.change}
                  size={1}
                />
                <div className="flex flex-wrap gap-0.5">
                  {sector.stocks.map(s => (
                    <HeatCell
                      key={s.ticker}
                      label={s.ticker}
                      change={s.change}
                      size={1}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
