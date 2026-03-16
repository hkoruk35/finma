'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import {
  Activity,
  TrendingUp,
  Brain,
  BarChart3,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  LineChart,
  Target,
  Globe,
} from 'lucide-react'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void
          renderButton: (element: HTMLElement, config: any) => void
          prompt: () => void
        }
      }
    }
  }
}

/* ── Featured stocks — default: gerçek Swing112 verileri, API'den güncellenir ── */
const DEFAULT_PREVIEW_STOCKS = [
  { symbol: 'CGON', sector: 'Energy',     score: 35.1, badge: 'BUY', potential: '+10.0%' },
  { symbol: 'LXU',  sector: 'Materials',  score: 33.5, badge: 'BUY', potential: '+10.0%' },
  { symbol: 'ADEA', sector: 'Technology', score: 32.5, badge: 'BUY', potential: '+9.9%'  },
  { symbol: 'PBR',  sector: 'Energy',     score: 30.4, badge: 'BUY', potential: '+7.7%'  },
  { symbol: 'STGW', sector: 'Technology', score: 30.0, badge: 'BUY', potential: '+10.1%' },
]

const features = [
  {
    icon: Brain,
    title: 'Yapay Zeka Analizi',
    desc: 'GPT destekli piyasa analizi, hisse değerlendirme ve otomatik sinyal üretimi.',
  },
  {
    icon: BarChart3,
    title: 'Piyasa İstihbaratı',
    desc: 'VIX, sektör rotasyonu, para akışı ve makro sinyaller tek panelde.',
  },
  {
    icon: Target,
    title: 'Günlük Öne Çıkanlar',
    desc: 'Her gün algoritmamızın seçtiği en güçlü 5 hisse ve performans analizi.',
  },
  {
    icon: LineChart,
    title: 'Profesyonel Grafikler',
    desc: 'TradingView entegrasyonu ile gelişmiş teknik analiz araçları.',
  },
  {
    icon: Zap,
    title: 'Anlık Sinyaller',
    desc: 'Alış/satış sinyalleri, stop-loss uyarıları ve portföy bildirimleri.',
  },
  {
    icon: Globe,
    title: 'ABD Borsası Odaklı',
    desc: 'S&P 500, NASDAQ, Dow Jones — tüm büyük ABD endeksleri ve hisseleri.',
  },
]

const proFeatures = [
  'AI destekli hisse analizi & skorlama',
  'Günlük 5 öne çıkan hisse seçimi',
  'Piyasa istihbaratı & rejim analizi',
  'İşlem açma/kapama & portföy yönetimi',
  'Profesyonel TradingView grafikleri',
  'Sektör heatmap & para akışı verileri',
  'Makro ekonomik takvim & sinyaller',
  'Telegram bildirim entegrasyonu',
]

