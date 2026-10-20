/**
 * Takip Sistemi motorları — tek kayıt (SPY · QQQ · IWM · NVDA · AAPL · TSLA · AMZN).
 *
 * Yedi sayfa birebir aynı tasarım ve aynı saf motorla (lib/spyengine/tracker.ts · trackerRead) çalışır; ayrışan yalnız
 * veri ucu, sayfa adresi, renk ve sembol başına Takip ayarı (TRACK_CFG + o sembole ölçülmüş küçük farklar).
 * SPY = TRACK_CFG (45 seansta kalibre, dokunulmaz) · QQQ = lib/qqqengine/config.ts · diğerleri aşağıda (ölçüm notlarıyla).
 * Sayfa (TrackerEnginePage), sunucu günlüğü (trackerStore) ve motor geçiş çubuğu buradan okur.
 */

import { TRACK_CFG, TRACK_VERSION, NON_SPY_RULES, type TrackCfg } from "./tracker";
import { QQQ_TRACK_CFG, QQQ_TRACK_VERSION } from "../qqqengine/config";

export const ENGINE_SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "AAPL", "TSLA", "AMZN"] as const;
export type EngineSymbol = (typeof ENGINE_SYMBOLS)[number];

export const isEngineSymbol = (v: string): v is EngineSymbol => (ENGINE_SYMBOLS as readonly string[]).includes(v);

export interface EngineDef {
  symbol: EngineSymbol;
  name: string;
  /** sayfa adresi */
  page: string;
  /** canlı akış + opsiyon seviyeleri uçları */
  stream: string;
  optlevels: string;
  /** SPY'a özgü ES açılış tahmini / kalibre kapanış bandı (diğerlerinde yok — uydurma yok) */
  openForecast: string | null;
  closeForecast: string | null;
  riskKey: string;
  /** geçiş çubuğu rengi */
  cls: string;
  cfg: TrackCfg;
  /** sunucu günlüğü sürümü — değişince o sembolün geriye dönük kayıtları yeniden üretilir */
  version: string;
  /** opsiyon önerisi: vade etiketi (endeks ETF'lerinde her gün vade var; hisselerde en yakın haftalık) */
  expiry: string;
  /** sayfada gösterilen sembole özel not (ölçüm sonucu / dikkat) */
  note: string;
}

/** kayıt sürümü = motor sürümü + sembol + TRACK_CFG'den farkların kısa parmak izi (ayar değişince geriye dönük kayıtlar yenilenir) */
function versionOf(sym: string, cfg: TrackCfg): string {
  const diff = JSON.stringify(Object.keys(cfg).filter((k) => JSON.stringify(cfg[k as keyof TrackCfg]) !== JSON.stringify(TRACK_CFG[k as keyof TrackCfg])).sort().map((k) => [k, cfg[k as keyof TrackCfg]]));
  let h = 0;
  for (let i = 0; i < diff.length; i++) h = (h * 31 + diff.charCodeAt(i)) >>> 0;
  return `${TRACK_VERSION}-${sym.toLowerCase()}-${h.toString(36)}`;
}

const stock = (s: string) => ({
  page: `/admin/${s.toLowerCase()}engine/v1`,
  stream: `/api/admin/engine/${s}`,
  optlevels: `/api/admin/engine/${s}/optlevels`,
  openForecast: null,
  closeForecast: null,
  riskKey: `${s.toLowerCase()}engine_risk_usd`,
});

/**
 * Hisseye özel ayarlar — her biri TRACK_CFG + o sembolün 5m verisinde ölçülmüş birkaç fark
 * (scripts/backtest_engines.ts; 45 seans 2026-08-14 → 2026-10-16, üç 15'er günlük dönem, seçim ölçütü en kötü dönem, sonra toplam).
 * Seçim aynı 45 günde yapıldı — görülmemiş dönem yok. Kontrat önerisi: endeks ETF'lerinde 0DTE / 1 $ adım, hisselerde
 * en yakın haftalık vade / 2,5 $ adım.
 */
