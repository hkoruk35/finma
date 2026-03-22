'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import {
  Activity, TrendingUp, TrendingDown, BarChart2,
  DollarSign, Users, RefreshCw, AlertCircle, ArrowRight,
  Flame, Eye, Building2
} from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

// ─── Types ───
interface InsiderTrade {
  ticker: string
  insider_name: string
  title: string
  transaction_type: string
  shares: number
  value: number
  date: string
}

interface SectorFlow {
  sector: string
  etf: string
  change_pct: number
  volume_ratio: number
  flow: 'inflow' | 'outflow' | 'neutral'
}

interface Mover {
  ticker: string
  name?: string
  price?: number
  change_pct: number
  volume?: number
}

const SECTOR_ETFS: Record<string, string> = {
  XLK: 'Teknoloji', XLF: 'Finans', XLV: 'Sağlık', XLY: 'Tüketici İhtiyari',
  XLI: 'Sanayi', XLC: 'İletişim', XLE: 'Enerji', XLU: 'Kamu Hizmetleri',
  XLRE: 'Gayrimenkul', XLB: 'Hammadde', XLP: 'Temel Tüketim',
}

function FlowBar({ pct }: { pct: number }) {
  const w = Math.min(Math.abs(pct) * 10, 100)
  return (
    <div className="h-1.5 bg-finma-border/30 rounded-full overflow-hidden w-24">
      <div
        className={cn('h-full rounded-full transition-all', pct >= 0 ? 'bg-finma-green' : 'bg-finma-red')}
        style={{ width: `${w}%`, marginLeft: pct < 0 ? 'auto' : 0 }}
      />
    </div>
  )
}

