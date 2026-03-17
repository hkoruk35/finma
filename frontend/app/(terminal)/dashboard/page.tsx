'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { HUDMetrics, RiskBanner } from '@/components/terminal/HUDMetrics'
import { MarketContext } from '@/components/terminal/MarketContext'
import { Card } from '@/components/shared/Card'
import { Badge, ActionBadge, sectorLabel } from '@/components/shared/Badge'
import { usePortfolioSummary, useTrades } from '@/hooks/usePortfolio'
import { useLatestSignals } from '@/hooks/useSignals'
import { useIndices, useRegime } from '@/hooks/useMarketData'
import { mockPortfolio, mockSignals, mockTrades, mockIndices } from '@/lib/mock-data'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Brain, Clock, AlertCircle, Globe2, DollarSign,
  Newspaper, Shield, Activity, Flame, TrendingUp, TrendingDown,
  BarChart3, Zap, Target, Eye, ArrowUpRight, ArrowDownRight,
  Volume2, Building2, Users, RefreshCw, ChevronRight, Star
} from 'lucide-react'

/* ── Sektör Renk Fonksiyonu (maps sayfasıyla aynı) ── */
function getHeatColor(change: number): string {
  if (change >= 2)     return 'bg-green-600'
  if (change >= 1)     return 'bg-green-700'
  if (change >= 0.25)  return 'bg-green-800'
  if (change >= -0.25) return 'bg-gray-700'
  if (change >= -1)    return 'bg-red-900'
  if (change >= -2)    return 'bg-red-800'
  return 'bg-red-700'
}

/* ── Sektör → ETF ── */
const sectorETF: Record<string, string> = {
  'Teknoloji': 'XLK', 'Finans': 'XLF', 'Sağlık': 'XLV',
  'Tüketici İhtiyari': 'XLY', 'Temel Tüketim': 'XLP', 'Sanayi': 'XLI',
  'İletişim': 'XLC', 'Enerji': 'XLE', 'Kamu Hizmetleri': 'XLU',
  'Gayrimenkul': 'XLRE', 'Hammadde': 'XLB',
}

/* ── Isı Haritası Verileri (maps sayfasıyla aynı format) ── */
const heatmapData = [
  { sector: 'Teknoloji', change: 1.40, size: 30, stocks: [
    { ticker: 'AAPL', name: 'Apple', change: 0.45, size: 9 },
    { ticker: 'MSFT', name: 'Microsoft', change: 1.20, size: 8 },
    { ticker: 'NVDA', name: 'NVIDIA', change: 2.10, size: 7 },
    { ticker: 'GOOG', name: 'Alphabet', change: 0.35, size: 5 },
    { ticker: 'META', name: 'Meta', change: 0.85, size: 4 },
    { ticker: 'AVGO', name: 'Broadcom', change: 1.55, size: 4 },
    { ticker: 'AMD', name: 'AMD', change: 1.80, size: 3 },
  ]},
  { sector: 'Enerji', change: 2.10, size: 12, stocks: [
    { ticker: 'XOM', name: 'Exxon', change: 1.85, size: 4 },
    { ticker: 'CVX', name: 'Chevron', change: 2.28, size: 3 },
    { ticker: 'COP', name: 'ConocoPhillips', change: 2.55, size: 3 },
    { ticker: 'SLB', name: 'Schlumberger', change: 1.92, size: 2 },
  ]},
  { sector: 'Sağlık', change: -0.30, size: 17, stocks: [
    { ticker: 'UNH', name: 'UnitedHealth', change: 0.12, size: 6 },
    { ticker: 'JNJ', name: 'J&J', change: -0.55, size: 5 },
    { ticker: 'LLY', name: 'Eli Lilly', change: -0.78, size: 6 },
    { ticker: 'ABBV', name: 'AbbVie', change: 0.45, size: 4 },
  ]},
  { sector: 'Finans', change: -0.60, size: 18, stocks: [
    { ticker: 'JPM', name: 'JP Morgan', change: -0.52, size: 6 },
    { ticker: 'BAC', name: 'BofA', change: -0.18, size: 5 },
    { ticker: 'GS', name: 'Goldman', change: -0.95, size: 4 },
    { ticker: 'MS', name: 'Morgan Stanley', change: -0.42, size: 3 },
  ]},
  { sector: 'Sanayi', change: 1.80, size: 13, stocks: [
    { ticker: 'GE', name: 'GE Aero', change: 1.35, size: 4 },
    { ticker: 'CAT', name: 'Caterpillar', change: 1.10, size: 4 },
    { ticker: 'LMT', name: 'Lockheed', change: 2.22, size: 3 },
    { ticker: 'RTX', name: 'RTX', change: 1.48, size: 2 },
  ]},
  { sector: 'Tüketici İhtiyari', change: -1.20, size: 15, stocks: [
    { ticker: 'AMZN', name: 'Amazon', change: -0.82, size: 6 },
    { ticker: 'TSLA', name: 'Tesla', change: -2.45, size: 5 },
    { ticker: 'HD', name: 'Home Depot', change: 0.18, size: 4 },
  ]},
  { sector: 'İletişim', change: 0.80, size: 12, stocks: [
    { ticker: 'GOOGL', name: 'Alphabet', change: 0.38, size: 5 },
    { ticker: 'NFLX', name: 'Netflix', change: 1.25, size: 4 },
    { ticker: 'DIS', name: 'Disney', change: 0.55, size: 3 },
  ]},
  { sector: 'Temel Tüketim', change: 0.10, size: 10, stocks: [
    { ticker: 'PG', name: 'P&G', change: 0.25, size: 4 },
    { ticker: 'KO', name: 'Coca-Cola', change: 0.12, size: 3 },
    { ticker: 'WMT', name: 'Walmart', change: -0.08, size: 3 },
  ]},
  { sector: 'Kamu Hizmetleri', change: 0.30, size: 6, stocks: [
    { ticker: 'NEE', name: 'NextEra', change: 0.45, size: 3 },
    { ticker: 'DUK', name: 'Duke Energy', change: 0.22, size: 3 },
  ]},
  { sector: 'Gayrimenkul', change: -0.40, size: 6, stocks: [
    { ticker: 'PLD', name: 'Prologis', change: -0.28, size: 3 },
    { ticker: 'AMT', name: 'AMT', change: -0.55, size: 3 },
  ]},
  { sector: 'Hammadde', change: 1.50, size: 7, stocks: [
    { ticker: 'LIN', name: 'Linde', change: 1.50, size: 3 },
    { ticker: 'APD', name: 'Air Products', change: 1.20, size: 2 },
    { ticker: 'FCX', name: 'Freeport', change: 2.10, size: 2 },
  ]},
]

