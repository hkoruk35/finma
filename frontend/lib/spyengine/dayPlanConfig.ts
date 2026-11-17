/**
 * Günlük Plan (Geniş Harita v5) — ayarlar. Motor (dayPlan.ts) bu değerleri okur; burada değişen her sayı
 * yeni snapshot'ların inputs_hash'ine girer (eski sürümler değişmez).
 */

export const DAYPLAN_VERSION = "5.1";

export interface DayPlanCfg {
  /** seviye kümeleme: birbirine bu kadar (puan) yakın adaylar tek bölge */
  mergeTol: number;
  /** ikinci geçiş: aradaki boşluk ≤ structTolEm × EM ve toplam genişlik ≤ maxZoneEm × EM ise komşu bölgeler birleşir */
  structTolEm: number;
  maxZoneEm: number;
  /** EM yokken ikinci geçiş için puan karşılıkları */
  structTolPts: number;
  maxZonePts: number;
  /** ret: seviyeye ±rejectTol yakın test + sonrasında ≥ rejectAtr × ATR(5m) geri çekilme (rejectLookBars mum içinde) */
  rejectTol: number;
  rejectAtr: number;
  rejectLookBars: number;
  /** iptal = bölge sınırı + invalBuf; stop = iptal + stopBuf */
  invalBuf: number;
  stopBuf: number;
  /** gap: son gapSessions seansta, en az gapMinPct (%) büyüklüğündeki boşluklar */
  gapSessions: number;
  gapMinPct: number;
  /** yuvarlak sayılar: roundStep katları, spot ± roundRangeEm × EM içinde */
  roundStep: number;
  roundRangeEm: number;
  /** skor bileşen ağırlıkları (gamma verisi yoksa ağırlığı düşer) */
  weights: Record<ScoreKey, number>;
  /** senaryo yolu: kapanış sonrası büyük bilanço varsa 13:30–16:00 genlik çarpanı */
  earningsDamp: number;
  /** 8:30 verisi varsa o andaki ek oynaklık (σ15 katı) */
  eventVolMult: number;
  /** istatistik kapısı: yön eğilimi yalnız n ≥ minN ve |z| ≥ minZ ve iki yarı aynı yönde ise gösterilir */
  minN: number;
  minZ: number;
  /** göreli güç sembolleri (sembol → liste) */
  relSymbols: Record<string, string[]>;
}

export type ScoreKey = "trend" | "macd" | "rsi" | "volume" | "flow" | "rel" | "gamma";

export const SCORE_LABELS: Record<ScoreKey, string> = {
  trend: "Trend (EMA dizilimi)",
  macd: "MACD ivmesi (4s)",
  rsi: "RSI (aşırı bölge, ters)",
  volume: "Hacim (dağıtım/birikim)",
  flow: "Gece/PM akışı",
  rel: "Göreli güç",
  gamma: "Gamma rejimi",
};

export const DAYPLAN_CFG: DayPlanCfg = {
  mergeTol: 0.4,
  structTolEm: 0.15,
  maxZoneEm: 0.2,
  structTolPts: 1.2,
  maxZonePts: 1.8,
  rejectTol: 0.15,
  rejectAtr: 1,
  rejectLookBars: 12,
  invalBuf: 0.25,
  stopBuf: 0.3,
  gapSessions: 15,
  gapMinPct: 0.1,
  roundStep: 5,
  roundRangeEm: 1.5,
  weights: { trend: 1.2, macd: 1, rsi: 0.6, volume: 0.7, flow: 0.8, rel: 0.7, gamma: 0.6 },
  earningsDamp: 0.6,
  eventVolMult: 2,
  minN: 40,
  minZ: 2,
  relSymbols: {
    SPY: ["QQQ", "NVDA"],
    QQQ: ["SPY", "NVDA"],
    IWM: ["SPY", "QQQ"],
    "*": ["SPY", "QQQ"],
  },
};

/** Sabit gün içi oynaklık profili (15m dilim başına göreli σ, 09:30 → 15:45) — veri yetersizse kullanılır, UI'da "sabit profil" yazar */
export const FIXED_PROFILE_15 = [
  2.0, 1.6, 1.35, 1.2, 1.1, 1.0, 0.95, 0.9, 0.85, 0.8, 0.78, 0.75, 0.72,
  0.72, 0.74, 0.76, 0.78, 0.8, 0.82, 0.85, 0.88, 0.92, 0.98, 1.05, 1.15, 1.35,
];

/** Senaryo anchor saatleri (ET dakika) */
export const ANCHORS_MIN = [8 * 60 + 30, 9 * 60 + 30, 10 * 60, 10 * 60 + 30, 11 * 60 + 30, 12 * 60, 13 * 60 + 30, 15 * 60, 16 * 60];

/** Snapshot saatleri (ET dakika): 04:00–16:00 her 5m kapanışından 1 dk sonra (04:06, 04:11 … 16:01) — v5.1 kullanıcı isteği */
export const SNAPSHOT_MIN: number[] = Array.from({ length: 144 }, (_, i) => 4 * 60 + 6 + i * 5).filter((m) => m <= 16 * 60 + 1);

/** Sembol → örtük oynaklık endeksi (yalnız endeks ETF'leri; hisselerde yok → EM "veri yok") */
export const IV_INDEX: Record<string, { sym: string; label: string }> = {
  SPY: { sym: "^VIX", label: "VIX" },
  QQQ: { sym: "^VXN", label: "VXN" },
  IWM: { sym: "^RVX", label: "RVX" },
};

/** Kapanış sonrası/gün içi bilançosu takip edilen mega cap'ler */
export const MEGA_CAPS = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "AVGO"];
