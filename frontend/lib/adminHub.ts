/**
 * Yönetim ana sayfası ve 4 merkez sayfasının ortak kaydı (2026-11-11).
 * Motor sayfa adresleri tek kaynaktan: lib/spyengine/engines.ts (ENGINES[sym].page) — burada rota tahmin edilmez.
 */

import type { EngineSymbol } from "./spyengine/engines";

export const INDEX_ENGINES: EngineSymbol[] = ["SPY", "QQQ", "IWM"];

/** Kaldıraçlı ETF'ler (SPY sinyalli). Yeni ETF eklemek = bu listeye bir satır. Henüz kendi motoru yok — yalnız canlı fiyat + SPY motoru bağlantısı. */
export const LEVERAGED_ETFS: { symbol: string; name: string; note: string }[] = [
  { symbol: "UPRO", name: "ProShares UltraPro S&P500 (3x)", note: "SPY yükselişinde al" },
  { symbol: "SPXU", name: "ProShares UltraPro Short S&P500 (-3x)", note: "SPY düşüşünde al" },
];

/** Birinci öncelik (kullanıcı listesi 2026-11-11) */
export const PRIORITY_STOCKS: EngineSymbol[] = ["NVDA", "TSLA", "AMD", "META", "PLTR", "AAPL", "AMZN", "COIN", "HOOD", "AVGO"];
/** İkinci grup (ETF'ler endeks merkezinde olduğundan hariç) */
export const SECONDARY_STOCKS: EngineSymbol[] = ["MU", "MSFT", "GOOGL", "NFLX", "ORCL", "TSM", "INTC", "SMCI", "MSTR", "SOFI", "JPM", "XOM"];

/** Opsiyon tercihi başlangıç şablonu (kullanıcı: 7–21 gün, ATM/ITM1, delta 0,55–0,70, 5M setup + 1M tetik) */
export const OPTION_PREFS = [
  ["Vade", "7–21 gün"],
  ["Strike", "ATM veya ITM1"],
  ["Delta", "0,55–0,70"],
  ["İşlem", "CALL / PUT alımı"],
  ["Giriş", "5M setup + 1M tetik"],
] as const;

export const HUB_PAGES = [
  { href: "/admin/merkez/endeks", label: "Endeks", icon: "⚡" },
  { href: "/admin/merkez/kaldiracli", label: "Kaldıraçlı ETF", icon: "🚀" },
  { href: "/admin/merkez/hisse-swing", label: "Hisse Swing", icon: "📈" },
  { href: "/admin/merkez/hisse-opsiyon", label: "Hisse Opsiyon", icon: "🎯" },
] as const;