const WEEKLY = { optLabel: "haftalık", strikeStep: 2.5 };
/** SPY'a özel kurallar (yalnız SPY 5m verisinde ölçüldü): stop sonrası ters yön kilidi + VWAP testeresinde küçük pozisyon / 1R'de tam çıkış + 0,75R sonrası 2 ters mumda erken çıkış — diğer sembollerde kapalı */
export const SPY_ONLY_OFF = NON_SPY_RULES;
/** IWM — küçük şirket endeksi, VWAP etrafında sık salınır: 15m yön teyidi VWAP'tan en az 0,3 ATR15 uzakta kapanmalı.
 *  SPY kuralları 147 işlem +9,9R (−1,4 / −5,5 / +16,9) → 139 işlem %54 +12,3R (−0,4 / −1,2 / +13,9); 0,2–0,3 arası sağlam. */
export const IWM_TRACK_CFG: TrackCfg = { ...TRACK_CFG, ...SPY_ONLY_OFF, net15Atr: 0.3 };
/** NVDA — sert ve hızlı: çok geniş stoplu (> 2 ATR5) girişler yok, zayıf 15m teyidinde ek 5m onayı beklenmez (geç kalıyordu),
 *  aşırı testere günde (VWAP 8+ kez kesildi) yeni giriş yok. 139 işlem +0,2R (−5,7 / −2,0 / +7,9) → 128 işlem %52 +13,0R (−0,3 / −0,7 / +14,0).
 *  Kesişme sınırı 6'ya inince +3,8R — yalnız aşırı testere süzülür. */
export const NVDA_TRACK_CFG: TrackCfg = { ...TRACK_CFG, ...SPY_ONLY_OFF, ...WEEKLY, maxCrosses: 8, maxStopAtr5: 2, weak15Confirm: false };
/** AAPL — yavaş ve gürültülü: stop dibin/tepenin 0,5 ATR15 ötesinde (gürültüden silkelenmez), ilk hedef 2R.
 *  145 işlem −2,6R (+3,7 / −8,7 / +2,4) → 77 işlem %43 +9,4R (+8,4 / +0,3 / +0,8). Komşu değerlerde kırılgan (h1R 1,5: +2,9R) — kanıt zayıf. */
export const AAPL_TRACK_CFG: TrackCfg = { ...TRACK_CFG, ...SPY_ONLY_OFF, ...WEEKLY, stopBufAtr15: 0.5, h1R: 2 };
/** TSLA — çok oynak, kırılımlar sık geri dönüyor: kırılım-tazeliği girişi yok, stop tamponu 0,3 ATR15, 1R'de tamamı kapanır,
 *  testere günde (VWAP 6+ kez) yeni giriş yok. 135 işlem −21,6R (−8,1 / −11,7 / −1,7) → 68 işlem %50 +0,1R (−0,2 / +1,1 / −0,8).
 *  SPY kurallarının kaybı silindi ama KANIT YOK (≈ başabaş) — varsayılan risk yarıya (100 $) indirildi. */
export const TSLA_TRACK_CFG: TrackCfg = { ...TRACK_CFG, ...SPY_ONLY_OFF, ...WEEKLY, freshBreakBars: 0, stopBufAtr15: 0.3, exitMode: "full", maxCrosses: 6, riskUsd: 100 };
/** AMZN — stop tamponu 0,2 ATR15, kapanış konumu şartı yok (AMZN'de güçlü mumlar ortada kapanabiliyor), testere günde (6+) yeni giriş yok.
 *  161 işlem +1,7R (−0,8 / −14,2 / +16,7) → 132 işlem %58 +22,0R (+2,5 / +2,9 / +16,7); kesişme 4–8 arası +19,6…+22R. */
export const AMZN_TRACK_CFG: TrackCfg = { ...TRACK_CFG, ...SPY_ONLY_OFF, ...WEEKLY, stopBufAtr15: 0.2, entryClosePos: 0, maxCrosses: 6 };

