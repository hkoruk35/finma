/**
 * SPX SuperTrade — Skorlama, Durum Makinesi ve Karar Metni
 * Her faktör ağırlığıyla birlikte döner; panelde "neden" gerekçeleri
 * doğrudan bu faktörlerden üretilir (sabit metin yoktur).
 */

import type {
  ConfidenceTier,
  Decision,
  Direction,
  EsLevels,
  ScoreFactor,
  SessionPhase,
  SignalState,
  SpxLevels,
  StructureSet,
  TrendStructure,
} from "./types";
import type { BreakoutState } from "./levels";
import { RTH_CLOSE_MIN, RTH_OPEN_MIN } from "./yahoo";

export function sessionPhase(minutes: number): SessionPhase {
  if (minutes < 4 * 60) return "PRE_SESSION";
  if (minutes < RTH_OPEN_MIN) return "PREMARKET";
  if (minutes < RTH_OPEN_MIN + 5) return "OPENING_RANGE";
  if (minutes < RTH_OPEN_MIN + 60) return "MAIN_WINDOW";
  if (minutes < RTH_CLOSE_MIN - 30) return "MID_SESSION";
  if (minutes < RTH_CLOSE_MIN) return "CLOSING";
  return "AFTER_HOURS";
}

export const PHASE_LABEL: Record<SessionPhase, string> = {
  PRE_SESSION: "Seans Öncesi (00:00–04:00 ET)",
  PREMARKET: "Açılış Öncesi (04:00–09:30 ET)",
  OPENING_RANGE: "Açılış Aralığı (09:30–09:35 ET)",
  MAIN_WINDOW: "Ana Sinyal Penceresi (09:35–10:30 ET)",
  MID_SESSION: "Seans Ortası (10:30–15:30 ET)",
  CLOSING: "Kapanış Bölgesi (15:30–16:00 ET)",
  AFTER_HOURS: "Seans Kapalı (Kapanış Verileri)",
};

function structureWeight(s: TrendStructure, w: number): number {
  if (s === "UPTREND") return w;
  if (s === "DOWNTREND") return -w;
  return 0;
}

const TR_STRUCTURE: Record<TrendStructure, string> = {
  UPTREND: "yükselen (HH/HL)",
  DOWNTREND: "düşen (LH/LL)",
  RANGE: "yatay",
};

export interface ScoreInput {
  spxPrice: number;
  esPrice: number;
  nqChangePct: number;
  vixChangePct: number;
  es: EsLevels;
  spx: SpxLevels;
  structure: StructureSet;
  longBreak: BreakoutState;
  shortBreak: BreakoutState;
}

export interface ScoreResult {
  longScore: number;
  shortScore: number;
  netScore: number;
  factors: ScoreFactor[];
  confidence: ConfidenceTier;
}