export default function LandingPage() {
  const { isAuthenticated, login } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previewStocks, setPreviewStocks] = useState(DEFAULT_PREVIEW_STOCKS)

  // Canlı sinyal verilerini çek (bot push edince otomatik güncellenir)
  useEffect(() => {
    api.getFeaturedSignals(5)
      .then((data) => {
        if (data?.featured?.length) {
          setPreviewStocks(data.featured.map((c: any) => ({
            symbol: c.ticker,
            sector: c.sector,
            score: c.score,
            badge: c.action,
            potential: `+${c.potential_pct?.toFixed(1)}%`,
          })))
        }
      })
      .catch(() => { /* fallback: default veriler kalır */ })
  }, [])

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard')
    }
  }, [isAuthenticated, router])

  const handleGoogleResponse = useCallback(async (response: any) => {
    setLoading(true)
    setError('')
    try {
      const result = await api.googleLogin(response.credential)
      login(result.access_token, result.user as any)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Google ile giriş yapılamadı')
    } finally {
      setLoading(false)
    }
  }, [login, router])

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return

    const initGoogle = () => {
      if (!window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        auto_select: false,
      })

      const btnEl = document.getElementById('hero-google-btn')
      if (btnEl) {
        window.google.accounts.id.renderButton(btnEl, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
          locale: 'tr',
        })
      }

      const btnEl2 = document.getElementById('cta-google-btn')
      if (btnEl2) {
        window.google.accounts.id.renderButton(btnEl2, {
          type: 'standard',
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
          width: 320,
          locale: 'tr',
        })
      }
    }

    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval)
          initGoogle()
        }
      }, 100)
      const timeout = setTimeout(() => clearInterval(interval), 5000)
      return () => { clearInterval(interval); clearTimeout(timeout) }
    }
  }, [handleGoogleResponse])

  return (
    <div className="min-h-screen bg-finma-bg text-white">
      {/* ─── Navbar ─── */}
      <nav className="fixed top-0 w-full z-50 bg-finma-bg/80 backdrop-blur-xl border-b border-finma-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Activity className="w-7 h-7 text-finma-primary" />
            <div className="flex">
              <span className="text-xl font-bold text-white">Fin</span>
              <span className="text-xl font-bold text-finma-primary">MA</span>
            </div>
            <span className="text-[10px] text-finma-text-dim ml-1 font-mono">v4.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm text-finma-text-dim">
              Aylık $19 USD
            </span>
            <a
              href="#pricing"
              className="finma-btn-primary text-sm px-5 py-2 flex items-center gap-2"
            >
              Başla <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-finma-primary/10 border border-finma-primary/30 mb-6">
            <Brain className="w-4 h-4 text-finma-primary" />
            <span className="text-xs text-finma-primary font-medium">
              Yapay Zeka Destekli Finans Platformu
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
            ABD Borsalarında
            <br />
            <span className="text-finma-primary">Akıllı Yatırım</span> Kararları
          </h1>

          <p className="text-lg sm:text-xl text-finma-text-muted max-w-2xl mx-auto mb-8">
            Her gün yapay zeka algoritmamızın seçtiği en güçlü hisseleri keşfedin.
            Piyasa istihbaratı, sinyal botları ve portföy yönetimi — tek platformda.
          </p>

          <div className="flex flex-col items-center gap-4 mb-6">
            <div id="hero-google-btn" />
            {loading && (
              <p className="text-xs text-finma-text-dim">Giriş yapılıyor...</p>
            )}
            {error && (
              <p className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <p className="text-xs text-finma-text-dim">
            Aylık $19 USD · İstediğin zaman iptal
          </p>
        </div>
      </section>

      {/* ─── Terminal Preview ─── */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-2xl border border-finma-border/50 bg-finma-card overflow-hidden shadow-2xl shadow-finma-primary/5">
            {/* Fake terminal bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-finma-border/50 bg-finma-sidebar">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-finma-red/70" />
                <div className="w-3 h-3 rounded-full bg-finma-yellow/70" />
                <div className="w-3 h-3 rounded-full bg-finma-green/70" />
              </div>
              <span className="text-xs text-finma-text-dim ml-2 font-mono">finmasmart.com/dashboard</span>
            </div>

            {/* Featured stocks preview */}
            <div className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-finma-primary" />
                <h3 className="text-sm font-bold text-white">BUGÜNÜN ÖNE ÇIKANLARI</h3>
                <span className="text-[10px] text-finma-text-dim">(AI tarafından seçildi)</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {previewStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className="bg-finma-bg/50 border border-finma-border/50 rounded-lg p-3 hover:border-finma-primary/30 transition-all"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">{stock.symbol}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-finma-green/20 text-finma-green font-medium">
                        {stock.badge}
                      </span>
                    </div>
                    <div className="text-[10px] text-finma-text-dim mb-1">{stock.sector}</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-finma-primary font-semibold">Skor: {stock.score}</span>
                      <span className="text-xs text-finma-green font-medium">{stock.potential}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Blur overlay */}
              <div className="relative mt-6">
                <div className="h-40 bg-gradient-to-b from-finma-card/0 via-finma-card/80 to-finma-card flex items-end justify-center pb-4">
                  <div className="flex items-center gap-2 text-sm text-finma-text-dim">
                    <Shield className="w-4 h-4" />
                    <span>Tüm verilere erişmek için üye olun</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="pb-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">
              Yatırımcılar İçin <span className="text-finma-primary">Tasarlandı</span>
            </h2>
            <p className="text-finma-text-muted max-w-xl mx-auto">
              Bloomberg kalitesinde terminal deneyimi, yapay zeka desteğiyle birleştirildi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feat) => (
              <div
                key={feat.title}
                className="bg-finma-card border border-finma-border/50 rounded-xl p-6 hover:border-finma-primary/30 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-finma-primary/10 flex items-center justify-center mb-4 group-hover:bg-finma-primary/20 transition-colors">
                  <feat.icon className="w-5 h-5 text-finma-primary" />
                </div>
                <h3 className="text-sm font-bold text-white mb-2">{feat.title}</h3>
                <p className="text-xs text-finma-text-dim leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="pb-20 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">
              Tek Plan, <span className="text-finma-primary">Tüm Özellikler</span>
            </h2>
            <p className="text-finma-text-muted">
              Hemen başlayın, istediğiniz zaman iptal edin.
            </p>
          </div>

          <div className="bg-finma-card border-2 border-finma-primary/50 rounded-2xl p-8 relative overflow-hidden">
            {/* Popular badge */}
            <div className="absolute top-0 right-0 bg-finma-primary text-finma-bg text-xs font-bold px-4 py-1 rounded-bl-xl">
              EN POPÜLER
            </div>

            <div className="text-center mb-6">
              <h3 className="text-lg font-bold text-white mb-1">Pro Üyelik</h3>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-4xl font-bold text-white">$19</span>
                <span className="text-finma-text-dim">/ay</span>
              </div>
              <p className="text-xs text-finma-green font-medium">
                İstediğiniz zaman iptal edebilirsiniz
              </p>
            </div>

            <div className="space-y-3 mb-8">
              {proFeatures.map((feat) => (
                <div key={feat} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-finma-green shrink-0 mt-0.5" />
                  <span className="text-sm text-finma-text">{feat}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div id="cta-google-btn" />
              <p className="text-[10px] text-finma-text-dim text-center">
                Google hesabınızla giriş yaparak hemen başlayın.
                <br />
                Aylık $19 USD. İstediğiniz zaman iptal edin.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Stats ─── */}
      <section className="pb-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {[
              { value: 'S&P 500', label: 'Endeks Takibi' },
              { value: '7000+', label: 'Hisse Analizi' },
              { value: 'AI', label: 'Destekli Sinyaller' },
              { value: '7/24', label: 'Veri Akışı' },
            ].map((stat) => (
              <div key={stat.label} className="bg-finma-card/50 border border-finma-border/30 rounded-xl p-4">
                <div className="text-xl font-bold text-finma-primary mb-1">{stat.value}</div>
                <div className="text-xs text-finma-text-dim">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-finma-border/30 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-[10px] text-finma-text-dim">
            <div className="flex items-center gap-1">
              <Activity className="w-5 h-5 text-finma-primary" />
              <div className="flex">
                <span className="text-sm font-bold text-white">Fin</span>
                <span className="text-sm font-bold text-finma-primary">MA</span>
              </div>
              <span className="text-[10px] text-finma-text-dim ml-1">v4.0</span>
            </div>
            <span className="text-[10px] text-finma-text-dim">Developed by <span className="text-finma-primary font-semibold">AFK DaSYS</span></span>
          </div>
          <div className="flex items-center gap-6 text-[10px] text-finma-text-dim">
            <span>Gizlilik Politikası</span>
            <span>Kullanım Koşulları</span>
            <span>KVKK</span>
            <span>SPK Uyarısı</span>
          </div>
          <div className="text-[10px] text-finma-text-dim">
            &copy; 2026 FinMA. Tüm hakları saklıdır.
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-4 text-center">
          <p className="text-[9px] text-finma-text-dim/60 leading-relaxed max-w-3xl mx-auto">
            Yatırım danışmanlığı kapsamında değildir. Burada yer alan bilgiler yatırım tavsiyesi niteliği taşımamaktadır.
            Yatırım kararlarınız tamamen kendi sorumluluğunuzdadır. Geçmiş performans gelecekteki sonuçların garantisi değildir.
            SPK lisanslı yatırım kuruluşlarından profesyonel destek almanız önerilir.
          </p>
        </div>
      </footer>
    </div>
  )
}
