// Forex / Commodities / Crypto / Futures — kategori sayfaları ve enstrüman
// listeleri için tek kaynak. Fiyat verisi lib/symbols.ts (resolveYahooSymbol)
// üzerinden zaten canlı olarak Yahoo Finance'tan çekiliyor — burada sadece
// hangi ticker'ların hangi kategoriye ait olduğunu ve 6 dildeki görünen
// adlarını tanımlıyoruz. bkz. app/global/[locale]/[assetClass]/page.tsx

export const ASSET_CLASS_LOCALES = ["tr", "en", "es", "fr", "pt", "id"] as const;
export type AssetClassLocale = (typeof ASSET_CLASS_LOCALES)[number];

export type AssetClassSlug = "forex" | "commodities" | "crypto" | "futures";
export const ASSET_CLASS_SLUGS: AssetClassSlug[] = ["forex", "commodities", "crypto", "futures"];

export interface AssetInstrument {
  /** Uygulama genelinde kullanilan ticker — resolveYahooSymbol() ile Yahoo sembolune cevrilir. */
  ticker: string;
  names: Record<AssetClassLocale, string>;
}

export interface AssetClassDefinition {
  slug: AssetClassSlug;
  names: Record<AssetClassLocale, string>;
  descriptions: Record<AssetClassLocale, string>;
  instruments: AssetInstrument[];
}

