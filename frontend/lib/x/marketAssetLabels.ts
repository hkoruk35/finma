// Sektör/endeks/emtia/döviz/kripto varlık adlarının 5 dildeki karşılıkları.
// Kuyruğa eklenirken saklanan "company" alanı sadece Türkçe (admin panelinde
// gösterilen ad) olduğundan, gönderi/kart üretilirken o TEK dile bağlı
// kalmak yerine buradan hedef dile göre doğru ad çekilir (bkz. x-studio
// page.tsx buildCardParamsFor, api/admin/x/generate/route.ts).

import type { Locale } from "./generateContent";

export const MARKET_ASSET_LABELS: Record<string, Record<Locale, string>> = {
  "^GSPC": { en: "S&P 500", es: "S&P 500", fr: "S&P 500", pt: "S&P 500", tr: "S&P 500" },
  "^IXIC": { en: "NASDAQ", es: "NASDAQ", fr: "NASDAQ", pt: "NASDAQ", tr: "NASDAQ" },
  "^DJI": { en: "Dow Jones", es: "Dow Jones", fr: "Dow Jones", pt: "Dow Jones", tr: "DOW" },
  "^RUT": { en: "Russell 2000", es: "Russell 2000", fr: "Russell 2000", pt: "Russell 2000", tr: "Russell 2000" },
  "^VIX": { en: "VIX", es: "VIX", fr: "VIX", pt: "VIX", tr: "VIX" },

  XLK: { en: "Technology", es: "Tecnología", fr: "Technologie", pt: "Tecnologia", tr: "Teknoloji" },
  XLF: { en: "Financials", es: "Finanzas", fr: "Finance", pt: "Financeiro", tr: "Finans" },
  XLV: { en: "Healthcare", es: "Salud", fr: "Santé", pt: "Saúde", tr: "Sağlık" },
  XLY: { en: "Consumer Discretionary", es: "Consumo Discrecional", fr: "Consommation Discrétionnaire", pt: "Consumo Discricionário", tr: "Tüketici (Döngüsel)" },
  XLP: { en: "Consumer Staples", es: "Consumo Básico", fr: "Consommation de Base", pt: "Consumo Básico", tr: "Tüketici (Temel)" },
  XLE: { en: "Energy", es: "Energía", fr: "Énergie", pt: "Energia", tr: "Enerji" },
  XLI: { en: "Industrials", es: "Industrial", fr: "Industrie", pt: "Industrial", tr: "Endüstriyel" },
  XLB: { en: "Materials", es: "Materiales", fr: "Matériaux", pt: "Materiais", tr: "Materyaller" },
  XLRE: { en: "Real Estate", es: "Bienes Raíces", fr: "Immobilier", pt: "Imóveis", tr: "Gayrimenkul" },
  XLU: { en: "Utilities", es: "Servicios Públicos", fr: "Services Publics", pt: "Utilidades", tr: "Kamu Hizmetleri" },
  XLC: { en: "Communication Services", es: "Servicios de Comunicación", fr: "Services de Communication", pt: "Serviços de Comunicação", tr: "İletişim Hizmetleri" },

  GOLD: { en: "Gold", es: "Oro", fr: "Or", pt: "Ouro", tr: "Altın" },
  SILVER: { en: "Silver", es: "Plata", fr: "Argent", pt: "Prata", tr: "Gümüş" },
  USOIL: { en: "Crude Oil (WTI)", es: "Petróleo Crudo (WTI)", fr: "Pétrole Brut (WTI)", pt: "Petróleo Bruto (WTI)", tr: "Ham Petrol (WTI)" },
  NATGAS: { en: "Natural Gas", es: "Gas Natural", fr: "Gaz Naturel", pt: "Gás Natural", tr: "Doğal Gaz" },

  EURUSD: { en: "EUR/USD", es: "EUR/USD", fr: "EUR/USD", pt: "EUR/USD", tr: "EUR/USD" },
  GBPUSD: { en: "GBP/USD", es: "GBP/USD", fr: "GBP/USD", pt: "GBP/USD", tr: "GBP/USD" },
  USDJPY: { en: "USD/JPY", es: "USD/JPY", fr: "USD/JPY", pt: "USD/JPY", tr: "USD/JPY" },
  USDCHF: { en: "USD/CHF", es: "USD/CHF", fr: "USD/CHF", pt: "USD/CHF", tr: "USD/CHF" },
  AUDUSD: { en: "AUD/USD", es: "AUD/USD", fr: "AUD/USD", pt: "AUD/USD", tr: "AUD/USD" },
  USDCAD: { en: "USD/CAD", es: "USD/CAD", fr: "USD/CAD", pt: "USD/CAD", tr: "USD/CAD" },

  BTCUSD: { en: "Bitcoin", es: "Bitcoin", fr: "Bitcoin", pt: "Bitcoin", tr: "Bitcoin" },
  ETHUSD: { en: "Ethereum", es: "Ethereum", fr: "Ethereum", pt: "Ethereum", tr: "Ethereum" },
  SOLUSD: { en: "Solana", es: "Solana", fr: "Solana", pt: "Solana", tr: "Solana" },
  XRPUSD: { en: "XRP", es: "XRP", fr: "XRP", pt: "XRP", tr: "XRP" },
};

export function getMarketAssetLabel(ticker: string, locale: Locale): string {
  const entry = MARKET_ASSET_LABELS[ticker.trim().toUpperCase()];
  return entry?.[locale] ?? ticker;
}
