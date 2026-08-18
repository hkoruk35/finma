/**
 * SPX SuperTrade — Ortak Tip Tanımları
 * Tüm motor katmanları (yahoo / levels / scoring / context / options) bu tipleri paylaşır.
 */

export type AssetClass = "SPX" | "SPY" | "QQQ" | "NDX" | "XND" | "XSP";

export const ASSET_MAP: Record<AssetClass, { spot: string; futures: string; scale: number; vix: string; name: string; tickSize: number }> = {
  SPX: { spot: "^GSPC", futures: "ES=F", scale: 1.0, vix: "^VIX", name: "S&P 500", tickSize: 0.25 },
  SPY: { spot: "SPY", futures: "ES=F", scale: 0.1, vix: "^VIX", name: "SPDR S&P 500 ETF", tickSize: 0.01 },
  XSP: { spot: "^XSP", futures: "ES=F", scale: 0.1, vix: "^VIX", name: "S&P 500 Mini", tickSize: 0.01 },
  NDX: { spot: "^NDX", futures: "NQ=F", scale: 1.0, vix: "^VXN", name: "Nasdaq 100", tickSize: 0.25 },
  QQQ: { spot: "QQQ", futures: "NQ=F", scale: 0.025, vix: "^VXN", name: "Invesco QQQ Trust", tickSize: 0.01 },
  XND: { spot: "^XND", futures: "NQ=F", scale: 0.01, vix: "^VXN", name: "Nasdaq 100 Micro", tickSize: 0.01 },
};