export function computeScores(input: ScoreInput): ScoreResult {
  const { es, spx, structure } = input;
  const factors: ScoreFactor[] = [];

  const push = (label: string, detail: string, weight: number) =>
    factors.push({ label, detail, weight: Math.round(weight * 100) / 100 });

  // 1. ES fiyatının seans VWAP'ına göre konumu (en ağır tekil faktör)
  if (es.vwap > 0) {
    const dist = input.esPrice - es.vwap;
    const w = Math.max(-1.5, Math.min(1.5, dist / 4));
    push(
      "ES / VWAP konumu",
      `${dist >= 0 ? "+" : ""}${dist.toFixed(2)} puan ${dist >= 0 ? "üstünde" : "altında"} (VWAP ${es.vwap.toFixed(2)})`,
      w
    );
  }

  // 2. VWAP eğimi
  if (es.vwapSlope !== "FLAT") {
    push(
      "VWAP eğimi",
      es.vwapSlope === "RISING" ? "yukarı eğimli" : "aşağı eğimli",
      es.vwapSlope === "RISING" ? 0.75 : -0.75
    );
  }

  // 3–4. Çok zaman dilimli yapı
  push("ES 15 dk yapı", TR_STRUCTURE[structure.es15m], structureWeight(structure.es15m, 1.0));
  push("ES 5 dk yapı", TR_STRUCTURE[structure.es5m], structureWeight(structure.es5m, 0.75));
  push("SPX 1 dk yapı", TR_STRUCTURE[structure.spx1m], structureWeight(structure.spx1m, 0.5));

  // 5. Açılış aralığına göre konum
  if (spx.isOrDefined) {
    if (spx.vsOr === "ABOVE") {
      push("Açılış aralığı", `ORH ${spx.orh.toFixed(2)} üzerinde`, 1.25);
    } else if (spx.vsOr === "BELOW") {
      push("Açılış aralığı", `ORL ${spx.orl.toFixed(2)} altında`, -1.25);
    } else {
      push("Açılış aralığı", `${spx.orl.toFixed(2)} – ${spx.orh.toFixed(2)} bandı içinde`, 0);
    }
  }

  // 6. Kırılım kabulü (5 dk kapanış teyidi)
  if (input.longBreak.accepted) {
    push("Kırılım kabulü", "ORH üzerinde 5 dk kapanış teyidi var", 1.0);
  } else if (input.shortBreak.accepted) {
    push("Kırılım kabulü", "ORL altında 5 dk kapanış teyidi var", -1.0);
  } else if (spx.isOrDefined) {
    push("Kırılım kabulü", "5 dk kapanış teyidi henüz yok", 0);
  }

  // 7. NQ uyumu
  if (Number.isFinite(input.nqChangePct)) {
    const w = Math.max(-0.75, Math.min(0.75, input.nqChangePct * 1.5));
    push(
      "NQ vadeli uyumu",
      `${input.nqChangePct >= 0 ? "+" : ""}%${input.nqChangePct.toFixed(2)} (gün içi)`,
      w
    );
  }

  // 8. VIX (ters ilişki)
  if (Number.isFinite(input.vixChangePct)) {
    const w = Math.max(-0.5, Math.min(0.5, -input.vixChangePct / 6));
    push(
      "VIX yönü",
      `${input.vixChangePct >= 0 ? "+" : ""}%${input.vixChangePct.toFixed(2)} — ${input.vixChangePct >= 0 ? "risk iştahı azalıyor" : "risk iştahı artıyor"}`,
      w
    );
  }

  // 9. Gece seansı orta noktası
  if (es.onMid > 0) {
    const w = input.esPrice >= es.onMid ? 0.5 : -0.5;
    push(
      "Gece aralığı orta noktası",
      `ON Mid ${es.onMid.toFixed(2)} ${input.esPrice >= es.onMid ? "üstünde" : "altında"}`,
      w
    );
  }

  // 10. Önceki gün kapanışı
  if (es.pdc > 0) {
    const w = input.esPrice >= es.pdc ? 0.5 : -0.5;
    push(
      "Önceki gün kapanışı",
      `PDC ${es.pdc.toFixed(2)} ${input.esPrice >= es.pdc ? "üstünde" : "altında"}`,
      w
    );
  }

  // 11. VWAP testere rejimi — yönsel skoru baskılar
  if (es.isVwapChop) {
    push("VWAP rejimi", "son 10 barda 4+ kez VWAP kesişimi (testere)", 0);
  }

  let longScore = 0;
  let shortScore = 0;
  for (const f of factors) {
    if (f.weight > 0) longScore += f.weight;
    else if (f.weight < 0) shortScore += -f.weight;
  }

  longScore = Math.round(longScore * 10) / 10;
  shortScore = Math.round(shortScore * 10) / 10;
  const netScore = Math.round((longScore - shortScore) * 10) / 10;

  return {
    longScore,
    shortScore,
    netScore,
    factors,
    confidence: determineConfidence(longScore, shortScore, netScore, factors, es.isVwapChop),
  };
}

