'use client'

import Link from 'next/link'
import { X, Crown, Zap, Check, Lock } from 'lucide-react'

/* ─── Tip: Hangi paywall gösterilsin ─────────────────────────────────────── */
export type PaywallType = 'stock_quota' | 'tracking_limit' | 'pro_required'

interface PaywallModalProps {
  type:    PaywallType
  onClose: () => void
}

const PAYWALL_CONTENT: Record<PaywallType, {
  icon:    React.ElementType
  iconColor: string
  title:   string
  desc:    string
  plan:    string
  price:   string
  features: string[]
  cta:     string
  ctaHref: string
}> = {
  stock_quota: {
    icon:      Crown,
    iconColor: 'text-finma-primary',
    title:     'Günlük limit doldu',
    desc:      'Free planda günde 3 hisse detayı görüntüleyebilirsiniz. Sınırsız analiz için Pro\'ya geçin.',
    plan:      'Pro',
    price:     '$19/ay',
    features:  [
      'Sınırsız hisse detayı',
      'Tüm 54 hisse listesi',
      'Sektör Liderleri erişimi',
      'Market Movers erişimi',
      '7 dil AI analizi',
    ],
    cta:     'Pro\'ya Geç',
    ctaHref: '/pricing',
  },
  tracking_limit: {
    icon:      Zap,
    iconColor: 'text-finma-cyan',
    title:     'Takip limiti doldu',
    desc:      'Free planda 1 hisse takip edebilirsiniz. Daha fazlası için Smart Tracking add-on\'u alın.',
    plan:      'Smart Tracking',
    price:     '$29/ay',
    features:  [
      '5 hisse takibi',
      'Canlı direktifler (5 dk)',
      'Day-Trade / Swing profil',
      'Push bildirimleri',
      'Tüm Pro özellikleri dahil',
    ],
    cta:     'Smart Tracking Başlat',
    ctaHref: '/pricing',
  },
  pro_required: {
    icon:      Lock,
    iconColor: 'text-finma-yellow',
    title:     'Pro üyelik gerekli',
    desc:      'Bu özelliğe erişmek için Pro veya üzeri plan gereklidir.',
    plan:      'Pro',
    price:     '$19/ay',
    features:  [
      'Sınırsız hisse analizi',
      'Sektör Liderleri',
      'Market Movers',
      'Tüm 54 hisse listesi',
      '7 dil AI analizi',
    ],
    cta:     'Pro\'ya Geç',
    ctaHref: '/pricing',
  },
}

export function PaywallModal({ type, onClose }: PaywallModalProps) {
  const content = PAYWALL_CONTENT[type]
  const Icon    = content.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-finma-surface border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5 relative">
        {/* Kapat */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-finma-text-dim hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* İkon + Başlık */}
        <div className="text-center space-y-3 pt-2">
          <div className={`w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto`}>
            <Icon className={`w-6 h-6 ${content.iconColor}`} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">{content.title}</h2>
            <p className="text-xs text-finma-text-dim mt-1 leading-relaxed">{content.desc}</p>
          </div>
        </div>

        {/* Plan kutusu */}
        <div className="rounded-xl border border-finma-primary/30 bg-finma-primary/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-white">{content.plan}</span>
            <span className="text-sm font-bold text-finma-primary">{content.price}</span>
          </div>
          <ul className="space-y-1.5">
            {content.features.map(f => (
              <li key={f} className="flex items-center gap-2 text-xs text-finma-text-dim">
                <Check className="w-3.5 h-3.5 text-finma-green shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Butonlar */}
        <div className="space-y-2">
          <Link
            href={content.ctaHref}
            className="block w-full text-center py-2.5 rounded-xl finma-btn-primary text-sm font-semibold"
          >
            {content.cta}
          </Link>
          <button
            onClick={onClose}
            className="block w-full text-center py-2 text-xs text-finma-text-dim hover:text-white transition-colors"
          >
            Şimdi değil
          </button>
        </div>

        {/* Yasal */}
        <p className="text-xs text-finma-text-dim/40 text-center leading-relaxed">
          7 gün ücretsiz · Kredi kartı gerekmez · İstediğin zaman iptal
        </p>
      </div>
    </div>
  )
}

/* ─── Inline Lock Banner (tracking sayfası için) ─────────────────────────── */

export function TrackingLockBanner({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="rounded-xl border border-finma-cyan/30 bg-finma-cyan/5 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4 text-finma-cyan" />
        <p className="text-sm font-semibold text-white">Takip limiti doldu</p>
      </div>
      <p className="text-xs text-finma-text-dim leading-relaxed">
        Free planda 1 hisse takip edebilirsiniz.
        Daha fazla hisse için Smart Tracking add-on'unu edinin.
      </p>
      <div className="flex gap-2">
        <Link
          href="/pricing"
          className="flex-1 text-center py-2 rounded-lg finma-btn-primary text-xs font-semibold"
        >
          Smart Tracking — $29/ay
        </Link>
        <button
          onClick={onUpgrade}
          className="px-3 py-2 rounded-lg bg-white/5 text-xs text-finma-text-dim hover:bg-white/10"
        >
          Detay
        </button>
      </div>
    </div>
  )
}