export interface Bar {
  time: number; // unix saniye
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Ağ üzerinden taşınan sıkıştırılmış mum: [time, open, high, low, close, volume] */
export type CompactBar = [number, number, number, number, number, number];

export type SessionPhase =
  | "PRE_SESSION"
  | "PREMARKET"
  | "OPENING_RANGE"
  | "MAIN_WINDOW"
  | "MID_SESSION"
  | "CLOSING"
  | "AFTER_HOURS";

export type SignalState =
  | "NEUTRAL"
  | "WATCH_LONG"
  | "WATCH_SHORT"
  | "EARLY_LONG"
  | "EARLY_SHORT"
  | "CONFIRMED_LONG"
  | "CONFIRMED_SHORT"
  | "STRONG_LONG"
  | "STRONG_SHORT"
  | "LONG_WEAKENING"
  | "SHORT_WEAKENING"
  | "FAILED_LONG"
  | "FAILED_SHORT"
  | "CHOP"
  | "DATA_STALE";

export type ConfidenceTier = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type Direction = "LONG" | "SHORT" | "NEUTRAL";
export type TrendStructure = "UPTREND" | "DOWNTREND" | "RANGE";

export interface ScoreFactor {
  /** Kısa Türkçe etiket — panelde satır olarak gösterilir */
  label: string;
  /** Ölçülen ham değer, insan okur formatta */
  detail: string;
  /** +: long lehine, -: short lehine, 0: nötr */
  weight: number;
}

export interface FuturesLevels {
  vwap: number;
  vwapSlope: "RISING" | "FALLING" | "FLAT";
  priceVsVwap: "ABOVE" | "BELOW" | "AT";
  vwapDistance: number;
  onh: number;
  onl: number;
  onMid: number;
  onRange: number;
  premarketHigh: number;
  premarketLow: number;
  pdh: number;
  pdl: number;
  pdc: number;
  sessionHigh: number;
  sessionLow: number;
  isVwapChop: boolean;
}

export interface SpotLevels {
  orh: number;
  orl: number;
  orMid: number;
  orSize: number;
  isOrDefined: boolean;
  pdh: number;
  pdl: number;
  pdc: number;
  sessionHigh: number;
  sessionLow: number;
  /** OR bandına göre konum */
  vsOr: "ABOVE" | "BELOW" | "INSIDE";
}

export interface StructureSet {
  futures15m: TrendStructure;
  futures5m: TrendStructure;
  futures1m: TrendStructure;
  spot5m: TrendStructure;
  spot1m: TrendStructure;
}

export interface Decision {
  direction: Direction;
  /** Şu an ne yapmalı */
  action: string;
  /** Teyit için ne bekliyoruz */
  confirmation: string;
  /** Neyin olması senaryoyu bozar */
  invalidation: string;
  triggerLevelName: string;
  triggerLevelValue: number;
  statusBadge: string;
  statusStrength: string;
  /** Aksiyona hazır mı — UI'da aksiyon rengini belirler */
  tone: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "WARNING";
}

/**
 * Ağ üzerinden taşınan hafif kare. Canlı modda 390 kare gönderildiği için
 * yalnızca skaler alanlar taşınır.
 */
export interface FrameLite {
  /** RTH içindeki dakika indeksi (0 = 09:30) */
  index: number;
  time: number;
  timeLabel: string; // HH:mm ET
  spotPrice: number;
  futuresPrice: number;
  basis: number;
  vwap: number;
  longScore: number;
  shortScore: number;
  netScore: number;
  state: SignalState;
  confidence: ConfidenceTier;
  phase: SessionPhase;
  /** O andaki tetik seviyesi (ORH / ORL / OR orta noktası) */
  trigger: number;
}

/** Yeniden oynatmada kullanılan tam kare — gerekçeler ve karar metni dahil */
export interface Frame extends FrameLite {
  factors: ScoreFactor[];
  structure: StructureSet;
  decision: Decision;
}

export interface FeedHealth {
  symbol: string;
  label: string;
  /** CLOSED: seans kapalı, gecikme değil — son kapanış verisi gösteriliyor */
  status: "LIVE" | "DELAYED" | "STALE" | "CLOSED" | "MISSING";
  ageSec: number;
  lastPrice: number;
}

// ── Bağlam ve Rejim ───────────────────────────────────────────────

export interface SeasonalityContext {
  month: string;
  weekday: string;
  monthPhase: "EARLY" | "MID" | "LATE";
  isOpexWeek: boolean;
  isTripleWitching: boolean;
  summary: string;
}

export interface VolatilityContext {
  vix: number;
  vix5dChange: number;
  level: "LOW" | "NORMAL" | "HIGH" | "EXTREME";
  trend: "RISING" | "FALLING" | "STABLE";
  label: string;
  /** 0DTE modellemesi için taban örtük oynaklık */
  impliedVol: number;
}

export interface PreviousSessionContext {
  date: string;
  changePct: number;
  closePositionPct: number; // 0 = dip, 100 = zirve
  last30mDirection: "UP" | "DOWN" | "FLAT";
  structureType: string;
  label: string;
}

export interface OvernightContext {
  gapPts: number;
  gapPct: number;
  gapType: string;
  onRangePts: number;
  vsOnMid: "ABOVE" | "BELOW";
  nqAlignment: "ALIGNED" | "DIVERGENT";
  nqChangePct: number;
  esChangePct: number;
  /** Çapraz kontrol enstrümanının görünen adı (SPX ailesi için "NQ", NDX ailesi için "ES") */
  crossLabel: string;
  label: string;
}

export interface AnalogContext {
  sampleSize: number;
  bullishCount: number;
  bearishCount: number;
  chopCount: number;
  bullishPct: number;
  medianMovePts: number;
  medianMfePts: number;
  medianMaePts: number;
  nearestDate: string;
  nearestSimilarity: number;
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  /** Bu istatistiği üreten kriterler — şeffaflık için */
  criteria: string;
}

export interface ContextSnapshot {
  fingerprint: string;
  seasonality: SeasonalityContext;
  volatility: VolatilityContext;
  previousSession: PreviousSessionContext;
  overnight: OvernightContext;
  analog: AnalogContext;
  liveAgreement: "CONFIRMED" | "CONTRADICTED" | "PENDING";
  liveAgreementText: string;
}

// ── Opsiyon ───────────────────────────────────────────────────────

export interface OptionQuote {
  label: string;
  strike: number;
  type: "CALL" | "PUT";
  otmPts: number;
  otmPct: number;
  premium: number;
  delta: number;
  theta: number;
  breakeven: number;
  /** Hedef seviyeye ulaşılırsa modellenen prim */
  premiumAtTarget: number;
  /** Hedefe göre beklenen getiri yüzdesi */
  targetReturnPct: number;
  moneyness: "ATM" | "OTM";
}

export interface RunnerResult {
  id: string;
  name: string;
  rule: string;
  entryPremium: number;
  exitPremium: number;
  entryTime: string;
  exitTime: string | null;
  open: boolean;
  pnl: number;
  maxPnl: number;
  drawdownPct: number;
}

export interface RunnerSimulation {
  available: boolean;
  reason?: string;
  direction: Direction;
  strike: number;
  entryTime: string;
  entryIndex: number;
  contracts: number;
  models: RunnerResult[];
  bestId: string | null;
}

// ── Uç Nokta Yanıtları ────────────────────────────────────────────

/** Ertesi güne dair, kapanış sonrası önceden hesaplanmış özet — bkz. Rollover */
export interface ForecastBundle {
  bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  score: number;
  analysisText: string;
}

/**
 * Gün geçişi durumu: piyasa kapanışından 1 saat sonra (17:00 ET) ertesi
 * günün özeti arka planda hazırlanır (`prepReady`); ekranda "bugün" olarak
 * gösterilen tarih ise NY gece yarısında (00:00 ET) otomatik olarak yeni
 * takvim gününe döner (`isNextDay`) — gerçek seans verisi gelene kadar bu
 * hazırlanmış özet "bugün" yerine gösterilir.
 */
export interface RolloverInfo {
  /** Şu an NY takvimine göre "bugün" — gerçek saatten türetilir */
  displayDate: string;
  /** true: NY gece yarısı geçti ama sessionDate için henüz yeni seans verisi yok */
  isNextDay: boolean;
  /** sessionDate'den sonraki bir sonraki işlem günü (hafta sonu atlanır) */
  nextTradingDate: string;
  /** true: kapanıştan 1 saat sonra (17:00 ET) veya daha ileri bir zaman — ertesi gün özeti hazır */
  prepReady: boolean;
}

export interface AssetSnapshot {
  ok: boolean;
  generatedAt: string;
  asOf: string;
  sessionDate: string;
  phase: SessionPhase;
  isLiveSession: boolean;
  dataAgeSec: number;
  isStale: boolean;
  notes: string[];
  feeds: FeedHealth[];
  asset: AssetClass;
  spotPrice: number;
  futuresPrice: number;
  nqPrice: number;
  vixPrice: number;
  basis: number;
  levels: { spot: SpotLevels; futures: FuturesLevels };
  structure: StructureSet;
  longScore: number;
  shortScore: number;
  netScore: number;
  factors: ScoreFactor[];
  confidence: ConfidenceTier;
  state: SignalState;
  decision: Decision;
  /** Son 5 dakikada ne değişti */
  changes: { label: string; from: string; to: string; tone: "UP" | "DOWN" | "FLAT" }[];
  context: ContextSnapshot;
  chain: OptionQuote[];
  runners: RunnerSimulation;
  bars: { futures: CompactBar[]; spot: CompactBar[] };
  frames: FrameLite[];
  rollover: RolloverInfo;
  /** prepReady olana kadar null */
  forecast: ForecastBundle | null;
}

export interface AssetReplayResponse {
  ok: boolean;
  date: string;
  availableDates: string[];
  generatedAt: string;
  levels: { spot: SpotLevels; futures: FuturesLevels };
  context: ContextSnapshot;
  frames: Frame[];
  bars: { futures: CompactBar[]; spot: CompactBar[] };
  runners: RunnerSimulation;
  notes: string[];
}
