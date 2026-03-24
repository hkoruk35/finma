'use client'

import Link from 'next/link'
import { Check, X, Activity, Crown, Zap, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ── Plan verileri ─────────────────────────────────────────────────────────── */

const FEATURES = [
  { label: 'Dashboard (Top Hisseler)',   free: '5 hisse',  pro: '54 hisse',     tracking: '10 hisse'   },
  { label: 'AI Analiz (Senaryo Metni)', free: '3/gün',    pro: 'Sınırsız',     tracking: 'Sınırsız'    },
  { label: 'Sektör Liderleri',          free: false,       pro: true,           tracking: true          },
  { label: 'Market Movers',             free: false,       pro: true,           tracking: true          },
  { label: 'Explore All (54 hisse)',    free: false,       pro: true,           tracking: true          },
  { label: '7 Dil Desteği',            free: '1 dil',    pro: '7 dil',        tracking: '7 dil'       },
  { label: 'Smart Tracking',           free: false,       pro: '5 hisse',       tracking: '10 hisse'    },
  { label: 'Momentum Değişim Alerts',   free: false,       pro: false,          tracking: true          },
  { label: 'Push Bildirimleri',         free: false,       pro: false,          tracking: true          },
  { label: 'Trend Analysis',            free: false,       pro: false,          tracking: true          },
  { label: 'Hisse Detay Sayfası',      free: false,       pro: true,           tracking: true          },
]

function FeatureValue({ val }: { val: string | boolean | undefined }) {
  if (val === true)  return <Check className="w-4 h-4 text-finma-green mx-auto" />
  if (val === false) return <X className="w-4 h-4 text-finma-text-dim/30 mx-auto" />
  return <span className="text-xs text-finma-text-dim">{val}</span>
}

/* ── Ana Sayfa ─────────────────────────────────────────────────────────────── */

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-finma-bg text-white">

      {/* ── Navbar ── */}
      <nav className="border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-finma-primary" />
          <span className="text-sm font-bold text-white">FinMA</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-finma-text-dim hover:text-white transition-colors">
            Giriş Yap
          </Link>
          <Link
            href="/login"
            className="finma-btn-primary text-xs px-4 py-2 rounded-lg"
          >
            Ücretsiz Başla
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">

        {/* ── Baslik ── */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-finma-primary/10 border border-finma-primary/20 text-finma-primary text-xs font-semibold">
            <Zap className="w-3.5 h-3.5" />
            8.000+ Hisse → 54 Seçim · Her Gün 2x
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">
            Doğru plan,
            <br />
            <span className="text-finma-primary">doğru fiyat</span>
          </h1>
          <p className="text-finma-text-dim max-w-lg mx-auto text-sm leading-relaxed">
            7 gün ücretsiz dene. Kredi kartı gerekmez.
            İstediğin zaman iptal et.
          </p>
        </div>

        {/* ── Plan kartlari ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Free Trial */}
          <div className="rounded-2xl border border-white/10 bg-white/3 p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-finma-text-dim" />
                <span className="text-sm font-semibold text-white">Free Trial</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">$0</span>
                <span className="text-finma-text-dim text-sm">/ 7 gün</span>
              </div>
              <p className="text-xs text-finma-text-dim mt-2">Temel özellikleri keşfet</p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-xl bg-white/10 border border-white/10 text-sm font-semibold text-white hover:bg-white/15 transition-colors"
            >
              Ücretsiz Başla
            </Link>
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-finma-primary/40 bg-finma-primary/5 p-6 space-y-6 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="text-xs px-3 py-1 rounded-full bg-finma-primary text-white font-semibold">
                En Popüler
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Crown className="w-4 h-4 text-finma-primary" />
                <span className="text-sm font-semibold text-white">Pro</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">$29</span>
                <span className="text-finma-text-dim text-sm">/ ay</span>
              </div>
              <p className="text-xs text-finma-text-dim mt-2">54 hisse, 5 takip hissesi dahil</p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-xl finma-btn-primary text-sm font-semibold"
            >
              Pro'ya Geç
            </Link>
          </div>

          {/* Smart Tracking */}
          <div className="rounded-2xl border border-finma-cyan/30 bg-finma-cyan/5 p-6 space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-finma-cyan" />
                <span className="text-sm font-semibold text-white">Smart Tracking</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-white">$19</span>
                <span className="text-finma-text-dim text-sm">/ hafta</span>
              </div>
              <p className="text-xs text-finma-text-dim mt-2">10 hisse, akıllı alerts</p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 rounded-xl border border-finma-cyan/40 bg-finma-cyan/10 text-sm font-semibold text-finma-cyan hover:bg-finma-cyan/20 transition-colors"
            >
              Smart Tracking Başlat
            </Link>
          </div>
        </div>

        {/* ── Özellik tablosu ── */}
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          {/* Baslik satiri */}
          <div className="grid grid-cols-4 gap-0 bg-white/5 border-b border-white/8 px-4 py-3">
            <div className="text-xs font-semibold text-finma-text-dim">Özellik</div>
            <div className="text-center text-xs font-semibold text-finma-text-dim">Free</div>
            <div className="text-center text-xs font-semibold text-finma-primary">Pro</div>
            <div className="text-center text-xs font-semibold text-finma-cyan">Smart</div>
          </div>

          {FEATURES.map((f, i) => (
            <div
              key={f.label}
              className={cn(
                'grid grid-cols-4 gap-0 px-4 py-3 text-sm border-b border-white/5',
                i % 2 === 0 ? '' : 'bg-white/2'
              )}
            >
              <div className="text-xs text-finma-text-dim flex items-center">{f.label}</div>
              <div className="flex items-center justify-center"><FeatureValue val={f.free} /></div>
              <div className="flex items-center justify-center"><FeatureValue val={f.pro} /></div>
              <div className="flex items-center justify-center"><FeatureValue val={f.tracking} /></div>
            </div>
          ))}
        </div>

        {/* ── SSS ── */}
        <div className="space-y-4 max-w-2xl mx-auto">
          <h2 className="text-lg font-bold text-white text-center">Sık Sorulan Sorular</h2>
          {[
            {
              q: 'Kredi kartı gerekiyor mu?',
              a: '7 günlük deneme süresi için kredi kartı gerekmez. Pro plana geçerken Stripe üzerinden güvenli ödeme yapılır.',
            },
            {
              q: 'Smart Tracking\'i Pro olmadan alabilir miyim?',
              a: 'Smart Tracking bir add-on\'dur. Pro plan içeriğini kapsar ve üzerine canlı direktif ile push bildirimleri ekler.',
            },
            {
              q: 'FinMA yatırım tavsiyesi mi veriyor?',
              a: 'Hayır. FinMA bir karar destek platformudur. Tüm analizler bilgilendirme amaçlıdır; yatırım tavsiyesi değildir.',
            },
            {
              q: 'İptal edebilir miyim?',
              a: 'Dilediğin zaman iptal edebilirsin. İptal sonrası dönem sonuna kadar erişimin devam eder.',
            },
          ].map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
              <p className="text-sm font-semibold text-white">{q}</p>
              <p className="text-xs text-finma-text-dim leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* ── CTA ── */}
        <div className="text-center space-y-4">
          <Link
            href="/login"
            className="inline-block finma-btn-primary px-8 py-3 text-sm font-semibold rounded-xl"
          >
            7 Gün Ücretsiz Başla
          </Link>
          <p className="text-xs text-finma-text-dim">
            Hukuki bilgi için:{' '}
            <Link href="/legal/terms" className="text-finma-primary hover:underline inline-flex items-center gap-0.5">
              Kullanım Koşulları <ExternalLink className="w-3 h-3" />
            </Link>
            {' · '}
            <Link href="/legal/risk" className="text-finma-primary hover:underline inline-flex items-center gap-0.5">
              Risk Açıklaması <ExternalLink className="w-3 h-3" />
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