/* ── Akıllı Para Akışı — Kurumsal Hareketler ── */
const SMART_MONEY = [
  { ticker: 'NVDA', name: 'NVIDIA', flow: '+$2.4B', direction: 'in' as const, institution: 'BlackRock, Vanguard', change: '+12.3%', sector: 'Teknoloji', signal: 'Büyük kurumsal birikim — AI çip talebi', type: 'Sweep Order', confidence: 'high' },
  { ticker: 'MSFT', name: 'Microsoft', flow: '+$1.8B', direction: 'in' as const, institution: 'State Street, Fidelity', change: '+5.1%', sector: 'Teknoloji', signal: 'Azure & Copilot büyümesi için pozisyon', type: 'Block Trade', confidence: 'high' },
  { ticker: 'AAPL', name: 'Apple', flow: '+$1.2B', direction: 'in' as const, institution: 'Berkshire, JP Morgan', change: '+3.2%', sector: 'Teknoloji', signal: 'Berkshire uzun vadeli tutum koruyor', type: 'Dark Pool', confidence: 'medium' },
  { ticker: 'AMD', name: 'Advanced Micro', flow: '+$890M', direction: 'in' as const, institution: 'ARK Invest, Citadel', change: '+8.7%', sector: 'Teknoloji', signal: 'NVIDIA alternatifi olarak güçleniyor', type: 'Sweep Order', confidence: 'high' },
  { ticker: 'TSLA', name: 'Tesla', flow: '-$650M', direction: 'out' as const, institution: 'Goldman Sachs, MS', change: '-4.2%', sector: 'Otomobil', signal: 'Çin satış düşüşü kurumsal çıkışı hızlandırıyor', type: 'Institutional Sell-off', confidence: 'medium' },
  { ticker: 'PLTR', name: 'Palantir', flow: '+$520M', direction: 'in' as const, institution: 'Renaissance, Susquehanna', change: '+8.5%', sector: 'Teknoloji', signal: 'S&P 500 dahil edilme beklentisi güçleniyor', type: 'Accumulation', confidence: 'high' },
  { ticker: 'MSTR', name: 'MicroStrategy', flow: '+$410M', direction: 'in' as const, institution: 'Fidelity, BlackRock', change: '+15.2%', sector: 'Teknoloji', signal: 'Bitcoin korelasyonu ve kaldıraçlı alım', type: 'Gamma Squeeze Candidate', confidence: 'medium' },
  { ticker: 'GLD', name: 'Gold ETF', flow: '+$680M', direction: 'in' as const, institution: 'SPDR, iShares', change: '+1.8%', sector: 'Emtia', signal: 'Güvenli liman talebi artıyor — jeopolitik risk', type: 'Safe Haven Flow', confidence: 'high' },
]

