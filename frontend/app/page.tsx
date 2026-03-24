'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { api } from '@/lib/api-client'
import {
  Activity, Brain, BarChart3, Shield, Zap, ArrowRight,
  CheckCircle2, LineChart, Target, Globe2, TrendingUp,
  Filter, ChevronDown, Layers, Cpu, Radio, Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Dil sistemi ────────────────────────────────────────────────────────────

const LANGS = [
  { code: 'tr', label: 'Türkçe',    flag: '🇹🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵' },
]

const COPY: Record<string, Record<string, string>> = {
  tr: {
    badge:      'Yapay Zeka Destekli Finans Platformu',
    hero1:      'ABD Borsalarında',
    hero2:      'Akıllı Yatırım',
    hero3:      'Zamanı',
    sub:        'Her gün 8.000+ hisseyi tarayan algoritmamız en güçlü 54 fırsatı seçer. Sektör analizi, AI yorumlar ve 7 dilde erişim — tek platformda.',
    cta:        'Hemen Başla',
    price_note: 'Aylık SADECE $19 USD',
    feat_title: 'Analizlerde Kaybolmayın',
    feat_sub:   'Yeni nesil finans deneyimi.',
    plan_title: 'Tek Plan, Tüm Özellikler',
    plan_sub:   'Hemen başlayın, istediğiniz zaman iptal edin.',
    plan_name:  'Pro Üyelik',
    plan_cta:   'Google ile Başla',
    plan_legal: 'Google hesabınızla giriş yaparak hemen başlayın.',
    cancel:     'İstediğiniz zaman iptal edebilirsiniz',
    pipeline:   '8.000+ Hisse Tarama → 200 Shortlist → 54 Seçim',
    member_cta: 'Üye girişi',
  },
  en: {
    badge:      'AI-Powered Finance Platform',
    hero1:      'Smart Investing in',
    hero2:      'US Markets',
    hero3:      'Starts Here',
    sub:        'Our algorithm scans 8,000+ stocks daily and selects the 54 strongest opportunities. Sector analysis, AI commentary in 7 languages — one platform.',
    cta:        'Get Started',
    price_note: 'Only $19 USD / month',
    feat_title: 'Stop Getting Lost in Analysis',
    feat_sub:   'Next-generation finance experience.',
    plan_title: 'One Plan, All Features',
    plan_sub:   'Start now, cancel anytime.',
    plan_name:  'Pro Membership',
    plan_cta:   'Start with Google',
    plan_legal: 'Sign in with your Google account to get started.',
    cancel:     'Cancel anytime',
    pipeline:   '8,000+ Stocks Scanned → 200 Shortlist → 54 Selected',
    member_cta: 'Sign in',
  },
  es: {
    badge:      'Plataforma Financiera con IA',
    hero1:      'Inversión Inteligente en',
    hero2:      'Mercados de EE.UU.',
    hero3:      'Empieza Aquí',
    sub:        'Nuestro algoritmo escanea más de 8.000 acciones diariamente y selecciona las 54 mejores oportunidades.',
    cta:        'Comenzar',
    price_note: 'Solo $19 USD / mes',
    feat_title: 'No Te Pierdas en los Análisis',
    feat_sub:   'Experiencia financiera de nueva generación.',
    plan_title: 'Un Plan, Todo Incluido',
    plan_sub:   'Empieza ahora, cancela cuando quieras.',
    plan_name:  'Membresía Pro',
    plan_cta:   'Empezar con Google',
    plan_legal: 'Inicia sesión con tu cuenta de Google.',
    cancel:     'Cancela cuando quieras',
    pipeline:   '+8.000 Acciones → 200 Preselección → 54 Seleccionadas',
    member_cta: 'Iniciar sesión',
  },
  pt: {
    badge:      'Plataforma Financeira com IA',
    hero1:      'Investimento Inteligente nos',
    hero2:      'Mercados dos EUA',
    hero3:      'Começa Aqui',
    sub:        'Nosso algoritmo escaneia mais de 8.000 ações diariamente e seleciona as 54 melhores oportunidades.',
    cta:        'Começar',
    price_note: 'Apenas $19 USD / mês',
    feat_title: 'Não Se Perca nas Análises',
    feat_sub:   'Experiência financeira de nova geração.',
    plan_title: 'Um Plano, Todos os Recursos',
    plan_sub:   'Comece agora, cancele quando quiser.',
    plan_name:  'Assinatura Pro',
    plan_cta:   'Começar com Google',
    plan_legal: 'Entre com sua conta Google para começar.',
    cancel:     'Cancele quando quiser',
    pipeline:   '+8.000 Ações → 200 Shortlist → 54 Selecionadas',
    member_cta: 'Entrar',
  },
  ar: {
    badge:      'منصة مالية مدعومة بالذكاء الاصطناعي',
    hero1:      'الاستثمار الذكي في',
    hero2:      'الأسواق الأمريكية',
    hero3:      'يبدأ هنا',
    sub:        'يفحص خوارزميتنا أكثر من 8,000 سهم يوميًا ويختار أفضل 54 فرصة.',
    cta:        'ابدأ الآن',
    price_note: 'فقط 19 دولار شهريًا',
    feat_title: 'لا تضيع في التحليلات',
    feat_sub:   'تجربة مالية من الجيل التالي.',
    plan_title: 'خطة واحدة، جميع الميزات',
    plan_sub:   'ابدأ الآن، ألغِ في أي وقت.',
    plan_name:  'عضوية Pro',
    plan_cta:   'البدء مع Google',
    plan_legal: 'سجّل الدخول بحساب Google الخاص بك.',
    cancel:     'إلغاء في أي وقت',
    pipeline:   '+8,000 سهم → 200 قائمة → 54 مختارة',
    member_cta: 'تسجيل الدخول',
  },
  id: {
    badge:      'Platform Keuangan Berbasis AI',
    hero1:      'Investasi Cerdas di',
    hero2:      'Pasar AS',
    hero3:      'Dimulai Di Sini',
    sub:        'Algoritma kami memindai lebih dari 8.000 saham setiap hari dan memilih 54 peluang terkuat.',
    cta:        'Mulai Sekarang',
    price_note: 'Hanya $19 USD / bulan',
    feat_title: 'Jangan Tersesat dalam Analisis',
    feat_sub:   'Pengalaman keuangan generasi berikutnya.',
    plan_title: 'Satu Paket, Semua Fitur',
    plan_sub:   'Mulai sekarang, batalkan kapan saja.',
    plan_name:  'Keanggotaan Pro',
    plan_cta:   'Mulai dengan Google',
    plan_legal: 'Masuk dengan akun Google Anda untuk memulai.',
    cancel:     'Batalkan kapan saja',
    pipeline:   '8.000+ Saham → 200 Shortlist → 54 Dipilih',
    member_cta: 'Masuk',
  },
  ja: {
    badge:      'AI搭載金融プラットフォーム',
    hero1:      '米国市場での',
    hero2:      'スマート投資',
    hero3:      'はここから始まる',
    sub:        '私たちのアルゴリズムは毎日8,000以上の銘柄をスキャンし、最強の54銘柄を選択します。',
    cta:        '今すぐ始める',
    price_note: '月額わずか$19 USD',
    feat_title: '分析で迷わない',
    feat_sub:   '次世代の金融体験。',
    plan_title: 'ワンプラン、全機能',
    plan_sub:   '今すぐ始め、いつでもキャンセル可能。',
    plan_name:  'Proメンバーシップ',
    plan_cta:   'Googleで始める',
    plan_legal: 'Googleアカウントでログインして始めましょう。',
    cancel:     'いつでもキャンセル可能',
    pipeline:   '8,000+銘柄スキャン → 200候補 → 54選出',
    member_cta: 'ログイン',
  },
}

// ─── Özellikler (dil bağımsız icon/key, metin COPY'dan) ─────────────────────
const FEATURE_KEYS = [
  { icon: Filter,    key: 'f1' },
  { icon: Brain,     key: 'f2' },
  { icon: BarChart3, key: 'f3' },
  { icon: Globe2,    key: 'f5' },
]

const FEATURES_COPY: Record<string, Record<string, { title: string; desc: string }>> = {
  tr: {
    f1: { title: '8.000+ Hisse Tarama',       desc: '3 katmanlı filtre sistemi ile likidite, momentum ve akış analizleri yapılır. En iyi 200 hisse shortlist\'e alınır.' },
    f2: { title: 'AI Destekli Yorumlar',       desc: 'AI ile 7 alan: piyasa bağlamı, senaryo bull/bear/nötr, risk referansı ve strateji notu. Legal-safe dil garantili.' },
    f3: { title: '5 Kategori Seçim',           desc: 'CORE (20), Sektör Liderleri (14), Yüksek Hacim (7), En Yükselenler (7), Aşırı Satım (7) — overlap korumalı.' },
    f5: { title: '7 Dil Desteği',              desc: 'Tüm analizler TR, EN, ES, PT, AR, ID, JA dillerinde. Gerçek zamanlı çeviri.' },
  },
  en: {
    f1: { title: '8,000+ Stock Scanner',      desc: '3-layer filter system analyzes liquidity, momentum and flow. Top 200 stocks make the shortlist.' },
    f2: { title: 'AI-Powered Commentary',     desc: 'AI generates 7 fields: market context, bull/bear/neutral scenarios, risk reference and strategy note.' },
    f3: { title: '5-Category Selection',      desc: 'CORE (20), Sector Leaders (14), High Volume (7), Top Gainers (7), Oversold (7) — overlap protected.' },
    f5: { title: '7-Language Support',        desc: 'All analyses in TR, EN, ES, PT, AR, ID, JA. Real-time translation.' },
  },
  es: {
    f1: { title: 'Escaneo de +8.000 Acciones', desc: 'Sistema de filtro de 3 capas analiza liquidez, momentum y flujo. Las 200 mejores acciones pasan a la lista corta.' },
    f2: { title: 'Comentarios con IA',          desc: 'IA genera 7 campos: contexto de mercado, escenarios bull/bear/neutral, referencia de riesgo y nota de estrategia.' },
    f3: { title: 'Selección en 5 Categorías',   desc: 'CORE (20), Líderes Sectoriales (14), Alto Volumen (7), Mayores Ganadores (7), Sobrevendidos (7).' },
    f5: { title: 'Soporte en 7 Idiomas',        desc: 'Todos los análisis en TR, EN, ES, PT, AR, ID, JA. Traducción en tiempo real.' },
  },
  pt: {
    f1: { title: 'Varredura de +8.000 Ações',   desc: 'Sistema de filtro de 3 camadas analisa liquidez, momentum e fluxo. As 200 melhores ações entram na shortlist.' },
    f2: { title: 'Comentários com IA',           desc: 'IA gera 7 campos: contexto de mercado, cenários bull/bear/neutro, referência de risco e nota de estratégia.' },
    f3: { title: 'Seleção em 5 Categorias',      desc: 'CORE (20), Líderes Setoriais (14), Alto Volume (7), Maiores Ganhos (7), Sobrevenda (7).' },
    f5: { title: 'Suporte em 7 Idiomas',         desc: 'Todas as análises em TR, EN, ES, PT, AR, ID, JA. Tradução em tempo real.' },
  },
  ar: {
    f1: { title: 'فحص +8,000 سهم',             desc: 'نظام تصفية ثلاثي الطبقات يحلل السيولة والزخم والتدفق. أفضل 200 سهم تدخل القائمة المختصرة.' },
    f2: { title: 'تعليقات مدعومة بالذكاء',     desc: 'الذكاء الاصطناعي ينتج 7 حقول: سياق السوق، سيناريوهات صعودية/هبوطية/محايدة، مرجع المخاطر وملاحظة الاستراتيجية.' },
    f3: { title: 'اختيار في 5 فئات',            desc: 'CORE (20)، قادة القطاعات (14)، حجم عالٍ (7)، أكبر الرابحين (7)، بيع مفرط (7).' },
    f5: { title: 'دعم 7 لغات',                  desc: 'جميع التحليلات باللغات TR وEN وES وPT وAR وID وJA. ترجمة فورية في الوقت الفعلي.' },
  },
  id: {
    f1: { title: 'Pemindaian 8.000+ Saham',     desc: 'Sistem filter 3 lapisan menganalisis likuiditas, momentum, dan aliran. 200 saham terbaik masuk shortlist.' },
    f2: { title: 'Komentar Berbasis AI',         desc: 'AI menghasilkan 7 bidang: konteks pasar, skenario bull/bear/netral, referensi risiko, dan catatan strategi.' },
    f3: { title: 'Seleksi 5 Kategori',           desc: 'CORE (20), Pemimpin Sektor (14), Volume Tinggi (7), Pemenang Teratas (7), Oversold (7).' },
    f5: { title: 'Dukungan 7 Bahasa',            desc: 'Semua analisis dalam TR, EN, ES, PT, AR, ID, JA. Terjemahan real-time.' },
  },
  ja: {
    f1: { title: '8,000+銘柄スキャン',          desc: '3層フィルターシステムが流動性・モメンタム・フローを分析。上位200銘柄がショートリストへ。' },
    f2: { title: 'AIコメンタリー',               desc: 'AIが7フィールド生成：市場コンテキスト、強気/弱気/中立シナリオ、リスク参照、戦略ノート。' },
    f3: { title: '5カテゴリー選択',              desc: 'CORE(20)、セクターリーダー(14)、高出来高(7)、最高上昇(7)、売られすぎ(7)。重複保護付き。' },
    f5: { title: '7言語サポート',                desc: 'TR、EN、ES、PT、AR、ID、JAで全分析を提供。リアルタイム翻訳。' },
  },
}

const PRO_FEATURES: Record<string, string[]> = {
  tr: ['8.000+ hisse günlük tarama (3 katmanlı filtre)', 'Günlük 54 seçim — 5 kategori', 'AI analiz metinleri', '7 dil desteği', 'NY 06:30 + 12:00 otomatik tarama', 'Piyasa rejimi & VIX analizi', 'Sektör liderliği & RVOL takibi', '5 takip hissesi dahil', 'Portföy & işlem yönetimi'],
  en: ['8,000+ daily stock scan (3-layer filter)', 'Daily 54 picks — 5 categories', 'AI analysis texts', '7-language support', 'Automatic scan NY 06:30 + 12:00', 'Market regime & VIX analysis', 'Sector leadership & RVOL tracking', '5 tracking stocks included', 'Portfolio & trade management'],
  es: ['Escaneo diario de +8.000 acciones', '54 selecciones diarias en 5 categorías', 'Textos de análisis con IA', 'Soporte en 7 idiomas', 'Escaneo automático NY 06:30 + 12:00', 'Análisis de régimen de mercado y VIX', 'Seguimiento de liderazgo sectorial y RVOL', '5 acciones de seguimiento incluidas', 'Gestión de portafolio y operaciones'],
  pt: ['Varredura diária de +8.000 ações', '54 seleções diárias em 5 categorias', 'Textos de análise com IA', 'Suporte em 7 idiomas', 'Varredura automática NY 06:30 + 12:00', 'Análise de regime de mercado e VIX', 'Acompanhamento de liderança setorial e RVOL', '5 ações de rastreamento incluídas', 'Gestão de portfólio e operações'],
  ar: ['فحص يومي لأكثر من 8,000 سهم', '54 اختياراً يومياً في 5 فئات', 'نصوص تحليل بالذكاء الاصطناعي', 'دعم 7 لغات', 'فحص تلقائي في 06:30 و12:00 بتوقيت نيويورك', 'تحليل نظام السوق و VIX', 'تتبع قيادة القطاعات و RVOL', '5 أسهم متابعة مضمنة', 'إدارة المحفظة والصفقات'],
  id: ['Pemindaian harian 8.000+ saham', '54 pilihan harian dalam 5 kategori', 'Teks analisis AI', 'Dukungan 7 bahasa', 'Pemindaian otomatis NY 06:30 + 12:00', 'Analisis rezim pasar & VIX', 'Pelacakan kepemimpinan sektor & RVOL', '5 saham pelacakan termasuk', 'Manajemen portofolio & perdagangan'],
  ja: ['毎日8,000+銘柄スキャン（3層フィルター）', '毎日54銘柄選出 — 5カテゴリー', 'AI分析テキスト', '7言語サポート', 'NY 06:30 + 12:00 自動スキャン', '市場レジーム & VIX分析', 'セクターリーダーシップ & RVOL追跡', '5銘柄トラッキング付き', 'ポートフォリオ & 取引管理'],
}

const STATS: Record<string, { value: string; label: string }[]> = {
  tr: [{ value: '8.000+', label: 'Günlük Taranan Hisse' }, { value: '54',     label: 'Günlük Seçim' }, { value: '7',      label: 'Dil Desteği' }, { value: '2x/gün', label: 'Otomatik Tarama' }],
  en: [{ value: '8,000+', label: 'Daily Scanned Stocks' }, { value: '54',     label: 'Daily Picks' }, { value: '7',      label: 'Languages' }, { value: '2x/day', label: 'Auto Scan' }],
  es: [{ value: '+8.000', label: 'Acciones Escaneadas' }, { value: '54',      label: 'Selecciones Diarias' }, { value: '7', label: 'Idiomas' }, { value: '2x/día', label: 'Escaneo Auto' }],
  pt: [{ value: '+8.000', label: 'Ações Varridas' }, { value: '54',           label: 'Seleções Diárias' }, { value: '7', label: 'Idiomas' }, { value: '2x/dia', label: 'Varredura Auto' }],
  ar: [{ value: '+8,000', label: 'أسهم ممسوحة يومياً' }, { value: '54',      label: 'اختيارات يومية' }, { value: '7', label: 'لغات' }, { value: 'مرتان/يوم', label: 'مسح تلقائي' }],
  id: [{ value: '8.000+', label: 'Saham Dipindai Harian' }, { value: '54',    label: 'Pilihan Harian' }, { value: '7', label: 'Bahasa' }, { value: '2x/hari', label: 'Pindai Otomatis' }],
  ja: [{ value: '8,000+', label: '毎日スキャン銘柄数' }, { value: '54',       label: '毎日の選出銘柄' }, { value: '7', label: '対応言語' }, { value: '2回/日', label: '自動スキャン' }],
}

// ─── Preview hisseler (finma514 tarzı) ──────────────────────────────────────
const PREVIEW_STOCKS = [
  { symbol: 'NVDA', sector: 'Technology',    score: 92, tier: 'STRONG', tag: 'CORE',   change: +4.2 },
  { symbol: 'MSFT', sector: 'Technology',    score: 87, tier: 'HIGH',   tag: 'CORE',   change: +1.8 },
  { symbol: 'XOM',  sector: 'Energy',        score: 83, tier: 'HIGH',   tag: 'SECTOR', change: +2.1 },
  { symbol: 'AMZN', sector: 'Consumer',      score: 79, tier: 'HIGH',   tag: 'GAINER', change: +3.5 },
  { symbol: 'AAPL', sector: 'Technology',    score: 76, tier: 'HIGH',   tag: 'CORE',   change: +0.9 },
]

const TIER_COLORS: Record<string, string> = {
  STRONG: 'text-finma-green border-finma-green/30 bg-finma-green/10',
  HIGH:   'text-finma-primary border-finma-primary/30 bg-finma-primary/10',
  WATCH:  'text-finma-yellow border-finma-yellow/30 bg-finma-yellow/10',
}


// ─── Dil Seçici ─────────────────────────────────────────────────────────────
function LangPicker({ lang, onChange }: { lang: string; onChange: (l: string) => void }) {
  const [open, setOpen] = useState(false)
  const cur = LANGS.find(l => l.code === lang) ?? LANGS[0]
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white/5 border border-finma-border
                   text-xs text-finma-text hover:border-finma-border-light transition-colors"
      >
        <span>{cur.flag}</span>
        <span className="hidden sm:inline">{cur.label}</span>
        <ChevronDown className={cn('w-3 h-3 text-finma-text-dim transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 bg-finma-card border border-finma-border
                        rounded-lg shadow-xl overflow-hidden min-w-[140px]">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => { onChange(l.code); setOpen(false) }}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors text-left',
                l.code === lang ? 'bg-finma-primary/15 text-finma-primary' : 'text-finma-text hover:bg-white/5'
              )}
            >
              <span>{l.flag}</span><span>{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ana bileşen ─────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { isAuthenticated, login } = useAuthStore()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [lang, setLang]       = useState('tr')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstallPrompt, setShowInstallPrompt] = useState(false)
  const t = COPY[lang] ?? COPY.tr
  const features = FEATURES_COPY[lang] ?? FEATURES_COPY.tr
  const stats    = STATS[lang]         ?? STATS.tr
  const proFeats = PRO_FEATURES[lang]  ?? PRO_FEATURES.tr

  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard')
  }, [isAuthenticated, router])

  const handleGoogleResponse = useCallback(async (response: any) => {
    setLoading(true); setError('')
    try {
      const result = await api.googleLogin(response.credential)
      login(result.access_token, result.user as any)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Google ile giriş yapılamadı')
    } finally { setLoading(false) }
  }, [login, router])

  // PWA Install prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowInstallPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShowInstallPrompt(false)
      setDeferredPrompt(null)
    }
  }

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return
    const init = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleResponse })
      ;['hero-google-btn', 'cta-google-btn'].forEach(id => {
        const el = document.getElementById(id)
        if (el) window.google!.accounts.id.renderButton(el, {
          type: 'standard', theme: 'filled_black', size: 'large',
          text: 'signin_with', shape: 'rectangular', width: 320, locale: lang === 'tr' ? 'tr' : 'en',
        })
      })
    }
    if (window.google?.accounts?.id) init()
    else {
      const iv = setInterval(() => { if (window.google?.accounts?.id) { clearInterval(iv); init() } }, 100)
      const to = setTimeout(() => clearInterval(iv), 5000)
      return () => { clearInterval(iv); clearTimeout(to) }
    }
  }, [handleGoogleResponse, lang])

  return (
    <div className={cn('min-h-screen bg-finma-bg text-white', lang === 'ar' && 'dir-rtl')} dir={lang === 'ar' ? 'rtl' : 'ltr'}>

      {/* ─── Install Prompt (Mobile) ─────────────────────────── */}
      {showInstallPrompt && (
        <div className="fixed top-16 left-0 right-0 z-40 bg-finma-primary/90 border-b border-finma-primary/50 px-4 py-3 flex items-center justify-between sm:hidden">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-white" />
            <span className="text-sm text-white font-medium">Uygulama olarak ekle</span>
          </div>
          <button
            onClick={handleInstall}
            className="text-xs px-3 py-1.5 rounded bg-white text-finma-primary font-semibold hover:bg-gray-100 transition-colors"
          >
            Ekle
          </button>
        </div>
      )}

      {/* ─── Navbar ──────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-finma-bg/80 backdrop-blur-xl border-b border-finma-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Activity className="w-6 h-6 sm:w-7 sm:h-7 text-finma-primary" />
            <span className="text-lg sm:text-xl font-bold text-white">Fin</span>
            <span className="text-lg sm:text-xl font-bold text-finma-primary">MA</span>
            <span className="text-[8px] sm:text-[10px] text-finma-text-dim ml-1 font-mono">v5.0</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <LangPicker lang={lang} onChange={setLang} />
            <span className="hidden md:block text-sm text-finma-text-dim">$29/mo</span>
            <button onClick={() => router.push('/login')} className="text-xs sm:text-sm text-finma-text-dim hover:text-finma-text transition-colors hidden sm:block">
              {t.member_cta}
            </button>
            <a href="#pricing" className="finma-btn-primary text-xs sm:text-sm px-3 sm:px-4 py-2 flex items-center gap-1.5">
              {t.cta} <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </a>
          </div>
        </div>
      </nav>

      {/* ─── Hero ────────────────────────────────────────────── */}
      <section className={cn("pt-32 pb-16 px-4", showInstallPrompt && "pt-40 sm:pt-32")}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 rounded-full bg-finma-primary/10 border border-finma-primary/30 mb-4 sm:mb-6">
            <Brain className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-finma-primary" />
            <span className="text-[10px] sm:text-xs text-finma-primary font-medium">{t.badge}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-4 sm:mb-6">
            {t.hero1}<br />
            <span className="text-finma-primary">{t.hero2}</span> {t.hero3}
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-finma-text-muted max-w-2xl mx-auto mb-3 sm:mb-4 px-2">
            {t.sub}
          </p>

          {/* Pipeline rozeti */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-finma-green/10 border border-finma-green/30 mb-6 sm:mb-8">
            <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-finma-green" />
            <span className="text-[10px] sm:text-xs text-finma-green font-mono font-semibold">{t.pipeline}</span>
          </div>

          <div className="flex flex-col items-center gap-4 mb-4 px-2">
            <div id="hero-google-btn" style={{ display: 'flex', justifyContent: 'center' }} />
            {loading && <p className="text-xs text-finma-text-dim">Giriş yapılıyor...</p>}
            {error   && <p className="text-xs text-finma-red bg-finma-red/10 border border-finma-red/30 rounded-md px-3 py-2">{error}</p>}
          </div>
          <p className="text-xs text-finma-text-dim">7 gün ücretsiz, sonra $29/ay</p>
        </div>
      </section>

      {/* ─── Terminal Preview (finma514 tarzı tablo) ─────────── */}
      <section className="pb-16 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-finma-border/50 bg-finma-card overflow-hidden shadow-2xl shadow-finma-primary/5">
            {/* Fake terminal bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-finma-border/50 bg-finma-sidebar">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-finma-red/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-finma-yellow/70" />
                  <div className="w-2.5 h-2.5 rounded-full bg-finma-green/70" />
                </div>
                <span className="text-[10px] text-finma-text-dim font-mono ml-2">finmasmart.com — Daily 54 Picks</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-finma-green animate-pulse-slow" />
                <span className="text-[10px] text-finma-green font-mono">LIVE</span>
              </div>
            </div>

            {/* Mini tablo */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-finma-border/40 bg-[#0f1520]">
                    <th className="px-4 py-2.5 text-left text-finma-text-dim font-medium">Ticker</th>
                    <th className="px-4 py-2.5 text-left text-finma-text-dim font-medium">Sektör</th>
                    <th className="px-4 py-2.5 text-center text-finma-text-dim font-medium">Tier</th>
                    <th className="px-4 py-2.5 text-center text-finma-text-dim font-medium">Kategori</th>
                    <th className="px-4 py-2.5 text-right text-finma-text-dim font-medium">Değişim</th>
                    <th className="px-4 py-2.5 text-right text-finma-text-dim font-medium">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {PREVIEW_STOCKS.map((s, i) => (
                    <tr key={s.symbol} className={cn('border-b border-finma-border/20', i % 2 === 0 ? '' : 'bg-white/[0.015]')}>
                      <td className="px-4 py-2.5 font-bold text-finma-primary finma-number">{s.symbol}</td>
                      <td className="px-4 py-2.5 text-finma-text-dim">{s.sector}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn('inline-flex px-1.5 py-0.5 rounded border text-[9px] font-bold finma-number', TIER_COLORS[s.tier])}>
                          {s.tier}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-finma-text-dim">{s.tag}</td>
                      <td className={cn('px-4 py-2.5 text-right finma-number', s.change >= 0 ? 'text-finma-green' : 'text-finma-red')}>
                        {s.change >= 0 ? '+' : ''}{s.change}%
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <div className="w-12 h-1 bg-white/10 rounded-full overflow-hidden">
                            <div className={cn('h-full rounded-full', s.score >= 90 ? 'bg-finma-green' : 'bg-finma-primary')}
                              style={{ width: `${s.score}%` }} />
                          </div>
                          <span className={cn('finma-number font-bold text-[10px]', s.score >= 90 ? 'text-finma-green' : 'text-finma-primary')}>
                            {s.score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Blur overlay + CTA */}
            <div className="flex items-center justify-center py-4 bg-gradient-to-t from-finma-bg/80 to-transparent px-4">
              <div className="flex flex-col items-center gap-2 bg-finma-bg/60 backdrop-blur-md border border-finma-border/50 rounded-xl p-4 shadow-xl text-center">
                <div className="flex items-center gap-2 text-xs font-medium text-white">
                  <Shield className="w-4 h-4 text-finma-primary" />
                  {lang === 'tr' ? 'Tüm 54 hisseyi görmek için üye olun' :
                   lang === 'en' ? 'Sign up to see all 54 stocks' :
                   lang === 'ja' ? '全54銘柄を見るには登録してください' :
                   'Sign up to see all 54 stocks'}
                </div>
                <a href="#pricing" className="finma-btn-primary px-6 py-2 text-xs flex items-center gap-1.5">
                  {t.cta} <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── İstatistikler ───────────────────────────────────── */}
      <section className="pb-16 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {stats.map((s) => (
              <div key={s.label} className="bg-finma-card/50 border border-finma-border/30 rounded-xl p-4">
                <div className="text-2xl font-bold text-finma-primary mb-1 finma-number">{s.value}</div>
                <div className="text-xs text-finma-text-dim">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Özellikler ──────────────────────────────────────── */}
      <section className="pb-16 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              {t.feat_title.split(' ').map((w, i, arr) =>
                i === arr.length - 1
                  ? <span key={i} className="text-finma-primary"> {w}</span>
                  : <span key={i}>{w} </span>
              )}
            </h2>
            <p className="text-finma-text-muted">{t.feat_sub}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURE_KEYS.map(({ icon: Icon, key }) => {
              const feat = features[key]
              return (
                <div key={key} className="bg-finma-card border border-finma-border/50 rounded-xl p-5 hover:border-finma-primary/30 transition-all group">
                  <div className="w-9 h-9 rounded-lg bg-finma-primary/10 flex items-center justify-center mb-3 group-hover:bg-finma-primary/20 transition-colors">
                    <Icon className="w-4.5 h-4.5 text-finma-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1.5">{feat.title}</h3>
                  <p className="text-xs text-finma-text-dim leading-relaxed">{feat.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────────────── */}
      <section id="pricing" className="pb-16 px-4">
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-3">
              {t.plan_title.split(',')[0]},&nbsp;
              <span className="text-finma-primary">{t.plan_title.split(',')[1]}</span>
            </h2>
            <p className="text-finma-text-muted">{t.plan_sub}</p>
          </div>

          <div className="bg-finma-card border-2 border-finma-primary/50 rounded-2xl p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-finma-primary text-finma-bg text-[10px] font-bold px-4 py-1 rounded-bl-xl">
              {lang === 'tr' ? 'EN POPÜLER' : lang === 'ja' ? '人気No.1' : 'MOST POPULAR'}
            </div>
            <div className="text-center mb-6">
              <h3 className="text-base font-bold text-white mb-1">{t.plan_name}</h3>
              <div className="flex items-baseline justify-center gap-1 mb-2">
                <span className="text-4xl font-bold text-white">$19</span>
                <span className="text-finma-text-dim">/mo</span>
              </div>
              <p className="text-xs text-finma-green font-medium">{t.cancel}</p>
            </div>

            <div className="space-y-2.5 mb-8">
              {proFeats.map((feat) => (
                <div key={feat} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-finma-green shrink-0 mt-0.5" />
                  <span className="text-sm text-finma-text">{feat}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div id="cta-google-btn" />
              <p className="text-[10px] text-finma-text-dim text-center">{t.plan_legal}<br />{t.price_note}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <footer className="border-t border-finma-border/30 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-[10px] text-finma-text-dim">
            <div className="flex items-center gap-1">
              <Activity className="w-5 h-5 text-finma-primary" />
              <span className="text-sm font-bold text-white">Fin</span>
              <span className="text-sm font-bold text-finma-primary">MA</span>
              <span className="text-[10px] text-finma-text-dim ml-1">v5.0</span>
            </div>
            <span>Developed by <span className="text-finma-primary font-semibold">AFK DaSYS</span></span>
          </div>
          <div className="flex items-center gap-5 text-[10px] text-finma-text-dim flex-wrap justify-center">
            <a href="/privacy"    className="hover:text-finma-primary">
              {lang === 'tr' ? 'Gizlilik Politikası' : 'Privacy Policy'}
            </a>
            <a href="/terms"      className="hover:text-finma-primary">
              {lang === 'tr' ? 'Kullanım Koşulları' : 'Terms of Use'}
            </a>
            <a href="/kvkk"       className="hover:text-finma-primary">KVKK</a>
            <a href="/disclaimer" className="hover:text-finma-primary">
              {lang === 'tr' ? 'SPK Uyarısı' : 'Disclaimer'}
            </a>
          </div>
          <div className="text-[10px] text-finma-text-dim">
            &copy; 2026 FinMA Global, New York / USA
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-4 text-center">
          <p className="text-[9px] text-finma-text-dim/60 leading-relaxed max-w-3xl mx-auto">
            {lang === 'tr'
              ? 'Yapay zekâ tarafından üretilen analizler hata içerebilir. Yatırım danışmanlığı kapsamında değildir. Yatırım kararlarınız tamamen kendi sorumluluğunuzdadır. Geçmiş performans gelecekteki sonuçların garantisi değildir.'
              : 'AI-generated analyses may contain errors. This is not investment advice. Investment decisions are solely your responsibility. Past performance does not guarantee future results.'}
          </p>
        </div>
      </footer>
    </div>
  )
}
