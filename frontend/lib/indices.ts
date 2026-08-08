// Faz 1 endeks evreni: US 4 + Avrupa 5. Slug <-> sembol <-> isim tek kaynak.
// index_daily_snapshot / index_weekly_snapshot tablolarindaki index_symbol
// degerleriyle birebir eslesir (bkz. supabase/migrations/0026_index_snapshots.sql).

export const INDEX_LOCALES = ["en", "tr", "es", "fr", "pt"] as const;
export type IndexLocale = (typeof INDEX_LOCALES)[number];

export type IndexSymbol =
  | "SPX"
  | "NDX"
  | "DJI"
  | "RUT"
  | "DAX"
  | "FTSE100"
  | "CAC40"
  | "IBEX35"
  | "STOXX600";

export interface IndexDefinition {
  symbol: IndexSymbol;
  slug: string;
  region: "us" | "europe";
  yahooTicker: string;
  names: Record<IndexLocale, string>;
}

export const INDEX_DEFINITIONS: Record<IndexSymbol, IndexDefinition> = {
  SPX: {
    symbol: "SPX",
    slug: "sp500",
    region: "us",
    yahooTicker: "^GSPC",
    names: { en: "S&P 500", tr: "S&P 500", es: "S&P 500", fr: "S&P 500", pt: "S&P 500" },
  },
  NDX: {
    symbol: "NDX",
    slug: "nasdaq-100",
    region: "us",
    yahooTicker: "^NDX",
    names: { en: "Nasdaq 100", tr: "Nasdaq 100", es: "Nasdaq 100", fr: "Nasdaq 100", pt: "Nasdaq 100" },
  },
  DJI: {
    symbol: "DJI",
    slug: "dow-jones",
    region: "us",
    yahooTicker: "^DJI",
    names: { en: "Dow Jones", tr: "Dow Jones", es: "Dow Jones", fr: "Dow Jones", pt: "Dow Jones" },
  },
  RUT: {
    symbol: "RUT",
    slug: "russell-2000",
    region: "us",
    yahooTicker: "^RUT",
    names: { en: "Russell 2000", tr: "Russell 2000", es: "Russell 2000", fr: "Russell 2000", pt: "Russell 2000" },
  },
  DAX: {
    symbol: "DAX",
    slug: "dax",
    region: "europe",
    yahooTicker: "^GDAXI",
    names: { en: "DAX", tr: "DAX", es: "DAX", fr: "DAX", pt: "DAX" },
  },
  FTSE100: {
    symbol: "FTSE100",
    slug: "ftse-100",
    region: "europe",
    yahooTicker: "^FTSE",
    names: { en: "FTSE 100", tr: "FTSE 100", es: "FTSE 100", fr: "FTSE 100", pt: "FTSE 100" },
  },
  CAC40: {
    symbol: "CAC40",
    slug: "cac-40",
    region: "europe",
    yahooTicker: "^FCHI",
    names: { en: "CAC 40", tr: "CAC 40", es: "CAC 40", fr: "CAC 40", pt: "CAC 40" },
  },
  IBEX35: {
    symbol: "IBEX35",
    slug: "ibex-35",
    region: "europe",
    yahooTicker: "^IBEX",
    names: { en: "IBEX 35", tr: "IBEX 35", es: "IBEX 35", fr: "IBEX 35", pt: "IBEX 35" },
  },
  STOXX600: {
    symbol: "STOXX600",
    slug: "stoxx-600",
    region: "europe",
    // Yahoo Finance'ta STOXX Europe 600 ticker'i ^STOXX (Euro Stoxx 50 = ^STOXX50E ile
    // karistirilmamali). Bot tarafinda veri cekilirken bu sembolun canli olarak
    // teyit edilmesi gerekir (Yahoo sembol kapsamlari zaman zaman degisebiliyor).
    yahooTicker: "^STOXX",
    names: {
      en: "STOXX Europe 600",
      tr: "STOXX Europe 600",
      es: "STOXX Europe 600",
      fr: "STOXX Europe 600",
      pt: "STOXX Europe 600",
    },
  },
};

export const INDEX_LIST: IndexDefinition[] = Object.values(INDEX_DEFINITIONS);

export function getIndexBySlug(slug: string): IndexDefinition | null {
  return INDEX_LIST.find((idx) => idx.slug === slug) ?? null;
}

export function getIndicesByRegion(region: IndexDefinition["region"]): IndexDefinition[] {
  return INDEX_LIST.filter((idx) => idx.region === region);
}
