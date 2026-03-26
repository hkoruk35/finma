'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth'

interface VIXData {
  value: number
  change: number
  changePercent: number
  level: 'low' | 'medium' | 'high' | 'extreme'
}

interface RiskMetric {
  name: string
  value: number
  status: 'safe' | 'warning' | 'danger'
  trend: 'up' | 'down'
}

export default function RiskVixPage() {
  const { user } = useAuthStore()
  const [vixData, setVixData] = useState<VIXData | null>(null)
  const [riskMetrics, setRiskMetrics] = useState<RiskMetric[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Mock data
    const mockVIX: VIXData = {
      value: 18.45,
      change: -0.85,
      changePercent: -4.4,
      level: 'low'
    }

    const mockMetrics: RiskMetric[] = [
      { name: 'Put/Call Oranı', value: 0.92, status: 'safe', trend: 'down' },
      { name: 'Credit Spreads', value: 2.1, status: 'safe', trend: 'up' },
      { name: 'Volatility Index', value: 18.45, status: 'safe', trend: 'down' },
      { name: 'Market Correlation', value: 0.78, status: 'warning', trend: 'up' },
    ]

    setTimeout(() => {
      setVixData(mockVIX)
      setRiskMetrics(mockMetrics)
      setLoading(false)
    }, 500)
  }, [])

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-500'
      case 'medium': return 'text-yellow-500'
      case 'high': return 'text-orange-500'
      case 'extreme': return 'text-red-500'
      default: return 'text-finma-text-dim'
    }
  }

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'low': return 'Düşük'
      case 'medium': return 'Orta'
      case 'high': return 'Yüksek'
      case 'extreme': return 'Aşırı'
      default: return '—'
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-finma-text mb-1">🌪️ Risk & VIX İndeksi</h1>
        <p className="text-finma-text-dim text-sm">Piyasa volatilitesi ve risk göstergeleri gerçek zamanlı.</p>
      </div>

      {/* VIX Main Card */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-finma-text-dim">Yükleniyor...</div>
        </div>
      ) : vixData ? (
        <>
          <div className="bg-gradient-to-br from-finma-primary/10 to-blue-500/5 border border-finma-border rounded-lg p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <div className="text-finma-text-dim text-sm mb-2">VIX Index (Korku İndeksi)</div>
                <div className="flex items-baseline gap-2">
                  <span className={cn('text-5xl font-bold', getLevelColor(vixData.level))}>
                    {vixData.value.toFixed(2)}
                  </span>
                  <span className="text-finma-text-dim text-lg">pts</span>
                </div>
              </div>
              <div className="text-right">
                <div className={cn(
                  'flex items-center gap-1 font-bold text-lg mb-1',
                  vixData.changePercent < 0 ? 'text-green-500' : 'text-red-500'
                )}>
                  {vixData.changePercent < 0 ? '↓' : '↑'}
                  {Math.abs(vixData.changePercent).toFixed(2)}%
                </div>
                <div className={cn('text-sm font-semibold px-2 py-1 rounded', getLevelColor(vixData.level))}>
                  {getLevelLabel(vixData.level)} Risk
                </div>
              </div>
            </div>
          </div>

          {/* Risk Metrics Grid */}
          <div>
            <h2 className="text-lg font-bold text-finma-text mb-3">📊 Risk Metrikleri</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {riskMetrics.map((metric) => (
                <div
                  key={metric.name}
                  className={cn(
                    'border rounded-lg p-4 transition-all duration-200',
                    metric.status === 'safe'
                      ? 'bg-green-500/5 border-green-500/20'
                      : metric.status === 'warning'
                        ? 'bg-yellow-500/5 border-yellow-500/20'
                        : 'bg-red-500/5 border-red-500/20'
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-finma-text font-semibold text-sm">{metric.name}</span>
                    {metric.status === 'safe' && (
                      <span className="text-green-500 text-xs font-bold">✓ Güvenli</span>
                    )}
                    {metric.status === 'warning' && (
                      <span className="text-yellow-500 text-xs font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Uyarı
                      </span>
                    )}
                    {metric.status === 'danger' && (
                      <span className="text-red-500 text-xs font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" /> Tehlikeli
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      'text-2xl font-bold',
                      metric.status === 'safe'
                        ? 'text-green-500'
                        : metric.status === 'warning'
                          ? 'text-yellow-500'
                          : 'text-red-500'
                    )}>
                      {metric.value.toFixed(2)}
                    </span>
                    <span className={cn('text-xs', metric.trend === 'up' ? 'text-orange-500' : 'text-green-500')}>
                      {metric.trend === 'up' ? '↑' : '↓'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro+ Feature */}
          <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💎</span>
              <div className="flex-1">
                <h3 className="font-bold text-finma-text mb-1">Volatility Alerts (Pro+ Özelliği)</h3>
                <p className="text-sm text-finma-text-dim mb-3">
                  VIX belirli seviyeleri geçtiğinde otomatik uyarılar al. Piyasa önemli değişimler yapmadan haberdar ol.
                </p>
                <a
                  href="/pricing"
                  className="inline-block text-sm font-semibold text-amber-500 hover:text-amber-600 transition-colors"
                >
                  Pro+ Özelliklerini Keşfet →
                </a>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-finma-bg border border-finma-border rounded-lg p-4">
            <h3 className="font-bold text-finma-text mb-2">ℹ️ VIX Nedir?</h3>
            <p className="text-sm text-finma-text-dim leading-relaxed">
              VIX (Volatility Index), S&P 500 endeksinin 30 günlük beklenen oynaklığının bir ölçüsüdür. Sıklıkla "Korku İndeksi" olarak adlandırılır. Düşük VIX değerleri piyasa istikrarını, yüksek değerler ise piyasa belirsizliğini gösterir.
            </p>
          </div>
        </>
      ) : null}
    </div>
  )
}
