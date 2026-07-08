// Admin Site Haritası sayfasının kaynağı. Statik liste (dosya sistemi runtime'da
// taranmıyor — beklenmedik route'ların admin paneline sızma riskini önler).
// Yeni bir public/üye sayfası eklendiğinde buraya bir satır eklemeyi unutma.

export interface SitemapEntry {
  label: string;
  path: string;
}

export interface SitemapGroup {
  group: string;
  entries: SitemapEntry[];
}

export const SITEMAP_EN: SitemapGroup[] = [
  { group: "Genel", entries: [
    { label: "Anasayfa", path: "/global/en" },
    { label: "Home", path: "/global/en/home" },
  ]},
  { group: "Üyelik", entries: [
    { label: "Login", path: "/global/en/login" },
    { label: "Register", path: "/global/en/register" },
    { label: "Account", path: "/global/en/account" },
  ]},
  { group: "Tracker / Analiz", entries: [
    { label: "Top100", path: "/global/en/top100" },
    { label: "Swing", path: "/global/en/swing" },
    { label: "Swing Archive", path: "/global/en/swing/archive" },
    { label: "Swing Performance", path: "/global/en/swingperformance" },
    { label: "Trend", path: "/global/en/trend" },
    { label: "Performance", path: "/global/en/performance" },
    { label: "AI Report", path: "/global/en/ai" },
    { label: "Analysis (Ticker)", path: "/global/en/analysis/[ticker]" },
    { label: "Graphic (Ticker)", path: "/global/en/graphic/[ticker]" },
  ]},
  { group: "Kurumsal / Yasal", entries: [
    { label: "About", path: "/global/en/about" },
    { label: "Contact", path: "/global/en/contact" },
    { label: "Terms", path: "/global/en/terms" },
    { label: "Privacy", path: "/global/en/privacy" },
    { label: "Disclaimer", path: "/global/en/disclaimer" },
  ]},
];

export const SITEMAP_TR: SitemapGroup[] = [
  { group: "Genel", entries: [
    { label: "Anasayfa", path: "/global/tr" },
    { label: "Ana Sayfa", path: "/global/tr/home" },
  ]},
  { group: "Üyelik", entries: [
    { label: "Giriş", path: "/global/tr/giris" },
    { label: "Kayıt", path: "/global/tr/kayit" },
    { label: "Hesabım", path: "/global/tr/hesabim" },
  ]},
  { group: "Tracker / Analiz", entries: [
    { label: "Top100", path: "/global/tr/top100" },
    { label: "Swing", path: "/global/tr/swing" },
    { label: "Swing Arşiv", path: "/global/tr/swing/arsiv" },
    { label: "Swing Performance", path: "/global/tr/swingperformance" },
    { label: "Trend", path: "/global/tr/trend" },
    { label: "Performans", path: "/global/tr/performance" },
    { label: "AI Rapor", path: "/global/tr/ai" },
    { label: "Analiz (Hisse)", path: "/global/tr/analysis/[ticker]" },
  ]},
  { group: "Kurumsal / Yasal", entries: [
    { label: "Hakkında", path: "/global/tr/about" },
    { label: "İletişim", path: "/global/tr/contact" },
    { label: "Kullanım Şartları", path: "/global/tr/terms" },
    { label: "Gizlilik", path: "/global/tr/privacy" },
    { label: "Sorumluluk Reddi", path: "/global/tr/disclaimer" },
  ]},
];

export const SITEMAP_ES: SitemapGroup[] = [
  { group: "Genel", entries: [
    { label: "Anasayfa", path: "/global/es" },
    { label: "Home", path: "/global/es/home" },
  ]},
  { group: "Üyelik", entries: [
    { label: "Login", path: "/global/es/login" },
    { label: "Register", path: "/global/es/register" },
    { label: "Account", path: "/global/es/account" },
  ]},
  { group: "Tracker / Analiz", entries: [
    { label: "Top100", path: "/global/es/top100" },
    { label: "Swing", path: "/global/es/swing" },
    { label: "Swing Archive", path: "/global/es/swing/archive" },
    { label: "Swing Performance", path: "/global/es/swingperformance" },
    { label: "Trend", path: "/global/es/trend" },
    { label: "Performance", path: "/global/es/performance" },
    { label: "AI Report", path: "/global/es/ai" },
    { label: "Analysis (Ticker)", path: "/global/es/analysis/[ticker]" },
  ]},
  { group: "Kurumsal / Yasal", entries: [
    { label: "About", path: "/global/es/about" },
    { label: "Contact", path: "/global/es/contact" },
    { label: "Terms", path: "/global/es/terms" },
    { label: "Privacy", path: "/global/es/privacy" },
    { label: "Disclaimer", path: "/global/es/disclaimer" },
  ]},
];

