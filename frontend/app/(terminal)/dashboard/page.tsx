'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { Card } from '@/components/shared/Card'
import { Badge } from '@/components/shared/Badge'
import { TierBadge } from '@/components/terminal/finma514/TierBadge'
import { ScoreBarCompact } from '@/components/terminal/finma514/ScoreBar'
import { useFinma514Insights, useFinma514Status } from '@/hooks/useFinma514'
import { useFinma514Events } from '@/hooks/useFinma514Events'
import { cn } from '@/lib/utils'
import {
  Zap, RefreshCw, Clock, TrendingUp, TrendingDown,
  AlertCircle, WifiOff, Target, BarChart3, Activity,
  ChevronRight, Layers, Star, Shield
} from 'lucide-react'

/* ── Kategori renk eşleşmesi ── */
const CATEGORY_COLOR: Record<string, string> = {
  CORE:   'text-finma-primary',
  SECTOR: 'text-blue-400',
  VOLUME: 'text-finma-yellow',
  GAINER: 'text-finma-green',
  LOSER:  'text-finma-red',
}

function regimeColor(regime: string): string {
  if (!regime) return 'default'
  const r = regime.toUpperCase()
  if (r.includes('BULL')) return 'bull'
  if (r.includes('BEAR')) return 'bear'
  return 'default'
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [lang] = useState<'tr'>('tr')

  const { data, isLoading, isError, refetch, isFetching } = useFinma514Insights(lang)
  const { data: status } = useFinma514Status()
  const { connected: sseConnected, lastUpdated } = useFinma514Events()

  const stocks      = data?.stocks       ?? []
  const regime      = data?.market_regime ?? status?.market_regime ?? 'UNKNOWN'
  const vix         = data?.vix          ?? status?.vix          ?? 0
  const runTime     = data?.run_time_ny  ?? '—'
  const marketDate  = data?.market_date  ?? status?.market_date  ?? '—'
  const stockCount  = data?.stock_count  ?? stocks.length

  const tierCounts = stocks.reduce((acc, s) => {
    acc[s.tier] = (acc[s.tier] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const avgScore = stocks.length
    ? Math.round(stocks.reduce((a, s) => a + s.score, 0) / stocks.length)
    : 0

  // Top 5 by score
  const top5 = [...stocks].sort((a, b) => b.score - a.score).slice(0, 5)

  // Top 3 gainers
  const topGainers = [...stocks].sort((a, b) => b.change_1d - a.change_1d).slice(0, 3)

  // Category distribution
  const catCounts = stocks.reduce((acc, s) => {
    const t = s.tag
    acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  const isEmpty = !isLoading && !isError && stocks.length === 0
  const hasData  = stocks.length > 0

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-finma-primary" />
          <h1 className="text-base font-bold text-white">Anasayfa</h1>
          <Badge variant={regimeColor(regime) as any}>{regime || 'UNKNOWN'}</Badge>
          {vix > 0 && (
            <span className="text-xs text-finma-text-dim finma-number">VIX {vix.toFixed(2)}</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* SSE bağlantı */}
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

          {lastUpdated && (
            <div className="flex items-center gap-1 text-[10px] text-finma-green/70">
              <Zap className="w-3 h-3" />
              <span>{lastUpdated.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}

          {runTime !== '—' && (
            <div className="flex items-center gap-1 text-[10px] text-finma-text-dim">
              <Clock className="w-3 h-3" />
              <span className="finma-number">NY {runTime} · {marketDate}</span>
            </div>
          )}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs text-finma-text-dim hover:text-finma-text transition-colors px-2 py-1.5 rounded hover:bg-white/5"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* ── Pipeline badge ── */}
      <div className="flex items-center gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-finma-text-dim bg-white/5 rounded-md px-3 py-1.5 border border-white/10">
          <Layers className="w-3 h-3 text-finma-primary" />
          <span className="finma-number font-semibold text-finma-primary">8.000+</span>
          <span className="text-white/30 mx-1">→</span>
          <span className="finma-number font-semibold text-white">200</span>
          <span className="text-white/30 mx-1">→</span>
          <span className="finma-number font-semibold text-finma-green">54 Seçim</span>
          <span className="text-white/20 mx-1.5">|</span>
          <span className="text-finma-text-dim">3 Katmanlı Filtre · 0-100 Skor</span>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <Card padding="sm">
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="w-8 h-8 border-2 border-finma-primary/30 border-t-finma-primary rounded-full animate-spin" />
            <p className="text-xs text-finma-text-dim">54 hisse yükleniyor...</p>
          </div>
        </Card>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <Card padding="sm">
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-finma-text-dim">
            <AlertCircle className="w-8 h-8 text-finma-red/60" />
            <p className="text-sm">Bot henüz çalışmamış.</p>
            <p className="text-xs text-center max-w-xs">
              FinMA 514 botu NY 06:30 ve 12:00'de otomatik çalışır.
              İlk çalıştıktan sonra veriler burada görünecek.
            </p>
            <button
              onClick={() => router.push('/finma514')}
              className="finma-btn-primary text-xs mt-1 px-4 py-1.5"
            >
              FinMA 514 Sayfasına Git
            </button>
          </div>
        </Card>
      )}

      {/* Empty */}
      {isEmpty && (
        <Card padding="sm">
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-finma-text-dim">
            <Zap className="w-8 h-8 text-finma-primary/40" />
            <p className="text-sm">Henüz veri yok.</p>
            <p className="text-xs text-center max-w-xs">
              Bot çalıştığında 54 hisse burada özetlenecek.
            </p>
          </div>
        </Card>
      )}

      {/* ── Ana içerik (sadece veri varsa) ── */}
      {hasData && (
        <>
          {/* Özet kartlar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider">Toplam Hisse</div>
              <div className="finma-number text-2xl font-bold text-white mt-1">{stockCount}</div>
              <div className="text-[10px] text-finma-text-dim mt-0.5">8000+ → 54</div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider">STRONG 90+</div>
              <div className="finma-number text-2xl font-bold text-finma-green mt-1">
                {tierCounts['STRONG'] ?? 0}
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider">HIGH 75–89</div>
              <div className="finma-number text-2xl font-bold text-finma-primary mt-1">
                {tierCounts['HIGH'] ?? 0}
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider">WATCH 60–74</div>
              <div className="finma-number text-2xl font-bold text-finma-yellow mt-1">
                {tierCounts['WATCH'] ?? 0}
              </div>
            </Card>
            <Card padding="sm">
              <div className="text-[10px] text-finma-text-dim uppercase tracking-wider">Ort. Skor</div>
              <div className="finma-number text-2xl font-bold text-white mt-1">{avgScore}</div>
              <div className="text-[10px] text-finma-text-dim mt-0.5">/100</div>
            </Card>
          </div>

          {/* Top gainers & kategori */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Günlük liderler */}
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-3.5 h-3.5 text-finma-green" />
                <span className="text-xs font-semibold text-finma-text">Günlük Liderler</span>
              </div>
              <div className="space-y-2">
                {topGainers.map((s, i) => (
                  <div key={s.ticker} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] w-4">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                      <div>
                        <span className="text-xs font-bold text-finma-primary finma-number">{s.ticker}</span>
                        <span className="text-[10px] text-finma-text-dim ml-1.5 truncate max-w-[80px] inline-block align-middle">{s.company_name}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <TierBadge tier={s.tier} />
                      <span className={cn(
                        'finma-number text-xs font-bold',
                        s.change_1d >= 0 ? 'text-finma-green' : 'text-finma-red'
                      )}>
                        {s.change_1d >= 0 ? '+' : ''}{s.change_1d?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Kategori dağılımı */}
            <Card padding="sm">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="w-3.5 h-3.5 text-finma-primary" />
                <span className="text-xs font-semibold text-finma-text">Kategori Dağılımı</span>
              </div>
              <div className="space-y-2">
                {(['CORE', 'SECTOR', 'VOLUME', 'GAINER', 'LOSER'] as const).map(cat => {
                  const count = catCounts[cat] ?? 0
                  const pct   = stockCount > 0 ? Math.round((count / stockCount) * 100) : 0
                  return (
                    <div key={cat} className="flex items-center gap-2">
                      <span className={cn('text-[10px] font-bold w-14 finma-number', CATEGORY_COLOR[cat])}>{cat}</span>
                      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', {
                            'bg-finma-primary': cat === 'CORE',
                            'bg-blue-400':      cat === 'SECTOR',
                            'bg-finma-yellow':  cat === 'VOLUME',
                            'bg-finma-green':   cat === 'GAINER',
                            'bg-finma-red':     cat === 'LOSER',
                          })}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="finma-number text-[10px] text-finma-text-dim w-8 text-right">{count}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          </div>

          {/* Top 5 by score */}
          <Card padding="sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-finma-yellow" />
                <span className="text-xs font-semibold text-finma-text">En Yüksek Skorlu 5 Hisse</span>
              </div>
              <button
                onClick={() => router.push('/finma514')}
                className="flex items-center gap-1 text-[10px] text-finma-primary hover:text-finma-primary/80 transition-colors"
              >
                <span>Tümünü Gör</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-finma-text-dim uppercase border-b border-finma-border/30">
                    <th className="text-left py-1.5 pr-3 font-medium">Hisse</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Kategori</th>
                    <th className="text-left py-1.5 pr-3 font-medium">Tier</th>
                    <th className="text-right py-1.5 pr-3 font-medium finma-number">Skor</th>
                    <th className="text-right py-1.5 pr-3 font-medium finma-number">1G %</th>
                    <th className="text-right py-1.5 font-medium finma-number">Fiyat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-finma-border/20">
                  {top5.map((s) => (
                    <tr key={s.ticker} className="hover:bg-white/3 transition-colors">
                      <td className="py-2 pr-3">
                        <div className="font-bold text-finma-primary finma-number">{s.ticker}</div>
                        <div className="text-[10px] text-finma-text-dim truncate max-w-[100px]">{s.company_name}</div>
                      </td>
                      <td className="py-2 pr-3">
                        <span className={cn('text-[10px] font-semibold finma-number', CATEGORY_COLOR[s.tag])}>
                          {s.tag}
                        </span>
                      </td>
                      <td className="py-2 pr-3">
                        <TierBadge tier={s.tier} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <ScoreBarCompact score={s.score} />
                          <span className="finma-number font-bold text-white">{s.score}</span>
                        </div>
                      </td>
                      <td className={cn(
                        'py-2 pr-3 text-right finma-number font-semibold',
                        s.change_1d >= 0 ? 'text-finma-green' : 'text-finma-red'
                      )}>
                        {s.change_1d >= 0 ? '+' : ''}{s.change_1d?.toFixed(2)}%
                      </td>
                      <td className="py-2 text-right finma-number text-finma-text">
                        ${s.price?.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* AI Insight preview — first STRONG/HIGH stock */}
          {(() => {
            const aiStock = stocks.find(s => (s.tier === 'STRONG' || s.tier === 'HIGH') && s.ai_text?.market_context)
            if (!aiStock?.ai_text) return null
            return (
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-3.5 h-3.5 text-finma-primary" />
                  <span className="text-xs font-semibold text-finma-text">AI Piyasa Bağlamı Önizlemesi</span>
                  <TierBadge tier={aiStock.tier} />
                  <span className="finma-number text-xs text-finma-primary font-bold">{aiStock.ticker}</span>
                </div>
                <p className="text-[11px] text-finma-text-dim leading-relaxed line-clamp-3">
                  {aiStock.ai_text.market_context}
                </p>
                <button
                  onClick={() => router.push('/finma514')}
                  className="mt-2 text-[10px] text-finma-primary hover:text-finma-primary/80 flex items-center gap-1"
                >
                  <span>Tüm AI analizleri FinMA 514'te</span>
                  <ChevronRight className="w-3 h-3" />
                </button>
              </Card>
            )
          })()}

          {/* CTA */}
          <div className="flex justify-center pt-2">
            <button
              onClick={() => router.push('/finma514')}
              className="finma-btn-primary flex items-center gap-2 px-6 py-2.5 text-sm"
            >
              <Zap className="w-4 h-4" />
              <span>FinMA 514 Tam Analiz Sayfası</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {/* ── Footer yasal uyarı ── */}
      <div className="px-1 py-2 border-t border-finma-border/30">
        <p className="text-[10px] text-finma-text-dim/50 leading-relaxed">
          <span className="font-semibold">Yasal Uyarı:</span> Bu içerik yalnızca bilgilendirme amaçlıdır.
          Gösterilen veriler yatırım tavsiyesi, alım-satım önerisi veya garanti niteliği taşımaz.
          Tüm yatırım kararları tamamen yatırımcının kendi sorumluluğundadır.
        </p>
      </div>
    </div>
  )
}
