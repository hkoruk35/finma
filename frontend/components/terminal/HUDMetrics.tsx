'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { formatCurrency, getPnlColor } from '@/lib/utils'
import type { PortfolioSnapshot } from '@/types'
import { Wallet, TrendingUp, TrendingDown, BarChart3, DollarSign, Shield, AlertTriangle, ShieldCheck, ShieldAlert, Info, Users } from 'lucide-react'
import { useAuthStore } from '@/store/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://finma-api.up.railway.app'

interface HUDMetricsProps {
  data: PortfolioSnapshot
}

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  subColor?: string
  icon: React.ReactNode
  highlight?: boolean
}

function MetricCard({ label, value, sub, subColor, icon, highlight }: MetricCardProps) {
  return (
    <div className={cn(
      'flex flex-col gap-1 px-3 py-2 rounded-lg border bg-finma-surface',
      highlight ? 'border-finma-primary/40' : 'border-finma-border/60'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-finma-text-dim uppercase tracking-wider font-medium truncate">
          {label}
        </span>
        <span className="text-finma-text-dim shrink-0 ml-1">{icon}</span>
      </div>
      <div className="finma-number text-sm font-bold text-white leading-none">
        {value}
      </div>
      {sub && (
        <div className={cn('finma-number text-[10px] font-medium', subColor || 'text-finma-text-dim')}>
          {sub}
        </div>
      )}
    </div>
  )
}

export function HUDMetrics({ data }: HUDMetricsProps) {
  const { canAccess } = useAuthStore()
  const isAdmin = canAccess('admin')
  const [adminStats, setAdminStats] = useState<any>(null)

  useEffect(() => {
    if (!isAdmin) return
    const token = localStorage.getItem('finma_token')
    if (!token) return
    fetch(`${API_URL}/api/auth/admin/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAdminStats(d) })
      .catch(() => {})
  }, [isAdmin])

  const metrics = isAdmin && adminStats ? [
    { label: 'Toplam Kullanıcı', value: adminStats.total_users?.toString() ?? '—', icon: <Users className="w-3 h-3" />, sub: `Pro: ${adminStats.pro_users ?? 0}`, subColor: 'text-finma-primary' },
    { label: 'Aktif Üye', value: adminStats.active_users?.toString() ?? '—', icon: <Users className="w-3 h-3" /> },
    { label: 'Toplam Trade', value: adminStats.total_trades?.toString() ?? '—', icon: <BarChart3 className="w-3 h-3" /> },
    { label: 'Günlük Sinyal', value: adminStats.signals_today?.toString() ?? '—', icon: <TrendingUp className="w-3 h-3" /> },
    { label: 'Bot Durumu', value: adminStats.bots_running ?? '—', icon: <Shield className="w-3 h-3" /> },
  ] : [
    { label: 'Net Likidite', value: formatCurrency(data.net_liquidation), icon: <Wallet className="w-3 h-3" />, highlight: true, sub: data.current_24h_pnl >= 0 ? `▲ ${Math.abs(data.current_24h_pnl).toFixed(2)}%` : `▼ ${Math.abs(data.current_24h_pnl).toFixed(2)}%`, subColor: getPnlColor(data.current_24h_pnl) },
    { label: 'Günlük PnL', value: formatCurrency(data.current_24h_pnl), icon: <TrendingUp className="w-3 h-3" />, subColor: getPnlColor(data.current_24h_pnl) },
    { label: '7 Gün PnL', value: formatCurrency(data.last_7_days_pnl), icon: <BarChart3 className="w-3 h-3" />, subColor: getPnlColor(data.last_7_days_pnl) },
    { label: 'Aylık PnL', value: formatCurrency(data.mtd_pnl), icon: <TrendingDown className="w-3 h-3" /> },
    { label: 'Yıllık PnL', value: formatCurrency(data.ytd_pnl), icon: <TrendingUp className="w-3 h-3" /> },
    { label: 'Nakit', value: formatCurrency(data.cash_available), icon: <DollarSign className="w-3 h-3" /> },
    { label: 'Marjin', value: formatCurrency(data.margin_used), icon: <Shield className="w-3 h-3" /> },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
      {metrics.map((m: any) => (
        <MetricCard
          key={m.label}
          label={m.label}
          value={m.value}
          sub={m.sub}
          subColor={m.subColor}
          icon={m.icon}
          highlight={m.highlight}
        />
      ))}
    </div>
  )
}

/* ──────────────────────────────────────────────────────────
   VIX Bazlı Risk Göstergesi – ABD Piyasa Standartları
   ──────────────────────────────────────────────────────── */

interface VixTier {
  label: string
  color: string
  bgClass: string
  borderClass: string
  textClass: string
  icon: React.ReactNode
  message: string
  suggestion: string
}

function getVixTier(vix: number): VixTier {
  if (vix <= 12) {
    return {
      label: 'ÇOK DÜŞÜK VOLATİLİTE',
      color: 'green',
      bgClass: 'bg-finma-green/8',
      borderClass: 'border-finma-green/25',
      textClass: 'text-finma-green',
      icon: <ShieldCheck className="w-4 h-4" />,
      message: `VIX ${vix.toFixed(2)} seviyesinde – piyasalar oldukça sakin. Tarihsel ortalama (≈19-20) altında, düşük korku ortamı.`,
      suggestion: 'Trend takibi stratejileri uygun olabilir. Düşük volatilite uzun süre devam etmeyebilir, ani hareketlere karşı tetikte kalın.',
    }
  }
  if (vix <= 20) {
    return {
      label: 'NORMAL VOLATİLİTE',
      color: 'green',
      bgClass: 'bg-finma-green/8',
      borderClass: 'border-finma-green/25',
      textClass: 'text-finma-green',
      icon: <ShieldCheck className="w-4 h-4" />,
      message: `VIX ${vix.toFixed(2)} – tarihsel ortalama aralığında. Piyasa koşulları standart seyrini koruyor.`,
      suggestion: 'Normal pozisyon büyüklükleri ile işlem yapılabilir. Temel ve teknik analiz uyumlu çalışıyor.',
    }
  }
  if (vix <= 25) {
    return {
      label: 'ARTAN VOLATİLİTE',
      color: 'yellow',
      bgClass: 'bg-finma-yellow/8',
      borderClass: 'border-finma-yellow/25',
      textClass: 'text-finma-yellow',
      icon: <Info className="w-4 h-4" />,
      message: `VIX ${vix.toFixed(2)} – ortalamanın üzerine çıktı. Yatırımcılarda temkinli bir bekleyiş hakim.`,
      suggestion: 'Pozisyon büyüklüklerini gözden geçirmek faydalı olabilir. Stop-loss seviyelerini biraz daha geniş tutmayı düşünebilirsiniz.',
    }
  }
  if (vix <= 30) {
    return {
      label: 'YÜKSEK VOLATİLİTE',
      color: 'orange',
      bgClass: 'bg-orange-500/8',
      borderClass: 'border-orange-500/25',
      textClass: 'text-orange-400',
      icon: <ShieldAlert className="w-4 h-4" />,
      message: `VIX ${vix.toFixed(2)} – belirgin bir belirsizlik ortamı. Piyasa katılımcıları koruma pozisyonlarına yöneliyor.`,
      suggestion: 'Yeni pozisyon açmadan önce risk/ödül oranını dikkatle değerlendirin. Portföy çeşitlendirmesi ve nakit oranını artırmak mantıklı olabilir.',
    }
  }
  // VIX > 30
  return {
    label: 'AŞIRI VOLATİLİTE',
    color: 'red',
    bgClass: 'bg-finma-red/8',
    borderClass: 'border-finma-red/25',
    textClass: 'text-finma-red',
    icon: <AlertTriangle className="w-4 h-4" />,
    message: `VIX ${vix.toFixed(2)} – piyasalarda ciddi bir stres gözlemleniyor. Tarihsel olarak bu seviyeler genellikle kısa süreli oluyor.`,
    suggestion: 'Sermaye koruma öncelikli olmalı. Mevcut pozisyonları gözden geçirin, yeni agresif pozisyonlardan kaçınmak prudent bir yaklaşım olabilir.',
  }
}

export function RiskBanner({ vix }: { vix: number }) {
  const tier = getVixTier(vix)

  return (
    <div
      className={cn(
        'flex items-start gap-3 px-4 py-2.5 rounded-md text-sm border',
        tier.bgClass,
        tier.borderClass
      )}
    >
      <span className={cn('shrink-0 mt-0.5', tier.textClass)}>{tier.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-bold text-xs tracking-wide', tier.textClass)}>
            {tier.label}
          </span>
          <span className={cn('finma-number text-[11px] font-semibold px-1.5 py-0.5 rounded', tier.bgClass, tier.textClass)}>
            VIX: {vix.toFixed(2)}
          </span>
        </div>
        <p className="text-xs text-finma-text-muted mt-1 leading-relaxed">
          {tier.message}
        </p>
        <p className={cn('text-[11px] mt-1 leading-relaxed opacity-80', tier.textClass)}>
          💡 {tier.suggestion}
        </p>
      </div>
    </div>
  )
}
