'use client'

import { Card } from '@/components/shared/Card'
import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent, getPnlColor } from '@/lib/utils'
import type { PortfolioSnapshot } from '@/types'
import { Wallet, TrendingUp, TrendingDown, BarChart3, DollarSign, Shield, AlertTriangle, ShieldCheck, ShieldAlert, Info } from 'lucide-react'

interface HUDMetricsProps {
  data: PortfolioSnapshot
}

interface MetricCardProps {
  label: string
  value: string
  change?: number
  changeSuffix?: string
  icon: React.ReactNode
  highlight?: boolean
}

function MetricCard({ label, value, change, changeSuffix = '%', icon, highlight }: MetricCardProps) {
  return (
    <Card padding="sm" className={cn('flex flex-col gap-1.5', highlight && 'border-finma-primary/30')}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-finma-text-dim uppercase tracking-wider font-medium">
          {label}
        </span>
        <span className="text-finma-text-dim">{icon}</span>
      </div>
      <div className="finma-number text-xl font-bold text-white">
        {value}
      </div>
      {change !== undefined && (
        <div className={cn('finma-number text-xs font-medium', getPnlColor(change))}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}{changeSuffix}
        </div>
      )}
    </Card>
  )
}

export function HUDMetrics({ data }: HUDMetricsProps) {
  // %30 küçültme: 7'den 5'ye indir
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
      <MetricCard
        label="Net Likidite"
        value={formatCurrency(data.net_liquidation)}
        change={0.05}
        icon={<Wallet className="w-3.5 h-3.5" />}
        highlight
      />
      <MetricCard
        label="Günlük PnL"
        value={formatCurrency(data.current_24h_pnl)}
        change={data.current_24h_pnl}
        changeSuffix="%"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="7 Gün PnL"
        value={formatCurrency(data.last_7_days_pnl)}
        change={data.last_7_days_pnl}
        changeSuffix="%"
        icon={<BarChart3 className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Nakit"
        value={formatCurrency(data.cash_available)}
        icon={<DollarSign className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Marjin"
        value={formatCurrency(data.margin_used)}
        icon={<Shield className="w-3.5 h-3.5" />}
      />
    </div>
  )
}

// Admin versiyonu - global istatistikler
interface AdminHUDProps {
  totalUsers: number
  freeUsers: number
  proUsers: number
  adminUsers: number
  activeTrades: number
  botsRunning: string
  totalRevenue: number
}

export function AdminHUDMetrics({ totalUsers, freeUsers, proUsers, adminUsers, activeTrades, botsRunning, totalRevenue }: AdminHUDProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2.5">
      <MetricCard
        label="Toplam Üyeler"
        value={totalUsers.toString()}
        change={((proUsers + adminUsers) / totalUsers) * 100}
        changeSuffix="% Ücretli"
        icon={<Wallet className="w-3.5 h-3.5" />}
        highlight
      />
      <MetricCard
        label="Free Üyeler"
        value={freeUsers.toString()}
        change={((freeUsers / totalUsers) * 100)}
        changeSuffix="%"
        icon={<Shield className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Pro Üyeler"
        value={proUsers.toString()}
        change={((proUsers / totalUsers) * 100)}
        changeSuffix="%"
        icon={<TrendingUp className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Admin Üyeler"
        value={adminUsers.toString()}
        change={((adminUsers / totalUsers) * 100)}
        changeSuffix="%"
        icon={<Shield className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Aktif İşlem"
        value={activeTrades.toString()}
        icon={<BarChart3 className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Boş Çalışan"
        value={botsRunning}
        icon={<DollarSign className="w-3.5 h-3.5" />}
      />
      <MetricCard
        label="Aylık Gelir"
        value={formatCurrency(totalRevenue)}
        icon={<TrendingUp className="w-3.5 h-3.5" />}
      />
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
