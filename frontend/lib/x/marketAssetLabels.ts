// Sektör/endeks/emtia/döviz/kripto varlık adlarının 5 dildeki karşılıkları.
// Kuyruğa eklenirken saklanan "company" alanı sadece Türkçe (admin panelinde
// gösterilen ad) olduğundan, gönderi/kart üretilirken o TEK dile bağlı
// kalmak yerine buradan hedef dile göre doğru ad çekilir (bkz. x-studio
// page.tsx buildCardParamsFor, api/admin/x/generate/route.ts).

// Not: bu Record'daki Locale, X-Studio/AI gönderi üretiminin 5-dilli
// (en/es/fr/pt/tr) Locale'inden DEĞİL, site genelindeki 6-dilli public
// Locale'den (lib/i18n/copy.ts) geliyor — çünkü getMarketAssetLabel hem
// admin X-Studio'da hem de public BogaChartEngine.tsx'te (id dahil 6 dil)
// kullanılıyor.
import type { Locale } from "@/lib/i18n/copy";

export const MARKET_ASSET_LABELS: Record<string, Record<Locale, string>> = {
  "^GSPC": { en: "S&P 500", es: "S&P 500", fr: "S&P 500", pt: "S&P 500", tr: "S&P 500", id: "S&P 500" },
  "^IXIC": { en: "NASDAQ", es: "NASDAQ", fr: "NASDAQ", pt: "NASDAQ", tr: "NASDAQ", id: "NASDAQ" },
  "^DJI": { en: "Dow Jones", es: "Dow Jones", fr: "Dow Jones", pt: "Dow Jones", tr: "DOW", id: "Dow Jones" },
  "^RUT": { en: "Russell 2000", es: "Russell 2000", fr: "Russell 2000", pt: "Russell 2000", tr: "Russell 2000", id: "Russell 2000" },
  "^VIX": { en: "VIX", es: "VIX", fr: "VIX", pt: "VIX", tr: "VIX", id: "VIX" },

  XLK: { en: "Technology", es: "Tecnología", fr: "Technologie", pt: "Tecnologia", tr: "Teknoloji", id: "Teknologi" },
  XLF: { en: "Financials", es: "Finanzas", fr: "Finance", pt: "Financeiro", tr: "Finans", id: "Keuangan" },
  XLV: { en: "Healthcare", es: "Salud", fr: "Santé", pt: "Saúde", tr: "Sağlık", id: "Kesehatan" },
  XLY: { en: "Consumer Discretionary", es: "Consumo Discrecional", fr: "Consommation Discrétionnaire", pt: "Consumo Discricionário", tr: "Tüketici (Döngüsel)", id: "Konsumen Siklikal" },
  XLP: { en: "Consumer Staples", es: "Consumo Básico", fr: "Consommation de Base", pt: "Consumo Básico", tr: "Tüketici (Temel)", id: "Konsumen Primer" },
  XLE: { en: "Energy", es: "Energía", fr: "Énergie", pt: "Energia", tr: "Enerji", id: "Energi" },
  XLI: { en: "Industrials", es: "Industrial", fr: "Industrie", pt: "Industrial", tr: "Endüstriyel", id: "Industri" },
  XLB: { en: "Materials", es: "Materiales", fr: "Matériaux", pt: "Materiais", tr: "Materyaller", id: "Bahan Baku" },
  XLRE: { en: "Real Estate", es: "Bienes Raíces", fr: "Immobilier", pt: "Imóveis", tr: "Gayrimenkul", id: "Properti" },
  XLU: { en: "Utilities", es: "Servicios Públicos", fr: "Services Publics", pt: "Utilidades", tr: "Kamu Hizmetleri", id: "Utilitas" },
  XLC: { en: "Communication Services", es: "Servicios de Comunicación", fr: "Services de Communication", pt: "Serviços de Comunicação", tr: "İletişim Hizmetleri", id: "Layanan Komunikasi" },

  GOLD: { en: "Gold", es: "Oro", fr: "Or", pt: "Ouro", tr: "Altın", id: "Emas" },
  SILVER: { en: "Silver", es: "Plata", fr: "Argent", pt: "Prata", tr: "Gümüş", id: "Perak" },
  USOIL: { en: "Crude Oil (WTI)", es: "Petróleo Crudo (WTI)", fr: "Pétrole Brut (WTI)", pt: "Petróleo Bruto (WTI)", tr: "Ham Petrol (WTI)", id: "Minyak Mentah (WTI)" },
  NATGAS: { en: "Natural Gas", es: "Gas Natural", fr: "Gaz Naturel", pt: "Gás Natural", tr: "Doğal Gaz", id: "Gas Alam" },

  EURUSD: { en: "EUR/USD", es: "EUR/USD", fr: "EUR/USD", pt: "EUR/USD", tr: "EUR/USD", id: "EUR/USD" },
  GBPUSD: { en: "GBP/USD", es: "GBP/USD", fr: "GBP/USD", pt: "GBP/USD", tr: "GBP/USD", id: "GBP/USD" },
  USDJPY: { en: "USD/JPY", es: "USD/JPY", fr: "USD/JPY", pt: "USD/JPY", tr: "USD/JPY", id: "USD/JPY" },
  USDCHF: { en: "USD/CHF", es: "USD/CHF", fr: "USD/CHF", pt: "USD/CHF", tr: "USD/CHF", id: "USD/CHF" },
  AUDUSD: { en: "AUD/USD", es: "AUD/USD", fr: "AUD/USD", pt: "AUD/USD", tr: "AUD/USD", id: "AUD/USD" },
  USDCAD: { en: "USD/CAD", es: "USD/CAD", fr: "USD/CAD", pt: "USD/CAD", tr: "USD/CAD", id: "USD/CAD" },

  BTCUSD: { en: "Bitcoin", es: "Bitcoin", fr: "Bitcoin", pt: "Bitcoin", tr: "Bitcoin", id: "Bitcoin" },
  ETHUSD: { en: "Ethereum", es: "Ethereum", fr: "Ethereum", pt: "Ethereum", tr: "Ethereum", id: "Ethereum" },
  SOLUSD: { en: "Solana", es: "Solana", fr: "Solana", pt: "Solana", tr: "Solana", id: "Solana" },
  XRPUSD: { en: "XRP", es: "XRP", fr: "XRP", pt: "XRP", tr: "XRP", id: "XRP" },
};

export function getMarketAssetLabel(ticker: string, locale: Locale): string {
  const entry = MARKET_ASSET_LABELS[ticker.trim().toUpperCase()];
  return entry?.[locale] ?? ticker;
}