export const SITEMAP_FR: SitemapGroup[] = [
  { group: "Genel", entries: [
    { label: "Anasayfa", path: "/global/fr" },
    { label: "Home", path: "/global/fr/home" },
  ]},
  { group: "Üyelik", entries: [
    { label: "Login", path: "/global/fr/login" },
    { label: "Register", path: "/global/fr/register" },
    { label: "Account", path: "/global/fr/account" },
  ]},
  { group: "Tracker / Analiz", entries: [
    { label: "Top100", path: "/global/fr/top100" },
    { label: "Swing", path: "/global/fr/swing" },
    { label: "Swing Archive", path: "/global/fr/swing/archive" },
    { label: "Swing Performance", path: "/global/fr/swingperformance" },
    { label: "Trend", path: "/global/fr/trend" },
    { label: "Performance", path: "/global/fr/performance" },
    { label: "AI Report", path: "/global/fr/ai" },
    { label: "Analysis (Ticker)", path: "/global/fr/analysis/[ticker]" },
  ]},
  { group: "Kurumsal / Yasal", entries: [
    { label: "About", path: "/global/fr/about" },
    { label: "Contact", path: "/global/fr/contact" },
    { label: "Terms", path: "/global/fr/terms" },
    { label: "Privacy", path: "/global/fr/privacy" },
    { label: "Disclaimer", path: "/global/fr/disclaimer" },
  ]},
];

export const SITEMAP_ADMIN: SitemapGroup[] = [
  { group: "Admin Sistem", entries: [
    { label: "Ana Panel", path: "/admin" },
    { label: "Yöneticiler", path: "/admin/admins" },
    { label: "Site Haritası", path: "/admin/sitemap" },
  ]},
  { group: "Üyeler & Paketler", entries: [
    { label: "Üye Yönetimi", path: "/admin/members" },
    { label: "Plan & Paket Yönetimi", path: "/admin/plans" },
    { label: "Gelen Mesajlar", path: "/admin/messages" },
  ]},
  { group: "İçerik & Kampanya", entries: [
    { label: "Kampanyalar", path: "/admin/campaigns" },
    { label: "Açılış Sayfası Düzenle", path: "/admin/landing" },
    { label: "Arşivlenmiş Bölümler", path: "/admin/archived-sections" },
  ]},
  { group: "Yapay Zeka & Raporlar", entries: [
    { label: "AI Rapor Hazırlama", path: "/admin/ai" },
    { label: "Günlük Yapay Zeka", path: "/admin/ai/daily" },
    { label: "AI Briefing Arşivi", path: "/admin/ai/archive" },
  ]},
  { group: "Analiz & Performans", entries: [
    { label: "Terminal Durumu (Pulse)", path: "/admin/analytics/terminal" },
    { label: "Genel Performans", path: "/admin/analytics/performance" },
    { label: "Kriter Performansı", path: "/admin/analytics/performance/kriter" },
    { label: "Tarama Raporları", path: "/admin/analytics/screener" },
    { label: "Tarama Arşivi", path: "/admin/analytics/screener/archive" },
    { label: "Saatlik Analizler", path: "/admin/analytics/hourly" },
  ]},
  { group: "İşlemler & Portföy", entries: [
    { label: "Top 100 Listesi", path: "/admin/top100" },
    { label: "Swing İşlemler", path: "/admin/trading/swing" },
    { label: "Opsiyon Analizi", path: "/admin/trading/options" },
    { label: "Opsiyon İzleme", path: "/admin/trading/options/monitor" },
    { label: "Opsiyon Performansı", path: "/admin/trading/options/performance" },
    { label: "Daytrade Dosyaları", path: "/admin/trading/daytrade-files" },
    { label: "Pro Dashboard", path: "/admin/pro" },
    { label: "Hisse Detay Girişi", path: "/admin/[ticker]" },
  ]}
];

