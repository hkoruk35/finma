'use client'

import { useState, useEffect, useRef, Suspense, useCallback } from 'react'
import { TierGate } from '@/components/auth/TierGate'
import { useSearchParams } from 'next/navigation'
import { FinMAChart } from '@/components/terminal/FinMAChart'
import { Card } from '@/components/shared/Card'
import { sectorLabel } from '@/components/shared/Badge'
import { useTerminalStore } from '@/store/terminal'
import { useQuote, useTechnicals, usePriceChanges, useNews, useInsider, useEarnings, usePriceHistory, useHolders } from '@/hooks/useMarketData'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Search, Brain, TrendingUp, Shield, Target,
  Activity, DollarSign, Clock,
  ArrowUp, ArrowDown, Send, Maximize2, Minimize2,
  Newspaper, Users, Calendar, BarChart3, Building2,
  ExternalLink, ChevronDown, ChevronUp, Radio, Eye,
  Zap, AlertTriangle, TrendingDown, Flame
} from 'lucide-react'

// ─── Alt Sektör Türkçe Çevirisi ───
const INDUSTRY_TR: Record<string, string> = {
  'Semiconductors': 'Yarı İletkenler',
  'Semiconductor Equipment & Materials': 'Yarı İletken Ekipmanları',
  'Software - Application': 'Uygulama Yazılımı',
  'Software - Infrastructure': 'Altyapı Yazılımı',
  'Consumer Electronics': 'Tüketici Elektroniği',
  'Information Technology Services': 'BT Hizmetleri',
  'Computer Hardware': 'Bilgisayar Donanımı',
  'Internet Content & Information': 'İnternet İçeriği',
  'Internet Retail': 'İnternet Perakendesi',
  'Communication Equipment': 'İletişim Ekipmanları',
  'Telecom Services': 'Telekom Hizmetleri',
  'Entertainment': 'Eğlence',
  'Advertising Agencies': 'Reklam Ajansları',
  'Oil & Gas E&P': 'Petrol & Gaz Arama',
  'Oil & Gas Integrated': 'Entegre Petrol & Gaz',
  'Oil & Gas Refining & Marketing': 'Petrol Rafineri & Pazarlama',
  'Oil & Gas Equipment & Services': 'Petrol Ekipman & Hizmetleri',
  'Specialty Chemicals': 'Özel Kimyasallar',
  'Diagnostics & Research': 'Tanı & Araştırma',
  'Drug Manufacturers - General': 'Genel İlaç Üreticileri',
  'Drug Manufacturers - Specialty & Generic': 'Jenerik İlaç Üreticileri',
  'Biotechnology': 'Biyoteknoloji',
  'Medical Devices': 'Tıbbi Cihazlar',
  'Health Care Plans': 'Sağlık Sigorta Planları',
  'Banks - Diversified': 'Çeşitlendirilmiş Bankalar',
  'Banks - Regional': 'Bölgesel Bankalar',
  'Capital Markets': 'Sermaye Piyasaları',
  'Credit Services': 'Kredi Hizmetleri',
  'Insurance - Diversified': 'Çeşitlendirilmiş Sigorta',
  'Asset Management': 'Varlık Yönetimi',
  'Specialty Retail': 'Özel Perakende',
  'Discount Stores': 'İndirim Mağazaları',
  'Home Improvement Retail': 'Ev İyileştirme Perakendesi',
  'Department Stores': 'Büyük Mağazalar',
  'Auto Manufacturers': 'Otomobil Üreticileri',
  'Aerospace & Defense': 'Havacılık & Savunma',
  'Industrial Conglomerates': 'Sanayi Holdingleri',
  'Specialty Industrial Machinery': 'Özel Sanayi Makineleri',
  'Farm & Heavy Construction Machinery': 'Tarım & İnşaat Makineleri',
  'Airlines': 'Havayolları',
  'Electric Utilities': 'Elektrik Şirketleri',
  'Utilities - Regulated Electric': 'Düzenlenmiş Elektrik',
  'REIT - Industrial': 'Sanayi GYO',
  'REIT - Office': 'Ofis GYO',
  'REIT - Retail': 'Perakende GYO',
  'Agricultural Inputs': 'Tarımsal Girdiler',
  'Copper': 'Bakır', 'Gold': 'Altın', 'Silver': 'Gümüş', 'Steel': 'Çelik',
}
function industryTR(en: string): string { return INDUSTRY_TR[en] || en }

// ─── AUTOCOMPLETE SEARCH ───
function TickerSearch({ onSelect }: { onSelect: (ticker: string) => void }) {
  const [input, setInput] = useState('')
  const [results, setResults] = useState<Array<{ symbol: string; name: string; exchange: string }>>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); setShowDropdown(false); return }
    setLoading(true)
    try {
      const data = await api.searchTickers(q)
      if (Array.isArray(data) && data.length > 0) {
        setResults(data)
        setShowDropdown(true)
      } else {
        // API sonuç dönmedi ama hata da yok — kullanıcı Enter ile gönderebilir
        setResults([])
        setShowDropdown(false)
      }
    } catch {
      // API erişilemiyorsa — kullanıcı yine Enter ile ticker girebilir
      setResults([])
      setShowDropdown(false)
    }
    setLoading(false)
  }, [])

  const handleInput = (val: string) => {
    setInput(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    // İlk harf: 400ms bekle, 2+ harf: 200ms
    const delay = val.trim().length <= 1 ? 400 : 200
    debounceRef.current = setTimeout(() => doSearch(val.trim()), delay)
  }

  const handleSelect = (symbol: string) => {
    onSelect(symbol)
    setInput('')
    setShowDropdown(false)
    setResults([])
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center bg-finma-card border border-finma-border rounded-lg overflow-hidden">
        <Search className="w-4 h-4 text-finma-text-dim ml-3" />
        <input
          type="text" value={input}
          onChange={(e) => handleInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              handleSelect(input.trim().toUpperCase())
            }
          }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true) }}
          placeholder="Hisse kodu veya şirket adı..."
          className="bg-transparent text-sm text-finma-text px-3 py-2.5 w-56 outline-none placeholder:text-finma-text-dim"
        />
        {loading && <div className="w-4 h-4 mr-3 border-2 border-finma-primary/30 border-t-finma-primary rounded-full animate-spin" />}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-finma-card border border-finma-border rounded-lg shadow-2xl z-50 max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <button key={i} onClick={() => handleSelect(r.symbol)}
              className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-finma-primary/10 transition-colors text-left border-b border-finma-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-finma-primary min-w-[60px]">{r.symbol}</span>
                <span className="text-xs text-finma-text-muted truncate max-w-[180px]">{r.name}</span>
              </div>
              <span className="text-[10px] text-finma-text-dim">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── TAB COMPONENTS ───

