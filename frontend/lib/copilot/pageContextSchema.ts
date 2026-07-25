// Page Context Service — BOGA Copilot Üye Operasyon Mimarisi böl. 6.
// Her Copilot isteğinde backend'e (ve system prompt'a) enjekte edilen tek,
// tutarlı bağlam nesnesi. Kullanıcının sitede o an nerede olduğunu, hangi
// varlığa/listeye baktığını Copilot'a anlatır — aynı şeyi tekrar sormasın diye.
//
// Not: chart_context (zaman aralığı, görünen indikatörler) şu an hiçbir
// merkezi state'te tutulmuyor (grafik bileşenleri bu bilgiyi paylaşmıyor).
// O alanlar bilinmediğinde undefined bırakılır — UYDURULMAZ.

import type { RouteKey } from "@/lib/copilot/routes";

export type AssetType =
  | "stock"
  | "index"
  | "index_etf"
  | "sector_etf"
  | "fx_pair"
  | "commodity"
  | "crypto"
  | "theme"
  | "unknown";

export type PageType =
  | "dashboard"
  | "asset_analysis"
  | "list_view"
  | "faq"
  | "news"
  | "account"
  | "other";

export interface SelectedAsset {
  symbol: string;
  assetType: AssetType;
}

export interface ActiveListContext {
  listKey: "personal_watchlist" | "trend_list" | "trend_candidate_watchlist" | "top7" | "top100" | null;
}

export interface CopilotPageContext {
  currentPage: {
    routeKey: RouteKey | "unknown";
    pageType: PageType;
  };
  selectedAsset: SelectedAsset | null;
  activeListContext: ActiveListContext;
  session: {
    locale: string;
    timezone: string; // her zaman "America/New_York" — Copilot ABD piyasa saatine göre konuşur
  };
}

const KNOWN_US_INDEX_ETFS = new Set(["SPY", "QQQ", "DIA", "IWM", "VIX"]);
const KNOWN_SECTOR_ETFS = new Set(["XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLRE", "XLU", "XLC"]);
const KNOWN_CRYPTO = new Set(["BTC", "ETH", "BTC-USD", "ETH-USD", "BITCOIN", "ETHEREUM"]);
const KNOWN_COMMODITIES = new Set(["GOLD", "SILVER", "OIL", "NATGAS", "XAU", "XAG", "WTI"]);
const KNOWN_FX = new Set(["EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD", "USDCAD"]);

/** Bir ticker/sembol string'inden en iyi çaba ile varlık sınıfı çıkarımı. */
export function inferAssetType(symbol: string): AssetType {
  const s = symbol.trim().toUpperCase();
  if (!s) return "unknown";
  if (KNOWN_SECTOR_ETFS.has(s)) return "sector_etf";
  if (KNOWN_US_INDEX_ETFS.has(s)) return "index_etf";
  if (KNOWN_CRYPTO.has(s)) return "crypto";
  if (KNOWN_COMMODITIES.has(s)) return "commodity";
  if (KNOWN_FX.has(s)) return "fx_pair";
  return "stock"; // varsayılan: BOGASTOCK'un asıl evreni ABD hisseleri
}

function pageTypeForRoute(routeKey: RouteKey | "unknown"): PageType {
  switch (routeKey) {
    case "dashboard": return "dashboard";
    case "graphic": return "asset_analysis";
    case "trend_list":
    case "trend_candidate_watchlist":
    case "top7":
    case "top100":
    case "my_watchlist":
      return "list_view";
    case "faq": return "faq";
    case "news": return "news";
    case "account": return "account";
    default: return "other";
  }
}

const ROUTE_TO_LIST_KEY: Partial<Record<RouteKey, ActiveListContext["listKey"]>> = {
  trend_list: "trend_list",
  trend_candidate_watchlist: "trend_candidate_watchlist",
  top7: "top7",
  top100: "top100",
  my_watchlist: "personal_watchlist",
};

export function buildPageContext(
  routeKey: RouteKey | "unknown",
  ticker: string | null,
  locale: string
): CopilotPageContext {
  return {
    currentPage: { routeKey, pageType: pageTypeForRoute(routeKey) },
    selectedAsset: ticker ? { symbol: ticker, assetType: inferAssetType(ticker) } : null,
    activeListContext: { listKey: ROUTE_TO_LIST_KEY[routeKey as RouteKey] ?? null },
    session: { locale, timezone: "America/New_York" },
  };
}