function determineConfidence(
  longScore: number,
  shortScore: number,
  netScore: number,
  factors: ScoreFactor[],
  isChop: boolean
): ConfidenceTier {
  const directional = factors.filter((f) => f.weight !== 0);
  if (!directional.length) return "LOW";

  const agreeing = directional.filter((f) =>
    netScore >= 0 ? f.weight > 0 : f.weight < 0
  ).length;
  const agreement = agreeing / directional.length;
  const abs = Math.abs(netScore);
  const total = longScore + shortScore;
  const dominance = total > 0 ? abs / total : 0;

  if (isChop) return abs >= 4 ? "MEDIUM" : "LOW";
  if (abs >= 4.5 && agreement >= 0.8 && dominance >= 0.6) return "VERY_HIGH";
  if (abs >= 3 && agreement >= 0.65) return "HIGH";
  if (abs >= 1.5 && agreement >= 0.55) return "MEDIUM";
  return "LOW";
}

export interface StateInput {
  phase: SessionPhase;
  isStale: boolean;
  spx: SpxLevels;
  es: EsLevels;
  netScore: number;
  longBreak: BreakoutState;
  shortBreak: BreakoutState;
  /** Son 10 dakikadaki net skor değişimi — zayıflama tespiti için */
  netScoreDelta: number;
}

export function determineState(input: StateInput): SignalState {
  const { spx, netScore, longBreak, shortBreak, netScoreDelta } = input;

  if (input.isStale) return "DATA_STALE";
  if (input.phase === "PRE_SESSION" || input.phase === "PREMARKET") return "NEUTRAL";
  if (!spx.isOrDefined) return "NEUTRAL";

  // Yukarı yön
  if (spx.vsOr === "ABOVE") {
    if (longBreak.accepted && netScore >= 4.5) return "STRONG_LONG";
    if (longBreak.accepted && netScore >= 2) {
      return netScoreDelta <= -1.5 ? "LONG_WEAKENING" : "CONFIRMED_LONG";
    }
    if (longBreak.probed && netScore >= 1) return "EARLY_LONG";
    return netScore >= 0 ? "WATCH_LONG" : "CHOP";
  }

  // Aşağı yön
  if (spx.vsOr === "BELOW") {
    if (shortBreak.accepted && netScore <= -4.5) return "STRONG_SHORT";
    if (shortBreak.accepted && netScore <= -2) {
      return netScoreDelta >= 1.5 ? "SHORT_WEAKENING" : "CONFIRMED_SHORT";
    }
    if (shortBreak.probed && netScore <= -1) return "EARLY_SHORT";
    return netScore <= 0 ? "WATCH_SHORT" : "CHOP";
  }

  // ── Bant içi ──
  // Tuzak kırılım yalnızca fiyat bant içine döndüğünde ve olay tazeyken
  // geçerlidir; aksi hâlde günün geri kalanına yapışır kalır.
  const FAILURE_FRESHNESS = 15; // dakika
  if (longBreak.failed && longBreak.barsSinceFailure <= FAILURE_FRESHNESS && netScore < 1) {
    return "FAILED_LONG";
  }
  if (shortBreak.failed && shortBreak.barsSinceFailure <= FAILURE_FRESHNESS && netScore > -1) {
    return "FAILED_SHORT";
  }

  if (input.es.isVwapChop && Math.abs(netScore) < 2) return "CHOP";
  if (netScore >= 2) return "WATCH_LONG";
  if (netScore <= -2) return "WATCH_SHORT";
  return "NEUTRAL";
}

export const STATE_META: Record<
  SignalState,
  { label: string; direction: Direction; tone: "POSITIVE" | "NEGATIVE" | "NEUTRAL" | "WARNING" }