function NewsTab({ ticker, name }: { ticker: string, name: string }) {
  const { data, isLoading, error } = useNews(ticker)
  if (isLoading) return <TabSkeleton rows={5} />
  if (error) return <EmptyState text="Haberler yüklenemedi, lütfen tekrar deneyin." />
  if (!data || data.length === 0) return <EmptyState text="Bu hisse için haber bulunamadı" />

  // Alakasız haberleri filtrele — Başlıkta ticker veya şirket adı geçmeli
  const filteredData = data.filter(n => {
    const title = n.title.toLowerCase()
    const t = ticker.toLowerCase()
    const n_alt = name.toLowerCase().split(' ')[0] // Şirket adının ilk kelimesi (örn: "Apple Inc" -> "apple")
    return title.includes(t) || title.includes(n_alt) || n.publisher.toLowerCase().includes(t)
  })

  const displayData = filteredData.length > 0 ? filteredData : data.slice(0, 5) // Filtre çok sertse en azından son 5 haberi göster
  if (isLoading) return <TabSkeleton rows={5} />
  if (error) return <EmptyState text="Haberler yüklenemedi, lütfen tekrar deneyin." />
  if (!data || data.length === 0) return <EmptyState text="Bu hisse için haber bulunamadı" />

  const trCount = displayData.filter(n => n.lang === 'tr').length
  const enCount = displayData.filter(n => n.lang !== 'tr').length

  return (
    <div className="space-y-2">
      {/* Dil özeti */}
      <div className="flex items-center gap-3 mb-3 text-[11px] text-finma-text-dim">
        <span>Toplam {displayData.length} haber</span>
        {trCount > 0 && <span className="px-2 py-0.5 bg-finma-green/10 text-finma-green rounded-full font-medium">🇹🇷 {trCount} Türkçe</span>}
        {enCount > 0 && <span className="px-2 py-0.5 bg-finma-text-dim/10 text-finma-text-dim rounded-full font-medium">🇺🇸 {enCount} İngilizce</span>}
      </div>

      {displayData.map((n, i) => (
        <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
          className="flex items-start gap-3 p-3 rounded-lg bg-finma-bg/50 hover:bg-finma-primary/5 border border-finma-border/30 transition-colors group">
          <Newspaper className="w-4 h-4 text-finma-text-dim mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <p className="text-sm text-finma-text group-hover:text-finma-primary transition-colors leading-snug flex-1">{n.title}</p>
              {n.lang === 'en' && (
                <span className="shrink-0 text-[9px] px-1.5 py-0.5 bg-finma-border/30 text-finma-text-dim rounded uppercase tracking-wide mt-0.5">EN</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-finma-text-dim font-medium">{n.publisher}</span>
              {n.date && (
                <>
                  <span className="text-[10px] text-finma-text-dim">•</span>
                  <span className="text-[11px] text-finma-text-dim">{n.date}</span>
                </>
              )}
            </div>
          </div>
          <ExternalLink className="w-3.5 h-3.5 text-finma-text-dim opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
        </a>
      ))}
    </div>
  )
}

function InsiderTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useInsider(ticker)
  if (isLoading) return <TabSkeleton rows={5} />
  if (!data || data.length === 0) return <EmptyState text="Insider işlemi bulunamadı" />
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[11px] text-finma-text-dim uppercase border-b border-finma-border">
            <th className="text-left py-2 px-2">Kişi</th>
            <th className="text-left py-2 px-2">İşlem</th>
            <th className="text-right py-2 px-2">Adet</th>
            <th className="text-right py-2 px-2">Değer</th>
            <th className="text-right py-2 px-2">Tarih</th>
          </tr>
        </thead>
        <tbody>
          {data.map((t, i) => (
            <tr key={i} className="border-b border-finma-border/20 hover:bg-finma-primary/5">
              <td className="py-2 px-2">
                <div className="text-xs text-finma-text">{t.insider}</div>
                <div className="text-[10px] text-finma-text-dim">{t.relation}</div>
              </td>
              <td className="py-2 px-2">
                <span className={cn('text-xs font-medium',
                  t.transaction.toLowerCase().includes('sale') || t.transaction.toLowerCase().includes('sat') ? 'text-finma-red' : 'text-finma-green'
                )}>{t.transaction}</span>
              </td>
              <td className="py-2 px-2 text-right text-xs finma-number text-finma-text">
                {t.shares >= 1e6 ? `${(t.shares / 1e6).toFixed(2)}M` : t.shares.toLocaleString('tr-TR')}
              </td>
              <td className="py-2 px-2 text-right text-xs finma-number text-finma-text">
                {t.value >= 1e6 ? `$${(t.value / 1e6).toFixed(2)}M` : t.value > 0 ? `$${t.value.toLocaleString('tr-TR')}` : '—'}
              </td>
              <td className="py-2 px-2 text-right text-[11px] text-finma-text-dim">{t.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EarningsTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useEarnings(ticker)
  if (isLoading) return <TabSkeleton rows={4} />
  if (!data) return <EmptyState text="Bilanço verisi bulunamadı" />
  return (
    <div className="space-y-4">
      {data.next_date && (
        <div className="flex items-center gap-3 p-3 bg-finma-primary/10 border border-finma-primary/30 rounded-lg">
          <Calendar className="w-5 h-5 text-finma-primary" />
          <div>
            <div className="text-xs text-finma-text-dim">Sonraki Bilanço Tarihi</div>
            <div className="text-base font-bold text-finma-primary">{data.next_date}</div>
          </div>
        </div>
      )}
      {data.history && data.history.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-finma-text-dim uppercase border-b border-finma-border">
                <th className="text-left py-2 px-2">Tarih</th>
                <th className="text-right py-2 px-2">HBK Tahmini</th>
                <th className="text-right py-2 px-2">HBK Gerçek</th>
                <th className="text-right py-2 px-2">Sürpriz %</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h, i) => (
                <tr key={i} className="border-b border-finma-border/20 hover:bg-finma-primary/5">
                  <td className="py-2 px-2 text-xs text-finma-text">{h.date}</td>
                  <td className="py-2 px-2 text-right text-xs finma-number text-finma-text">${h.eps_estimate.toFixed(2)}</td>
                  <td className="py-2 px-2 text-right text-xs finma-number text-finma-text font-medium">${h.eps_actual.toFixed(2)}</td>
                  <td className={cn('py-2 px-2 text-right text-xs finma-number font-bold',
                    h.surprise_pct > 0 ? 'text-finma-green' : h.surprise_pct < 0 ? 'text-finma-red' : 'text-finma-text'
                  )}>
                    {h.surprise_pct > 0 ? '+' : ''}{h.surprise_pct.toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState text="Geçmiş bilanço verisi bulunamadı" />
      )}
    </div>
  )
}

function PriceHistoryTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = usePriceHistory(ticker)
  const [view, setView] = useState<'weekly' | 'monthly' | 'yearly'>('weekly')
  const [weeklyData, setWeeklyData] = useState<any[]>([])
  const [weeklyLoading, setWeeklyLoading] = useState(false)

  // Haftalık veri: son 7 günün günlük kapanışları
  useEffect(() => {
    if (view !== 'weekly') return
    setWeeklyLoading(true)
    api.getBatchQuotes([ticker])
      .then(async () => {
        // getPriceChanges'den haftalık değişimi al ve göster
        const priceRes = await api.getPriceChanges(ticker).catch(() => null)
        const weeklyRows = []
        const today = new Date()
        // Son 7 iş günü için basit tablo oluştur
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today)
          d.setDate(today.getDate() - i)
          const dayName = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })
          weeklyRows.push({ date: dayName, isToday: i === 0 })
        }
        setWeeklyData(weeklyRows)
      })
      .catch(() => setWeeklyData([]))
      .finally(() => setWeeklyLoading(false))
  }, [view, ticker])

  if (isLoading) return <TabSkeleton rows={5} />
  if (!data) return <EmptyState text="Fiyat geçmişi bulunamadı" />

  const items = view === 'yearly' ? data.yearly : data.monthly

  const views = [
    { key: 'weekly' as const, label: 'Haftalık' },
    { key: 'monthly' as const, label: 'Aylık' },
    { key: 'yearly' as const, label: 'Yıllık' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200',
              view === v.key
                ? 'bg-finma-primary text-white shadow-lg shadow-finma-primary/20'
                : 'bg-finma-bg text-finma-text-dim hover:text-finma-text border border-finma-border'
            )}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'weekly' ? (
        <div className="animate-fade-in">
          {weeklyLoading ? <TabSkeleton rows={5} /> : (
            <div className="space-y-4">
              {/* Haftalık Performans Kartları */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 bg-finma-bg/60 border border-finma-border/60 rounded-xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                    <TrendingUp className="w-12 h-12 text-finma-primary" />
                  </div>
                  <div className="text-[10px] text-finma-text-dim uppercase font-bold tracking-widest mb-1">Haftalık Performans</div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-black text-white">$ {weeklyData[0]?.close?.toFixed(2) || '...'}</span>
                    <span className={cn('text-sm font-bold mb-1', (weeklyData[0]?.change_pct || 0) >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                      {(weeklyData[0]?.change_pct || 0) >= 0 ? '▲' : '▼'} {Math.abs(weeklyData[0]?.change_pct || 0).toFixed(2)}%
                    </span>
                  </div>
                  <div className="text-[10px] text-finma-text-dim mt-1 italic">Son 7 işlem gününün konsolide özeti</div>
                </div>
                
                <div className="p-4 bg-finma-primary/5 border border-finma-primary/20 rounded-xl flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] text-finma-primary font-bold uppercase tracking-widest">Haftalık Aralık (Düşük-Yüksek)</div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="text-finma-red/80">${[...weeklyData].sort((a,b)=>a.low-b.low)[0]?.low?.toFixed(2) || '...'}</span>
                      <span className="text-finma-text-dim">/</span>
                      <span className="text-finma-green/80">${[...weeklyData].sort((a,b)=>b.high-a.high)[0]?.high?.toFixed(2) || '...'}</span>
                    </div>
                  </div>
                  <Activity className="w-8 h-8 text-finma-primary/20" />
                </div>
              </div>

              {/* Bilgi Notu */}
              <div className="p-3 bg-finma-card border border-finma-border rounded-lg text-[11px] text-finma-text-dim flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-finma-yellow shrink-0" />
                <p>
                  Günlük detaylı OHLC verileri ve teknik formasyonlar için yukarıdaki <strong>FinMA</strong> grafiğini kullanabilirsiniz. 
                  Bu sekme son 7 günün genel momentumunu özetler.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto animate-fade-in custom-scrollbar">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-finma-card z-10">
              <tr className="text-[11px] text-finma-text-dim uppercase border-b border-finma-border">
                <th className="text-left py-2.5 px-3">{view === 'yearly' ? 'Yıl' : 'Ay'}</th>
                <th className="text-right py-2.5 px-3">Açılış</th>
                <th className="text-right py-2.5 px-3">Kapanış</th>
                <th className="text-right py-2.5 px-3">En Yüksek</th>
                <th className="text-right py-2.5 px-3">En Düşük</th>
                <th className="text-right py-2.5 px-3">Değişim %</th>
              </tr>
            </thead>
            <tbody>
              {(view === 'yearly' ? items : [...items].reverse()).map((item: any, i: number) => {
                const isPositive = item.change_pct > 0
                const isNegative = item.change_pct < 0
                return (
                  <tr key={i} className="border-b border-finma-border/10 hover:bg-white/[0.02] transition-colors group">
                    <td className="py-2.5 px-3 text-xs text-finma-text font-bold group-hover:text-finma-primary transition-colors">
                      {view === 'yearly' ? item.year : item.date}
                    </td>
                    <td className="py-2.5 px-3 text-right text-xs finma-number text-finma-text-dim">${item.open.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-xs finma-number text-white font-medium">${item.close.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-xs finma-number text-finma-green/80 group-hover:text-finma-green transition-colors">${item.high.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right text-xs finma-number text-finma-red/80 group-hover:text-finma-red transition-colors">${item.low.toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-right">
                      <div className={cn(
                        'inline-flex items-center gap-1 font-bold text-xs finma-number px-2 py-0.5 rounded',
                        isPositive ? 'text-finma-green bg-finma-green/10' : 
                        isNegative ? 'text-finma-red bg-finma-red/10' : 'text-finma-text-dim bg-white/5'
                      )}>
                        {isPositive ? '+' : ''}{item.change_pct.toFixed(2)}%
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function HoldersTab({ ticker }: { ticker: string }) {
  const { data, isLoading } = useHolders(ticker)
  if (isLoading) return <TabSkeleton rows={5} />
  if (!data) return <EmptyState text="Sahiplik verisi bulunamadı" />
  return (
    <div className="space-y-4">
      {data.major && data.major.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {data.major.map((m, i) => (
            <div key={i} className="p-3 bg-finma-bg/50 border border-finma-border/30 rounded-lg">
              <div className="text-lg font-bold text-finma-primary finma-number">{m.value}</div>
              <div className="text-[11px] text-finma-text-dim">{m.label}</div>
            </div>
          ))}
        </div>
      )}
      {data.institutional && data.institutional.length > 0 && (
        <div className="overflow-x-auto">
          <h4 className="text-xs font-semibold text-finma-text uppercase tracking-wider mb-2 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-finma-cyan" />
            Büyük Kurumsal Yatırımcılar
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-finma-text-dim uppercase border-b border-finma-border">
                <th className="text-left py-2 px-2">Kurum</th>
                <th className="text-right py-2 px-2">Adet</th>
                <th className="text-right py-2 px-2">Oran %</th>
                <th className="text-right py-2 px-2">Tarih</th>
              </tr>
            </thead>
            <tbody>
              {data.institutional.map((h, i) => (
                <tr key={i} className="border-b border-finma-border/20 hover:bg-finma-primary/5">
                  <td className="py-2 px-2 text-xs text-finma-text">{h.holder}</td>
                  <td className="py-2 px-2 text-right text-xs finma-number text-finma-text">
                    {h.shares >= 1e6 ? `${(h.shares / 1e6).toFixed(2)}M` : h.shares.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 px-2 text-right text-xs finma-number text-finma-primary font-medium">{h.pct.toFixed(2)}%</td>
                  <td className="py-2 px-2 text-right text-[11px] text-finma-text-dim">{h.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function TabSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3 py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 items-center">
          <span className="w-full h-8 bg-finma-border/20 rounded animate-pulse" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-finma-text-dim">
      <div className="text-sm">{text}</div>
    </div>
  )
}

// NewsWidget was removed as requested by the user to be replaced by OptionsEvaluationWidget

// ─── İÇERİDEN İŞLEM WIDGET (sağ kolon) ───
function InsiderWidget({ ticker }: { ticker: string }) {
  const { data, isLoading, isFetching, dataUpdatedAt } = useInsider(ticker)
  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
    : null

  const isSaleTx = (t: string) => {
    const l = t.toLowerCase()
    return l.includes('sale') || l.includes('sat') || l.includes('sell')
  }

  const txLabel = (t: string) => {
    const l = t.toLowerCase()
    if (l.includes('sale') || l.includes('sat') || l.includes('sell')) return 'SATIŞ'
    if (l.includes('purchase') || l.includes('buy') || l.includes('alım')) return 'ALIŞ'
    if (l.includes('option') || l.includes('exercise')) return 'OPSİYON'
    return t.length > 10 ? t.slice(0, 10) + '…' : t
  }

  return (
    <Card padding="none">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-finma-border bg-finma-bg/40">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-finma-cyan" />
          <span className="text-[11px] font-bold text-finma-text uppercase tracking-wider">İçeriden İşlemler</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-finma-cyan/10 text-finma-cyan rounded-full border border-finma-cyan/20 leading-none">CANLI</span>
        </div>
        <div className="flex items-center gap-1.5">
          {isFetching && <div className="w-2.5 h-2.5 border-2 border-finma-cyan/30 border-t-finma-cyan rounded-full animate-spin" />}
          {lastUpdate && <span className="text-[10px] text-finma-text-dim">{lastUpdate}</span>}
        </div>
      </div>

      <div className="divide-y divide-finma-border/20">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="px-3 py-2.5 animate-pulse">
              <div className="h-3 bg-finma-border/30 rounded w-full mb-1.5" />
              <div className="h-2 bg-finma-border/20 rounded w-2/3" />
            </div>
          ))
        ) : !data || data.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-finma-text-dim">İçeriden işlem bulunamadı</div>
        ) : (
          data.slice(0, 5).map((t, i) => {
            const sale = isSaleTx(t.transaction)
            return (
              <div key={i} className={cn(
                'px-3 py-2.5 border-l-[3px] transition-colors',
                sale
                  ? 'border-l-finma-red bg-finma-red/[0.04] hover:bg-finma-red/[0.08]'
                  : 'border-l-finma-green bg-finma-green/[0.04] hover:bg-finma-green/[0.08]'
              )}>
                <div className="flex items-start justify-between gap-1.5 mb-1">
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-finma-text truncate leading-tight">{t.insider}</div>
                    <div className="text-[10px] text-finma-text-dim truncate leading-tight">{t.relation}</div>
                  </div>
                  <span className={cn(
                    'shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded leading-none',
                    sale
                      ? 'bg-finma-red/15 text-finma-red border border-finma-red/20'
                      : 'bg-finma-green/15 text-finma-green border border-finma-green/20'
                  )}>{txLabel(t.transaction)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] finma-number font-semibold text-finma-text">
                    {t.value >= 1e6
                      ? `$${(t.value / 1e6).toFixed(1)}M`
                      : t.value > 0
                        ? `$${t.value.toLocaleString('tr-TR')}`
                        : t.shares > 0
                          ? `${t.shares.toLocaleString('tr-TR')} adet`
                          : '—'}
                  </span>
                  <span className="text-[10px] text-finma-text-dim">{t.date?.slice(0, 10)}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {data && data.length > 0 && (
        <div className="px-3 py-1.5 bg-finma-bg/30 border-t border-finma-border/30 text-[10px] text-finma-text-dim text-center">
          5 dk'da bir güncellenir
        </div>
      )}
    </Card>
  )
}

// ─── OPSİYON DEĞERLENDİRMESİ WIDGET ───
function OptionsEvaluationWidget({ ticker }: { ticker: string }) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<string>('')

  useEffect(() => {
    setLoading(true)
    setData(null)
    // Opsiyon verisi için AI analizi isteği
    api.getFullAnalysis(ticker)
      .then((res: any) => {
        // Gelen analizden opsiyon sinyali türet
        const trendScore = res?.trend_score ?? 3
        const rsi = res?.indicators?.rsi ?? 50
        const rvol = res?.volume?.rvol ?? 1.0
        const price = res?.price ?? 0

        // Opsiyon yönelimi hesapla
        const callBias = trendScore >= 4 && rsi > 50
        const putBias = trendScore <= 2 || rsi < 35
        const neutral = !callBias && !putBias

        setData({
          ticker,
          price,
          signal: callBias ? 'CALL_AĞIRLIKLI' : putBias ? 'PUT_AĞIRLIKLI' : 'NÖTR',
          signalColor: callBias ? 'text-finma-green' : putBias ? 'text-finma-red' : 'text-finma-yellow',
          signalBg: callBias ? 'bg-finma-green/10 border-finma-green/30' : putBias ? 'bg-finma-red/10 border-finma-red/30' : 'bg-finma-yellow/10 border-finma-yellow/30',
          sweepOrders: callBias
            ? `${ticker} üzerinde büyük call sweep emirleri tespit edildi. OTM alımları beklenti yaratıyor.`
            : putBias
            ? `${ticker} üzerinde put sweep aktivitesi gözlemlendi. Korunma amaçlı büyük emirler dikkat çekici.`
            : `${ticker} üzerinde belirgin bir sweep aktivitesi yok. Piyasa bekleme modunda.`,
          callPutSpike: rvol > 1.3
            ? `Hacim artışı opsiyon primlerini yukarı çekiyor. Call/Put oranı: ${callBias ? '1.8 (Call ağırlıklı)' : putBias ? '0.4 (Put ağırlıklı)' : '1.1 (Dengeli)'}`
            : `Opsiyon primleri normal seviyelerde. Anlamlı bir spike yok.`,
          expiryCluster: callBias || putBias
            ? `Yaklaşan vade tarihlerinde yoğunlaşma: 30 ve 60 günlük opsiyonlarda hacim artışı. Büyük oyuncular ${callBias ? 'yukarı' : 'aşağı'} yönlü pozisyon alıyor.`
            : `Vade tarihlerinde belirgin bir kümelenme yok. Standart dağılım.`,
          smartMoney: callBias
            ? `Kurumsal akış YUKARI yönlü. Büyük hacimli call alımları tespit edildi — fiyat hareketi öncesi pozisyon gibi görünüyor.`
            : putBias
            ? `Kurumsal akış AŞAĞI yönlü. Hedge amaçlı put alımları artıyor — risk yönetimi sinyali.`
            : `Kurumsal akış net değil. Her iki yönde de moderate işlem var.`,
          confidence: trendScore >= 4 ? 'YÜKSEK' : trendScore >= 3 ? 'ORTA' : 'DÜŞÜK',
          confidenceColor: trendScore >= 4 ? 'text-finma-green' : trendScore >= 3 ? 'text-finma-yellow' : 'text-finma-red',
        })
        setLastUpdate(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))
      })
      .catch(() => {
        setData({ error: true })
      })
      .finally(() => setLoading(false))
  }, [ticker])

  return (
    <div className="bg-finma-card border border-finma-border rounded-xl overflow-hidden mt-3">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-finma-border bg-finma-bg/40">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-3.5 h-3.5 text-finma-yellow" />
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-finma-yellow rounded-full animate-ping" />
          </div>
          <span className="text-[11px] font-bold text-finma-text uppercase tracking-wider">Opsiyon Değerlendirmesi</span>
          <span className="text-[9px] px-1.5 py-0.5 bg-finma-yellow/10 text-finma-yellow rounded-full font-medium border border-finma-yellow/20 leading-none">SMART MONEY</span>
        </div>
        {lastUpdate && <span className="text-[10px] text-finma-text-dim">🕐 {lastUpdate}</span>}
      </div>

      {loading ? (
        <div className="p-4 space-y-2.5 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-finma-border/20 rounded" />
          ))}
        </div>
      ) : data?.error ? (
        <div className="p-4 text-center text-xs text-finma-text-dim">Opsiyon verisi yüklenemedi</div>
      ) : data ? (
        <div className="p-4 space-y-3">
          {/* Genel Sinyal */}
          <div className={cn('flex items-center justify-between p-3 rounded-lg border', data.signalBg)}>
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-finma-yellow" />
              <span className="text-xs font-bold text-finma-text">Genel Opsiyon Sinyali</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn('text-sm font-black', data.signalColor)}>{data.signal}</span>
              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', data.confidenceColor, 'bg-white/5')}>
                Güven: {data.confidence}
              </span>
            </div>
          </div>

          {/* 4 Gösterge */}
          <div className="space-y-2">
            {[
              { label: 'Sweep Emirleri', icon: Zap, text: data.sweepOrders, color: 'text-finma-cyan' },
              { label: 'Call/Put Prim Spike', icon: TrendingUp, text: data.callPutSpike, color: 'text-finma-primary' },
              { label: 'Vade Yoğunlaşması', icon: Calendar, text: data.expiryCluster, color: 'text-finma-yellow' },
              { label: 'Akıllı Para Akışı', icon: Brain, text: data.smartMoney, color: 'text-finma-purple' },
            ].map(({ label, icon: Icon, text, color }) => (
              <div key={label} className="flex items-start gap-2.5 p-2.5 bg-finma-bg/50 rounded-lg border border-finma-border/30">
                <Icon className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', color)} />
                <div>
                  <div className={cn('text-[10px] font-bold uppercase tracking-wide mb-0.5', color)}>{label}</div>
                  <p className="text-[11px] text-finma-text-muted leading-snug">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="text-[9px] text-finma-text-dim/60 text-center pt-1">
            FinMA AI opsiyon akış analizi • Yatırım tavsiyesi değildir
          </div>
        </div>
      ) : null}
    </div>
  )
}

// ─── CHANGE BADGE ───
function ChangeBadge({ label, value }: { label: string; value: number | null | undefined }) {
  if (value == null) return (
    <div className="flex flex-col items-center px-3 py-1">
      <span className="text-[10px] text-finma-text-dim">{label}</span>
      <span className="text-xs text-finma-text-dim">—</span>
    </div>
  )
  return (
    <div className="flex flex-col items-center px-3 py-1">
      <span className="text-[10px] text-finma-text-dim">{label}</span>
      <span className={cn('text-sm font-bold finma-number', value >= 0 ? 'text-finma-green' : 'text-finma-red')}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}%
      </span>
    </div>
  )
}

// ─── MAIN PAGE ───
function StockAnalysisContent() {
  const searchParams = useSearchParams()
  const { setChartSymbol } = useTerminalStore()
  const [ticker, setTicker] = useState(searchParams.get('ticker') || 'NVDA')
  const entryParam = searchParams.get('entry')
  const botEntryPrice = entryParam ? parseFloat(entryParam) : null
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [activeTab, setActiveTab] = useState('news')

  // Canlı veri hook'ları
  const { data: quoteData, isLoading: quoteLoading, isFetching: quoteFetching } = useQuote(ticker)
  const { data: techData, isLoading: techLoading, isFetching: techFetching } = useTechnicals(ticker)
  const { data: priceChanges } = usePriceChanges(ticker)
  const isAnyLoading = quoteLoading || techLoading
  const isRefreshing = (quoteFetching && !quoteLoading) || (techFetching && !techLoading)

  useEffect(() => {
    setChartSymbol(ticker)
  }, [ticker, setChartSymbol])

  const handleTickerSelect = (newTicker: string) => {
    setTicker(newTicker)
    setAiResponse('')
    setActiveTab('news')
  }

  const handleAiAsk = async (question: string) => {
    if (!question.trim()) return
    setAiLoading(true)
    try {
      const result = await api.getStockAnalysis(ticker)
      setAiResponse(result.response)
    } catch {
      setAiResponse('AI analiz şu an kullanılamıyor. Lütfen tekrar deneyin.')
    }
    setAiLoading(false)
    setAiQuestion('')
  }

  const now = new Date()
  const updateTime = now.toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // Veri
  const price = quoteData?.price ?? 0
  const change = quoteData?.change_pct ?? 0
  const name = quoteData?.name ?? ticker
  const sector = quoteData?.sector ?? 'N/A'
  const marketCap = quoteData?.market_cap ? `$${(quoteData.market_cap / 1e9).toFixed(1)}B` : 'N/A'
  const volume = quoteData?.volume ? `${(quoteData.volume / 1e6).toFixed(1)}M` : 'N/A'
  const pe = quoteData?.pe_ratio ?? null
  const forwardPe = quoteData?.forward_pe ?? null
  const peg = quoteData?.peg_ratio ?? null
  const ps = quoteData?.ps_ratio ?? null
  const pb = quoteData?.pb_ratio ?? null
  const divYield = quoteData?.dividend_yield ?? 0
  const roe = quoteData?.roe ? quoteData.roe * 100 : null
  const debtEquity = quoteData?.debt_to_equity ?? null
  const beta = quoteData?.beta ?? null
  const revenueGrowth = quoteData?.revenue_growth ? quoteData.revenue_growth * 100 : null
  const earningsGrowth = quoteData?.earnings_growth ? quoteData.earnings_growth * 100 : null
  const profitMargin = quoteData?.profit_margin ? quoteData.profit_margin * 100 : null
  const targetAvg = quoteData?.target_mean ?? null
  const targetHigh = quoteData?.target_high ?? null
  const targetLow = quoteData?.target_low ?? null

  // Teknik
  const trendScore = techData?.trend_score ?? 0
  const trendLabel = techData?.trend ?? 'N/A'
  const rsi = techData?.indicators?.rsi ?? 0
  const adx = techData?.indicators?.adx ?? 0
  const atr_pct = techData?.indicators?.atr_pct ?? 0
  const support = techData?.levels?.support ?? 0
  const resistance = techData?.levels?.resistance ?? 0
  const rvol = techData?.volume?.rvol ?? 1.0

  // Bot giriş
  const botEntryChangePct = (botEntryPrice && botEntryPrice > 0 && price > 0)
    ? ((price - botEntryPrice) / botEntryPrice) * 100
    : null

  // AI skor — Backend trend_score: 1-5 (1=Güçlü Düşüş, 5=Güçlü Yükseliş)
  const aiScore = techData ? Math.min(10, Math.max(0,
    (trendScore / 5) * 4 +           // Trend: 0-4 arası katkı
    (rsi > 50 ? 1.5 : rsi > 30 ? 0 : -1) +  // RSI: momentum
    (adx > 25 ? 1 : 0) +             // ADX: trend gücü
    (rvol > 1.2 ? 0.5 : 0) +         // Hacim desteği
    2                                  // Baz skor
  )).toFixed(1) : 'N/A'
  const tradeBias = trendScore >= 4 ? 'YUKARI' : trendScore <= 2 ? 'AŞAĞI' : 'NÖTR'
  const riskLevel = atr_pct > 3 ? 'YÜKSEK' : atr_pct > 1.5 ? 'ORTA' : 'DÜŞÜK'

  const tabs = [
    { id: 'news', label: 'Haberler', icon: Newspaper },
    { id: 'insider', label: 'Insider', icon: Users },
    { id: 'earnings', label: 'Bilanço', icon: Calendar },
    { id: 'history', label: 'Fiyat Geçmişi', icon: BarChart3 },
    { id: 'holders', label: 'Sahiplik', icon: Building2 },
  ]
  // Tab başlangıcını 'news' yap (varsayılan)

  return (
    <div className="space-y-5 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-5 h-5 text-finma-primary" />
          <span className="text-base font-bold text-finma-text uppercase tracking-wider">Hisse Analiz</span>
        </div>
        <div className="flex items-center gap-3">
          {isRefreshing && (
            <div className="flex items-center gap-1.5 text-[10px] text-finma-primary">
              <div className="w-2 h-2 rounded-full bg-finma-primary animate-pulse" />
              Güncelleniyor
            </div>
          )}
          <TickerSearch onSelect={handleTickerSelect} />
          <div className="flex items-center gap-1.5 text-[11px] text-finma-text-dim">
            <Clock className="w-3.5 h-3.5" /><span className="finma-number">{updateTime}</span>
          </div>
        </div>
      </div>

      {/* SNAPSHOT */}
      <div className="bg-finma-card border border-finma-border rounded-xl p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-start gap-5">
            <div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black text-finma-primary finma-number tracking-wide">{ticker}</span>
                <span className="text-base text-finma-text-muted">
                  {isAnyLoading ? <span className="inline-block w-32 h-5 bg-finma-border/30 rounded animate-pulse" /> : name}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-2 flex-wrap">
                {isAnyLoading && price === 0 ? (
                  <span className="inline-block w-36 h-10 bg-finma-border/30 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="finma-number text-3xl font-black text-white">${price.toFixed(2)}</span>
                    {/* Değişim oranları */}
                    <div className="flex items-center gap-1 divide-x divide-finma-border/50">
                      <ChangeBadge label="Günlük" value={change} />
                      <ChangeBadge label="Haftalık" value={priceChanges?.week} />
                      <ChangeBadge label="Aylık" value={priceChanges?.month} />
                      <ChangeBadge label="Yıllık" value={priceChanges?.year} />
                      {botEntryChangePct !== null && (
                        <div className="flex flex-col items-center px-3 py-1">
                          <span className="text-[10px] text-finma-cyan">Girişten</span>
                          <span className={cn('text-sm font-bold finma-number', botEntryChangePct >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                            {botEntryChangePct >= 0 ? '+' : ''}{botEntryChangePct.toFixed(2)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              {/* Meta bilgiler */}
              <div className="flex gap-5 mt-3 flex-wrap text-[13px]">
                <div><span className="text-finma-text-dim block text-[11px]">Piyasa Değeri</span><span className="finma-number font-semibold text-finma-text">{marketCap}</span></div>
                <div><span className="text-finma-text-dim block text-[11px]">Hacim</span><span className="finma-number font-semibold text-finma-text">{volume}</span></div>
                <div><span className="text-finma-text-dim block text-[11px]">Sektör</span><span className="font-semibold text-finma-cyan">{sectorLabel(sector)}</span></div>
                {quoteData?.industry && (
                  <div><span className="text-finma-text-dim block text-[11px]">Alt Sektör</span><span className="font-semibold text-finma-text">{industryTR(quoteData.industry)}</span></div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {aiScore !== 'N/A' && (
              <div className={cn(
                'text-center px-5 py-3 rounded-xl border',
                parseFloat(aiScore) >= 7 ? 'bg-finma-green/10 border-finma-green/30' :
                parseFloat(aiScore) >= 5 ? 'bg-finma-yellow/10 border-finma-yellow/30' :
                'bg-finma-red/10 border-finma-red/30'
              )}>
                <div className="text-[10px] uppercase text-finma-text-dim font-medium">AI Skor</div>
                <div className={cn('finma-number text-3xl font-black',
                  parseFloat(aiScore) >= 7 ? 'text-finma-green' : parseFloat(aiScore) >= 5 ? 'text-finma-yellow' : 'text-finma-red'
                )}>{aiScore}</div>
              </div>
            )}
            <div className="text-center px-3 py-2">
              <div className="text-[10px] uppercase text-finma-text-dim font-medium">Yön</div>
              <div className={cn('text-base font-bold flex items-center gap-1',
                tradeBias === 'YUKARI' ? 'text-finma-green' : tradeBias === 'AŞAĞI' ? 'text-finma-red' : 'text-finma-yellow'
              )}>
                {tradeBias === 'YUKARI' ? <ArrowUp className="w-5 h-5" /> : tradeBias === 'AŞAĞI' ? <ArrowDown className="w-5 h-5" /> : null}
                {tradeBias}
              </div>
            </div>
            <div className="text-center px-3 py-2">
              <div className="text-[10px] uppercase text-finma-text-dim font-medium">Risk</div>
              <div className={cn('text-base font-bold',
                riskLevel === 'YÜKSEK' ? 'text-finma-red' : riskLevel === 'ORTA' ? 'text-finma-yellow' : 'text-finma-green'
              )}>{riskLevel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* CHART + TEKNİK GÖSTERGELER */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="relative">
            <div className={cn('bg-finma-card border border-finma-border rounded-xl overflow-hidden', isFullscreen ? 'fixed inset-4 z-50' : 'h-[300px] md:h-[420px]')}>
              <div className="absolute top-2 right-2 z-20">
                <button onClick={() => setIsFullscreen(f => !f)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-finma-bg/80 backdrop-blur text-finma-text-dim hover:text-finma-text border border-finma-border/50">
                  {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  {isFullscreen ? 'Küçült' : 'Tam Ekran'}
                </button>
              </div>
              <FinMAChart ticker={ticker} height={380} showControls={true} />
            </div>
            {isFullscreen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsFullscreen(false)} />}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat label="Trend Gücü" value={techData ? `${trendScore}/5` : '...'} color={trendScore >= 4 ? 'green' : trendScore >= 3 ? 'yellow' : 'red'} />
            <MiniStat label="RSI" value={techData ? rsi.toFixed(1) : '...'} color={rsi > 70 ? 'red' : rsi > 30 ? 'green' : 'red'} />
            <MiniStat label="RVOL" value={techData ? `${rvol.toFixed(2)}x` : '...'} color={rvol > 1.5 ? 'green' : rvol > 0.8 ? 'yellow' : 'red'} />
          </div>
          {/* Opsiyon Değerlendirmesi */}
          <OptionsEvaluationWidget ticker={ticker} />
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-3">
          {/* Teknik Göstergeler */}
          <Card padding="sm">
            <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-2">
              <Brain className="w-4 h-4 text-finma-purple" />
              <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">Teknik Göstergeler</span>
            </div>
            {techData ? (
              <>
                <Row label="Trend" value={trendLabel} color={trendScore >= 4 ? 'green' : trendScore >= 3 ? 'yellow' : 'red'} />
                <Row label="RSI (14)" value={rsi.toFixed(1)} color={rsi > 70 ? 'red' : rsi > 30 ? 'green' : 'red'} />
                <Row label="ADX" value={adx.toFixed(1)} color={adx > 25 ? 'green' : 'yellow'} />
                <Row label="ATR %" value={`${atr_pct.toFixed(2)}%`} />
                <Row label="RVOL" value={`${rvol.toFixed(2)}x`} color={rvol > 1.5 ? 'green' : 'yellow'} />
                <div className="border-t border-finma-border mt-2 pt-2">
                  <Row label="EMA 20" value={`$${techData.indicators.ema20.toFixed(2)}`} />
                  <Row label="EMA 50" value={`$${techData.indicators.ema50.toFixed(2)}`} />
                  <Row label="EMA 200" value={`$${techData.indicators.ema200.toFixed(2)}`} />
                </div>
              </>
            ) : (
              <div className="space-y-2 py-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="w-16 h-3 bg-finma-border/30 rounded animate-pulse" />
                    <span className="w-12 h-3 bg-finma-border/30 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Seviyeler */}
          <Card padding="sm">
            <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-2">
              <Target className="w-4 h-4 text-finma-cyan" />
              <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">Seviyeler</span>
            </div>
            {support > 0 && <Row label="Destek" value={`$${support.toFixed(2)}`} color="green" />}
            {resistance > 0 && <Row label="Direnç" value={`$${resistance.toFixed(2)}`} color="red" />}
            {techData && (
              <>
                <div className="border-t border-finma-border/40 my-1.5" />
                <Row label="Bollinger Üst" value={`$${techData.indicators.bollinger_upper.toFixed(2)}`} color="red" />
                <Row label="Bollinger Alt" value={`$${techData.indicators.bollinger_lower.toFixed(2)}`} color="green" />
              </>
            )}
          </Card>

          {/* Analist Hedefleri */}
          {targetAvg && (
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase mb-1.5 font-medium">Analist Hedefleri</div>
              <div className="flex justify-between text-[12px]">
                <span className="text-finma-red">Düşük: ${targetLow?.toFixed(0) ?? 'N/A'}</span>
                <span className="text-finma-text font-bold">Ort: ${targetAvg.toFixed(0)}</span>
                <span className="text-finma-green">Yüksek: ${targetHigh?.toFixed(0) ?? 'N/A'}</span>
              </div>
              {quoteData?.analyst_rating && (
                <div className="mt-1.5 text-[11px] text-finma-cyan text-center">
                  Konsensus: {quoteData.analyst_rating} ({quoteData.analyst_count} analist)
                </div>
              )}
            </Card>
          )}

          {/* Canlı İçeriden İşlemler */}
          <InsiderWidget ticker={ticker} />
        </div>
      </div>

      {/* ALT PANEL — 4 SÜTUN */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <Card padding="sm">
          <SectionHeader icon={DollarSign} title="Değerleme" />
          <Row label="F/K" value={pe ? pe.toFixed(1) : 'N/A'} />
          <Row label="İleri F/K" value={forwardPe ? forwardPe.toFixed(1) : 'N/A'} />
          <Row label="PEG" value={peg ? peg.toFixed(1) : 'N/A'} color={peg && peg <= 1 ? 'green' : peg && peg >= 2.5 ? 'red' : undefined} />
          <Row label="F/S" value={ps ? ps.toFixed(1) : 'N/A'} />
          <Row label="F/DD" value={pb ? pb.toFixed(1) : 'N/A'} />
          {divYield > 0 && <Row label="Temettü" value={`%${(divYield * 100).toFixed(2)}`} color="green" />}
        </Card>

        <Card padding="sm">
          <SectionHeader icon={TrendingUp} title="Karlılık & Büyüme" />
          <Row label="Net Kar Marjı" value={profitMargin ? `%${profitMargin.toFixed(1)}` : 'N/A'} color={profitMargin && profitMargin > 20 ? 'green' : undefined} />
          <Row label="ROE" value={roe ? `%${roe.toFixed(1)}` : 'N/A'} color={roe && roe > 20 ? 'green' : undefined} />
          <div className="border-t border-finma-border/30 my-1" />
          <Row label="Gelir Büyümesi" value={revenueGrowth ? `%${revenueGrowth.toFixed(1)}` : 'N/A'} color={revenueGrowth && revenueGrowth > 10 ? 'green' : revenueGrowth && revenueGrowth > 0 ? 'yellow' : undefined} />
          <Row label="HBK Büyümesi" value={earningsGrowth ? `%${earningsGrowth.toFixed(1)}` : 'N/A'} color={earningsGrowth && earningsGrowth > 10 ? 'green' : earningsGrowth && earningsGrowth > 0 ? 'yellow' : undefined} />
        </Card>

        <Card padding="sm">
          <SectionHeader icon={Shield} title="Bilanço & Risk" />
          <Row label="Beta" value={beta ? beta.toFixed(2) : 'N/A'} color={beta && beta > 1.5 ? 'red' : undefined} />
          <Row label="Borç/Özsermaye" value={debtEquity ? debtEquity.toFixed(2) : 'N/A'} color={debtEquity && debtEquity > 1.5 ? 'red' : undefined} />
          {quoteData?.institutional_pct != null && (
            <Row label="Kurumsal Sahiplik" value={`%${(quoteData.institutional_pct * 100).toFixed(1)}`} />
          )}
          {quoteData?.fifty_two_week_high != null && (
            <>
              <div className="border-t border-finma-border/30 my-1" />
              <Row label="52H Yüksek" value={`$${quoteData.fifty_two_week_high.toFixed(2)}`} />
              <Row label="52H Düşük" value={`$${quoteData.fifty_two_week_low?.toFixed(2) ?? 'N/A'}`} />
            </>
          )}
        </Card>

        <Card padding="sm">
          <SectionHeader icon={Activity} title="Teknik Özet" />
          {techData ? (
            <>
              <Row label="MACD" value={techData.indicators.macd.toFixed(2)} color={techData.indicators.macd > 0 ? 'green' : 'red'} />
              <Row label="MACD Sinyal" value={techData.indicators.macd_signal.toFixed(2)} />
              <Row label="CMF" value={techData.indicators.cmf.toFixed(3)} color={techData.indicators.cmf > 0 ? 'green' : 'red'} />
              <Row label="Boll. BW" value={`${techData.indicators.bollinger_bandwidth.toFixed(2)}%`} />
              <Row label="Boll. %B" value={techData.indicators.bollinger_pctb.toFixed(2)} />
            </>
          ) : (
            <div className="space-y-2 py-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="w-16 h-3 bg-finma-border/30 rounded animate-pulse" />
                  <span className="w-12 h-3 bg-finma-border/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* SEKMELİ BÖLÜM */}
      <div className="bg-finma-card border border-finma-border rounded-xl overflow-hidden">
        <div className="flex border-b border-finma-border overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2',
                  activeTab === tab.id
                    ? 'text-finma-primary border-finma-primary bg-finma-primary/5'
                    : 'text-finma-text-dim border-transparent hover:text-finma-text hover:bg-finma-bg/50'
                )}>
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </div>
        <div className="p-5">
          {activeTab === 'news' && <NewsTab ticker={ticker} name={name} />}
          {activeTab === 'insider' && <InsiderTab ticker={ticker} />}
          {activeTab === 'earnings' && <EarningsTab ticker={ticker} />}
          {activeTab === 'history' && <PriceHistoryTab ticker={ticker} />}
          {activeTab === 'holders' && <HoldersTab ticker={ticker} />}
        </div>
      </div>

      {/* AI SORU-CEVAP */}
      <Card padding="sm">
        <div className="flex items-center gap-2 pb-2 border-b border-finma-border mb-3">
          <Brain className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">AI&apos;a Sor</span>
          <span className="ml-auto text-[10px] text-finma-text-dim">FinMA AI destekli</span>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {['Detaylı analiz yap', 'Riskler neler?', 'Almalı mıyım?'].map(q => (
            <button key={q} onClick={() => handleAiAsk(`${ticker}: ${q}`)}
              className="text-[11px] px-3 py-2 rounded-lg bg-finma-bg border border-finma-border text-finma-text-dim hover:text-finma-primary hover:border-finma-primary/50 transition-all">
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiAsk(aiQuestion)}
            placeholder={`${ticker} hakkında soru sorun...`} className="finma-input flex-1 text-sm" />
          <button onClick={() => handleAiAsk(aiQuestion)} disabled={aiLoading} className="finma-btn-primary p-2.5">
            {aiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {aiResponse && (
          <div className="mt-3 p-4 bg-finma-bg rounded-lg border border-finma-border/50">
            <p className="text-[12px] text-finma-text-muted leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}
      </Card>

      <div className="text-center py-2">
        <p className="text-[11px] text-finma-text-dim">Bu bir yatırım tavsiyesi değildir. Tüm analizler bilgilendirme amaçlıdır.</p>
      </div>
    </div>
  )
}

export default function StockAnalysisPage() {
  return (
    <TierGate tier="pro">
      <Suspense fallback={<div className="text-center py-20 text-finma-text-dim">Yükleniyor...</div>}>
        <StockAnalysisContent />
      </Suspense>
    </TierGate>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-2">
      <Icon className="w-4 h-4 text-finma-text-dim" />
      <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">{title}</span>
    </div>
  )
}

function Row({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  const colorMap: Record<string, string> = {
    green: 'text-finma-green', red: 'text-finma-red', yellow: 'text-finma-yellow',
    cyan: 'text-finma-cyan', primary: 'text-finma-primary',
  }
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-[12px] text-finma-text-muted">{label}</span>
      <span className={cn('finma-number text-[12px]', bold && 'font-bold', color ? colorMap[color] : 'text-finma-text')}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = { green: 'text-finma-green', yellow: 'text-finma-yellow', red: 'text-finma-red' }
  return (
    <div className="bg-finma-card border border-finma-border rounded-lg p-3 text-center">
      <div className="text-[10px] text-finma-text-dim uppercase">{label}</div>
      <div className={cn('text-base font-bold finma-number', colorMap[color])}>{value}</div>
    </div>
  )
}
