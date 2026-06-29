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
    { label: "Ticker Detail ([ticker])", path: "/global/en/[ticker]" },
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
    { label: "Hisse Detay ([ticker])", path: "/global/tr/[ticker]" },
  ]},
];

export const SITEMAP_OTHER: SitemapGroup[] = [
  { group: "Diğer Public Sayfalar", entries: [
    { label: "Tracker (1H izleme)", path: "/tracker" },
    { label: "İletişim", path: "/contact" },
    { label: "Pro Dashboard", path: "/pro" },
  ]},
];