/* ── Mock: Market Movers (profesyonel tablo) ── */
const MOVERS = {
  gainers: [
    { ticker: 'SMCI', name: 'Super Micro', sector: 'Technology', price: 892.40, change_pct: 14.2, volume: '42M' },
    { ticker: 'PLTR', name: 'Palantir', sector: 'Technology', price: 78.50, change_pct: 8.7, volume: '88M' },
    { ticker: 'FANG', name: 'Diamondback', sector: 'Energy', price: 182.43, change_pct: 6.3, volume: '12M' },
    { ticker: 'NOC', name: 'Northrop Grumman', sector: 'Industrials', price: 733.41, change_pct: 5.8, volume: '8M' },
    { ticker: 'LMT', name: 'Lockheed Martin', sector: 'Industrials', price: 646.10, change_pct: 4.9, volume: '6M' },
    { ticker: 'EQNR', name: 'Equinor', sector: 'Energy', price: 35.25, change_pct: 4.1, volume: '15M' },
    { ticker: 'OKE', name: 'ONEOK', sector: 'Energy', price: 85.36, change_pct: 3.8, volume: '5M' },
    { ticker: 'DELL', name: 'Dell Technologies', sector: 'Technology', price: 151.70, change_pct: 3.2, volume: '9M' },
    { ticker: 'ARM', name: 'ARM Holdings', sector: 'Technology', price: 145.80, change_pct: 2.9, volume: '22M' },
    { ticker: 'CRWD', name: 'CrowdStrike', sector: 'Technology', price: 342.10, change_pct: 2.5, volume: '7M' },
  ],
  losers: [
    { ticker: 'RIVN', name: 'Rivian', sector: 'Consumer', price: 12.30, change_pct: -8.4, volume: '65M' },
    { ticker: 'SNAP', name: 'Snap Inc.', sector: 'Communication', price: 11.20, change_pct: -6.1, volume: '38M' },
    { ticker: 'NKLA', name: 'Nikola', sector: 'Industrials', price: 0.85, change_pct: -5.7, volume: '28M' },
    { ticker: 'BYND', name: 'Beyond Meat', sector: 'Consumer', price: 5.40, change_pct: -5.2, volume: '12M' },
    { ticker: 'LCID', name: 'Lucid Group', sector: 'Consumer', price: 2.80, change_pct: -4.8, volume: '32M' },
    { ticker: 'COIN', name: 'Coinbase', sector: 'Financials', price: 208.50, change_pct: -4.3, volume: '18M' },
    { ticker: 'PYPL', name: 'PayPal', sector: 'Financials', price: 65.20, change_pct: -3.9, volume: '14M' },
    { ticker: 'HOOD', name: 'Robinhood', sector: 'Financials', price: 18.40, change_pct: -3.5, volume: '25M' },
    { ticker: 'SOFI', name: 'SoFi', sector: 'Financials', price: 8.90, change_pct: -3.1, volume: '42M' },
    { ticker: 'DKNG', name: 'DraftKings', sector: 'Consumer', price: 38.70, change_pct: -2.8, volume: '11M' },
  ],
  volume: [
    { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', price: 912.45, change_pct: 2.1, volume: '145M' },
    { ticker: 'TSLA', name: 'Tesla', sector: 'Consumer', price: 178.90, change_pct: -1.4, volume: '112M' },
    { ticker: 'PLTR', name: 'Palantir', sector: 'Technology', price: 78.50, change_pct: 8.7, volume: '88M' },
    { ticker: 'AMD', name: 'AMD', sector: 'Technology', price: 168.30, change_pct: 1.8, volume: '78M' },
    { ticker: 'RIVN', name: 'Rivian', sector: 'Consumer', price: 12.30, change_pct: -8.4, volume: '65M' },
    { ticker: 'AAPL', name: 'Apple', sector: 'Technology', price: 182.30, change_pct: 0.5, volume: '58M' },
    { ticker: 'SMCI', name: 'Super Micro', sector: 'Technology', price: 892.40, change_pct: 14.2, volume: '42M' },
    { ticker: 'SOFI', name: 'SoFi', sector: 'Financials', price: 8.90, change_pct: -3.1, volume: '42M' },
    { ticker: 'SNAP', name: 'Snap Inc.', sector: 'Communication', price: 11.20, change_pct: -6.1, volume: '38M' },
    { ticker: 'INTC', name: 'Intel', sector: 'Technology', price: 31.50, change_pct: 1.2, volume: '35M' },
  ],
}

/* ── Sektör Renkleri (Badge) ── */
const SECTOR_BADGE: Record<string, string> = {
  Technology: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Energy: 'bg-green-500/10 text-green-400 border-green-500/20',
  Industrials: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Consumer: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  Communication: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Financials: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Healthcare: 'bg-red-400/10 text-red-400 border-red-400/20',
  'Real Estate': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Materials: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default function DashboardPage() {
  const router = useRouter()
  const { canAccess } = useAuthStore()
  const isPro = canAccess('pro')
  const { data: portfolioData } = usePortfolioSummary()
  const { data: tradesData } = useTrades('OPEN')
  const { data: signalsData } = useLatestSignals()
  const { data: indicesData } = useIndices()
  const { data: regimeData } = useRegime()

  // Canlı fiyatlar — top10 + movers tickers için batch quote
  const [liveQuotes, setLiveQuotes] = useState<Record<string, { price: number; change: number; change_pct: number }>>({})
  // Movers canlı veri
  const [liveMovers, setLiveMovers] = useState<{
    gainers: any[]; losers: any[]; volume: any[]
  }>({ gainers: [], losers: [], volume: [] })
  // Weekly highlights (Highlights of the week)
  const [weeklyHighlights, setWeeklyHighlights] = useState<any[]>([])
  // Heatmap son güncelleme zamanı
  const [heatmapUpdate, setHeatmapUpdate] = useState(new Date())

  const portfolio = portfolioData || mockPortfolio
  const trades = tradesData || mockTrades
  const signals = (signalsData || mockSignals) as import('@/types').SignalReport
  const indices = indicesData && indicesData.length > 0 ? indicesData : mockIndices

  // VIX sanity check
  const indicesVix = indices.find(i => i.symbol === 'VIX')?.price
  const rawRegimeVix = regimeData?.vix
  const safeRegimeVix = rawRegimeVix && rawRegimeVix > 0 && rawRegimeVix <= 90 ? rawRegimeVix : null
  const vix = safeRegimeVix ?? indicesVix ?? signals.vix_level
  const regime = regimeData?.regime_tr ?? (signals.market_regime === 'Bull' ? '🐂 Boğa' : '🐻 Ayı')
  const sectorLeaders = signals.sector_leaders?.join(', ') ?? 'Utilities, Materials'

  const [moversTab, setMoversTab] = useState<'gainers' | 'losers' | 'volume'>('gainers')
  const [moversPeriod, setMoversPeriod] = useState<'1d' | '1w' | '1m' | '1y'>('1d')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  // 5 dakikada bir otomatik güncelleme (zaman damgası için)
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date())
    }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const timeStr = lastRefresh.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = lastRefresh.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  // Bot sonuçlarından ilk 10
  const top10Candidates = signals.candidates?.slice(0, 10) || []

  // Canlı fiyatları ve movers verilerini çek
  useEffect(() => {
    const fetchMovers = async () => {
      try {
        const data = await api.getMarketMovers(moversPeriod)
        setLiveMovers(data)
        
        // Live quotes map'ini de güncelle ki Bot sonuçları vb. etkilensin
        const map: Record<string, any> = { ...liveQuotes }
        const allItems = [...data.gainers, ...data.losers, ...data.volume]
        allItems.forEach(item => {
          map[item.symbol] = { price: item.price, change_pct: item.change_pct }
        })
        setLiveQuotes(map)
        setLastRefresh(new Date())
      } catch (err) {
        console.error('Movers fetch error:', err)
      }
    }

    fetchMovers()
    const interval = setInterval(fetchMovers, moversPeriod === '1d' ? 3 * 60 * 1000 : 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [moversPeriod])

  // Haftalık öne çıkanları çek (1w gainers)
  useEffect(() => {
    api.getMarketMovers('1w')
      .then(data => setWeeklyHighlights(data.gainers))
      .catch(err => console.error('Weekly highlights error:', err))
  }, [])

  // Isı haritası verilerini çek
  const [heatmap, setHeatmap] = useState(heatmapData)

  useEffect(() => {
    const fetchHeatmap = () => {
      api.getSectors('1d')
        .then(sectors => {
          if (!sectors || sectors.length === 0) return
          
          // Mevcut heatmapData yapısına dönüştür (görsellik için)
          const updated = heatmapData.map(h => {
            const apiSector = sectors.find(s => s.sector_tr === h.sector || s.sector === h.sector)
            if (apiSector) {
              return { ...h, change: apiSector.change_pct }
            }
            return h
          })
          setHeatmap(updated)
          setHeatmapUpdate(new Date())
        })
        .catch(err => console.error('Heatmap fetch error:', err))
    }

    fetchHeatmap()
    const interval = setInterval(fetchHeatmap, 60 * 60 * 1000) // 1 saat
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Risk Banner */}
      <RiskBanner vix={vix} />

      {/* Komuta Merkezi — sadece Pro+ */}
      {isPro && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-semibold text-finma-text">Komuta Merkezi</span>
          </div>
          <HUDMetrics data={portfolio} />
        </div>
      )}

      {/* Piyasa Bağlamı */}
      <MarketContext indices={indices} />

      {/* ═══════════════ 1. AI MARKET BRAIN ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Brain className="w-5 h-5 text-finma-purple" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            AI Market Brain
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Her 5 dk güncellenir • {timeStr}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
          {/* Piyasa Trendi */}
          <div className="bg-gradient-to-br from-finma-green/5 to-finma-green/10 rounded-lg p-4 border border-finma-green/20">
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-finma-green" />
              <span className="text-xs font-bold text-finma-text uppercase">Piyasa Trendi</span>
            </div>
            <div className="text-2xl font-bold text-finma-green mb-2">{regime}</div>
            <div className="text-xs text-finma-text-muted space-y-1">
              <div>VIX: <span className="finma-number text-finma-yellow font-semibold">{vix.toFixed(2)}</span></div>
              <div>S&P 500 {regimeData?.spy_price ? <span className="finma-number">${regimeData.spy_price}</span> : ''} <span className="text-finma-green">200 gün ort. üzerinde</span></div>
            </div>
          </div>

          {/* İtici Güçler */}
          <div className="bg-gradient-to-br from-finma-primary/5 to-finma-primary/10 rounded-lg p-4 border border-finma-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-finma-primary" />
              <span className="text-xs font-bold text-finma-text uppercase">İtici Güçler</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <div className="flex items-center gap-1.5"><span className="text-finma-green">▲</span> Enerji sektörü güçlü (+2.1%)</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-green">▲</span> Teknoloji momentum devam</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-green">▲</span> Savunma hisseleri rallisi</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-green">▲</span> Liderler: {sectorLeaders}</div>
            </div>
          </div>

          {/* Riskler */}
          <div className="bg-gradient-to-br from-finma-red/5 to-finma-red/10 rounded-lg p-4 border border-finma-red/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-finma-red" />
              <span className="text-xs font-bold text-finma-text uppercase">Riskler</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <div className="flex items-center gap-1.5"><span className="text-finma-red">▼</span> VIX {vix > 25 ? 'yüksek seviyede' : 'yükseliş eğiliminde'}</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-yellow">⚠</span> FED konuşması bekleniyor</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-yellow">⚠</span> Tahvil getirisi %4.28 baskı</div>
              <div className="flex items-center gap-1.5"><span className="text-finma-red">▼</span> Tüketici sektörü zayıf</div>
            </div>
          </div>
        </div>
      </Card>

      {/* ═══════════════ 2. GÜNÜN YAPAY ZEKA SEÇİMİ ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Flame className="w-5 h-5 text-orange-400" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Günün Fırsatları
          </span>
          <span className="text-[9px] bg-finma-yellow/10 text-finma-yellow px-2 py-0.5 rounded-full font-medium ml-2 border border-finma-yellow/20">
            Veriler 15 dk gecikmeli
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <Clock className="w-3 h-3" /> {dateStr}
          </span>
        </div>

        {top10Candidates.length === 0 ? (
          <div className="text-center py-8 text-finma-text-dim">
            <Brain className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">Bot henüz çalışmadı. Sonuçlar otomatik güncellenecek.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
            {top10Candidates.map((c: any, idx: number) => {
              const live = liveQuotes[c.ticker]
              const livePrice = live?.price
              // changePct: bot giriş fiyatından (c.price) canlı fiyata (livePrice) değişim
              // Yahoo Finance'in günlük change_pct DEĞİL — dünün kapanışı referans değil
              const changePct = (livePrice != null && c.price > 0)
                ? ((livePrice - c.price) / c.price) * 100
                : null
              return (
                <div
                  key={c.ticker}
                  onClick={() => router.push(`/stock-analysis?ticker=${c.ticker}&entry=${c.price}`)}
                  className="flex items-center gap-3 bg-finma-bg/50 rounded-md p-3 border border-finma-border/30 hover:border-finma-primary/30 transition-colors group cursor-pointer"
                >
                  <div className={cn(
                    'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    idx < 3 ? 'bg-finma-primary text-white' : 'bg-finma-bg text-finma-text-dim border border-finma-border'
                  )}>
                    {idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-finma-primary finma-number">{c.ticker}</span>
                      <ActionBadge action={c.action} />
                      <span className="text-[9px] text-finma-text-dim">{sectorLabel(c.sector)}</span>
                    </div>
                    {/* Bot alım fiyatı + canlı fiyat — aynı büyüklükte */}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="finma-number text-xs font-semibold text-finma-text-muted">
                        Alım: <span className="text-finma-text font-bold">${c.price?.toFixed(2)}</span>
                      </span>
                      {livePrice ? (
                        <>
                          <span className="text-finma-text-dim text-xs">→</span>
                          <span className="finma-number text-xs font-bold text-white">${livePrice.toFixed(2)}</span>
                          <span className={cn(
                            'finma-number text-xs font-bold',
                            (changePct ?? 0) >= 0 ? 'text-finma-green' : 'text-finma-red'
                          )}>
                            {(changePct ?? 0) >= 0 ? '+' : ''}{(changePct ?? 0).toFixed(2)}%
                          </span>
                        </>
                      ) : null}
                    </div>
                  </div>

                  <div className={cn(
                    'finma-number text-sm font-bold px-2 py-1 rounded shrink-0',
                    c.score >= 10 ? 'bg-finma-green/20 text-finma-green' :
                    c.score >= 8 ? 'bg-finma-primary/20 text-finma-primary' :
                    'bg-finma-yellow/20 text-finma-yellow'
                  )}>
                    {c.score?.toFixed(1)}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* ═══════════════ 3. PİYASA HAREKETLERİ (Profesyonel) ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <BarChart3 className="w-5 h-5 text-finma-cyan" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Piyasa Hareketleri
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> 3 dk'da bir güncellenir • {timeStr}
          </span>
        </div>

        {/* Sekmeler */}
        <div className="flex items-center gap-2 mt-3 mb-3 flex-wrap">
          <div className="flex bg-finma-bg rounded-lg p-0.5 gap-0.5">
            {([
              { key: 'gainers', label: 'Yükselenler', icon: TrendingUp, color: 'text-finma-green' },
              { key: 'losers', label: 'Düşenler', icon: TrendingDown, color: 'text-finma-red' },
              { key: 'volume', label: 'En Yüksek Hacim', icon: Volume2, color: 'text-finma-cyan' },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setMoversTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  moversTab === tab.key
                    ? 'bg-finma-card text-white shadow-sm'
                    : 'text-finma-text-dim hover:text-finma-text'
                )}
              >
                <tab.icon className={cn('w-3 h-3', moversTab === tab.key && tab.color)} />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="ml-auto flex bg-finma-bg rounded-lg p-0.5 gap-0.5">
            {(['1d', '1w', '1m', '1y'] as const).map(p => (
              <button
                key={p}
                onClick={() => setMoversPeriod(p)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[10px] font-medium transition-all finma-number',
                  moversPeriod === p
                    ? 'bg-finma-card text-white shadow-sm'
                    : 'text-finma-text-dim hover:text-finma-text'
                )}
              >
                {p === '1d' ? '1 Gün' : p === '1w' ? '1 Hafta' : p === '1m' ? '1 Ay' : '1 Yıl'}
              </button>
            ))}
          </div>
        </div>

        {/* Profesyonel Tablo */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-finma-text-dim border-b border-finma-border/30">
                <th className="text-left py-2 px-2 font-medium w-8">#</th>
                <th className="text-left py-2 px-2 font-medium">Hisse</th>
                <th className="text-left py-2 px-2 font-medium hidden md:table-cell">Sektör</th>
                <th className="text-right py-2 px-2 font-medium">Fiyat</th>
                <th className="text-right py-2 px-2 font-medium">Değişim</th>
                <th className="text-right py-2 px-2 font-medium">Hacim</th>
              </tr>
            </thead>
            <tbody>
              {liveMovers[moversTab]?.map((stock: any, idx: number) => (
                <tr key={stock.ticker} className="border-b border-finma-border/10 hover:bg-finma-card-hover transition-colors cursor-pointer">
                  <td className="py-2.5 px-2 finma-number text-finma-text-dim">{idx + 1}</td>
                  <td className="py-2.5 px-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-finma-primary finma-number">{stock.ticker}</span>
                      <span className="text-finma-text-muted text-[10px] hidden sm:inline">{stock.name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-2 hidden md:table-cell">
                    <span className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded border font-medium',
                      SECTOR_BADGE[stock.sector] || 'bg-white/5 text-finma-text-dim border-white/10'
                    )}>
                      {sectorLabel(stock.sector)}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text font-medium">${stock.price.toFixed(2)}</td>
                  <td className={cn('py-2.5 px-2 text-right finma-number font-semibold', stock.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    <div className="flex items-center justify-end gap-1">
                      {stock.change_pct >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {stock.change_pct >= 0 ? '+' : ''}{stock.change_pct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-right finma-number text-finma-text-dim">{stock.volume}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ═══════════════ 4. AKILLI PARA AKIŞI ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Building2 className="w-5 h-5 text-finma-green" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Akıllı Para Akışı
          </span>
          <span className="text-[9px] bg-finma-green/10 text-finma-green px-2 py-0.5 rounded-full border border-finma-green/20 font-medium ml-1">
            Kurumsal Yatırımcı İzleme
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <Clock className="w-3 h-3" /> {timeStr}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
          {SMART_MONEY.map((item) => (
            <div
              key={item.ticker}
              className={cn(
                'rounded-lg p-3 border transition-colors cursor-pointer',
                item.direction === 'in'
                  ? 'bg-finma-green/5 border-finma-green/20 hover:border-finma-green/50'
                  : 'bg-finma-red/5 border-finma-red/20 hover:border-finma-red/50'
              )}
            >
              <div className="flex items-start justify-between mb-1.5 gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold finma-number text-finma-primary">{item.ticker}</span>
                    <span className="text-[10px] text-finma-text-dim">{item.name}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-finma-primary/10 text-finma-primary rounded font-medium">{item.sector}</span>
                    <span className="text-[9px] px-1.5 py-0.5 bg-finma-yellow/10 text-finma-yellow rounded border border-finma-yellow/20 font-bold uppercase">{item.type}</span>
                  </div>
                  <p className="text-[11px] text-finma-text-muted mt-0.5 leading-snug">{item.signal}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className={cn('text-sm font-bold finma-number', item.direction === 'in' ? 'text-finma-green' : 'text-finma-red')}>
                    {item.flow}
                  </div>
                  <div className={cn('flex items-center justify-end gap-0.5 text-[11px] finma-number', item.direction === 'in' ? 'text-finma-green' : 'text-finma-red')}>
                    {item.direction === 'in' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {item.change}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-finma-border/20">
                <Building2 className="w-3 h-3 text-finma-text-dim shrink-0" />
                <span className="text-[10px] text-finma-text-dim truncate">{item.institution}</span>
                <span className={cn(
                  'ml-auto shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded',
                  item.confidence === 'high' ? 'bg-finma-green/15 text-finma-green' : 'bg-finma-yellow/15 text-finma-yellow'
                )}>
                  {item.confidence === 'high' ? 'YÜKSEK GÜVENİLİRLİK' : 'ORTA GÜVENİLİRLİK'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ═══════════════ 5. SEKTÖR ISI HARİTASI (maps tarzı) ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center flex-wrap gap-2 pb-3 border-b border-finma-border">
          <Globe2 className="w-5 h-5 text-finma-yellow" />
          <span className="text-sm font-bold text-finma-text uppercase tracking-wider">
            Sektör Isı Haritası
          </span>
          <span className="text-[9px] text-finma-text-dim finma-number flex items-center gap-1 ml-2">
            <RefreshCw className="w-2.5 h-2.5" />
            Saatte bir güncellenir • {heatmapUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="ml-auto flex items-center gap-1.5 text-[9px] text-finma-text-dim">
            {[
              { color: 'bg-green-600', label: '+2%' },
              { color: 'bg-green-800', label: '+0.25%' },
              { color: 'bg-gray-700',  label: '0' },
              { color: 'bg-red-900',   label: '-1%' },
              { color: 'bg-red-700',   label: '-2%' },
            ].map(({ color, label }) => (
              <span key={label} className="flex items-center gap-0.5">
                <span className={cn('w-3 h-3 rounded-sm inline-block', color)} />{label}
              </span>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto mt-3 pb-1" style={{ scrollbarWidth: 'thin' }}>
          <div className="flex gap-1.5" style={{ minWidth: 'max-content' }}>
            {heatmap.map(sector => (
              <div
                key={sector.sector}
                className="flex flex-col gap-0.5"
                style={{ width: `${Math.max(sector.size * 5, 100)}px` }}
              >
                {/* Sektör başlığı */}
                <div className={cn(
                  'rounded-t-md px-2 py-2.5 text-center cursor-pointer transition-all hover:brightness-125 select-none',
                  getHeatColor(sector.change)
                )}>
                  <div className="text-[11px] font-bold text-white leading-tight">{sector.sector}</div>
                  <div className="text-[10px] text-white/75 finma-number">{sectorETF[sector.sector]}</div>
                  <div className="text-[11px] font-bold text-white finma-number mt-0.5">
                    {sector.change >= 0 ? '+' : ''}{sector.change.toFixed(2)}%
                  </div>
                </div>

                {/* Hisse kartları */}
                <div className="flex flex-wrap gap-0.5">
                  {sector.stocks.map(stock => (
                    <div
                      key={stock.ticker}
                      className={cn(
                        'rounded-sm px-1 py-1.5 text-center cursor-pointer hover:brightness-125 transition-all select-none',
                        getHeatColor(stock.change)
                      )}
                      style={{ flex: `${stock.size} 0 0`, minWidth: '44px' }}
                    >
                      <div className="text-[10px] font-bold text-white finma-number">{stock.ticker}</div>
                      <div className="text-[9px] text-white/75 finma-number mt-0.5">
                        {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* ═══════════════ PİYASA İSTİHBARATI (Genişletilmiş) ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Brain className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa İstihbaratı
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Her 5 dk güncellenir • {timeStr}
          </span>
        </div>

        {/* Makro */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-3 h-3 text-finma-green" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Piyasa Rejimi</span>
            </div>
            <div className="text-sm font-bold text-finma-green">{regime}</div>
            <div className="text-[10px] text-finma-text-dim mt-2 space-y-0.5">
              <div>VIX: <span className="text-finma-yellow finma-number">{vix.toFixed(2)}</span> | Trend: <span className="text-finma-green">Yükseliş</span></div>
              <div>S&P 500 {regimeData?.spy_price ? <span className="finma-number">{regimeData.spy_price}</span> : '200 günlük ortalamanın'} <span className="text-finma-green">üzerinde</span></div>
              <div>Put/Call Oranı: <span className="finma-number text-finma-cyan">0.82</span> (Nötr)</div>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <AlertCircle className="w-3 h-3 text-finma-yellow" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Volatilite Durumu</span>
            </div>
            <div className="text-sm font-bold text-finma-yellow">
              {vix <= 20 ? 'Normal' : vix <= 25 ? 'Ortalama Üstü' : 'Yüksek'}
            </div>
            <div className="text-[10px] text-finma-text-dim mt-2 space-y-0.5">
              <div>VIX: <span className="finma-number text-finma-yellow">{vix.toFixed(2)}</span> (Tarihsel ort: ~19-20)</div>
              <div>Opsiyon piyasasında <span className="text-finma-yellow">artan koruma talebi</span></div>
              <div>Kısa vadeli VIX vadeli: <span className="finma-number text-finma-yellow">Contango</span></div>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Globe2 className="w-3 h-3 text-finma-cyan" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Sektör Rotasyonu</span>
            </div>
            <div className="text-sm font-bold text-finma-cyan">Defansif Döngü</div>
            <div className="text-[10px] text-finma-text-dim mt-2 space-y-0.5">
              <div>Liderler: <span className="text-finma-green">{sectorLeaders}</span></div>
              <div>Sanayi ve savunma <span className="text-finma-green">güçlü</span></div>
              <div>Teknoloji <span className="text-finma-yellow">nötr beklenti</span></div>
              <div>Tüketici İhtiyari <span className="text-finma-red">zayıf</span></div>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <DollarSign className="w-3 h-3 text-finma-green" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Para Akışı</span>
            </div>
            <div className="text-sm font-bold text-finma-green">Net Giriş</div>
            <div className="text-[10px] text-finma-text-dim mt-2 space-y-0.5">
              <div>SPY net akış: <span className="text-finma-green finma-number">+$2.1B</span> (haftalık)</div>
              <div>QQQ net akış: <span className="text-finma-red finma-number">-$450M</span></div>
              <div>Güvenli liman (GLD): <span className="text-finma-green finma-number">+$680M</span></div>
              <div>DXY (Dolar): <span className="finma-number text-finma-cyan">104.2</span> (stabil)</div>
            </div>
          </div>
        </div>

        {/* Haber & Analiz */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Newspaper className="w-3 h-3 text-finma-primary" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Günün Özeti</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <p>• Piyasalar güçlü açıldı. {sectorLeaders} sektörleri liderlik ediyor.</p>
              <p>• Savunma hisseleri rallisi devam ediyor – NOC, LMT dikkat çekici.</p>
              <p>• 10 yıllık tahvil getirisi %4.28 seviyesinde sabit.</p>
              <p>• Altın $2,950 üzerinde, güvenli liman talebi güçlü.</p>
              <p>• Kripto piyasası baskı altında, BTC $83K altına geriledi.</p>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3 text-finma-yellow" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Ekonomik Takvim</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              {[
                { time: '14:30', event: 'ABD Haftalık İşsizlik Başvuruları', hot: true },
                { time: '16:00', event: 'FED Başkanı Konuşması', hot: true },
                { time: 'Yarın', event: 'Enflasyon Verileri (CPI)', hot: false },
                { time: 'Yarın', event: 'Michigan Tüketici Güveni', hot: false },
                { time: 'Çar.', event: 'FOMC Toplantı Tutanakları', hot: false },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={cn(
                    'text-[9px] finma-number px-1.5 py-0.5 rounded',
                    item.hot ? 'text-finma-yellow bg-finma-yellow/10' : 'text-finma-text-dim bg-finma-bg'
                  )}>{item.time}</span>
                  <span>{item.event}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="w-3 h-3 text-finma-purple" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">AI Analiz Özeti</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <p>• Genel piyasa yönü <span className="text-finma-green font-medium">pozitif</span>, ancak VIX dikkat gerektiriyor.</p>
              <p>• Enerji ve savunma sektörlerinde momentum <span className="text-finma-green font-medium">güçlü</span>.</p>
              <p>• {top10Candidates[0]?.ticker ?? 'NVDA'} en yüksek skorla öne çıkıyor ({top10Candidates[0]?.score?.toFixed(1) ?? '—'}).</p>
              <p>• Kurumsal para girişi NVDA, MSFT, AMD'de yoğunlaşıyor.</p>
              <p>• Risk yönetimi: Pozisyon büyüklüklerini VIX'e göre ayarlayın.</p>
            </div>
          </div>
        </div>

        {/* Teknik Seviyeler + Öne Çıkanlar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
          {/* Teknik Seviyeler — 10 Satır */}
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-finma-primary" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Önemli Teknik Seviyeler</span>
            </div>
            <div className="text-xs space-y-0.5">
              {[
                ['S&P 500 Destek', '5,720 / 5,680', 'text-finma-green'],
                ['S&P 500 Direnç', '5,880 / 5,920', 'text-finma-red'],
                ['Nasdaq Destek', '20,100 / 19,850', 'text-finma-green'],
                ['Nasdaq Direnç', '20,500 / 20,800', 'text-finma-red'],
                ['Bitcoin Destek/Direnç', '$82.5K / $88K', 'text-finma-cyan'],
                ['Altın (Ons) Destek/Direnç', '$2,920 / $3,050', 'text-finma-yellow'],
                ['Gümüş Destek/Direnç', '$28.5 / $33.0', 'text-finma-yellow'],
                ['Ham Petrol (WTI)', '$68 / $75', 'text-finma-orange'],
                ['Doğalgaz (Gas)', '$1.85 / $2.45', 'text-finma-cyan'],
                ['DXY (Dolar Endeksi)', '103.5 / 105.5', 'text-finma-primary'],
              ].map(([label, value, color], i) => (
                <div key={i} className="flex justify-between py-0.5 border-b border-finma-border/15 last:border-0">
                  <span className="text-[11px] text-finma-text-muted">{label}</span>
                  <span className={`finma-number text-[11px] font-medium ${color}`}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bugünün Öne Çıkanları */}
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Bugünün Öne Çıkanları</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1">
              {top10Candidates.slice(0, 10).map((c: any, i: number) => {
                const live = liveQuotes[c.ticker]
                const changePct = live ? ((live.price - c.price) / c.price) * 100 : null
                return (
                  <div key={c.ticker} onClick={() => router.push(`/stock-analysis?ticker=${c.ticker}`)}
                    className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-finma-primary/5 rounded px-1 -mx-1">
                    <span className="text-[10px] w-4 text-finma-text-dim">{i+1}</span>
                    <span className="font-bold text-finma-primary finma-number text-[11px] min-w-[44px]">{c.ticker}</span>
                    <span className="flex-1 text-[10px] text-finma-text-dim truncate">{sectorLabel(c.sector)}</span>
                    {live && <span className="finma-number text-[11px] text-finma-text">${live.price.toFixed(2)}</span>}
                    {changePct !== null && (
                      <span className={cn('finma-number text-[10px] font-bold', changePct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                        {changePct >= 0 ? '+' : ''}{changePct.toFixed(1)}%
                      </span>
                    )}
                  </div>
                )
              })}
              {top10Candidates.length === 0 && (
                <div className="text-center py-4 text-finma-text-dim text-[10px]">Bot sonuçları bekleniyor...</div>
              )}
            </div>
          </div>

          {/* Bu Hafta Öne Çıkanlar */}
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Star className="w-3 h-3 text-finma-yellow" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Bu Hafta Öne Çıkanlar</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1">
              {/* Haftalık en yüksek kazanan 10 hisse */}
              {weeklyHighlights.slice(0, 10).map((s: any, i: number) => (
                <div key={s.symbol} onClick={() => router.push(`/stock-analysis?ticker=${s.symbol}`)}
                  className="flex items-center gap-2 py-0.5 cursor-pointer hover:bg-finma-primary/5 rounded px-1 -mx-1">
                  <span className="text-[10px] w-4 text-finma-text-dim">{i+1}</span>
                  <span className="font-bold text-finma-primary finma-number text-[11px] min-w-[44px]">{s.symbol}</span>
                  <span className="flex-1 text-[10px] text-finma-text-dim truncate">{s.name}</span>
                  <span className="finma-number text-[11px] text-finma-text">${s.price.toFixed(2)}</span>
                  <span className={cn('finma-number text-[10px] font-bold', s.change_pct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                    {s.change_pct >= 0 ? '+' : ''}{s.change_pct.toFixed(1)}%
                  </span>
                </div>
              ))}
              {weeklyHighlights.length === 0 && (
                <div className="text-center py-4 text-finma-text-dim text-[10px]">Yükleniyor...</div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
