'use client'

import { cn } from '@/lib/utils'

type BadgeVariant = 'buy' | 'sell' | 'hold' | 'close' | 'default' | 'bull' | 'bear'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  buy:     'bg-finma-green/15 text-finma-green border-finma-green/30',
  sell:    'bg-finma-red/15 text-finma-red border-finma-red/30',
  hold:    'bg-finma-yellow/15 text-finma-yellow border-finma-yellow/30',
  close:   'bg-finma-purple/15 text-finma-purple border-finma-purple/30',
  bull:    'bg-finma-green/15 text-finma-green border-finma-green/30',
  bear:    'bg-finma-red/15 text-finma-red border-finma-red/30',
  default: 'bg-finma-card text-finma-text-muted border-finma-border',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

/* ─── Türkçe aksiyon etiketleri ─── */
const actionLabel: Record<string, string> = {
  BUY:   'AL',
  SELL:  'SAT',
  HOLD:  'TUT',
  CLOSE: 'KAPAT',
  SHORT: 'AÇİĞA SAT',
  WATCH: 'İZLE',
}

const actionVariant: Record<string, BadgeVariant> = {
  BUY:   'buy',
  SELL:  'sell',
  HOLD:  'hold',
  CLOSE: 'close',
  SHORT: 'sell',
  WATCH: 'default',
}

export function ActionBadge({ action }: { action: string }) {
  const variant  = actionVariant[action] ?? 'default'
  const label    = actionLabel[action]   ?? action
  return <Badge variant={variant}>{label}</Badge>
}

/* ─── Türkçe piyasa rejimi etiketi ─── */
export function RegimeBadge({ regime }: { regime: string }) {
  const isBull = regime === 'Bull'
  return (
    <Badge variant={isBull ? 'bull' : 'bear'}>
      {isBull ? '🐂 Boğa' : '🐻 Ayı'}
    </Badge>
  )
}

/* ─── Türkçe sektör adı haritası ─── */
export const sectorTR: Record<string, string> = {
  'Energy':          'Enerji',
  'Technology':      'Teknoloji',
  'Industrials':     'Sanayi',
  'Real Estate':     'Gayrimenkul',
  'Materials':       'Hammadde',
  'Consumer':        'Tüketici',
  'Communication':   'İletişim',
  'Healthcare':      'Sağlık',
  'Financials':      'Finans',
  'Utilities':       'Kamu Hizmetleri',
  'Consumer Staples':'Temel Tüketim',
  'Crypto':          'Kripto',
  'Commodity':       'Emtia',
  'Index':           'Endeks',
}

export function sectorLabel(en: string): string {
  return sectorTR[en] ?? en
}
