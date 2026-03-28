'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth'
import { useTerminalStore } from '@/store/terminal'
import { api } from '@/lib/api-client'
import dynamic from 'next/dynamic'

// Chart component — browser-only (uses DOM APIs)
const LandingChart = dynamic(
  () => import('@/components/landing/LandingChart'),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 200, background: '#0C1017', borderRadius: 12 }} />
    ),
  }
)

// Sector Heatmap — browser-only (fetches data)
const SectorHeatmap = dynamic(
  () => import('@/components/landing/SectorHeatmap').then(m => ({ default: m.SectorHeatmap })),
  {
    ssr: false,
    loading: () => (
      <div style={{ height: 300, background: '#0C1017', borderRadius: 12, marginBottom: 60 }} />
    ),
  }
)

// Sidebar component — browser-only
const Sidebar = dynamic(
  () => import('@/components/terminal/Sidebar').then(m => ({ default: m.Sidebar })),
  { ssr: false }
)

// Ticker strip — browser-only
const LandingTicker = dynamic(
  () => import('@/components/landing/LandingTicker').then(m => ({ default: m.LandingTicker })),
  { ssr: false }
)

// Market index badge — browser-only
const MarketIndexBadge = dynamic(
  () => import('@/components/landing/MarketIndexBadge').then(m => ({ default: m.MarketIndexBadge })),
  { ssr: false }
)

// Market movers column — right sidebar, browser-only
const MarketMoversColumn = dynamic(
  () => import('@/components/landing/MarketMoversColumn').then(m => ({ default: m.MarketMoversColumn })),
  { ssr: false }
)

// ─── Types ────────────────────────────────────────────────────────────────────
interface AssetInfo {
  ticker: string
  displayName: string
  category: string
  meta: string
  icon: string
  price: string
  change: string
  changeDir: 'up' | 'down'
}

// ─── Language Data ────────────────────────────────────────────────────────────
const LANGS = [
  { code: 'tr', label: 'Türkçe',    flag: '🇹🇷' },
  { code: 'en', label: 'English',   flag: '🇺🇸' },
  { code: 'es', label: 'Español',   flag: '🇪🇸' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'ar', label: 'العربية',   flag: '🇸🇦' },
  { code: 'id', label: 'Indonesia', flag: '🇮🇩' },
  { code: 'ja', label: '日本語',     flag: '🇯🇵' },
]