> = {
  NEUTRAL: { label: "Nötr / Beklemede", direction: "NEUTRAL", tone: "NEUTRAL" },
  WATCH_LONG: { label: "Long İzleme", direction: "LONG", tone: "WARNING" },
  WATCH_SHORT: { label: "Short İzleme", direction: "SHORT", tone: "WARNING" },
  EARLY_LONG: { label: "Erken Long", direction: "LONG", tone: "POSITIVE" },
  EARLY_SHORT: { label: "Erken Short", direction: "SHORT", tone: "NEGATIVE" },
  CONFIRMED_LONG: { label: "Teyitli Long", direction: "LONG", tone: "POSITIVE" },
  CONFIRMED_SHORT: { label: "Teyitli Short", direction: "SHORT", tone: "NEGATIVE" },
  STRONG_LONG: { label: "Güçlü Long", direction: "LONG", tone: "POSITIVE" },
  STRONG_SHORT: { label: "Güçlü Short", direction: "SHORT", tone: "NEGATIVE" },
  LONG_WEAKENING: { label: "Long Zayıflıyor", direction: "LONG", tone: "WARNING" },
  SHORT_WEAKENING: { label: "Short Zayıflıyor", direction: "SHORT", tone: "WARNING" },
  FAILED_LONG: { label: "Long Kırılımı Başarısız", direction: "NEUTRAL", tone: "WARNING" },
  FAILED_SHORT: { label: "Short Kırılımı Başarısız", direction: "NEUTRAL", tone: "WARNING" },
  CHOP: { label: "Testere / İşlem Yok", direction: "NEUTRAL", tone: "NEUTRAL" },
  DATA_STALE: { label: "Veri Akışı Beklemede", direction: "NEUTRAL", tone: "WARNING" },
};

export const CONFIDENCE_LABEL: Record<ConfidenceTier, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  VERY_HIGH: "Çok Yüksek",
};

