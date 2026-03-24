'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, RefreshCw, Clock, TrendingUp, TrendingDown, Minus, AlertCircle, Wifi, WifiOff, X, Target } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { TierGate } from '@/components/auth/TierGate'
import { Finma514Table } from '@/components/terminal/finma514/Finma514Table'
import { LangSelector } from '@/components/terminal/finma514/LangSelector'
import { useFinma514Insights, useFinma514Status } from '@/hooks/useFinma514'
import { useFinma514Events } from '@/hooks/useFinma514Events'
import type { FinmaLang, Finma514Stock } from '@/types/finma514'

/* ── Mini AddToTracking Modal ────────────────────────────────────────────── */
function QuickAddModal({ stock, onClose }: { stock: Finma514Stock; onClose: () => void }) {
  const router = useRouter()

  function goToTracking() {
    onClose()
    const params = new URLSearchParams({
      ticker: stock.ticker,
      price:  String(stock.price ?? ''),
    })
    router.push(`/tracking?${params.toString()}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-finma-surface border border-white/10 rounded-xl p-5 w-full max-w-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-finma-primary" />
            <h2 className="text-sm font-bold text-white">Takibe Ekle</h2>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-finma-text-dim" /></button>
        </div>

        <div className="bg-white/5 rounded-lg p-3 space-y-1">
          <div className="flex items-center justify-between">
            <span className="finma-number font-bold text-finma-primary text-base">{stock.ticker}</span>
            <span className="finma-number text-sm text-finma-text">${stock.price?.toFixed(2)}</span>
          </div>
          <div className="text-[10px] text-finma-text-dim truncate">{stock.company_name}</div>
          <div className="text-[10px] text-finma-text-dim">{stock.sector}</div>
        </div>

        <p className="text-xs text-finma-text-dim">
          Smart Tracking sayfasına yönlendirileceksiniz. Ticker ve giriş fiyatı otomatik doldurulacak.
        </p>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-white/5 text-xs text-finma-text-dim hover:bg-white/10">
            İptal
          </button>
          <button
            onClick={goToTracking}
            className="flex-1 py-2 rounded-lg finma-btn-primary text-xs"
          >
            Takibe Ekle →
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Finma514Page() {
  return (
    <TierGate tier="admin">
      <Finma514Content />
    </TierGate>
  )
}

function regimeColor(regime: string) {
  if (!regime) return 'default'
  const r = regime.toUpperCase()
  if (r.includes('BULL') || r === 'BULLISH') return 'bull'
  if (r.includes('BEAR') || r === 'BEARISH') return 'bear'
  return 'default'
}

function RegimeBadge({ regime }: { regime: string }) {
  const variant = regimeColor(regime)
  return <Badge variant={variant as any}>{regime || 'UNKNOWN'}</Badge>
}

function Finma514Content() {
  const [lang, setLang] = useState<FinmaLang>('tr')
  const [quickAddStock, setQuickAddStock] = useState<Finma514Stock | null>(null)

  const { data, isLoading, isError, refetch, isFetching } = useFinma514Insights(lang)
  const { data: status } = useFinma514Status()
  const { connected: sseConnected, lastEvent, lastUpdated } = useFinma514Events()

  const stocks      = data?.stocks       ?? []
  const regime      = data?.market_regime ?? status?.market_regime ?? 'UNKNOWN'
  const vix         = data?.vix          ?? status?.vix ?? 0
  const runTime     = data?.run_time_ny  ?? '—'
  const marketDate  = data?.market_date  ?? status?.market_date ?? '—'
  const stockCount  = data?.stock_count  ?? stocks.length
  const isLimited   = data?.is_limited   ?? false
  const totalCount  = data?.total_count  ?? stockCount

  // İstatistikler
  const tierCounts = stocks.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const avgScore = stocks.length
    ? Math.round(stocks.reduce((a, s) => a + s.score, 0) / stocks.length)
    : 0

  const topGainers = [...stocks].sort((a, b) => b.change_1d - a.change_1d).slice(0, 3)

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-finma-primary" />
          <h1 className="text-lg font-bold text-white">FinMA 514</h1>
          <RegimeBadge regime={regime} />
          <span className="text-xs text-finma-text-dim finma-number">VIX: {vix.toFixed(2)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* SSE canlı bağlantı göstergesi */}
          <div className={cn(
            'flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-md border',
            sseConnected
              ? 'text-finma-green bg-finma-green/10 border-finma-green/20'
              : 'text-finma-text-dim bg-white/5 border-white/10'
          )}>
            {sseConnected
              ? <><span className="w-1.5 h-1.5 rounded-full bg-finma-green animate-pulse-slow" /><span>Canlı</span></>
              : <><WifiOff className="w-3 h-3" /><span>Bağlanıyor</span></>
            }
          </div>

          {/* Son yayın */}
          {lastUpdated && (
            <div className="flex items-center gap-1 text-[10px] text-finma-green/70">
              <Zap className="w-3 h-3" />
              <span>Güncellendi {lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}

          {/* Son çalışma zamanı */}
          {runTime && runTime !== '—' && (
            <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
              <Clock className="w-3 h-3" />
              <span>NY {runTime} · {marketDate}</span>
            </div>
          )}

          {/* Dil seçici */}
          <LangSelector value={lang} onChange={setLang} />

          {/* Yenile */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-finma-text-dim hover:text-finma-text transition-colors px-2 py-1.5 rounded hover:bg-white/5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            <span>Yenile</span>
          </button>
        </div>
      </div>

      {/* ── Özet kartlar ─────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Toplam Hisse</div>
          <div className="finma-number text-xl font-bold text-white mt-1">{stockCount}</div>
          <div className="text-[10px] text-finma-text-dim mt-0.5">8000+ → 200 → 54</div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Strong (90+)</div>
          <div className="finma-number text-xl font-bold text-finma-green mt-1">
            {tierCounts['STRONG'] ?? 0}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">High (75-89)</div>
          <div className="finma-number text-xl font-bold text-finma-primary mt-1">
            {tierCounts['HIGH'] ?? 0}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Watch (60-74)</div>
          <div className="finma-number text-xl font-bold text-finma-yellow mt-1">
            {tierCounts['WATCH'] ?? 0}
          </div>
        </Card>
        <Card padding="sm">
          <div className="text-[10px] text-finma-text-dim uppercase">Ort. Skor</div>
          <div className="finma-number text-xl font-bold text-white mt-1">{avgScore}</div>
          <div className="text-[10px] text-finma-text-dim mt-0.5">/100</div>
        </Card>
      </div>

      {/* ── Top 3 kazanan ───────────────────────────────── */}
      {topGainers.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {topGainers.map((s, i) => (
            <Card key={s.ticker} padding="sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className={cn(
                    'text-[10px] text-finma-text-dim',
                    i === 0 && 'text-finma-yellow'
                  )}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'} Günlük Lider
                  </span>
                  <div className="finma-number font-bold text-finma-primary text-sm">{s.ticker}</div>
                  <div className="text-[10px] text-finma-text-dim truncate max-w-[100px]">
                    {s.company_name}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn(
                    'finma-number font-bold text-base',
                    s.change_1d >= 0 ? 'text-finma-green' : 'text-finma-red'
                  )}>
                    {s.change_1d >= 0 ? '+' : ''}{s.change_1d?.toFixed(2)}%
                  </div>
                  <div className="finma-number text-xs text-finma-text-dim">
                    ${s.price?.toFixed(2)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* ── Ana tablo ────────────────────────────────────── */}
      <Card padding="sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-2 border-finma-primary/30 border-t-finma-primary rounded-full animate-spin" />
            <p className="text-xs text-finma-text-dim">54 hisse yükleniyor...</p>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-finma-text-dim">
            <AlertCircle className="w-8 h-8 text-finma-red/60" />
            <p className="text-sm">Veri yüklenemedi.</p>
            <p className="text-xs">Bot henüz çalışmamış olabilir veya bağlantı hatası var.</p>
            <button
              onClick={() => refetch()}
              className="finma-btn-primary text-xs mt-1 px-3 py-1.5"
            >
              Tekrar Dene
            </button>
          </div>
        ) : (
          <>
            <Finma514Table
              stocks={stocks}
              lang={lang}
              onLangChange={setLang}
              onAddToTracking={setQuickAddStock}
            />
            {isLimited && (
              <div className="mt-3 mx-1 rounded-xl border border-finma-primary/30 bg-finma-primary/5 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-finma-primary">
                    🔒 {totalCount - stocks.length} hisse daha listeleniyor
                  </p>
                  <p className="text-xs text-finma-text-dim mt-0.5">
                    Pro üyelik ile tüm {totalCount} adayı görüntüleyin — takibe alın, AI analizlerine erişin.
                  </p>
                </div>
                <a
                  href="/pricing"
                  className="shrink-0 finma-btn-primary text-xs px-4 py-2"
                >
                  Pro'ya Geç
                </a>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Quick Add Modal ──────────────────────────────── */}
      {quickAddStock && (
        <QuickAddModal
          stock={quickAddStock}
          onClose={() => setQuickAddStock(null)}
        />
      )}

      {/* ── Yasal uyarı footer ───────────────────────────── */}
      <div className="px-1 py-2 border-t border-finma-border/30">
        <p className="text-[10px] text-finma-text-dim/50 leading-relaxed">
          <span className="font-semibold">Yasal Uyarı:</span> Bu içerik yalnızca bilgilendirme amaçlıdır.
          Gösterilen veriler, indikatörler ve senaryolar yatırım tavsiyesi, alım-satım önerisi veya
          garanti niteliği taşımaz. Tüm yatırım kararları tamamen yatırımcının kendi sorumluluğundadır.
        </p>
      </div>
    </div>
  )
}