export const ENGINES: Record<EngineSymbol, EngineDef> = {
  SPY: {
    symbol: "SPY", name: "S&P 500 ETF", page: "/admin/spyengine/v1",
    stream: "/api/admin/spyengine/v2", optlevels: "/api/admin/spyengine/v2/optlevels",
    openForecast: "/api/admin/spyengine/v2/openforecast", closeForecast: "/api/admin/spyengine/v2/forecast",
    riskKey: "spyengine_risk_usd", cls: "border-amber-500/60 bg-amber-500/15 text-amber-300 hover:bg-amber-500/30",
    cfg: TRACK_CFG, version: TRACK_VERSION, expiry: "0DTE", note: "SPY v3.2: v2.18 çekirdeği · sıçrama kırılımı (RVOL ≥ 1,5) · izleyen stop tamponu 0,4 · 12:00 sonrası trend günü değilse RVOL ≥ 1,5.",
  },
  QQQ: {
    symbol: "QQQ", name: "Nasdaq 100 ETF", page: "/admin/qqqengine/v1",
    stream: "/api/admin/qqqengine/v2", optlevels: "/api/admin/qqqengine/v2/optlevels",
    openForecast: null, closeForecast: null,
    riskKey: "qqqengine_risk_usd", cls: "border-sky-500/60 bg-sky-500/15 text-sky-300 hover:bg-sky-500/30",
    cfg: QQQ_TRACK_CFG, version: QQQ_TRACK_VERSION, expiry: "0DTE", note: "QQQ'nun kendi 5m süzgeçleri: RVOL ≥ 0,85 · testere günde (VWAP 6+ kesişme) giriş yok · taşınan yarıda 5m kapanış stopu.",
  },
  IWM: { symbol: "IWM", name: "Russell 2000 ETF", ...stock("IWM"), cls: "border-violet-500/60 bg-violet-500/15 text-violet-300 hover:bg-violet-500/30", cfg: IWM_TRACK_CFG, version: versionOf("IWM", IWM_TRACK_CFG), expiry: "0DTE", note: "IWM: 15m yön teyidi VWAP'tan en az 0,3 ATR15 uzakta kapanmalı (VWAP etrafında salınım süzgeci)." },
  NVDA: { symbol: "NVDA", name: "NVIDIA", ...stock("NVDA"), cls: "border-lime-500/60 bg-lime-500/15 text-lime-300 hover:bg-lime-500/30", cfg: NVDA_TRACK_CFG, version: versionOf("NVDA", NVDA_TRACK_CFG), expiry: "haftalık", note: "NVDA: stop > 2 ATR5 ise giriş yok · zayıf 15m'de ek onay beklenmez · aşırı testere günde (VWAP 8+ kesişme) giriş yok · en yakın haftalık vade." },
  AAPL: { symbol: "AAPL", name: "Apple", ...stock("AAPL"), cls: "border-slate-400/60 bg-slate-400/15 text-slate-200 hover:bg-slate-400/30", cfg: AAPL_TRACK_CFG, version: versionOf("AAPL", AAPL_TRACK_CFG), expiry: "haftalık", note: "AAPL: stop tamponu 0,5 ATR15 · ilk hedef 2R · en yakın haftalık vade. Ölçüm kanıtı zayıf — küçük riskle izleyin." },
  TSLA: { symbol: "TSLA", name: "Tesla", ...stock("TSLA"), cls: "border-rose-500/60 bg-rose-500/15 text-rose-300 hover:bg-rose-500/30", cfg: TSLA_TRACK_CFG, version: versionOf("TSLA", TSLA_TRACK_CFG), expiry: "haftalık", note: "TSLA: kırılım-tazeliği girişi yok · 1R'de tamamı kapanır · testere günde giriş yok · varsayılan risk 100 $. 45 seansta ≈ başabaş — KANITLANMIŞ KENAR YOK." },
  AMZN: { symbol: "AMZN", name: "Amazon", ...stock("AMZN"), cls: "border-orange-500/60 bg-orange-500/15 text-orange-300 hover:bg-orange-500/30", cfg: AMZN_TRACK_CFG, version: versionOf("AMZN", AMZN_TRACK_CFG), expiry: "haftalık", note: "AMZN: stop tamponu 0,2 ATR15 · kapanış konumu şartı yok · testere günde (VWAP 6+ kesişme) giriş yok · en yakın haftalık vade." },
};
