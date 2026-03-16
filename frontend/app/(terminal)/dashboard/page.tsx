'use client'

import { HUDMetrics, RiskBanner } from '@/components/terminal/HUDMetrics'
import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { ActiveOperations } from '@/components/terminal/ActiveOperations'
import { CompactSignals } from '@/components/terminal/CompactSignals'
import { MarketContext } from '@/components/terminal/MarketContext'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { usePortfolioSummary, useTrades } from '@/hooks/usePortfolio'
import { useLatestSignals } from '@/hooks/useSignals'
import { useIndices, useRegime } from '@/hooks/useMarketData'
import { mockPortfolio, mockSignals, mockTrades, mockIndices } from '@/lib/mock-data'
import {
  Brain, Clock, AlertCircle, Globe2, DollarSign,
  Newspaper, Shield, Activity, Flame
} from 'lucide-react'

export default function DashboardPage() {
  // Live data hooks (fallback to mock)
  const { data: portfolioData } = usePortfolioSummary()
  const { data: tradesData } = useTrades('OPEN')
  const { data: signalsData } = useLatestSignals()
  const { data: indicesData } = useIndices()
  const { data: regimeData } = useRegime()

  // Use live data or fallback to mock
  const portfolio = portfolioData || mockPortfolio
  const trades = tradesData || mockTrades
  const signals = (signalsData || mockSignals) as import('@/types').SignalReport
  const indices = indicesData && indicesData.length > 0 ? indicesData : mockIndices
  const vix = regimeData?.vix ?? signals.vix_level
  const regime = regimeData?.regime_tr ?? (signals.market_regime === 'Bull' ? '🐂 Boğa' : '🐻 Ayı')
  const sectorLeaders = signals.sector_leaders?.join(', ') ?? 'Utilities, Materials'

  const now = new Date()
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  const dateStr = now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Risk Banner */}
      <RiskBanner vix={vix} />

      {/* Komuta Merkezi */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm font-semibold text-finma-text">
            🏛️ Komuta Merkezi
          </span>
        </div>
        <HUDMetrics data={portfolio} />
      </div>

      {/* Piyasa Bağlamı */}
      <MarketContext indices={indices} />

      {/* Ana içerik: Grafik (sol) + Aktif Operasyonlar & Sinyaller (sağ) */}
      <div className="grid grid-cols-12 gap-4">
        {/* TradingView Grafik */}
        <div className="col-span-12 lg:col-span-7 xl:col-span-8">
          <div className="h-[300px] md:h-[500px]">
            <TradingViewWidget />
          </div>
        </div>

        {/* Sağ sütun */}
        <div className="col-span-12 lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
          <div className="h-auto md:h-[242px]">
            <ActiveOperations trades={trades} maxVisible={4} />
          </div>
          <div className="h-auto md:h-[242px]">
            <CompactSignals data={signals} maxVisible={5} />
          </div>
        </div>
      </div>

      {/* ═══════════════ Piyasa İstihbaratı ═══════════════ */}
      <Card padding="sm">
        <div className="flex items-center gap-2 px-1 pb-3 border-b border-finma-border">
          <Brain className="w-4 h-4 text-finma-purple" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">
            Piyasa İstihbaratı
          </span>
          <span className="ml-auto text-[10px] text-finma-text-dim finma-number flex items-center gap-1">
            <Clock className="w-3 h-3" /> Son güncelleme: {dateStr} {timeStr}
          </span>
        </div>

        {/* Satır 1: Makro Göstergeler */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Activity className="w-3 h-3 text-finma-green" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Piyasa Rejimi</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-finma-green">{regime}</span>
            </div>
            <div className="text-[10px] text-finma-text-dim mt-2 space-y-0.5">
              <div>VIX: <span className="text-finma-yellow finma-number">{vix.toFixed(2)}</span> | Trend: <span className="text-finma-green">Yükseliş</span></div>
              <div>S&P 500 {regimeData?.spy_price ? <span className="finma-number">{regimeData.spy_price}</span> : '200 günlük ortalamanın'} <span className="text-finma-green">üzerinde</span></div>
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
              <div>Sanayi ve savunma hisseleri <span className="text-finma-green">güçlü</span></div>
              <div>Teknoloji sektöründe <span className="text-finma-yellow">nötr beklenti</span></div>
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
            </div>
          </div>
        </div>

        {/* Satır 2: Haber & Analiz */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Newspaper className="w-3 h-3 text-finma-primary" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Günün Özeti</span>
              <span className="ml-auto text-[9px] text-finma-text-dim finma-number">{timeStr}</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <p>• Piyasalar güçlü açıldı. {sectorLeaders} sektörleri liderlik ediyor.</p>
              <p>• Savunma hisseleri rallisi devam ediyor – NOC, LMT dikkat çekici.</p>
              <p>• 10 yıllık tahvil getirisi %4.28 seviyesinde sabit.</p>
              <p>• Altın $2,110 üzerinde tutunuyor, güvenli liman talebi sürüyor.</p>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock className="w-3 h-3 text-finma-yellow" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Ekonomik Takvim</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] finma-number text-finma-yellow bg-finma-yellow/10 px-1.5 py-0.5 rounded">14:30</span>
                <span>ABD Haftalık İşsizlik Başvuruları</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] finma-number text-finma-yellow bg-finma-yellow/10 px-1.5 py-0.5 rounded">16:00</span>
                <span>FED Başkanı Konuşması</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] finma-number text-finma-text-dim bg-finma-bg px-1.5 py-0.5 rounded">Yarın</span>
                <span>Enflasyon Verileri (CPI)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] finma-number text-finma-text-dim bg-finma-bg px-1.5 py-0.5 rounded">Yarın</span>
                <span>Michigan Tüketici Güveni</span>
              </div>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Brain className="w-3 h-3 text-finma-purple" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">AI Analiz Özeti</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              <p>• Genel piyasa yönü <span className="text-finma-green font-medium">pozitif</span>, ancak VIX seviyesi dikkat gerektiriyor.</p>
              <p>• Enerji ve savunma sektörlerinde momentum <span className="text-finma-green font-medium">güçlü</span>.</p>
              <p>• {signals.candidates?.[0]?.ticker ?? 'NVDA'} en yüksek skoru ile öne çıkıyor.</p>
              <p>• Risk yönetimi: Pozisyon büyüklüklerini VIX seviyesine göre ayarlayın.</p>
            </div>
          </div>
        </div>

        {/* Satır 3: Teknik Seviyeler & Öne Çıkanlar */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Shield className="w-3 h-3 text-finma-primary" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Önemli Teknik Seviyeler</span>
            </div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between py-1 border-b border-finma-border/20">
                <span className="text-finma-text-muted">S&P 500 Destek</span>
                <span className="finma-number text-finma-green">5,720 / 5,680</span>
              </div>
              <div className="flex justify-between py-1 border-b border-finma-border/20">
                <span className="text-finma-text-muted">S&P 500 Direnç</span>
                <span className="finma-number text-finma-red">5,880 / 5,920</span>
              </div>
              <div className="flex justify-between py-1 border-b border-finma-border/20">
                <span className="text-finma-text-muted">Nasdaq Destek</span>
                <span className="finma-number text-finma-green">20,100 / 19,850</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-finma-text-muted">Bitcoin Destek/Direnç</span>
                <span className="finma-number text-finma-cyan">$68K / $74K</span>
              </div>
            </div>
          </div>

          <div className="bg-finma-bg/50 rounded-md p-3 border border-finma-border/30">
            <div className="flex items-center gap-1.5 mb-2">
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-[10px] text-finma-text-dim uppercase font-medium">Bugünün Öne Çıkanları</span>
            </div>
            <div className="text-xs text-finma-text-muted space-y-1.5">
              {signals.candidates?.slice(0, 4).map((c: any) => (
                <div key={c.ticker} className="flex items-center gap-2">
                  <Badge variant={c.action === 'BUY' ? 'buy' : c.action === 'HOLD' ? 'hold' : 'sell'}>
                    {c.ticker}
                  </Badge>
                  <span>
                    Skor: <span className="finma-number text-finma-primary">{c.score?.toFixed(1)}</span>
                    {' | '}
                    Pot: <span className={`finma-number ${c.potential_pct >= 0 ? 'text-finma-green' : 'text-finma-red'}`}>
                      {c.potential_pct >= 0 ? '+' : ''}{c.potential_pct?.toFixed(1)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