export function buildDecision(
  state: SignalState,
  spx: SpxLevels,
  es: EsLevels,
  breaks: { longBreak: BreakoutState; shortBreak: BreakoutState }
): Decision {
  const meta = STATE_META[state];
  const orh = spx.orh;
  const orl = spx.orl;
  const vwap = es.vwap;

  const base: Decision = {
    direction: meta.direction,
    action: "Bekle — açılış aralığını izle",
    confirmation: spx.isOrDefined
      ? `ORH ${orh.toFixed(2)} veya ORL ${orl.toFixed(2)} kırılımı + 5 dk kapanış teyidi`
      : "Açılış aralığının (09:30–09:35) oluşması",
    invalidation: "Bant içinde yönsüz sıkışmanın sürmesi",
    triggerLevelName: spx.isOrDefined
      ? `OR bandı ${orl.toFixed(2)} – ${orh.toFixed(2)}`
      : "Açılış aralığı bekleniyor",
    triggerLevelValue: spx.orMid,
    statusBadge: "BANT İÇİ",
    statusStrength: "Fiyat açılış aralığında, yön bekleniyor",
    tone: meta.tone,
  };

  switch (state) {
    case "DATA_STALE":
      return {
        ...base,
        action: "İşlem yapma — veri akışı gecikmeli",
        confirmation: "Canlı akışın tazelenmesi",
        invalidation: "—",
        statusBadge: "VERİ GECİKMELİ",
        statusStrength: "Son mum güncel değil, sinyaller askıya alındı",
      };

    case "WATCH_LONG":
      return {
        ...base,
        action: "Long hazırlığı — henüz giriş yok",
        confirmation: `ORH ${orh.toFixed(2)} üzerinde 5 dk kapanış`,
        invalidation: `ES'in VWAP ${vwap.toFixed(2)} altına dönmesi`,
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "KIRILIM BEKLENİYOR",
        statusStrength: "Yukarı yön lehine baskı var, teyit eksik",
      };

    case "WATCH_SHORT":
      return {
        ...base,
        action: "Short hazırlığı — henüz giriş yok",
        confirmation: `ORL ${orl.toFixed(2)} altında 5 dk kapanış`,
        invalidation: `ES'in VWAP ${vwap.toFixed(2)} üzerine dönmesi`,
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "KIRILIM BEKLENİYOR",
        statusStrength: "Aşağı yön lehine baskı var, teyit eksik",
      };

    case "EARLY_LONG":
      return {
        ...base,
        action: "Erken giriş — küçük pozisyon",
        confirmation: `5 dk mumun ORH ${orh.toFixed(2)} üzerinde kapanması`,
        invalidation: `Fiyatın ORH altına dönmesi (tuzak kırılım)`,
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "İLK KIRILIM",
        statusStrength: `${breaks.longBreak.barsBeyond} dakikadır seviye üzerinde`,
      };

    case "EARLY_SHORT":
      return {
        ...base,
        action: "Erken giriş — küçük pozisyon",
        confirmation: `5 dk mumun ORL ${orl.toFixed(2)} altında kapanması`,
        invalidation: "Fiyatın ORL üzerine dönmesi (tuzak kırılım)",
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "İLK KIRILIM",
        statusStrength: `${breaks.shortBreak.barsBeyond} dakikadır seviye altında`,
      };

    case "CONFIRMED_LONG":
      return {
        ...base,
        action: "Long giriş uygun — normal pozisyon",
        confirmation: "Hacmin korunması ve yeni zirvelerin yapılması",
        invalidation: `ES'in VWAP ${vwap.toFixed(2)} altına inmesi`,
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "KABUL EDİLDİ",
        statusStrength: "1 dk ve 5 dk teyidi tamam",
      };

    case "CONFIRMED_SHORT":
      return {
        ...base,
        action: "Short giriş uygun — normal pozisyon",
        confirmation: "Satış hacminin korunması ve yeni diplerin yapılması",
        invalidation: `ES'in VWAP ${vwap.toFixed(2)} üzerine çıkması`,
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "KABUL EDİLDİ",
        statusStrength: "1 dk ve 5 dk teyidi tamam",
      };

    case "STRONG_LONG":
      return {
        ...base,
        action: "Pozisyonu koru — takip eden stop ile yönet",
        confirmation: "Runner modellerinin çıkış kuralları",
        invalidation: "5 dk yapının bozulması veya net skorun çökmesi",
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "GÜÇLÜ TREND",
        statusStrength: "Tüm zaman dilimleri hizalı",
      };

    case "STRONG_SHORT":
      return {
        ...base,
        action: "Pozisyonu koru — takip eden stop ile yönet",
        confirmation: "Runner modellerinin çıkış kuralları",
        invalidation: "5 dk yapının bozulması veya net skorun toparlanması",
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "GÜÇLÜ TREND",
        statusStrength: "Tüm zaman dilimleri hizalı",
      };

    case "LONG_WEAKENING":
      return {
        ...base,
        action: "Yeni giriş yapma — kademeli kâr al",
        confirmation: "Net skorun yeniden güçlenmesi",
        invalidation: `ORH ${orh.toFixed(2)} altına dönüş`,
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "İVME AZALIYOR",
        statusStrength: "Yukarı ivme son 10 dakikada zayıfladı",
      };

    case "SHORT_WEAKENING":
      return {
        ...base,
        action: "Yeni giriş yapma — kademeli kâr al",
        confirmation: "Net skorun yeniden zayıflaması",
        invalidation: `ORL ${orl.toFixed(2)} üzerine dönüş`,
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "İVME AZALIYOR",
        statusStrength: "Aşağı ivme son 10 dakikada zayıfladı",
      };

    case "FAILED_LONG":
      return {
        ...base,
        action: "Long senaryosu iptal — pozisyonu kapat",
        confirmation: "—",
        invalidation: "Fiyat ORH üzerinde tutunamadı",
        triggerLevelName: `ORH ${orh.toFixed(2)}`,
        triggerLevelValue: orh,
        statusBadge: "TUZAK KIRILIM",
        statusStrength: "Kırılım geri alındı, ters yön riski var",
      };

    case "FAILED_SHORT":
      return {
        ...base,
        action: "Short senaryosu iptal — pozisyonu kapat",
        confirmation: "—",
        invalidation: "Fiyat ORL altında tutunamadı",
        triggerLevelName: `ORL ${orl.toFixed(2)}`,
        triggerLevelValue: orl,
        statusBadge: "TUZAK KIRILIM",
        statusStrength: "Kırılım geri alındı, ters yön riski var",
      };

    case "CHOP":
      return {
        ...base,
        action: "İşlem yapma — testere piyasası",
        confirmation: "Bant dışına hacimli ve kalıcı kırılım",
        invalidation: "—",
        statusBadge: "TESTERE",
        statusStrength: "VWAP çevresinde sık kesişim, sinyal güvenilmez",
      };

    default:
      return base;
  }
}