export const ASSET_CLASSES: Record<AssetClassSlug, AssetClassDefinition> = {
  forex: {
    slug: "forex",
    names: { en: "Forex", tr: "Döviz", es: "Divisas", fr: "Forex", pt: "Câmbio", id: "Forex" },
    descriptions: {
      en: "Live prices, interactive charts and hourly direction forecasts for the world's most traded currency pairs.",
      tr: "Dünyanın en çok işlem gören döviz paritelerinde canlı fiyatlar, interaktif grafikler ve saatlik yön tahminleri.",
      es: "Precios en vivo, gráficos interactivos y pronósticos de dirección por hora para los pares de divisas más operados del mundo.",
      fr: "Prix en direct, graphiques interactifs et prévisions de direction horaires pour les paires de devises les plus échangées au monde.",
      pt: "Preços ao vivo, gráficos interativos e previsões de direção por hora para os pares de moedas mais negociados do mundo.",
      id: "Harga langsung, grafik interaktif, dan perkiraan arah per jam untuk pasangan mata uang yang paling banyak diperdagangkan di dunia.",
    },
    instruments: [
      { ticker: "EURUSD", names: { en: "EUR/USD", tr: "EUR/USD", es: "EUR/USD", fr: "EUR/USD", pt: "EUR/USD", id: "EUR/USD" } },
      { ticker: "GBPUSD", names: { en: "GBP/USD", tr: "GBP/USD", es: "GBP/USD", fr: "GBP/USD", pt: "GBP/USD", id: "GBP/USD" } },
      { ticker: "USDJPY", names: { en: "USD/JPY", tr: "USD/JPY", es: "USD/JPY", fr: "USD/JPY", pt: "USD/JPY", id: "USD/JPY" } },
      { ticker: "USDCHF", names: { en: "USD/CHF", tr: "USD/CHF", es: "USD/CHF", fr: "USD/CHF", pt: "USD/CHF", id: "USD/CHF" } },
      { ticker: "AUDUSD", names: { en: "AUD/USD", tr: "AUD/USD", es: "AUD/USD", fr: "AUD/USD", pt: "AUD/USD", id: "AUD/USD" } },
      { ticker: "USDCAD", names: { en: "USD/CAD", tr: "USD/CAD", es: "USD/CAD", fr: "USD/CAD", pt: "USD/CAD", id: "USD/CAD" } },
      { ticker: "NZDUSD", names: { en: "NZD/USD", tr: "NZD/USD", es: "NZD/USD", fr: "NZD/USD", pt: "NZD/USD", id: "NZD/USD" } },
      { ticker: "USDTRY", names: { en: "USD/TRY", tr: "USD/TRY", es: "USD/TRY", fr: "USD/TRY", pt: "USD/TRY", id: "USD/TRY" } },
    ],
  },
  commodities: {
    slug: "commodities",
    names: { en: "Commodities", tr: "Emtia", es: "Materias Primas", fr: "Matières Premières", pt: "Commodities", id: "Komoditas" },
    descriptions: {
      en: "Live prices, interactive charts and hourly direction forecasts for gold, silver, oil and natural gas.",
      tr: "Altın, gümüş, petrol ve doğal gazda canlı fiyatlar, interaktif grafikler ve saatlik yön tahminleri.",
      es: "Precios en vivo, gráficos interactivos y pronósticos de dirección por hora para oro, plata, petróleo y gas natural.",
      fr: "Prix en direct, graphiques interactifs et prévisions de direction horaires pour l'or, l'argent, le pétrole et le gaz naturel.",
      pt: "Preços ao vivo, gráficos interativos e previsões de direção por hora para ouro, prata, petróleo e gás natural.",
      id: "Harga langsung, grafik interaktif, dan perkiraan arah per jam untuk emas, perak, minyak, dan gas alam.",
    },
    instruments: [
      { ticker: "GOLD", names: { en: "Gold (XAU/USD)", tr: "Altın (XAU/USD)", es: "Oro (XAU/USD)", fr: "Or (XAU/USD)", pt: "Ouro (XAU/USD)", id: "Emas (XAU/USD)" } },
      { ticker: "SILVER", names: { en: "Silver (XAG/USD)", tr: "Gümüş (XAG/USD)", es: "Plata (XAG/USD)", fr: "Argent (XAG/USD)", pt: "Prata (XAG/USD)", id: "Perak (XAG/USD)" } },
      { ticker: "USOIL", names: { en: "Crude Oil (WTI)", tr: "Ham Petrol (WTI)", es: "Petróleo Crudo (WTI)", fr: "Pétrole Brut (WTI)", pt: "Petróleo Bruto (WTI)", id: "Minyak Mentah (WTI)" } },
      { ticker: "NATGAS", names: { en: "Natural Gas", tr: "Doğal Gaz", es: "Gas Natural", fr: "Gaz Naturel", pt: "Gás Natural", id: "Gas Alam" } },
    ],
  },
  crypto: {
    slug: "crypto",
    names: { en: "Crypto", tr: "Kripto", es: "Cripto", fr: "Crypto", pt: "Cripto", id: "Kripto" },
    descriptions: {
      en: "Live prices, interactive charts and hourly direction forecasts for Bitcoin, Ethereum and other major cryptocurrencies.",
      tr: "Bitcoin, Ethereum ve diğer büyük kripto paralarda canlı fiyatlar, interaktif grafikler ve saatlik yön tahminleri.",
      es: "Precios en vivo, gráficos interactivos y pronósticos de dirección por hora para Bitcoin, Ethereum y otras criptomonedas principales.",
      fr: "Prix en direct, graphiques interactifs et prévisions de direction horaires pour le Bitcoin, l'Ethereum et d'autres grandes cryptomonnaies.",
      pt: "Preços ao vivo, gráficos interativos e previsões de direção por hora para Bitcoin, Ethereum e outras grandes criptomoedas.",
      id: "Harga langsung, grafik interaktif, dan perkiraan arah per jam untuk Bitcoin, Ethereum, dan mata uang kripto utama lainnya.",
    },
    instruments: [
      { ticker: "BTCUSD", names: { en: "Bitcoin (BTC)", tr: "Bitcoin (BTC)", es: "Bitcoin (BTC)", fr: "Bitcoin (BTC)", pt: "Bitcoin (BTC)", id: "Bitcoin (BTC)" } },
      { ticker: "ETHUSD", names: { en: "Ethereum (ETH)", tr: "Ethereum (ETH)", es: "Ethereum (ETH)", fr: "Ethereum (ETH)", pt: "Ethereum (ETH)", id: "Ethereum (ETH)" } },
      { ticker: "SOLUSD", names: { en: "Solana (SOL)", tr: "Solana (SOL)", es: "Solana (SOL)", fr: "Solana (SOL)", pt: "Solana (SOL)", id: "Solana (SOL)" } },
      { ticker: "XRPUSD", names: { en: "XRP", tr: "XRP", es: "XRP", fr: "XRP", pt: "XRP", id: "XRP" } },
    ],
  },
  futures: {
    slug: "futures",
    names: { en: "Futures", tr: "Vadeli İşlemler", es: "Futuros", fr: "Futures", pt: "Futuros", id: "Futures" },
    descriptions: {
      en: "Live prices, interactive charts and hourly direction forecasts for the major US equity index and commodity futures contracts.",
      tr: "Büyük ABD endeks ve emtia vadeli işlem kontratlarında canlı fiyatlar, interaktif grafikler ve saatlik yön tahminleri.",
      es: "Precios en vivo, gráficos interactivos y pronósticos de dirección por hora para los principales contratos de futuros de índices y materias primas de EE. UU.",
      fr: "Prix en direct, graphiques interactifs et prévisions de direction horaires pour les principaux contrats à terme sur indices et matières premières américains.",
      pt: "Preços ao vivo, gráficos interativos e previsões de direção por hora para os principais contratos futuros de índices e commodities dos EUA.",
      id: "Harga langsung, grafik interaktif, dan perkiraan arah per jam untuk kontrak futures indeks ekuitas dan komoditas utama AS.",
    },
    instruments: [
      { ticker: "ES_F", names: { en: "S&P 500 Futures", tr: "S&P 500 Vadeli İşlemleri", es: "Futuros del S&P 500", fr: "Futures S&P 500", pt: "Futuros do S&P 500", id: "Futures S&P 500" } },
      { ticker: "NQ_F", names: { en: "Nasdaq 100 Futures", tr: "Nasdaq 100 Vadeli İşlemleri", es: "Futuros del Nasdaq 100", fr: "Futures Nasdaq 100", pt: "Futuros do Nasdaq 100", id: "Futures Nasdaq 100" } },
      { ticker: "YM_F", names: { en: "Dow Jones Futures", tr: "Dow Jones Vadeli İşlemleri", es: "Futuros del Dow Jones", fr: "Futures Dow Jones", pt: "Futuros do Dow Jones", id: "Futures Dow Jones" } },
      { ticker: "GC_F", names: { en: "Gold Futures", tr: "Altın Vadeli İşlemleri", es: "Futuros de Oro", fr: "Futures Or", pt: "Futuros de Ouro", id: "Futures Emas" } },
      { ticker: "CL_F", names: { en: "Crude Oil Futures", tr: "Ham Petrol Vadeli İşlemleri", es: "Futuros de Petróleo Crudo", fr: "Futures Pétrole Brut", pt: "Futuros de Petróleo Bruto", id: "Futures Minyak Mentah" } },
    ],
  },
};

export function getAssetClass(slug: string): AssetClassDefinition | undefined {
  return ASSET_CLASSES[slug as AssetClassSlug];
}

/** Tum kategorilerdeki ticker'larin duz listesi — graphic/[ticker] sayfasinin
 * bu enstrumanlari "market context" (giris sart olmadan acik) olarak
 * tanimasi icin kullanilir. bkz. components/public/GraphicDetailContent.tsx */
export const ALL_ASSET_CLASS_TICKERS: string[] = Object.values(ASSET_CLASSES).flatMap((ac) =>
  ac.instruments.map((i) => i.ticker)
);