const COPY: Record<string, {
  p1_badge: string; p1_tagline: string
  p1_h1: string; p1_h2: string; p1_h3: string; p1_sub: string; p1_ph: string
  pill_gainers: string; pill_nasdaq: string; pill_volume: string; pill_breakout: string; pill_vix: string
  p1_popular_title: string; p1_prompts: string[]
  cta_free: string; signin: string
  p2_back: string; p2_cta: string; p2_ai_label: string; p2_ai_text: string
  p2_action_title: string; entry_lbl: string; target_lbl: string; risk_lbl: string; winrate_lbl: string
  p2_market_shift: string; p2_corr: string
  p3_tab1: string; p3_tab2: string; p3_tab3: string; p3_upgrade: string; p3_pro_lock: string
  p4_tab1: string; p4_tab2: string; p4_tab3: string; p4_tab4: string
  modal_title: string; modal_sub: string; modal_google: string; legal: string
  install_cta: string; install_btn: string
  legal_disclaimer: string
}> = {
  tr: {
    p1_badge: 'ABD Borsaları · SP500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'Finansal Zeka',
    p1_h1: 'ABD Borsasında', p1_h2: 'Fırsatları Bul.', p1_h3: '',
    p1_sub: 'AI destekli analiz ile günün en güçlü hisselerini saniyeler içinde keşfet.',
    p1_ph: 'Bugün ABD\'de en çok kazandıran hisseler hangileri?',
    pill_gainers: '🔥 En Çok Yükselenler', pill_nasdaq: '📊 NASDAQ Liderleri', pill_volume: '💰 Para Girişi Olanlar',
    pill_breakout: '⚡ Breakout Hisseler', pill_vix: '🌪️ VIX Durumu',
    p1_popular_title: '🔥 En Çok Arananlar',
    p1_prompts: [
      'Bugün ABD borsasında en çok yükselenler hangileri?',
      'NASDAQ\'ta şu an hangi teknoloji hisseleri güçlü?',
      'Büyük yatırımcı girişi olan hisseler nelerdir?',
      'Kırılımlar (breakout) yapan hisseler hangileri?',
      'VIX düşükken hangi hisseler güvenli?',
      'S&P 500\'de en güçlü sektör hangisi?',
      'Dividend veren kaliteli ABD hisseleri hangileri?',
    ],
    cta_free: 'Ücretsiz Üye Ol', signin: 'Üye Girişi',
    p2_back: 'Geri', p2_cta: 'Ücretsiz Üye Ol',
    p2_ai_label: '▸ AI Piyasa Özeti',
    p2_ai_text: 'Analist giriş aralığı inceleniyor; mevcut momentum yapısı kritik seviyelere yaklaşmış durumda. Makro arka plan nötre dönmüş olsa da sektörel akış pozitif sinyal üretiyor. Olası hedef bölgeleri ve yapı zayıflama sinyalleri Pro üyelere açıktır.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'Analist Giriş Aralığı', target_lbl: 'Olası Hedef', risk_lbl: 'Yapı Zayıflama Sinyali', winrate_lbl: 'Geçmiş Başarı',
    p2_market_shift: 'Çapraz Varlık (Market Shift)',
    p2_corr: 'Bu varlığın mevcut korelasyonu:',
    p3_tab1: 'Genel Bakış', p3_tab2: 'Geçmiş Analizler', p3_tab3: 'Varlık Performansı',
    p3_upgrade: "Pro'ya Geç — Günlük Top 5 + Akıllı Takip",
    p3_pro_lock: 'Pro içerik — Yükselt',
    p4_tab1: 'Günlük Top 5', p4_tab2: 'Sektörel Analizler', p4_tab3: 'Hazır Listeler', p4_tab4: 'Akıllı Takip',
    modal_title: 'Devam etmek için ücretsiz hesap oluştur',
    modal_sub: 'Kayıt ücretsizdir. Kredi kartı gerekmez.',
    modal_google: 'Google ile Devam Et',
    legal: "Kayıt olarak Kullanım Koşulları ve Gizlilik Politikası'nı kabul etmiş olursunuz.",
    install_cta: 'Uygulama olarak ekle', install_btn: 'Ekle',
    legal_disclaimer: 'FinMA yapay zeka destekli piyasa analiz platformudur. Sunulan içerikler yalnızca bilgilendirme amaçlıdır; yatırım tavsiyesi niteliği taşımaz. Nihai karar kullanıcıya aittir. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  en: {
    p1_badge: 'US Markets · S&P 500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'Financial Intelligence',
    p1_h1: 'Find Opportunities in', p1_h2: 'US Stock Markets.', p1_h3: '',
    p1_sub: 'Discover the strongest stocks of the day with AI-powered analysis in seconds.',
    p1_ph: 'What are today\'s biggest gainers in the US market?',
    pill_gainers: '🔥 Top Gainers', pill_nasdaq: '📊 NASDAQ Leaders', pill_volume: '💰 Heavy Volume',
    pill_breakout: '⚡ Breakout Stocks', pill_vix: '🌪️ VIX Status',
    p1_popular_title: '🔥 Popular Searches',
    p1_prompts: [
      'What are today\'s biggest gainers in the US market?',
      'Which tech stocks are leading NASDAQ right now?',
      'Which stocks are seeing heavy institutional buying?',
      'What stocks are making breakout moves?',
      'Which stocks are safe when VIX is low?',
      'What\'s the strongest sector in the S&P 500?',
      'What are quality dividend-paying US stocks?',
    ],
    cta_free: 'Sign Up Free', signin: 'Sign In',
    p2_back: 'Back', p2_cta: 'Sign Up Free',
    p2_ai_label: '▸ AI Market Summary',
    p2_ai_text: 'Analyst entry range under review; current momentum structure has approached critical levels. Macro backdrop has turned neutral but sector flow is generating positive signals. Possible target zones and structural weakness signals are available to Pro members.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'Analyst Entry Range', target_lbl: 'Possible Target', risk_lbl: 'Structure Weakness Signal', winrate_lbl: 'Historical Win Rate',
    p2_market_shift: 'Cross-Asset (Market Shift)',
    p2_corr: 'Current correlation for this asset:',
    p3_tab1: 'Overview', p3_tab2: 'Past Analyses', p3_tab3: 'Asset Performance',
    p3_upgrade: 'Go Pro — Daily Top 5 + Smart Tracking',
    p3_pro_lock: 'Pro content — Upgrade',
    p4_tab1: 'Daily Top 5', p4_tab2: 'Sector Analysis', p4_tab3: 'Ready Lists', p4_tab4: 'Smart Tracking',
    modal_title: 'Create a free account to continue',
    modal_sub: 'Registration is free. No credit card required.',
    modal_google: 'Continue with Google',
    legal: 'By signing up you agree to the Terms of Service and Privacy Policy.',
    install_cta: 'Add to home screen', install_btn: 'Add',
    legal_disclaimer: 'FinMA is an AI-powered market analysis platform. Content provided is for informational purposes only and does not constitute investment advice. The final decision rests with the user. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  es: {
    p1_badge: 'Mercados EE.UU. · S&P 500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'Inteligencia Financiera',
    p1_h1: 'Encuentra Oportunidades en', p1_h2: 'Mercados de Valores EE.UU.', p1_h3: '',
    p1_sub: 'Descubre las acciones más fuertes del día con análisis impulsado por IA en segundos.',
    p1_ph: '¿Cuáles son los mayores ganadores del mercado estadounidense hoy?',
    pill_gainers: '🔥 Mayores Ganancias', pill_nasdaq: '📊 Líderes NASDAQ', pill_volume: '💰 Alto Volumen',
    pill_breakout: '⚡ Acciones en Ruptura', pill_vix: '🌪️ Estado del VIX',
    p1_popular_title: '🔥 Búsquedas Populares',
    p1_prompts: [
      '¿Cuáles son los mayores ganadores del mercado estadounidense hoy?',
      '¿Qué acciones tecnológicas están liderando NASDAQ ahora?',
      '¿Qué acciones están experimentando compras institucionales?',
      '¿Qué acciones están haciendo rupturas?',
      '¿Qué acciones son seguras cuando el VIX es bajo?',
      '¿Cuál es el sector más fuerte en el S&P 500?',
      '¿Qué son las acciones de calidad que pagan dividendos?',
    ],
    cta_free: 'Registro Gratis', signin: 'Iniciar Sesión',
    p2_back: 'Volver', p2_cta: 'Registro Gratis',
    p2_ai_label: '▸ Resumen AI del Mercado',
    p2_ai_text: 'Rango de entrada del analista en revisión; la estructura de momentum actual se ha acercado a niveles críticos. El telón de fondo macro se ha vuelto neutral pero el flujo sectorial genera señales positivas.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'Rango de Entrada', target_lbl: 'Objetivo Posible', risk_lbl: 'Señal de Debilidad', winrate_lbl: 'Tasa de Éxito',
    p2_market_shift: 'Cross-Asset (Market Shift)',
    p2_corr: 'Correlación actual para este activo:',
    p3_tab1: 'Vista General', p3_tab2: 'Análisis Anteriores', p3_tab3: 'Rendimiento',
    p3_upgrade: 'Ir Pro — Top 5 Diario + Seguimiento',
    p3_pro_lock: 'Contenido Pro — Mejorar',
    p4_tab1: 'Top 5 Diario', p4_tab2: 'Análisis Sectorial', p4_tab3: 'Listas Listas', p4_tab4: 'Seguimiento Inteligente',
    modal_title: 'Crea una cuenta gratuita para continuar',
    modal_sub: 'El registro es gratuito. No se requiere tarjeta de crédito.',
    modal_google: 'Continuar con Google',
    legal: 'Al registrarte aceptas los Términos de Servicio y la Política de Privacidad.',
    install_cta: 'Agregar a pantalla de inicio', install_btn: 'Agregar',
    legal_disclaimer: 'FinMA es una plataforma de análisis de mercado con IA. El contenido es solo informativo; no constituye asesoramiento de inversión. La decisión final corresponde al usuario. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  pt: {
    p1_badge: 'Mercados EUA · S&P 500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'Inteligência Financeira',
    p1_h1: 'Encontre Oportunidades no', p1_h2: 'Mercado de Ações EUA.', p1_h3: '',
    p1_sub: 'Descubra as ações mais fortes do dia com análise alimentada por IA em segundos.',
    p1_ph: 'Quais são os maiores ganhos do mercado americano hoje?',
    pill_gainers: '🔥 Maiores Ganhos', pill_nasdaq: '📊 Líderes NASDAQ', pill_volume: '💰 Alto Volume',
    pill_breakout: '⚡ Ações em Ruptura', pill_vix: '🌪️ Status VIX',
    p1_popular_title: '🔥 Buscas Populares',
    p1_prompts: [
      'Quais são os maiores ganhos do mercado americano hoje?',
      'Quais ações de tecnologia estão liderando o NASDAQ agora?',
      'Quais ações estão recebendo compras institucionais?',
      'Quais ações estão fazendo breakouts?',
      'Quais ações são seguras quando o VIX está baixo?',
      'Qual é o setor mais forte do S&P 500?',
      'Quais são as ações de qualidade que pagam dividendos?',
    ],
    cta_free: 'Cadastro Grátis', signin: 'Entrar',
    p2_back: 'Voltar', p2_cta: 'Cadastro Grátis',
    p2_ai_label: '▸ Resumo AI do Mercado',
    p2_ai_text: 'Faixa de entrada do analista em revisão; a estrutura de momentum atual se aproximou de níveis críticos. O pano de fundo macro ficou neutro mas o fluxo setorial gera sinais positivos.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'Faixa de Entrada', target_lbl: 'Alvo Possível', risk_lbl: 'Sinal de Fraqueza', winrate_lbl: 'Taxa de Acerto',
    p2_market_shift: 'Cross-Asset (Market Shift)',
    p2_corr: 'Correlação atual para este ativo:',
    p3_tab1: 'Visão Geral', p3_tab2: 'Análises Anteriores', p3_tab3: 'Desempenho',
    p3_upgrade: 'Ir Pro — Top 5 Diário + Rastreamento',
    p3_pro_lock: 'Conteúdo Pro — Atualizar',
    p4_tab1: 'Top 5 Diário', p4_tab2: 'Análise Setorial', p4_tab3: 'Listas Prontas', p4_tab4: 'Rastreamento Inteligente',
    modal_title: 'Crie uma conta gratuita para continuar',
    modal_sub: 'O cadastro é gratuito. Não é necessário cartão de crédito.',
    modal_google: 'Continuar com Google',
    legal: 'Ao se cadastrar, você concorda com os Termos de Serviço e a Política de Privacidade.',
    install_cta: 'Adicionar à tela inicial', install_btn: 'Adicionar',
    legal_disclaimer: 'FinMA é uma plataforma de análise de mercado com IA. O conteúdo é apenas informativo; não constitui conselho de investimento. A decisão final cabe ao usuário. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  ar: {
    p1_badge: 'الأسواق الأمريكية · S&P 500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'الذكاء المالي',
    p1_h1: 'اعثر على الفرص في', p1_h2: 'أسواق الأسهم الأمريكية.', p1_h3: '',
    p1_sub: 'اكتشف أقوى الأسهم في اليوم باستخدام تحليل مدعوم بالذكاء الاصطناعي في ثوانٍ.',
    p1_ph: 'ما أكبر المكاسب في السوق الأمريكي اليوم؟',
    pill_gainers: '🔥 أكبر المكاسب', pill_nasdaq: '📊 قادة NASDAQ', pill_volume: '💰 حجم كبير',
    pill_breakout: '⚡ أسهم الاختراق', pill_vix: '🌪️ حالة VIX',
    p1_popular_title: '🔥 عمليات البحث الشهيرة',
    p1_prompts: [
      'ما أكبر المكاسب في السوق الأمريكي اليوم؟',
      'ما الأسهم التكنولوجية التي تقود ناسداك الآن؟',
      'ما الأسهم التي تشهد عمليات شراء مؤسسية؟',
      'ما الأسهم التي تحقق اختراقات؟',
      'ما الأسهم الآمنة عندما يكون VIX منخفضاً؟',
      'ما القطاع الأقوى في S&P 500؟',
      'ما هي أسهم الجودة التي تدفع أرباحاً؟',
    ],
    cta_free: 'تسجيل مجاني', signin: 'تسجيل الدخول',
    p2_back: 'رجوع', p2_cta: 'تسجيل مجاني',
    p2_ai_label: '▸ ملخص الذكاء الاصطناعي للسوق',
    p2_ai_text: 'نطاق دخول المحلل قيد المراجعة؛ هيكل الزخم الحالي اقترب من مستويات حرجة. الخلفية الكلية أصبحت محايدة لكن تدفق القطاع يولد إشارات إيجابية.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'نطاق الدخول', target_lbl: 'الهدف المحتمل', risk_lbl: 'إشارة الضعف', winrate_lbl: 'معدل النجاح',
    p2_market_shift: 'الأصول المتقاطعة',
    p2_corr: 'الارتباط الحالي لهذا الأصل:',
    p3_tab1: 'نظرة عامة', p3_tab2: 'التحليلات السابقة', p3_tab3: 'أداء الأصول',
    p3_upgrade: 'الترقية إلى Pro',
    p3_pro_lock: 'محتوى Pro — ترقية',
    p4_tab1: 'أفضل 5 يومياً', p4_tab2: 'تحليل القطاعات', p4_tab3: 'قوائم جاهزة', p4_tab4: 'التتبع الذكي',
    modal_title: 'أنشئ حساباً مجانياً للمتابعة',
    modal_sub: 'التسجيل مجاني. لا يلزم بطاقة ائتمان.',
    modal_google: 'الاستمرار مع Google',
    legal: 'بالتسجيل توافق على شروط الخدمة وسياسة الخصوصية.',
    install_cta: 'إضافة إلى الشاشة الرئيسية', install_btn: 'إضافة',
    legal_disclaimer: 'FinMA منصة تحليل سوق مدعومة بالذكاء الاصطناعي. المحتوى لأغراض إعلامية فقط؛ لا يُعدّ نصيحة استثمارية. القرار النهائي يعود للمستخدم. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  id: {
    p1_badge: 'Pasar AS · S&P 500 · NASDAQ · Dow Jones · Russell',
    p1_tagline: 'Kecerdasan Finansial',
    p1_h1: 'Temukan Peluang di', p1_h2: 'Pasar Saham AS.', p1_h3: '',
    p1_sub: 'Temukan saham terkuat hari ini dengan analisis yang didukung AI dalam hitungan detik.',
    p1_ph: 'Apa penyimpangan terbesar di pasar AS hari ini?',
    pill_gainers: '🔥 Penambah Terbesar', pill_nasdaq: '📊 Pemimpin NASDAQ', pill_volume: '💰 Volume Tinggi',
    pill_breakout: '⚡ Saham Breakout', pill_vix: '🌪️ Status VIX',
    p1_popular_title: '🔥 Pencarian Populer',
    p1_prompts: [
      'Apa penyimpangan terbesar di pasar AS hari ini?',
      'Saham teknologi apa yang memimpin NASDAQ sekarang?',
      'Saham apa yang mengalami pembelian institusional?',
      'Saham apa yang membuat terobosan?',
      'Saham apa yang aman ketika VIX rendah?',
      'Sektor apa yang paling kuat di S&P 500?',
      'Apa saham berkualitas yang membayar dividen?',
    ],
    cta_free: 'Daftar Gratis', signin: 'Masuk',
    p2_back: 'Kembali', p2_cta: 'Daftar Gratis',
    p2_ai_label: '▸ Ringkasan AI Pasar',
    p2_ai_text: 'Rentang entri analis sedang ditinjau; struktur momentum saat ini telah mendekati level kritis. Latar belakang makro menjadi netral tetapi aliran sektor menghasilkan sinyal positif.',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'Rentang Entri', target_lbl: 'Target Mungkin', risk_lbl: 'Sinyal Kelemahan', winrate_lbl: 'Tingkat Kemenangan',
    p2_market_shift: 'Cross-Asset (Market Shift)',
    p2_corr: 'Korelasi saat ini untuk aset ini:',
    p3_tab1: 'Ikhtisar', p3_tab2: 'Analisis Sebelumnya', p3_tab3: 'Kinerja Aset',
    p3_upgrade: 'Beli Pro — Top 5 Harian + Pelacakan',
    p3_pro_lock: 'Konten Pro — Tingkatkan',
    p4_tab1: 'Top 5 Harian', p4_tab2: 'Analisis Sektor', p4_tab3: 'Daftar Siap', p4_tab4: 'Pelacakan Cerdas',
    modal_title: 'Buat akun gratis untuk melanjutkan',
    modal_sub: 'Pendaftaran gratis. Tidak perlu kartu kredit.',
    modal_google: 'Lanjutkan dengan Google',
    legal: 'Dengan mendaftar Anda setuju dengan Syarat Layanan dan Kebijakan Privasi.',
    install_cta: 'Tambahkan ke layar beranda', install_btn: 'Tambah',
    legal_disclaimer: 'FinMA adalah platform analisis pasar bertenaga AI. Konten yang disediakan hanya untuk informasi; bukan merupakan saran investasi. Keputusan akhir ada pada pengguna. © 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
  ja: {
    p1_badge: '米国市場・S&P 500・NASDAQ・Dow Jones・Russell',
    p1_tagline: 'ファイナンシャル・インテリジェンス',
    p1_h1: '米国株式市場で', p1_h2: '機会を発見します。', p1_h3: '',
    p1_sub: 'AI搭載分析により、数秒で本日の最強銘柄を発見します。',
    p1_ph: '今日の米国市場で最大の上昇銘柄は何ですか？',
    pill_gainers: '🔥 最大上昇', pill_nasdaq: '📊 NASDAQ指導者', pill_volume: '💰 高ボリューム',
    pill_breakout: '⚡ ブレイクアウト', pill_vix: '🌪️ VIXステータス',
    p1_popular_title: '🔥 人気検索',
    p1_prompts: [
      '今日の米国市場で最大の上昇銘柄は何ですか？',
      'NASDACを主導している技術銘柄は何ですか？',
      '機関投資家の買いを受けている銘柄は何ですか？',
      'ブレイクアウトしている銘柄は何ですか？',
      'VIXが低いときに安全な銘柄は何ですか？',
      'S&P 500で最も強いセクターは何ですか？',
      '配当を支払う優良銘柄は何ですか？',
    ],
    cta_free: '無料登録', signin: 'ログイン',
    p2_back: '戻る', p2_cta: '無料登録',
    p2_ai_label: '▸ AIマーケットサマリー',
    p2_ai_text: 'アナリストのエントリー範囲を検討中；現在のモメンタム構造は重要なレベルに近づいています。マクロ環境は中立に転じましたが、セクターフローはポジティブなシグナルを生成しています。',
    p2_action_title: 'AI Trade Insight',
    entry_lbl: 'アナリスト参入範囲', target_lbl: '可能なターゲット', risk_lbl: '構造的弱さシグナル', winrate_lbl: '勝率',
    p2_market_shift: 'クロスアセット (Market Shift)',
    p2_corr: 'この資産の現在の相関:',
    p3_tab1: '概要', p3_tab2: '過去の分析', p3_tab3: '資産パフォーマンス',
    p3_upgrade: 'プロにアップグレード',
    p3_pro_lock: 'プロコンテンツ — アップグレード',
    p4_tab1: 'デイリーTop 5', p4_tab2: 'セクター分析', p4_tab3: 'レディリスト', p4_tab4: 'スマートトラッキング',
    modal_title: '続けるには無料アカウントを作成してください',
    modal_sub: '登録は無料です。クレジットカード不要。',
    modal_google: 'Googleで続ける',
    legal: '登録することで、利用規約とプライバシーポリシーに同意したことになります。',
    install_cta: 'ホーム画面に追加', install_btn: '追加',
    legal_disclaimer: 'FinMAはAI搭載の市場分析プラットフォームです。提供コンテンツは情報提供のみを目的としており、投資アドバイスではありません。最終決定はユーザーに帰属します。© 2026 FinMA NY/USA Powered by AFK DaSYS',
  },
}

// ─── Asset Database ───────────────────────────────────────────────────────────
const ASSETS: Record<string, AssetInfo> = {
  stocks: { ticker: 'SPY',      displayName: 'S&P 500 ETF',    category: 'ABD Hisseleri', meta: 'NYSE ARCA · ETF',     icon: '📈', price: '582.45', change: '+1.23%', changeDir: 'up' },
  tech:   { ticker: 'QQQ',      displayName: 'Nasdaq-100 ETF',  category: 'ABD Hisseleri', meta: 'NASDAQ · ETF',        icon: '◈',  price: '494.32', change: '+0.95%', changeDir: 'up' },
  dow:    { ticker: 'DIA',      displayName: 'Dow Jones ETF',   category: 'ABD Hisseleri', meta: 'NYSE ARCA · ETF',     icon: '📊', price: '398.75', change: '+0.87%', changeDir: 'up' },
  russell:{ ticker: 'IWM',      displayName: 'Russell 2000 ETF',category: 'ABD Hisseleri', meta: 'NASDAQ · ETF',        icon: '📈', price: '206.23', change: '+1.12%', changeDir: 'up' },
}

const MACRO = [
  { label: 'SPY',   value: '582.45', chg: '+1.23%', desc: 'S&P 500 ETF',   dir: 'up'   as const },
  { label: 'QQQ',   value: '494.32', chg: '+0.95%', desc: 'Nasdaq-100',    dir: 'up'   as const },
  { label: 'DIA',   value: '398.75', chg: '+0.87%', desc: 'Dow Jones ETF',  dir: 'up'   as const },
  { label: 'IWM',   value: '206.23', chg: '+1.12%', desc: 'Russell 2000',  dir: 'up'   as const },
  { label: 'VIX',   value: '18.4',   chg: '+2.10%', desc: 'Volatilite',    dir: 'up'   as const },
  { label: 'US10Y', value: '4.32%',  chg: '+0.04',  desc: 'ABD Bonosu',    dir: 'up'   as const },
]

function resolveAsset(q: string): AssetInfo {
  const ql = q.toLowerCase().trim()
  if (['tech', 'teknoloji', 'qqq', 'nasdaq'].some(k => ql.includes(k))) return ASSETS.tech
  if (['dow', 'dj', 'dia'].some(k => ql.includes(k))) return ASSETS.dow
  if (['russell', 'iwm', '2000'].some(k => ql.includes(k))) return ASSETS.russell
  if (['sp500', 'spy', 'abd', 'us market', 'borsa'].some(k => ql.includes(k))) return ASSETS.stocks
  const upper = q.trim().toUpperCase()
  if (/^[A-Z]{1,5}$/.test(upper)) {
    return { ticker: upper, displayName: upper, category: 'ABD Hisseleri', meta: 'NYSE/NASDAQ · Hisse', icon: '📊', price: '—', change: '—', changeDir: 'up' }
  }
  return ASSETS.stocks
}

// ─── Shared Styles ────────────────────────────────────────────────────────────
const S = {
  card: {
    background: '#0C1017',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 13,
    padding: '18px 20px',
  } as React.CSSProperties,
  label: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '1.5px',
    color: '#4C5A6B',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  },
  tag: {
    fontFamily: 'DM Mono, monospace',
    fontSize: 10,
    fontWeight: 500,
    letterSpacing: '1.2px',
    textTransform: 'uppercase' as const,
    padding: '3px 8px',
    borderRadius: 5,
  },
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function LandingPage() {
  type Page = 'p1' | 'p2' | 'p3' | 'p4'
  type P3Tab = 'overview' | 'history' | 'perf'
  type P4Tab = 'top5' | 'sectors' | 'lists' | 'tracking'

  const [page, setPage] = useState<Page>('p1')
  const [lang, setLang] = useState('tr')
  const [langOpen, setLangOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [asset, setAsset] = useState<AssetInfo>(ASSETS.stocks)
  const [p3tab, setP3tab] = useState<P3Tab>('overview')
  const [p4tab, setP4tab] = useState<P4Tab>('top5')
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showInstall, setShowInstall] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [searchVal, setSearchVal] = useState('')
  const [isMounted, setIsMounted] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const { isAuthenticated, login } = useAuthStore()
  const { setMobileMenuOpen: openSidebar } = useTerminalStore()
  const router = useRouter()
  const t = (COPY[lang] ?? COPY.tr)
  const isRtl = lang === 'ar'

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) router.push('/dashboard')
  }, [isAuthenticated, router])

  // Search handler
  const doSearch = useCallback((q: string) => {
    if (!q.trim()) return
    setAsset(resolveAsset(q))
    setSearchVal('')
    setPage('p2')
  }, [])

  // Google OAuth handler
  const handleGoogleResponse = useCallback(async (resp: any) => {
    setAuthLoading(true)
    setAuthError('')
    try {
      const result = await api.googleLogin(resp.credential)
      login(result.access_token, result.user as any)
      router.push('/dashboard')
    } catch (err: any) {
      setAuthError(err.message || 'Giriş yapılamadı')
    } finally {
      setAuthLoading(false)
    }
  }, [login, router])

  // Google GSI init (re-runs when modal opens or lang changes)
  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) return
    const init = () => {
      if (!window.google?.accounts?.id) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleResponse })
      const el = document.getElementById('landing-google-btn')
      if (el) {
        el.innerHTML = ''
        window.google!.accounts.id.renderButton(el, {
          type: 'standard', theme: 'filled_black', size: 'large',
          text: 'signin_with', shape: 'rectangular', width: 320,
          locale: lang === 'tr' ? 'tr' : 'en',
        })
      }
    }
    if (window.google?.accounts?.id) init()
    else {
      const iv = setInterval(() => {
        if (window.google?.accounts?.id) { clearInterval(iv); init() }
      }, 100)
      const to = setTimeout(() => clearInterval(iv), 5000)
      return () => { clearInterval(iv); clearTimeout(to) }
    }
  }, [handleGoogleResponse, lang, showModal])

  // PWA install prompt
  useEffect(() => {
    const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); setShowInstall(true) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  // Set isMounted for client-side rendering
  useEffect(() => {
    setIsMounted(true)
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setShowInstall(false)
      setDeferredPrompt(null)
    }
  }

  const gotoPage = (p: Page) => { setPage(p); window.scrollTo(0, 0) }

  // ─── HEADER ───
  const Header = () => (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, height: 56,
      background: 'rgba(6,10,15,0.85)', backdropFilter: 'blur(12px)',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      justifyContent: 'space-between',
    }}>
      {/* Sol: Masaüstünde Logo, Mobilde Hamburger */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Hamburger — sadece mobilde, solda */}
        <button
          className="md:hidden"
          onClick={() => openSidebar(true)}
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8,
            padding: '7px 10px', cursor: 'pointer', color: '#EDF2FA',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            touchAction: 'manipulation',
          }}
          aria-label="Menüyü aç"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" fill="none">
            <rect y="0" width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="6" width="18" height="2" rx="1" fill="currentColor"/>
            <rect y="12" width="18" height="2" rx="1" fill="currentColor"/>
          </svg>
        </button>
        {/* Logo — sadece masaüstünde solda */}
        <button
          onClick={() => gotoPage('p1')}
          className="hidden md:flex"
          style={{ alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="22" height="20" viewBox="0 0 24 24" fill="none">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"
              stroke="#2D7EF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 18, color: '#EDF2FA', letterSpacing: '-0.5px' }}>
            Fin<span style={{ color: '#2D7EF8' }}>MA</span>
          </span>
        </button>
      </div>

      {/* Orta: Kayan ticker — her ekranda */}
      <div style={{ flex: 1, overflow: 'hidden', padding: '0 12px' }}>
        <LandingTicker />
      </div>

      {/* Sağ: Logo (sadece mobilde) + Lang + Auth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Logo — sadece mobilde sağda */}
        <button
          onClick={() => gotoPage('p1')}
          className="md:hidden"
          style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          <svg width="20" height="18" viewBox="0 0 24 24" fill="none">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"
              stroke="#2D7EF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 17, color: '#EDF2FA', letterSpacing: '-0.5px' }}>
            Fin<span style={{ color: '#2D7EF8' }}>MA</span>
          </span>
        </button>
        {/* Lang picker */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setLangOpen(o => !o)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#8B97AA',
              fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            {lang.toUpperCase()}
            <span style={{ fontSize: 8, opacity: 0.6 }}>▼</span>
          </button>
          {langOpen && (
            <div style={{
              position: 'absolute', top: '110%', right: 0, background: '#0C1017',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10, padding: '6px 0',
              minWidth: 140, zIndex: 200,
            }}>
              {LANGS.map(l => (
                <button key={l.code}
                  onClick={() => { setLang(l.code); setLangOpen(false) }}
                  style={{
                    display: 'flex', width: '100%', padding: '8px 14px', gap: 8, alignItems: 'center',
                    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
                    color: l.code === lang ? '#EDF2FA' : '#8B97AA',
                    fontFamily: 'Manrope, sans-serif', fontSize: 13,
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sign in — masaüstünde görünür */}
        <button
          onClick={() => router.push('/login')}
          className="hidden md:block"
          style={{
            background: 'none', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 8,
            padding: '6px 14px', cursor: 'pointer', color: '#8B97AA',
            fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 500,
          }}
        >
          {t.signin}
        </button>

        {/* Sign up — masaüstünde görünür */}
        <button
          onClick={() => setShowModal(true)}
          className="hidden md:block"
          style={{
            background: '#2D7EF8', border: 'none', borderRadius: 8,
            padding: '7px 16px', cursor: 'pointer', color: '#fff',
            fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
          }}
        >
          {t.cta_free}
        </button>

      </div>
    </header>
  )

  // ─── PAGE 1: SEARCH LANDING ───
  const Page1 = () => {
    const [localVal, setLocalVal] = useState('')
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => { inputRef.current?.focus() }, [])

    const submit = () => doSearch(localVal)

    return (
      <div className="lp-page-enter" style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        padding: '84px 20px 32px', position: 'relative', zIndex: 1,
      }}>
        {/* Hero heading */}
        <div style={{ textAlign: 'center', marginBottom: 38, maxWidth: 660 }}>
          {/* Market Index Tickers */}
          <MarketIndexBadge />
          {/* H1 */}
          <h1 style={{
            fontFamily: 'DM Serif Display, serif', fontSize: 'clamp(40px, 6.5vw, 72px)',
            fontWeight: 400, lineHeight: 1.05, color: '#EDF2FA',
            margin: '0 0 12px', letterSpacing: '-1.5px',
          }}>
            {t.p1_h1}<br />
            <em style={{ fontStyle: 'italic', color: '#2D7EF8' }}>{t.p1_h2}</em>
          </h1>
          {/* Sub */}
          <p style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 300,
            color: '#8B97AA', lineHeight: 1.65, margin: 0, maxWidth: 420,
            marginLeft: 'auto', marginRight: 'auto',
          }}>
            {t.p1_sub}
          </p>
        </div>

        {/* Search box */}
        <div style={{ width: '100%', maxWidth: 640, position: 'relative', marginBottom: 20 }}>
          <input
            ref={inputRef}
            type="text"
            value={localVal}
            onChange={e => setLocalVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            placeholder="AI Başarı Karnesi"
            style={{
              width: '100%', height: 60, background: '#101820',
              border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14,
              padding: '0 120px 0 20px', fontSize: 16,  // 16px — iOS zoom prevention
              color: '#EDF2FA', outline: 'none', boxSizing: 'border-box',
              fontFamily: 'Manrope, sans-serif', transition: 'border-color 0.25s',
            }}
            onFocus={e => { e.target.style.borderColor = 'rgba(45,126,248,0.5)' }}
            onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.10)' }}
          />
          <button
            onClick={submit}
            style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: '#2D7EF8', border: 'none', borderRadius: 9,
              width: 40, height: 40, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="white" strokeWidth="2"/>
              <path d="m21 21-4.35-4.35" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Keyboard hint (hidden on mobile) */}
          <span style={{
            position: 'absolute', right: 62, top: '50%', transform: 'translateY(-50%)',
            fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B',
            letterSpacing: '0.5px',
          }} className="hidden sm:block">
            ENTER ↵
          </span>
        </div>

        {/* Pill shortcuts — 3×2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, width: '100%', maxWidth: 640, marginBottom: 40 }}>
          {[
            { label: '⚡ Canlı Piyasa Radarı',  q: 'Canlı Piyasa Radarı' },
            { label: '🧭 Makro Endeksler',        q: 'Makro Endeksler' },
            { label: '🗺️ Para Akışı Haritası',   q: 'Para Akışı Haritası' },
            { label: '🔥 Hacim Liderleri',        q: 'Hacim Liderleri' },
            { label: '💸 Temettü Yıldızları',     q: 'Temettü Yıldızları' },
            { label: '🎯 AI Başarı Karnesi',      q: 'AI Başarı Karnesi' },
          ].map(pill => (
            <button
              key={pill.q}
              onClick={() => doSearch(pill.q)}
              style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10, padding: '9px 10px', cursor: 'pointer',
                color: '#8B97AA', fontFamily: 'Manrope, sans-serif', fontSize: 12.5, fontWeight: 500,
                transition: 'all 0.2s', textAlign: 'center',
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.borderColor = 'rgba(45,126,248,0.40)'
                el.style.color = '#EDF2FA'
                el.style.background = 'rgba(45,126,248,0.06)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.borderColor = 'rgba(255,255,255,0.10)'
                el.style.color = '#8B97AA'
                el.style.background = 'rgba(255,255,255,0.03)'
              }}
            >
              {pill.label}
            </button>
          ))}
        </div>

      </div>
    )
  }

  // ─── PAGE 2: RESULTS ───
  const Page2 = () => {
    const upColor = '#10B981'
    const downColor = '#F43F5E'
    const chgColor = asset.changeDir === 'up' ? upColor : downColor

    return (
      <div className="lp-page-enter" style={{ paddingTop: 84, position: 'relative', zIndex: 1 }}>
        {/* Sub-header */}
        <div style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 20px', display: 'flex', alignItems: 'center',
          gap: 12, flexWrap: 'wrap',
        }}>
          <button
            onClick={() => gotoPage('p1')}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer', color: '#8B97AA',
              fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            ← {t.p2_back}
          </button>

          {/* Asset info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
            <span style={{ fontSize: 20 }}>{asset.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, color: '#EDF2FA' }}>
                  {asset.displayName}
                </span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#4C5A6B', letterSpacing: '1px' }}>
                  {asset.ticker}
                </span>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B', letterSpacing: '1px' }}>
                {asset.meta}
              </div>
            </div>
            {/* Live badge */}
            <span style={{
              fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '1.5px',
              color: '#10B981', background: 'rgba(16,185,129,0.10)',
              padding: '3px 8px', borderRadius: 20, textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <span className="lp-blink" style={{ fontSize: 7 }}>●</span> Canlı AI
            </span>
          </div>

          {/* Kayıt linki — hafif, taciz değil */}
          <a
            href="#"
            onClick={e => { e.preventDefault(); setShowModal(true) }}
            style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#4C5A6B',
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}
          >
            Üye Girişi
          </a>
        </div>

        {/* Macro strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
          gap: 1, background: 'rgba(255,255,255,0.04)', margin: '0 0 1px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          {MACRO.map(m => (
            <div key={m.label} style={{
              background: '#060A0F', padding: '10px 14px',
              borderRight: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B', letterSpacing: '1.5px', marginBottom: 3 }}>
                {m.label}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#EDF2FA', marginBottom: 2 }}>
                {m.value}
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: m.dir === 'up' ? upColor : downColor }}>
                {m.chg}
              </div>
            </div>
          ))}
        </div>

        {/* Main content grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16,
          padding: '16px 20px', maxWidth: 1100, margin: '0 auto',
        }}>
          {/* Left: main content */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* AI Summary Card */}
            <div style={{ ...S.card }}>
              <div style={{ ...S.label, color: '#2D7EF8', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="lp-blink" style={{ color: '#2D7EF8', fontSize: 8 }}>●</span>
                {t.p2_ai_label}
              </div>
              <p style={{
                fontFamily: 'DM Serif Display, serif', fontSize: 16, fontStyle: 'italic',
                color: '#B8C5D4', lineHeight: 1.7, margin: 0,
              }}>
                {t.p2_ai_text}
              </p>
            </div>

            {/* Quick market links */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 8,
            }}>
              {[
                { href: '/market/stocks', label: '📈 ABD Borsaları' },
                { href: '/market/crypto', label: '🪙 Bitcoin' },
                { href: '/market/commodities', label: '💎 Altın' },
                { href: '/market/tech', label: '💻 Teknoloji' },
                { href: '/market/forex', label: '💱 EUR/USD' },
                { href: '/world-markets', label: '🌍 Dünya' },
              ].map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  style={{
                    padding: '10px 12px',
                    fontSize: 'clamp(11px, 3vw, 12px)',
                    color: '#2D7EF8',
                    textDecoration: 'none',
                    textAlign: 'center',
                    border: '1px solid rgba(45,126,248,0.25)',
                    background: 'rgba(45,126,248,0.05)',
                    borderRadius: 8,
                    transition: 'all 200ms',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(45,126,248,0.15)'
                    e.currentTarget.style.borderColor = 'rgba(45,126,248,0.50)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(45,126,248,0.05)'
                    e.currentTarget.style.borderColor = 'rgba(45,126,248,0.25)'
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Action Box */}
            <div style={{ ...S.card, background: '#0A1520', border: '1px solid rgba(45,126,248,0.15)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ ...S.label, color: '#2D7EF8' }}>🎯 {t.p2_action_title}</div>
                  <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 18, color: '#EDF2FA' }}>
                    Momentum Kırılım Yapısı
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 28, color: '#2D7EF8', lineHeight: 1 }}>82</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#4C5A6B', letterSpacing: '1px' }}>GÜVEN / 100</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <span style={{ ...S.tag, background: 'rgba(16,185,129,0.13)', color: '#10B981' }}>Breakout</span>
                <span style={{ ...S.tag, background: 'rgba(45,126,248,0.13)', color: '#2D7EF8' }}>Risk-On</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {[
                  { label: t.entry_lbl,   value: `$${asset.price}`, sub: '± %0.8' },
                  { label: t.target_lbl,  value: '+7.4%', sub: 'Olası Hedef' },
                  { label: t.winrate_lbl, value: '68.3%', sub: 'Geçmiş Veri' },
                ].map(row => (
                  <div key={row.label} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ ...S.label }}>{row.label}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 15, color: '#EDF2FA', fontWeight: 700 }}>{row.value}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B' }}>{row.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chart — subtle, above paywall */}
            <div style={{ ...S.card, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ ...S.label }}>Fiyat Grafiği — 1 Ay</div>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: chgColor }}>
                  {asset.change}
                </div>
              </div>
              <LandingChart ticker={asset.ticker} />
            </div>

            {/* Paywall zone */}
            <div style={{ position: 'relative', borderRadius: 13, overflow: 'hidden' }}>
              {/* Blurred content */}
              <div className="lp-blur-content" style={{ ...S.card, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: 'Senaryo: Boğa', value: '+12.4%', color: '#10B981' },
                  { label: 'Senaryo: Ayı',  value: '-8.7%',  color: '#F43F5E' },
                  { label: 'Destek Seviyesi', value: '547.20', color: '#EDF2FA' },
                  { label: 'Direnç Seviyesi', value: '598.80', color: '#EDF2FA' },
                  { label: 'Stop-Loss Referansı', value: '541.00', color: '#F43F5E' },
                  { label: 'Sektör Sıralaması', value: '#4 / 11',  color: '#F59E0B' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ ...S.label }}>{item.label}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 16, color: item.color, fontWeight: 700 }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Paywall overlay — bilgilendirici, taciz yok */}
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 0%, rgba(12,16,23,0.80) 35%, rgba(12,16,23,0.97) 60%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end',
                padding: '16px 20px 20px', borderRadius: 13,
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '2px', color: '#4C5A6B', marginBottom: 6, textTransform: 'uppercase' }}>
                    PRO İÇERİK
                  </div>
                  <div style={{
                    fontFamily: 'Manrope, sans-serif', fontWeight: 600, fontSize: 13, color: '#8B97AA', marginBottom: 10,
                  }}>
                    Senaryo ve seviyelere erişmek için üye ol
                  </div>
                  <button
                    onClick={() => setShowModal(true)}
                    style={{
                      background: 'rgba(45,126,248,0.12)', border: '1px solid rgba(45,126,248,0.25)',
                      borderRadius: 8, padding: '8px 20px', cursor: 'pointer', color: '#2D7EF8',
                      fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                    }}
                  >
                    Ücretsiz Hesap Oluştur
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Market Shift */}
            <div style={{ ...S.card }}>
              <div style={{ ...S.label, marginBottom: 12 }}>{t.p2_market_shift}</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA', marginBottom: 10 }}>
                {t.p2_corr}
              </div>
              {[
                { label: 'DXY', tag: 'Negatif Korelasyon', color: '#F43F5E', bg: 'rgba(244,63,94,0.10)' },
                { label: 'VIX', tag: 'Risk Baskısı: Düşük', color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
                { label: 'BTC', tag: 'Risk-On Paralel',      color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
              ].map(c => (
                <div key={c.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#EDF2FA' }}>{c.label}</span>
                  <span style={{ ...S.tag, background: c.bg, color: c.color, fontSize: 9 }}>{c.tag}</span>
                </div>
              ))}
              <div style={{ marginTop: 12, padding: '8px 10px', background: 'rgba(16,185,129,0.08)', borderRadius: 8, border: '1px solid rgba(16,185,129,0.15)' }}>
                <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '1.5px', color: '#10B981', marginBottom: 3 }}>
                  MACRO SIGNAL
                </div>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#B8C5D4' }}>
                  Risk-On ortam · Macro Tailwind
                </div>
              </div>
            </div>

            {/* Notification demo */}
            <div style={{ ...S.card }}>
              <div style={{ ...S.label, marginBottom: 10 }}>Bildirim Örneği</div>
              {[
                { time: '09:42', msg: 'AAPL momentum kırılım sinyali', color: '#10B981' },
                { time: '11:15', msg: 'SPY direnç testinde', color: '#F59E0B' },
                { time: '14:30', msg: 'BTC volatilite uyarısı', color: '#F43F5E' },
              ].map(n => (
                <div key={n.time} style={{
                  display: 'flex', gap: 10, padding: '8px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ width: 4, flexShrink: 0, background: n.color, borderRadius: 2 }} />
                  <div>
                    <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#B8C5D4' }}>{n.msg}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B' }}>{n.time}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: 10, padding: '7px 8px', background: 'rgba(45,126,248,0.05)', borderRadius: 7, border: '1px solid rgba(45,126,248,0.10)' }}>
                <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#4C5A6B' }}>
                  Pro üyeler anlık sinyal bildirimi alır.{' '}
                  <a href="#" onClick={e => { e.preventDefault(); setShowModal(true) }} style={{ color: '#2D7EF8', textDecoration: 'none' }}>Üye ol →</a>
                </span>
              </div>
            </div>

            {/* Legal note */}
            <p style={{
              fontFamily: 'Manrope, sans-serif', fontSize: 10, color: '#4C5A6B',
              lineHeight: 1.6, margin: 0, padding: '10px 4px',
            }}>
              {t.legal_disclaimer}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ─── PAGE 3: FREE DASHBOARD ───
  const Page3 = () => (
    <div className="lp-page-enter" style={{ paddingTop: 84, position: 'relative', zIndex: 1, minHeight: '100vh' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 84px)' }}>
        {/* Sidebar */}
        <div style={{ background: '#0A1520', borderRight: '1px solid rgba(255,255,255,0.06)', padding: '20px 0' }}>
          <div style={{ padding: '0 14px', marginBottom: 8 }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Genel</div>
            {[
              { id: 'overview' as P3Tab, label: t.p3_tab1, icon: '⊞' },
              { id: 'history'  as P3Tab, label: t.p3_tab2, icon: '◷' },
              { id: 'perf'     as P3Tab, label: t.p3_tab3, icon: '◈' },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => setP3tab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 10px', borderRadius: 8, marginBottom: 3,
                  background: p3tab === tab.id ? 'rgba(45,126,248,0.12)' : 'none',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                  color: p3tab === tab.id ? '#2D7EF8' : '#8B97AA',
                  fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span> {tab.label}
              </button>
            ))}
          </div>

          <div style={{ margin: '16px 14px 8px', height: 1, background: 'rgba(255,255,255,0.06)' }} />

          <div style={{ padding: '0 14px' }}>
            <div style={{ ...S.label, marginBottom: 10 }}>Pro İçerik</div>
            {['Günlük Top 5', 'Sektörel Analiz', 'Akıllı Takip'].map(item => (
              <div key={item}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '9px 10px', borderRadius: 8, marginBottom: 3,
                  color: '#4C5A6B', fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 500,
                }}
              >
                <span style={{ fontSize: 11 }}>🔒</span> {item}
                <span style={{ marginLeft: 'auto', fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#2D7EF8', background: 'rgba(45,126,248,0.08)', padding: '2px 6px', borderRadius: 4 }}>PRO</span>
              </div>
            ))}
          </div>

          {/* Hesap bilgisi — sade */}
          <div style={{ margin: '20px 14px 0', padding: '10px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#4C5A6B' }}>
              Pro özelliklere erişmek için{' '}
              <a href="#" onClick={e => { e.preventDefault(); setShowModal(true) }} style={{ color: '#2D7EF8', textDecoration: 'none', fontWeight: 600 }}>üye ol</a>.
            </div>
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          {p3tab === 'overview' && (
            <div>
              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: 'S&P 500', val: '5,826', chg: '+1.23%', dir: 'up' as const },
                  { label: 'Nasdaq-100', val: '20,432', chg: '+0.95%', dir: 'up' as const },
                  { label: 'Bitcoin', val: '$87,420', chg: '-2.41%', dir: 'down' as const },
                ].map(stat => (
                  <div key={stat.label} style={{ ...S.card }}>
                    <div style={{ ...S.label }}>{stat.label}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 22, color: '#EDF2FA', marginBottom: 4 }}>{stat.val}</div>
                    <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: stat.dir === 'up' ? '#10B981' : '#F43F5E' }}>{stat.chg}</div>
                  </div>
                ))}
              </div>

              {/* Top 5 preview (3 visible, 2 locked) */}
              <div style={{ ...S.card, marginBottom: 14 }}>
                <div style={{ ...S.label, marginBottom: 12 }}>Top 5 Önizleme</div>
                {[
                  { rank: 1, ticker: 'NVDA', name: 'NVIDIA Corp', score: 94, chg: '+3.2%' },
                  { rank: 2, ticker: 'META', name: 'Meta Platforms', score: 91, chg: '+1.8%' },
                  { rank: 3, ticker: 'MSFT', name: 'Microsoft Corp', score: 88, chg: '+0.9%' },
                ].map(s => (
                  <div key={s.ticker} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#4C5A6B', width: 16 }}>{s.rank}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#EDF2FA', fontWeight: 600 }}>{s.ticker}</div>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA' }}>{s.name}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#10B981' }}>{s.chg}</div>
                      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#2D7EF8' }}>Skor {s.score}</div>
                    </div>
                  </div>
                ))}
                {/* Locked rows */}
                <div className="lp-blur-content">
                  {[
                    { rank: 4, ticker: 'AMZN', name: 'Amazon.com Inc', score: 85, chg: '+1.1%' },
                    { rank: 5, ticker: 'AAPL', name: 'Apple Inc', score: 83, chg: '+0.6%' },
                  ].map(s => (
                    <div key={s.ticker} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#4C5A6B', width: 16 }}>{s.rank}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#EDF2FA', fontWeight: 600 }}>{s.ticker}</div>
                        <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA' }}>{s.name}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#10B981' }}>{s.chg}</div>
                        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#2D7EF8' }}>Skor {s.score}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pro bilgi satırı — hafif */}
              <div style={{
                background: 'rgba(45,126,248,0.05)',
                border: '1px solid rgba(45,126,248,0.12)', borderRadius: 10, padding: '12px 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
              }}>
                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#4C5A6B' }}>
                  {t.p3_upgrade}
                </div>
                <a
                  href="#"
                  onClick={e => { e.preventDefault(); setShowModal(true) }}
                  style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#2D7EF8', textDecoration: 'none', fontWeight: 600 }}
                >
                  Detaylar →
                </a>
              </div>
            </div>
          )}

          {p3tab === 'history' && (
            <div>
              <div style={{ ...S.label, marginBottom: 16 }}>Geçmiş Analizler</div>
              {[
                { date: '24 Mar 2026', title: 'S&P 500 momentum kırılım analizi', note: 'Güven: 82/100 · Breakout yapısı onaylandı' },
                { date: '23 Mar 2026', title: 'Bitcoin destek testi', note: 'Güven: 74/100 · Makro baskı yüksek' },
                { date: '22 Mar 2026', title: 'NVIDIA sektör liderliği', note: 'Güven: 91/100 · Güçlü momentum' },
              ].map(item => (
                <div key={item.date} style={{ ...S.card, marginBottom: 10 }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#4C5A6B', marginBottom: 4 }}>{item.date}</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#EDF2FA', fontWeight: 600, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA' }}>{item.note}</div>
                </div>
              ))}
            </div>
          )}

          {p3tab === 'perf' && (
            <div>
              <div style={{ ...S.label, marginBottom: 16 }}>Varlık Performansı</div>
              {[
                { asset: 'SPY', label: 'S&P 500', '1w': '+1.8%', '1m': '+4.2%', '1y': '+24.1%', dir: 'up' as const },
                { asset: 'QQQ', label: 'Nasdaq-100', '1w': '+2.1%', '1m': '+5.8%', '1y': '+31.4%', dir: 'up' as const },
                { asset: 'GC=F', label: 'Altın', '1w': '+0.9%', '1m': '+3.1%', '1y': '+18.7%', dir: 'up' as const },
                { asset: 'BTC-USD', label: 'Bitcoin', '1w': '-3.2%', '1m': '-8.4%', '1y': '+42.1%', dir: 'down' as const },
              ].map(row => (
                <div key={row.asset} style={{
                  display: 'grid', gridTemplateColumns: '80px 1fr 1fr 1fr 1fr',
                  alignItems: 'center', gap: 12, padding: '10px 12px',
                  background: '#0C1017', borderRadius: 8, marginBottom: 6,
                  border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#EDF2FA' }}>{row.asset}</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA' }}>{row.label}</div>
                  {[row['1w'], row['1m'], row['1y']].map((v, i) => (
                    <div key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: v.startsWith('-') ? '#F43F5E' : '#10B981', textAlign: 'right' }}>
                      {v}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )

  // ─── PAGE 4: PRO DASHBOARD ───
  const Page4 = () => (
    <div className="lp-page-enter" style={{ paddingTop: 56, position: 'relative', zIndex: 1, minHeight: '100vh', padding: '100px 20px 40px' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 0 }}>
        {[
          { id: 'top5' as P4Tab,     label: t.p4_tab1 },
          { id: 'sectors' as P4Tab,  label: t.p4_tab2 },
          { id: 'lists' as P4Tab,    label: t.p4_tab3 },
          { id: 'tracking' as P4Tab, label: t.p4_tab4 },
        ].map(tab => (
          <button key={tab.id}
            onClick={() => setP4tab(tab.id)}
            style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 500,
              color: p4tab === tab.id ? '#EDF2FA' : '#8B97AA',
              borderBottom: p4tab === tab.id ? '2px solid #2D7EF8' : '2px solid transparent',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {p4tab === 'top5' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {[
            { rank: 1, ticker: 'NVDA', name: 'NVIDIA', score: 94, setup: 'Momentum Breakout', chg: '+3.2%', sector: 'Teknoloji' },
            { rank: 2, ticker: 'META', name: 'Meta Platforms', score: 91, setup: 'Trend Continuation', chg: '+1.8%', sector: 'İletişim' },
            { rank: 3, ticker: 'MSFT', name: 'Microsoft', score: 88, setup: 'Pullback Reversal', chg: '+0.9%', sector: 'Teknoloji' },
            { rank: 4, ticker: 'AMZN', name: 'Amazon', score: 85, setup: 'Consolidation Break', chg: '+1.1%', sector: 'E-Ticaret' },
            { rank: 5, ticker: 'AAPL', name: 'Apple', score: 83, setup: 'Support Bounce', chg: '+0.6%', sector: 'Tüketici' },
          ].map(s => (
            <div key={s.ticker} style={{ ...S.card }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 20, color: '#2D7EF8', fontWeight: 700 }}>#{s.rank}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 18, color: '#10B981', fontWeight: 700 }}>{s.score}</span>
              </div>
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 20, color: '#EDF2FA', marginBottom: 2 }}>{s.ticker}</div>
              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#8B97AA', marginBottom: 10 }}>{s.name}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                <span style={{ ...S.tag, background: 'rgba(45,126,248,0.13)', color: '#2D7EF8', fontSize: 9 }}>{s.setup}</span>
                <span style={{ ...S.tag, background: 'rgba(255,255,255,0.05)', color: '#8B97AA', fontSize: 9 }}>{s.sector}</span>
              </div>
              <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 14, color: '#10B981', fontWeight: 700 }}>{s.chg}</div>
            </div>
          ))}
        </div>
      )}

      {p4tab === 'tracking' && (
        <div style={{ maxWidth: 600 }}>
          <div style={{ ...S.label, marginBottom: 16 }}>Akıllı Takip — Aktif Pozisyon</div>
          <div style={{ ...S.card, marginBottom: 14, border: '1px solid rgba(16,185,129,0.20)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '2px', color: '#10B981',
                background: 'rgba(16,185,129,0.10)', padding: '4px 10px', borderRadius: 20,
              }}>
                <span className="lp-blink" style={{ fontSize: 7 }}>●</span> AKTİF · KADEMELİ GİRİŞ
              </div>
            </div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 22, color: '#EDF2FA', marginBottom: 4 }}>NVDA</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#8B97AA', marginBottom: 16 }}>NVIDIA Corporation · Momentum Breakout</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              {[
                { label: 'Direktif', value: 'KADEMELİ GİRİŞ', color: '#10B981' },
                { label: 'Analist Giriş', value: '$887–902', color: '#EDF2FA' },
                { label: 'Durum', value: 'Onaylandı', color: '#10B981' },
              ].map(r => (
                <div key={r.label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ ...S.label }}>{r.label}</div>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: r.color, fontWeight: 700 }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Waiting state */}
          <div style={{ ...S.card, border: '1px solid rgba(245,158,11,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '2px', color: '#F59E0B',
                background: 'rgba(245,158,11,0.10)', padding: '4px 10px', borderRadius: 20,
              }}>
                <span className="lp-blink" style={{ fontSize: 7 }}>●</span> BEKLE
              </div>
            </div>
            <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 22, color: '#EDF2FA', marginBottom: 4 }}>META</div>
            <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#8B97AA' }}>Meta Platforms · Onay bekleniyor</div>
          </div>
        </div>
      )}

      {(p4tab === 'sectors' || p4tab === 'lists') && (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
          <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 24, color: '#EDF2FA', marginBottom: 8 }}>
            {p4tab === 'sectors' ? 'Sektörel Analizler' : 'Hazır Listeler'}
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: '#8B97AA', marginBottom: 24 }}>
            Pro içerik — ücretsiz hesabınızla temel özelliklere erişin.
          </div>
          <button
            onClick={() => setShowModal(true)}
            style={{
              background: '#2D7EF8', border: 'none', borderRadius: 10,
              padding: '12px 28px', cursor: 'pointer', color: '#fff',
              fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
            }}
          >
            {t.cta_free}
          </button>
        </div>
      )}
    </div>
  )

  // ─── AUTH MODAL ───
  const AuthModal = () => (
    <div
      onClick={() => setShowModal(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,10,15,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div
        className="lp-pop"
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0C1017', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 18, padding: '32px 28px', width: '100%', maxWidth: 400,
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 10 }}>
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="#2D7EF8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 800, fontSize: 20, color: '#EDF2FA', marginBottom: 6 }}>
            Fin<span style={{ color: '#2D7EF8' }}>MA</span>
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 17, color: '#EDF2FA', marginBottom: 6 }}>
            {t.modal_title}
          </div>
          <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#8B97AA' }}>
            {t.modal_sub}
          </div>
        </div>

        {/* Google button */}
        <div id="landing-google-btn" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }} />

        {/* Or divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#4C5A6B' }}>veya</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
        </div>

        {/* Email button (goes to login page) */}
        <button
          onClick={() => { setShowModal(false); router.push('/login') }}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10, padding: '12px', cursor: 'pointer', color: '#EDF2FA',
            fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 600, marginBottom: 12,
          }}
        >
          ✉ E-posta ile Devam Et
        </button>

        {authError && (
          <div style={{
            fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#F43F5E',
            textAlign: 'center', marginBottom: 10, padding: '8px', background: 'rgba(244,63,94,0.10)',
            borderRadius: 8,
          }}>
            {authError}
          </div>
        )}

        {/* Legal */}
        <p style={{
          fontFamily: 'Manrope, sans-serif', fontSize: 10, color: '#4C5A6B',
          textAlign: 'center', lineHeight: 1.5, margin: 0,
        }}>
          {t.legal}
        </p>

        {/* Dismiss — basic analysis still accessible */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button
            onClick={() => setShowModal(false)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#4C5A6B',
              textDecoration: 'underline', textUnderlineOffset: 3,
              padding: 0,
            }}
          >
            Temel analizi görüntüle →
          </button>
        </div>

        {/* Close */}
        <button
          onClick={() => setShowModal(false)}
          style={{
            position: 'absolute', top: 14, right: 14, background: 'none',
            border: 'none', cursor: 'pointer', color: '#4C5A6B', fontSize: 18, lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )

  // ─── PWA Install Banner ───
  const InstallBanner = () => (
    <div style={{
      position: 'fixed', top: 56, left: 0, right: 0, zIndex: 90,
      background: 'rgba(45,126,248,0.90)', backdropFilter: 'blur(8px)',
      borderBottom: '1px solid rgba(45,126,248,0.30)',
      padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: '#fff', fontWeight: 500 }}>
        📱 {t.install_cta}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setShowInstall(false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
          İptal
        </button>
        <button onClick={handleInstall}
          style={{
            background: '#fff', border: 'none', borderRadius: 7, padding: '6px 14px',
            cursor: 'pointer', color: '#2D7EF8', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700,
          }}>
          {t.install_btn}
        </button>
      </div>
    </div>
  )

  // ─── RENDER ───
  return (
    <div className="lp-root" dir={isRtl ? 'rtl' : 'ltr'} onClick={() => langOpen && setLangOpen(false)}>
      {/* Close lang dropdown on outside click is handled above */}

      <Sidebar />
      {showInstall && <InstallBanner />}
      <Header />

      <main style={{ position: 'relative', zIndex: 1 }}>
        {page === 'p1' && (
          <div style={{ display: 'flex', gap: 20, maxWidth: '1400px', margin: '0 auto', padding: '0 20px' }}>
            {/* Left: Main content (Page1 + Heatmap) */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <Page1 />
              <div style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
                <SectorHeatmap />
              </div>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px 0 40px', textAlign: 'center' }}>
                <p style={{
                  fontFamily: 'Manrope, sans-serif', fontSize: 'clamp(12px, 3vw, 13px)', color: '#8B97AA',
                  lineHeight: 1.6, margin: 0,
                }}>
                  {t.legal_disclaimer}
                </p>
              </div>
            </div>

            {/* Right: Market Movers Column (desktop only, lg+ breakpoint) */}
            {isMounted && window.innerWidth >= 1024 && (
              <div style={{
                width: 290,
                flexShrink: 0,
                paddingTop: 40,
              }}>
                <MarketMoversColumn />
              </div>
            )}
          </div>
        )}
        {page === 'p2' && <Page2 />}
        {page === 'p3' && <Page3 />}
        {page === 'p4' && <Page4 />}
      </main>

      {/* Bottom nav (demo) — free page accessible directly, pro shows modal */}
      {page === 'p2' && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 80,
          background: 'rgba(6,10,15,0.85)', backdropFilter: 'blur(8px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        }}>
          {/* Info label */}
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#4C5A6B' }}>
            Daha fazlası:
          </span>
          {/* Free — no login required */}
          <button onClick={() => setPage('p3')}
            style={{
              background: 'none', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#8B97AA',
              fontFamily: 'Manrope, sans-serif', fontSize: 12,
            }}>
            Ücretsiz Görünüm
          </button>
          {/* Pro — prompts signup */}
          <button onClick={() => setShowModal(true)}
            style={{
              background: 'rgba(45,126,248,0.15)', border: '1px solid rgba(45,126,248,0.30)',
              borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: '#2D7EF8',
              fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
            }}>
            Pro'yu Dene ✦
          </button>
        </div>
      )}

      {showModal && <AuthModal />}
    </div>
  )
}
