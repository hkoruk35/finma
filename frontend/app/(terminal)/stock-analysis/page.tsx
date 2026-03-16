'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { TradingViewWidget } from '@/components/terminal/TradingViewWidget'
import { Card } from '@/components/shared/Card'
import { useTerminalStore } from '@/store/terminal'
import { useQuote, useTechnicals } from '@/hooks/useMarketData'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import {
  Search, Brain, TrendingUp, Shield, Target,
  Activity, DollarSign, Clock,
  ArrowUp, ArrowDown, Send, Maximize2, Minimize2
} from 'lucide-react'

function StockAnalysisContent() {
  const searchParams = useSearchParams()
  const { setChartSymbol } = useTerminalStore()
  const [ticker, setTicker] = useState(searchParams.get('ticker') || 'NVDA')
  const [searchInput, setSearchInput] = useState('')
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Canlı veri hook'ları — otomatik refetch + placeholder ile kesintisiz
  const { data: quoteData, isLoading: quoteLoading, isFetching: quoteFetching } = useQuote(ticker)
  const { data: techData, isLoading: techLoading, isFetching: techFetching } = useTechnicals(ticker)
  const isAnyLoading = quoteLoading || techLoading
  const isRefreshing = (quoteFetching && !quoteLoading) || (techFetching && !techLoading)

  useEffect(() => {
    setChartSymbol(ticker)
  }, [ticker, setChartSymbol])

  const handleSearch = () => {
    if (searchInput.trim()) {
      setTicker(searchInput.trim().toUpperCase())
      setSearchInput('')
      setAiResponse('')
    }
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

  // Canlı veya varsayılan veri
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

  // Teknik veriler
  const trendScore = techData?.trend_score ?? 0
  const trendLabel = techData?.trend ?? 'N/A'
  const rsi = techData?.indicators?.rsi ?? 0
  const adx = techData?.indicators?.adx ?? 0
  const atr_pct = techData?.indicators?.atr_pct ?? 0
  const support = techData?.levels?.support ?? 0
  const resistance = techData?.levels?.resistance ?? 0
  const rvol = techData?.volume?.rvol ?? 1.0

  // AI skoru hesapla
  const aiScore = techData ? Math.min(10, Math.max(0, (trendScore / 10) * 5 + (rsi > 50 ? 1 : -0.5) + (adx > 25 ? 1 : 0) + 3)).toFixed(1) : 'N/A'
  const tradeBias = trendScore > 5 ? 'YUKARI' : trendScore < -5 ? 'ASAGI' : 'NÖTR'
  const riskLevel = atr_pct > 3 ? 'YÜKSEK' : atr_pct > 1.5 ? 'ORTA' : 'DÜŞÜK'

  return (
    <div className="space-y-4 animate-fade-in">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-finma-primary" />
          <span className="text-sm font-semibold text-finma-text uppercase tracking-wider">Hisse Analiz</span>
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border text-yellow-400 bg-yellow-400/10 border-yellow-400/30">Gold</span>
        </div>
        <div className="flex items-center gap-2">
          {isRefreshing && (
            <div className="flex items-center gap-1 text-[9px] text-finma-primary">
              <div className="w-2 h-2 rounded-full bg-finma-primary animate-pulse" />
              Güncelleniyor
            </div>
          )}
          <div className="flex items-center bg-finma-card border border-finma-border rounded-md overflow-hidden">
            <input
              type="text" value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Hisse kodu girin..."
              className="bg-transparent text-xs text-finma-text px-3 py-2 w-36 outline-none placeholder:text-finma-text-dim"
            />
            <button onClick={handleSearch} className="px-3 py-2 bg-finma-primary/20 text-finma-primary hover:bg-finma-primary/30 transition-colors">
              <Search className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
            <Clock className="w-3 h-3" /><span className="finma-number">{updateTime}</span>
          </div>
        </div>
      </div>

      {/* SNAPSHOT */}
      <div className="bg-finma-card border border-finma-border rounded-lg p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-finma-primary finma-number">{ticker}</span>
                <span className="text-sm text-finma-text-muted">— {isAnyLoading ? <span className="inline-block w-24 h-4 bg-finma-border/30 rounded animate-pulse" /> : name}</span>
              </div>
              <div className="flex items-center gap-4 mt-1">
                {isAnyLoading && price === 0 ? (
                  <span className="inline-block w-28 h-8 bg-finma-border/30 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="finma-number text-2xl font-bold text-white transition-all duration-300">${price.toFixed(2)}</span>
                    <span className={cn('finma-number text-sm font-bold transition-all duration-300', change >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="h-12 w-px bg-finma-border" />
            <div className="flex gap-6 text-[11px]">
              <div><span className="text-finma-text-dim block">Piyasa Değeri</span><span className="finma-number font-semibold text-finma-text">{marketCap}</span></div>
              <div><span className="text-finma-text-dim block">Hacim</span><span className="finma-number font-semibold text-finma-text">{volume}</span></div>
              <div><span className="text-finma-text-dim block">Sektör</span><span className="font-semibold text-finma-cyan">{sector}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {aiScore !== 'N/A' && (
              <div className={cn(
                'text-center px-4 py-2 rounded-lg border',
                parseFloat(aiScore) >= 7 ? 'bg-finma-green/10 border-finma-green/30' :
                parseFloat(aiScore) >= 5 ? 'bg-finma-yellow/10 border-finma-yellow/30' :
                'bg-finma-red/10 border-finma-red/30'
              )}>
                <div className="text-[9px] uppercase text-finma-text-dim font-medium">AI Skor</div>
                <div className={cn('finma-number text-2xl font-bold',
                  parseFloat(aiScore) >= 7 ? 'text-finma-green' : parseFloat(aiScore) >= 5 ? 'text-finma-yellow' : 'text-finma-red'
                )}>{aiScore}</div>
              </div>
            )}
            <div className="text-center px-3 py-2">
              <div className="text-[9px] uppercase text-finma-text-dim font-medium">Yön</div>
              <div className={cn('text-sm font-bold flex items-center gap-1',
                tradeBias === 'YUKARI' ? 'text-finma-green' : tradeBias === 'ASAGI' ? 'text-finma-red' : 'text-finma-yellow'
              )}>
                {tradeBias === 'YUKARI' ? <ArrowUp className="w-4 h-4" /> : tradeBias === 'ASAGI' ? <ArrowDown className="w-4 h-4" /> : null}
                {tradeBias}
              </div>
            </div>
            <div className="text-center px-3 py-2">
              <div className="text-[9px] uppercase text-finma-text-dim font-medium">Risk</div>
              <div className={cn('text-sm font-bold',
                riskLevel === 'YÜKSEK' ? 'text-finma-red' : riskLevel === 'ORTA' ? 'text-finma-yellow' : 'text-finma-green'
              )}>{riskLevel}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ANA İÇERİK */}
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 lg:col-span-8">
          <div className="relative">
            <div className={cn('bg-finma-card border border-finma-border rounded-lg overflow-hidden', isFullscreen && 'fixed inset-4 z-50')}
              style={{ height: isFullscreen ? 'auto' : '420px' }}>
              <div className="absolute top-2 right-2 z-20">
                <button onClick={() => setIsFullscreen(f => !f)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-finma-bg/80 backdrop-blur text-finma-text-dim hover:text-finma-text border border-finma-border/50">
                  {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  {isFullscreen ? 'Küçült' : 'Tam Ekran'}
                </button>
              </div>
              <TradingViewWidget />
            </div>
            {isFullscreen && <div className="fixed inset-0 bg-black/60 z-40" onClick={() => setIsFullscreen(false)} />}
          </div>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <MiniStat label="Trend Gücü" value={techData ? `${trendScore.toFixed(0)}/10` : '...'} color={trendScore > 5 ? 'green' : trendScore > 0 ? 'yellow' : 'red'} />
            <MiniStat label="RSI" value={techData ? rsi.toFixed(1) : '...'} color={rsi > 70 ? 'red' : rsi > 30 ? 'green' : 'red'} />
            <MiniStat label="RVOL" value={techData ? `${rvol.toFixed(2)}x` : '...'} color={rvol > 1.5 ? 'green' : rvol > 0.8 ? 'yellow' : 'red'} />
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-3">
          {/* Teknik Göstergeler */}
          <Card padding="sm">
            <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-2">
              <Brain className="w-3.5 h-3.5 text-finma-purple" />
              <span className="text-[10px] font-semibold text-finma-text uppercase tracking-wider">Teknik Göstergeler</span>
            </div>
            {techData ? (
              <>
                <Row label="Trend" value={trendLabel} color={trendScore > 5 ? 'green' : trendScore > 0 ? 'yellow' : 'red'} />
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
                {[...Array(6)].map((_, i) => (
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
              <Target className="w-3.5 h-3.5 text-finma-cyan" />
              <span className="text-[10px] font-semibold text-finma-text uppercase tracking-wider">Seviyeler</span>
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
              <div className="text-[9px] text-finma-text-dim uppercase mb-1">Analist Hedefleri</div>
              <div className="flex justify-between text-[11px]">
                <span className="text-finma-red">Düşük: ${targetLow?.toFixed(0) ?? 'N/A'}</span>
                <span className="text-finma-text font-bold">Ort: ${targetAvg.toFixed(0)}</span>
                <span className="text-finma-green">Yüksek: ${targetHigh?.toFixed(0) ?? 'N/A'}</span>
              </div>
              {quoteData?.analyst_rating && (
                <div className="mt-1 text-[10px] text-finma-cyan text-center">
                  Konsensus: {quoteData.analyst_rating} ({quoteData.analyst_count} analist)
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* ALT PANEL */}
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
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex justify-between items-center">
                  <span className="w-16 h-3 bg-finma-border/30 rounded animate-pulse" />
                  <span className="w-12 h-3 bg-finma-border/30 rounded animate-pulse" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* AI SORU-CEVAP */}
      <Card padding="sm">
        <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-3">
          <Brain className="w-3.5 h-3.5 text-finma-purple" />
          <span className="text-xs font-semibold text-finma-text uppercase tracking-wider">AI&apos;a Sor</span>
          <span className="ml-auto text-[9px] text-finma-text-dim">Gemini destekli</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          {['Detaylı analiz yap', 'Riskler neler?', 'Almalı mıyım?'].map(q => (
            <button key={q} onClick={() => handleAiAsk(`${ticker}: ${q}`)}
              className="text-[10px] px-2.5 py-1.5 rounded bg-finma-bg border border-finma-border text-finma-text-dim hover:text-finma-primary hover:border-finma-primary/50 transition-all">
              {q}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="text" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAiAsk(aiQuestion)}
            placeholder={`${ticker} hakkında soru sorun...`} className="finma-input flex-1 text-xs" />
          <button onClick={() => handleAiAsk(aiQuestion)} disabled={aiLoading} className="finma-btn-primary p-2.5">
            {aiLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        {aiResponse && (
          <div className="mt-3 p-3 bg-finma-bg rounded-md border border-finma-border/50">
            <p className="text-[11px] text-finma-text-muted leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}
      </Card>

      <div className="text-center py-2">
        <p className="text-[10px] text-finma-text-dim">Bu bir yatırım tavsiyesi değildir. Tüm analizler bilgilendirme amaçlıdır.</p>
      </div>
    </div>
  )
}

export default function StockAnalysisPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-finma-text-dim">Yükleniyor...</div>}>
      <StockAnalysisContent />
    </Suspense>
  )
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-2 border-b border-finma-border mb-2">
      <Icon className="w-3.5 h-3.5 text-finma-text-dim" />
      <span className="text-[10px] font-semibold text-finma-text uppercase tracking-wider">{title}</span>
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
      <span className="text-[11px] text-finma-text-muted">{label}</span>
      <span className={cn('finma-number text-[11px]', bold && 'font-bold', color ? colorMap[color] : 'text-finma-text')}>{value}</span>
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = { green: 'text-finma-green', yellow: 'text-finma-yellow', red: 'text-finma-red' }
  return (
    <div className="bg-finma-card border border-finma-border rounded-md p-2.5 text-center">
      <div className="text-[9px] text-finma-text-dim uppercase">{label}</div>
      <div className={cn('text-sm font-bold finma-number', colorMap[color])}>{value}</div>
    </div>
  )
}