export default function MarketFlowPage() {
  const router = useRouter()
  const [insiders, setInsiders] = useState<InsiderTrade[]>([])
  const [sectors, setSectors] = useState<SectorFlow[]>([])
  const [topBuys, setTopBuys] = useState<Mover[]>([])
  const [topSells, setTopSells] = useState<Mover[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [insiderRes, sectorRes, gainersRes, losersRes] = await Promise.allSettled([
        fetch(`${API_URL}/api/market/insider/latest?limit=30`).then(r => r.json()),
        fetch(`${API_URL}/api/market/sectors?period=1d`).then(r => r.json()),
        fetch(`${API_URL}/api/market/movers?tab=gainers&limit=10`).then(r => r.json()),
        fetch(`${API_URL}/api/market/movers?tab=losers&limit=10`).then(r => r.json()),
      ])

      if (insiderRes.status === 'fulfilled') {
        setInsiders(insiderRes.value || [])
      }
      if (sectorRes.status === 'fulfilled') {
        const raw: any[] = sectorRes.value || []
        setSectors(raw.map(s => ({
          sector: SECTOR_ETFS[s.etf] || s.sector || s.etf,
          etf: s.etf,
          change_pct: s.change_pct || 0,
          volume_ratio: s.volume_ratio || 1,
          flow: (s.change_pct || 0) > 0.5 ? 'inflow' : (s.change_pct || 0) < -0.5 ? 'outflow' : 'neutral',
        })))
      }
      if (gainersRes.status === 'fulfilled') {
        setTopBuys(gainersRes.value?.items || [])
      }
      if (losersRes.status === 'fulfilled') {
        setTopSells(losersRes.value?.items || [])
      }

      setLastUpdate(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const inflowSectors = sectors.filter(s => s.flow === 'inflow').sort((a, b) => b.change_pct - a.change_pct)
  const outflowSectors = sectors.filter(s => s.flow === 'outflow').sort((a, b) => a.change_pct - b.change_pct)

  const insiderBuys = insiders.filter(i => i.transaction_type?.toLowerCase().includes('purchase') || i.transaction_type === 'P')
  const insiderSells = insiders.filter(i => i.transaction_type?.toLowerCase().includes('sale') || i.transaction_type === 'S')

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-finma-primary" />
          <div>
            <h1 className="text-lg font-bold text-white">Akıllı Para Akışı</h1>
            <p className="text-xs text-finma-text-dim">Kurumsal akış • Insider işlemleri • Sektör hareketi</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[10px] text-finma-text-dim">Son: {lastUpdate}</span>
          )}
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-lg border border-finma-border text-finma-text-muted hover:text-finma-text transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Sector Flow - Inflow/Outflow Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inflow */}
        <Card padding="sm">
          <div className="flex items-center gap-2 pb-3 border-b border-finma-border mb-3">
            <TrendingUp className="w-4 h-4 text-finma-green" />
            <span className="text-sm font-bold text-finma-green">Para Girişi (Inflow)</span>
            <span className="ml-auto text-xs text-finma-text-dim">{inflowSectors.length} sektör</span>
          </div>
          {inflowSectors.length === 0 ? (
            <div className="text-center py-4 text-finma-text-dim text-xs">Veri yok</div>
          ) : (
            <div className="space-y-2">
              {inflowSectors.map(s => (
                <div key={s.etf} className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/stock-analysis?ticker=${s.etf}`)}
                    className="text-xs font-bold finma-number text-finma-primary hover:underline w-10 shrink-0"
                  >
                    {s.etf}
                  </button>
                  <span className="text-xs text-finma-text-dim flex-1 truncate">{s.sector}</span>
                  <FlowBar pct={s.change_pct} />
                  <span className="text-xs font-bold finma-number text-finma-green w-14 text-right">
                    +{s.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Outflow */}
        <Card padding="sm">
          <div className="flex items-center gap-2 pb-3 border-b border-finma-border mb-3">
            <TrendingDown className="w-4 h-4 text-finma-red" />
            <span className="text-sm font-bold text-finma-red">Para Çıkışı (Outflow)</span>
            <span className="ml-auto text-xs text-finma-text-dim">{outflowSectors.length} sektör</span>
          </div>
          {outflowSectors.length === 0 ? (
            <div className="text-center py-4 text-finma-text-dim text-xs">Veri yok</div>
          ) : (
            <div className="space-y-2">
              {outflowSectors.map(s => (
                <div key={s.etf} className="flex items-center gap-3">
                  <button
                    onClick={() => router.push(`/stock-analysis?ticker=${s.etf}`)}
                    className="text-xs font-bold finma-number text-finma-primary hover:underline w-10 shrink-0"
                  >
                    {s.etf}
                  </button>
                  <span className="text-xs text-finma-text-dim flex-1 truncate">{s.sector}</span>
                  <FlowBar pct={s.change_pct} />
                  <span className="text-xs font-bold finma-number text-finma-red w-14 text-right">
                    {s.change_pct.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <Card padding="sm">
          <div className="flex items-center gap-2 pb-3 border-b border-finma-border mb-3">
            <Flame className="w-4 h-4 text-finma-yellow" />
            <span className="text-sm font-bold text-finma-text">En Çok Yükselenler</span>
          </div>
          <div className="space-y-1.5">
            {topBuys.slice(0, 8).map((m, i) => (
              <div
                key={m.ticker}
                className="flex items-center gap-2 hover:bg-finma-primary/5 rounded-md px-1 py-1 cursor-pointer transition-colors"
                onClick={() => router.push(`/stock-analysis?ticker=${m.ticker}`)}
              >
                <span className="text-[10px] text-finma-text-dim w-4">{i + 1}</span>
                <span className="text-xs font-bold finma-number text-finma-primary flex-1">{m.ticker}</span>
                {m.price != null && (
                  <span className="text-xs finma-number text-finma-text-dim">${m.price.toFixed(2)}</span>
                )}
                <span className="text-xs font-bold finma-number text-finma-green">
                  +{m.change_pct.toFixed(2)}%
                </span>
                <ArrowRight className="w-3 h-3 text-finma-text-dim/40" />
              </div>
            ))}
          </div>
        </Card>

        {/* Top Losers */}
        <Card padding="sm">
          <div className="flex items-center gap-2 pb-3 border-b border-finma-border mb-3">
            <TrendingDown className="w-4 h-4 text-finma-red" />
            <span className="text-sm font-bold text-finma-text">En Çok Düşenler</span>
          </div>
          <div className="space-y-1.5">
            {topSells.slice(0, 8).map((m, i) => (
              <div
                key={m.ticker}
                className="flex items-center gap-2 hover:bg-finma-red/5 rounded-md px-1 py-1 cursor-pointer transition-colors"
                onClick={() => router.push(`/stock-analysis?ticker=${m.ticker}`)}
              >
                <span className="text-[10px] text-finma-text-dim w-4">{i + 1}</span>
                <span className="text-xs font-bold finma-number text-finma-primary flex-1">{m.ticker}</span>
                {m.price != null && (
                  <span className="text-xs finma-number text-finma-text-dim">${m.price.toFixed(2)}</span>
                )}
                <span className="text-xs font-bold finma-number text-finma-red">
                  {m.change_pct.toFixed(2)}%
                </span>
                <ArrowRight className="w-3 h-3 text-finma-text-dim/40" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Insider Transactions */}
      <Card padding="sm">
        <div className="flex items-center justify-between pb-3 mb-1 border-b border-finma-border">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-finma-primary" />
            <span className="text-sm font-bold text-finma-text">Insider İşlemleri</span>
            <span className="text-[10px] text-finma-text-dim bg-finma-border/30 px-2 py-0.5 rounded">SEC Form 4</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-finma-text-dim">
            <span className="text-finma-green font-bold">{insiderBuys.length} Alış</span>
            <span className="text-finma-red font-bold">{insiderSells.length} Satış</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-finma-text-dim text-sm">
            <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin opacity-50" />
            Yükleniyor...
          </div>
        ) : insiders.length === 0 ? (
          <div className="text-center py-8 text-finma-text-dim text-sm">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-30" />
            <p>Insider verisi bulunamadı.</p>
            <p className="text-xs mt-1 text-finma-text-dim/60">SEC veritabanı güncellenmeyi bekliyor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-finma-text-dim bg-finma-bg/80">
                  <th className="text-left py-2 px-3 border border-finma-border/50">Hisse</th>
                  <th className="text-left py-2 px-2 border border-finma-border/50 hidden md:table-cell">İçeriden Kişi</th>
                  <th className="text-left py-2 px-2 border border-finma-border/50 hidden md:table-cell">Ünvan</th>
                  <th className="text-center py-2 px-2 border border-finma-border/50">İşlem</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">Adet</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50">Değer ($)</th>
                  <th className="text-right py-2 px-2 border border-finma-border/50 hidden md:table-cell">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {insiders.map((ins, i) => {
                  const isBuy = ins.transaction_type?.toLowerCase().includes('purchase') || ins.transaction_type === 'P'
                  return (
                    <tr
                      key={i}
                      className="hover:bg-finma-primary/5 transition-colors cursor-pointer"
                      onClick={() => router.push(`/stock-analysis?ticker=${ins.ticker}`)}
                    >
                      <td className="py-2 px-3 border border-finma-border/50 font-bold text-finma-primary finma-number">
                        {ins.ticker}
                      </td>
                      <td className="py-2 px-2 border border-finma-border/50 text-finma-text-dim hidden md:table-cell max-w-[140px] truncate">
                        {ins.insider_name}
                      </td>
                      <td className="py-2 px-2 border border-finma-border/50 text-finma-text-dim hidden md:table-cell max-w-[120px] truncate">
                        {ins.title}
                      </td>
                      <td className="py-2 px-2 border border-finma-border/50 text-center">
                        <span className={cn(
                          'px-2 py-0.5 rounded text-[10px] font-bold',
                          isBuy ? 'bg-finma-green/10 text-finma-green' : 'bg-finma-red/10 text-finma-red'
                        )}>
                          {isBuy ? 'Alış' : 'Satış'}
                        </span>
                      </td>
                      <td className="py-2 px-2 border border-finma-border/50 text-right finma-number">
                        {ins.shares ? ins.shares.toLocaleString() : '—'}
                      </td>
                      <td className={cn(
                        'py-2 px-2 border border-finma-border/50 text-right finma-number font-bold',
                        isBuy ? 'text-finma-green' : 'text-finma-red'
                      )}>
                        {ins.value ? `$${(ins.value / 1e6).toFixed(2)}M` : '—'}
                      </td>
                      <td className="py-2 px-2 border border-finma-border/50 text-right text-finma-text-dim hidden md:table-cell">
                        {ins.date ? new Date(ins.date).toLocaleDateString('tr-TR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
