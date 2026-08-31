/**
 * SPY Engine V3 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * V3, V2'nin yerini alır. V2'nin kök sorunu: giriş tarafı 15m → 5m → 1m
 * SIRALI/ENGELLEYİCİ bir hiyerarşi taşıyordu — 5m "kurulum" vermeden 1m hiç
 * değerlendirilmiyordu, bu da 1m'de net bir fiyat hareketi varken sistemin
 * "Kurulum yok" diyerek beklemede kalmasına yol açıyordu.
 *
 * V3'te hiyerarşi TERS ÇEVRİLDİ:
 *   1m → ANA SÜRÜCÜ: giriş, art arda aynı yönlü kapanan mumların "seri"si
 *        üzerinden üretilir (Kontrat A: 2. mum, Kontrat B: 4. mum + 5m RSI
 *        teyidi). 5m artık bir kapı (gate) değil, sadece güven puanını
 *        ayarlayan bir destek katmanı.
 *   5m → DESTEK: RSI yönü sinyali onaylıyorsa güven artar, ters yöndeyse
 *        güven azalır ama sinyal ASLA iptal edilmez (Kontrat B hariç — B'nin
 *        VARLIĞI zaten 5m RSI teyidine bağlı, bu onun tanımının bir parçası).
 *   15m → KALDIRILDI. Artık karar mekanizmasının hiçbir yerinde kullanılmıyor;
 *        salt bilgi amaçlı `readM15()` hâlâ var (15m Bağlam sekmesi için) ama
 *        `generateCandidates()` çıktısına hiçbir şekilde karışmıyor.
 *
 * Pozisyon yönetimi de sadeleşti (V2'nin yarı-kapama+trailing modeli yerine
 * düz SL/TP/süre sınırı):
 *   Kontrat A: SL = giriş × 0,70 (−%30) · TP = giriş × 1,60 (+%60)
 *   Kontrat B: SL = giriş × 0,60 (−%40) · TP = giriş × 2,00 (+%100)
 *   Her iki kontrat da en fazla 45 dakika taşınır (talimattaki "40-50 dk"
 *   aralığının netleştirilmiş tek değeri); süre dolarsa mevcut fiyattan
 *   zorunlu kapama. 15:45 ET her zaman mutlak önceliklidir.
 *   TAM giriş / TAM çıkış — kısmi kapama veya trailing yok.
 *
 * Yeniden giriş (§5): bir pozisyon kapandığında sistem, o pozisyonun
 * yönünün TERSİNE kapanan İLK 1m mumu görene kadar yeni aday üretmeye
 * kapalıdır ("düzeltme mumu" beklenir) — bkz. `filterOverlapping`.
 *
 * NON-REPAINTING: tüm kararlar SADECE kapanmış mumlarla verilir.
 * `generateCandidates()` her çağrıldığında sıfırdan yeniden hesaplanır; aynı
 * girdi her zaman aynı çıktıyı verir, bu yüzden geçmiş bir işaret asla
 * yerinden oynamaz.
 */

import {
  Bar,
  SessionInfo,
  ema,
  rsi,
  nyParts,
  ENTRY_START_MIN,
  ENTRY_END_MIN,
  EOD_FORCE_MIN,
  RTH_OPEN_MIN,
  r2,
} from "./core";

// ── Sabitler ────────────────────────────────────────────────────────

export type ContractType = "A" | "B";

/** Talimat §3: her kontratın kendi sabit risk parametreleri */
export const CONTRACT_RULES: Record<ContractType, { stopMult: number; targetMult: number; label: string }> = {
  A: { stopMult: 0.70, targetMult: 1.60, label: "Kontrat A · hızlı giriş" },   // −%30 / +%60
  B: { stopMult: 0.60, targetMult: 2.00, label: "Kontrat B · teyitli 2. giriş" }, // −%40 / +%100
};

/** Talimat §4: "40-50 dakika" aralığının deterministik tek değeri (orta nokta) */
export const FORCE_EXIT_MINUTES = 45;
export const FORCE_EXIT_SEC = FORCE_EXIT_MINUTES * 60;

/** Talimat §3/§6: hacim teyidi için bakılan geçmiş mum sayısı */
export const VOLUME_LOOKBACK = 15;
/** Talimat §7: "son swing high/low'a yakınlık" için bakılan pencere */
export const SWING_LOOKBACK = 10;

/** Opsiyon primi verisi hiç gelmediyse pozisyonun açık sayılacağı azami süre (saniye) */
export const BLIND_POSITION_MAX_SEC = 30 * 60;

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";

export type StreakDir = "UP" | "DOWN" | "NONE";

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type EventKind = "ENTRY" | "TARGET" | "STOP" | "TIME_EXIT" | "EOD_EXIT";

export interface ConfidencePart {
  label: string;
  /** Puana katkısı (+/−) — talimat §7: "kara kutu değil", her bileşen görülebilir olmalı */
  value: number;
}

export interface EngineEvent {
  id: string;
  kind: EventKind;
  /** Olayın gerçekleştiği kapalı mumun zamanı (unix sn, UTC) */
  time: number;
  side: Side;
  /** SPY spot fiyatı (grafikte işaretin oturduğu seviye) */
  spot: number;
  /** 0DTE opsiyon primi — veri yoksa null (uydurma yok) */
  premium: number | null;
  /** Bu olaya kadarki kümülatif kâr/zarar (kontrat başına $, prim × 100) */
  pnl: number | null;
  label: string;
  note: string;
}

export interface PositionState {
  id: string;
  side: Side;
  contractType: ContractType;
  entryTime: number;
  entrySpot: number;
  /** 0DTE kontrat sembolü (OCC) — prim takibi bu sembolden yapılır */
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  /** Gerçek giriş primi (Yahoo'dan). Veri yoksa null. */
  entryPremium: number | null;
  stopLevel: number | null;   // entryPremium × contractType'a göre stopMult
  targetLevel: number | null; // entryPremium × contractType'a göre targetMult
  /** entryTime + 45dk — prim verisi olmasa bile her zaman bilinir */
  forceExitTime: number;
  status: "OPEN" | "CLOSED";
  /** Son bilinen prim (canlıysa anlık) */
  lastPremium: number | null;
  /** Kontrat başına gerçekleşen kâr/zarar ($) */
  realizedPnl: number;
  /** Açıkken anlık kâr/zarar ($) */
  unrealizedPnl: number | null;
  events: EngineEvent[];
  exitTime: number | null;
  exitReason: EventKind | null;
  /** Prim verisi hiç gelmediyse true — panelde açıkça belirtilir */
  premiumDataMissing: boolean;
}

export interface EntryCandidate {
  time: number;
  side: Side;
  spot: number;
  contractType: ContractType;
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
}

export interface EngineRead {
  /** 15m yön/rejim — talimat §2 gereği KARAR MEKANİZMASININ PARÇASI DEĞİL, sadece 15m Bağlam sekmesi için bilgi */
  m15Direction: Direction;
  m15Note: string;
  /** 5m RSI — "destek" katmanı: sinyali iptal etmez, sadece güveni ayarlar */
  m5Rsi: number | null;
  m5RsiDirection: Direction;
  m5Note: string;
  /** 1m ardışık mum serisi — "ana sürücü" */
  m1StreakDir: StreakDir;
  m1StreakLen: number;
  m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  /** Son barda tetiklenen kontrat türü (varsa) */
  contractType: ContractType | null;
  state: "WATCHING" | "ARMED" | "TRIGGERED";
  confidence: number;
  confidenceParts: ConfidencePart[];
  reasoning: string;
}

// ── Yardımcılar ───────────────────────────────────────────────────

const closes = (b: Bar[]) => b.map((x) => x.close);

/** `nowSec` itibarıyla KAPANMIŞ mumlar (son, hâlâ oluşmakta olan mum atılır) */
export function closedBars(bars: Bar[], tfMinutes: number, nowSec: number): Bar[] {
  const span = tfMinutes * 60;
  const out: Bar[] = [];
  for (const b of bars) {
    if (b.time + span <= nowSec) out.push(b);
  }
  return out;
}

function idOf(prefix: string, t: number, side: string) {
  return `${prefix}-${t}-${side}`;
}

/** OCC opsiyon sembolü: SPY + YYMMDD + C/P + strike×1000 (8 hane) */
export function buildOptionSymbol(underlying: string, ymd: string, isCall: boolean, strike: number): string {
  const [y, m, d] = ymd.split("-");
  const strikePart = String(Math.round(strike * 1000)).padStart(8, "0");
  return `${underlying}${y.slice(2)}${m}${d}${isCall ? "C" : "P"}${strikePart}`;
}

/** SPY 0DTE için ATM strike — $1 adım */
export function atmStrike(spot: number): number {
  return Math.round(spot);
}

function candleDir(b: Bar): StreakDir {
  if (b.close > b.open) return "UP";
  if (b.close < b.open) return "DOWN";
  return "NONE";
}

/** Gövde/aralık oranı (0..1) — talimat §7 "1m mum paterni gücü" */
function bodyRatio(b: Bar): number {
  const range = b.high - b.low;
  if (range <= 0) return 0;
  return Math.min(1, Math.abs(b.close - b.open) / range);
}

/** `uptoExclusive` mumundan ÖNCEKİ `n` mumun ortalama hacmi (bakış-ileri sızıntısı yok) */
function avgVolume(bars: Bar[], uptoExclusive: number, n: number): number | null {
  const start = Math.max(0, uptoExclusive - n);
  if (start >= uptoExclusive) return null;
  const slice = bars.slice(start, uptoExclusive);
  if (!slice.length) return null;
  return slice.reduce((s, b) => s + (b.volume || 0), 0) / slice.length;
}

/**
 * Talimat §7 "trend kırılması riski (son swing high/low'a yakınlık)".
 * Pozisyonun yönüne karşıt en yakın swing noktasına mesafe, o pencerenin
 * ortalama mum aralığına oranlanır. 0 = güvenli mesafe, 1 = swing noktasına
 * yapışık/kırılmış (yüksek risk — bir sonraki mumda kolayca geçersiz olabilir).
 */
function trendBreakRisk(bars: Bar[], i: number, side: Side): number {
  const start = Math.max(0, i - SWING_LOOKBACK);
  const window = bars.slice(start, i); // mevcut mum hariç — sızıntı yok
  if (!window.length) return 0;
  const bar = bars[i];
  const avgRange = window.reduce((s, b) => s + (b.high - b.low), 0) / window.length || 0.01;
  if (side === "LONG") {
    const swingLow = Math.min(...window.map((b) => b.low));
    const dist = bar.low - swingLow;
    return dist <= 0 ? 1 : Math.max(0, 1 - dist / (avgRange * 2));
  }
  const swingHigh = Math.max(...window.map((b) => b.high));
  const dist = swingHigh - bar.high;
  return dist <= 0 ? 1 : Math.max(0, 1 - dist / (avgRange * 2));
}

/**
 * Talimat §7 güven skoru — dört şeffaf bileşen, kara kutu değil:
 * mum gücü + hacim teyidi + 5m RSI uyumu + trend kırılma riski.
 */
function buildConfidence(
  bar: Bar,
  volOk: boolean,
  rsiAligned: boolean | null,
  risk: number,
  streakLen: number
): { total: number; parts: ConfidencePart[] } {
  const parts: ConfidencePart[] = [{ label: "Taban", value: 50 }];
  let total = 50;

  const bodyPts = Math.round(bodyRatio(bar) * 20);
  parts.push({ label: "1m mum gövde gücü", value: bodyPts });
  total += bodyPts;

  const volPts = volOk ? 15 : -5;
  parts.push({ label: "Hacim teyidi (son 15 mum ort.)", value: volPts });
  total += volPts;

  if (rsiAligned != null) {
    const rsiPts = rsiAligned ? 10 : -5;
    parts.push({ label: "5m RSI yönü", value: rsiPts });
    total += rsiPts;
  }

  const riskPts = -Math.round(risk * 15);
  parts.push({ label: "Trend kırılma riski", value: riskPts });
  total += riskPts;

  if (streakLen >= 3) {
    parts.push({ label: "Uzamış seri (3+ mum)", value: 5 });
    total += 5;
  }

  return { total: Math.max(0, Math.min(100, total)), parts };
}

// ── 15m yön (SADECE bilgi — 15m Bağlam sekmesi için, karara girmez) ─

export function readM15(m15: Bar[]): { direction: Direction; note: string } {
  if (m15.length < 55) return { direction: "NEUTRAL", note: "Yeterli 15m geçmişi yok" };
  const c = closes(m15);
  const e20 = ema(c, 20);
  const e50 = ema(c, 50);
  const i = c.length - 1;
  const a = e20[i];
  const b = e50[i];
  if (a == null || b == null) return { direction: "NEUTRAL", note: "EMA hesaplanamadı" };

  const spread = ((a - b) / b) * 100;
  if (spread > 0.05 && c[i] > a) return { direction: "BULLISH", note: `EMA20 > EMA50 (+%${spread.toFixed(2)}), fiyat EMA20 üstünde` };
  if (spread < -0.05 && c[i] < a) return { direction: "BEARISH", note: `EMA20 < EMA50 (%${spread.toFixed(2)}), fiyat EMA20 altında` };
  return { direction: "NEUTRAL", note: `EMA20/EMA50 sıkışık (%${spread.toFixed(2)})` };
}

// ── Giriş adaylarının üretimi (talimat §1-§3: 1m ana sürücü) ───────

export interface GenerateInput {
  /** Bugünkü seansa ait 1m mumlar (pre/post dahil) */
  m1: Bar[];
  /** 5m mumlar — RSI destek okuması için */
  m5: Bar[];
  /** 15m mumlar — sadece 15m Bağlam sekmesi için */
  m15: Bar[];
  session: SessionInfo;
  nowSec: number;
}

export interface GenerateOutput {
  candidates: EntryCandidate[];
  read: EngineRead;
  lastClosed: { m1: number | null; m5: number | null; m15: number | null };
}

export function generateCandidates(input: GenerateInput): GenerateOutput {
  const { session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m15 = closedBars(input.m15, 15, nowSec);

  const m15Read = readM15(m15);
  const m5RsiSeries = rsi(closes(m5), 14);

  const candidates: EntryCandidate[] = [];

  let streakDir: StreakDir = "NONE";
  let streakLen = 0;
  let aFiredThisStreak = false;
  let bFiredThisStreak = false;
  let m5Cursor = -1;

  for (let i = 0; i < m1.length; i++) {
    const bar = m1[i];
    // Bu 1m mumu kapandığı anda kapanmış olan son 5m mumu
    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;

    const dir = candleDir(bar);
    if (dir === "NONE") {
      // Doji: yön belirsiz, seri kesin olarak sıfırlanır (talimat açıkça
      // belirtmiyor ama "art arda aynı yönde kapanıyor" ifadesi net bir
      // yön gerektirir; kararsız bir mum seriyi bozar).
      streakDir = "NONE"; streakLen = 0; aFiredThisStreak = false; bFiredThisStreak = false;
      continue;
    }
    if (dir === streakDir) {
      streakLen++;
    } else {
      streakDir = dir; streakLen = 1; aFiredThisStreak = false; bFiredThisStreak = false;
    }

    const p = nyParts(bar.time);
    const inWindow = p.ymd === session.date && p.minutes >= ENTRY_START_MIN && p.minutes < ENTRY_END_MIN;
    if (!inWindow) continue;

    const side: Side = streakDir === "UP" ? "LONG" : "SHORT";
    const volAvg = avgVolume(m1, i, VOLUME_LOOKBACK);
    const volOk = volAvg == null || volAvg === 0 ? true : (bar.volume || 0) >= volAvg;
    const risk = trendBreakRisk(m1, i, side);

    const r5 = m5Cursor >= 0 ? m5RsiSeries[m5Cursor] : null;
    const r5Prev = m5Cursor >= 1 ? m5RsiSeries[m5Cursor - 1] : null;
    const rsiAlignedInfo = r5 == null ? null : side === "LONG" ? r5 > 50 : r5 < 50;

    // Kontrat A — 2. ardışık mumda tetik (talimat §3)
    if (streakLen === 2 && !aFiredThisStreak) {
      aFiredThisStreak = true;
      const { total, parts } = buildConfidence(bar, volOk, rsiAlignedInfo, risk, streakLen);
      candidates.push({
        time: bar.time,
        side,
        spot: bar.close,
        contractType: "A",
        confidence: total,
        confidenceParts: parts,
        reasoning: `2 ardışık ${side === "LONG" ? "yükseliş" : "düşüş"} 1m mumu${volOk ? ", hacim ortalamanın üzerinde" : " (hacim zayıf — düşük güven)"}`,
      });
    }

    // Kontrat B — 4. ardışık mumda, 5m RSI teyidi + trend kırılmamış (talimat §3)
    if (streakLen === 4 && !bFiredThisStreak) {
      bFiredThisStreak = true;
      const rsiOkForB =
        r5 != null &&
        (side === "LONG"
          ? r5 > 50 && (r5Prev == null || r5 >= r5Prev)
          : r5 < 50 && (r5Prev == null || r5 <= r5Prev));
      const prevBar = m1[i - 1];
      const trendIntact = side === "LONG" ? bar.low >= prevBar.low : bar.high <= prevBar.high;

      if (rsiOkForB && trendIntact) {
        const { total, parts } = buildConfidence(bar, volOk, true, risk, streakLen);
        candidates.push({
          time: bar.time,
          side,
          spot: bar.close,
          contractType: "B",
          confidence: total,
          confidenceParts: parts,
          reasoning: `4. ${side === "LONG" ? "yükseliş" : "düşüş"} mum, 5m RSI ${r5 != null ? r5.toFixed(0) : "—"} teyitli, trend kırılmadı`,
        });
      }
    }
  }

  // ── Canlı okuma (son kapalı mumlar üzerinden, panel için) ────────
  const lastM1Idx = m1.length - 1;
  const lastM1 = lastM1Idx >= 0 ? m1[lastM1Idx] : null;
  const lastCandidate =
    candidates.length && lastM1 && candidates[candidates.length - 1].time === lastM1.time
      ? candidates[candidates.length - 1]
      : null;

  let state: EngineRead["state"] = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let contractType: ContractType | null = null;
  let confidence = 40;
  let confidenceParts: ConfidencePart[] = [{ label: "Taban (seri yok)", value: 40 }];
  let reasoning = "Kurulum aranıyor — net yönlü mum serisi yok.";

  if (lastCandidate) {
    state = "TRIGGERED";
    action = lastCandidate.side;
    contractType = lastCandidate.contractType;
    confidence = lastCandidate.confidence;
    confidenceParts = lastCandidate.confidenceParts;
    reasoning = lastCandidate.reasoning;
  } else if (streakLen >= 1) {
    state = "ARMED";
    confidence = Math.min(55, 40 + streakLen * 5);
    confidenceParts = [
      { label: "Taban", value: 40 },
      { label: `${streakLen} mumluk seri`, value: confidence - 40 },
    ];
    reasoning = `${streakLen} ardışık ${streakDir === "UP" ? "yükseliş" : "düşüş"} mumu — 2. mumda Kontrat A tetiklenebilir.`;
  }

  const m5RsiLast = m5Cursor >= 0 ? m5RsiSeries[m5Cursor] : null;

  return {
    candidates,
    read: {
      m15Direction: m15Read.direction,
      m15Note: m15Read.note,
      m5Rsi: m5RsiLast,
      m5RsiDirection: m5RsiLast == null ? "NEUTRAL" : m5RsiLast > 50 ? "BULLISH" : m5RsiLast < 50 ? "BEARISH" : "NEUTRAL",
      m5Note: m5RsiLast == null ? "5m RSI verisi yok" : `5m RSI ${m5RsiLast.toFixed(1)} — ${m5RsiLast > 50 ? "yükseliş yönü" : m5RsiLast < 50 ? "düşüş yönü" : "nötr"}`,
      m1StreakDir: streakDir,
      m1StreakLen: streakLen,
      m1Note:
        streakLen >= 1
          ? `${streakLen} ardışık ${streakDir === "UP" ? "yükseliş" : "düşüş"} 1m mumu`
          : "Net yönlü seri yok",
      action,
      contractType,
      state,
      confidence,
      confidenceParts,
      reasoning,
    },
    lastClosed: {
      m1: lastM1 ? lastM1.time : null,
      m5: m5.length ? m5[m5.length - 1].time : null,
      m15: m15.length ? m15[m15.length - 1].time : null,
    },
  };
}

// ── Pozisyon durum makinesi (talimat §3-§4: düz SL/TP/süre sınırı) ──

export interface LifecycleInput {
  candidate: EntryCandidate;
  /** Giriş anında seçilen 0DTE kontratın 1m prim mumları (Yahoo, GERÇEK veri) */
  premiumBars: Bar[];
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  session: SessionInfo;
  nowSec: number;
  /** Canlı anlık prim (varsa) — son kapalı prim mumundan daha taze olabilir */
  livePremium?: number | null;
}

/**
 * Tek bir pozisyonun tüm yaşam döngüsünü, GERÇEK opsiyon primi mumları
 * üzerinde adım adım oynatır. TAM giriş / TAM çıkış — kısmi kapama yok.
 * Prim verisi yoksa pozisyon "prim verisi yok" olarak işaretlenir ve hiçbir
 * seviye uydurulmaz.
 */
export function runLifecycle(input: LifecycleInput): PositionState {
  const { candidate, premiumBars, session, nowSec } = input;
  const events: EngineEvent[] = [];
  const rules = CONTRACT_RULES[candidate.contractType];
  const forceExitTime = candidate.time + FORCE_EXIT_SEC;
  const eodEpoch = session.rthOpen + (EOD_FORCE_MIN - RTH_OPEN_MIN) * 60;

  const pos: PositionState = {
    id: idOf("pos", candidate.time, candidate.side),
    side: candidate.side,
    contractType: candidate.contractType,
    entryTime: candidate.time,
    entrySpot: candidate.spot,
    contract: input.contract,
    strike: input.strike,
    expiry: input.expiry,
    entryPremium: null,
    stopLevel: null,
    targetLevel: null,
    forceExitTime,
    status: "OPEN",
    lastPremium: null,
    realizedPnl: 0,
    unrealizedPnl: null,
    events,
    exitTime: null,
    exitReason: null,
    premiumDataMissing: true,
  };

  const entryIdx = premiumBars.findIndex((b) => b.time >= candidate.time);

  if (entryIdx < 0 || !premiumBars.length) {
    events.push({
      id: idOf("ev", candidate.time, "ENTRY"),
      kind: "ENTRY",
      time: candidate.time,
      side: candidate.side,
      spot: candidate.spot,
      premium: null,
      pnl: null,
      label: candidate.side === "LONG" ? "Long Buy" : "Short Sell",
      note: `${rules.label} · ${candidate.reasoning} · Opsiyon primi verisi yok — seviyeler hesaplanamadı.`,
    });
    if (nowSec >= forceExitTime || nowSec >= eodEpoch) {
      // Kapanış anı `nowSec`e göre DEĞİL, adayın kendi sabit zaman
      // noktalarına (forceExitTime / eodEpoch) göre belirlenir. `nowSec`
      // kullanmak — özellikle geriye dönük oynatmada `nowSec` gün sonunu
      // çoktan geçmiş olduğu için — TÜM prim-verisi-eksik adayların
      // exitTime'ını aynı sabit değere (eodEpoch) kilitlerdi; bu da
      // `filterOverlapping`'in yeniden giriş kapısını bozar (erken saatteki
      // bir adayın "çıkışı" günün ortasına sarkmış gibi görünür ve
      // aradaki tüm gerçek adayları haksız yere bloklar).
      const exitAt = Math.min(forceExitTime, eodEpoch);
      pos.status = "CLOSED";
      pos.exitTime = exitAt;
      pos.exitReason = exitAt >= eodEpoch ? "EOD_EXIT" : "TIME_EXIT";
    }
    return pos;
  }

  pos.premiumDataMissing = false;
  const entryPremium = premiumBars[entryIdx].close;
  pos.entryPremium = entryPremium;
  pos.stopLevel = r2(entryPremium * rules.stopMult);
  pos.targetLevel = r2(entryPremium * rules.targetMult);

  events.push({
    id: idOf("ev", candidate.time, "ENTRY"),
    kind: "ENTRY",
    time: candidate.time,
    side: candidate.side,
    spot: candidate.spot,
    premium: entryPremium,
    pnl: 0,
    label: candidate.side === "LONG" ? "Long Buy" : "Short Sell",
    note: `${rules.label} · ${candidate.reasoning} · Stop ${pos.stopLevel!.toFixed(2)} (×${rules.stopMult}), hedef ${pos.targetLevel!.toFixed(2)} (×${rules.targetMult})`,
  });

  for (let i = entryIdx; i < premiumBars.length; i++) {
    const b = premiumBars[i];
    pos.lastPremium = b.close;

    // §4 — mutlak öncelikli kural: 15:45 ET, süre sınırından BAĞIMSIZ
    if (b.time >= eodEpoch) {
      const exitPrem = b.open;
      pos.realizedPnl = r2((exitPrem - entryPremium) * 100);
      pos.status = "CLOSED";
      pos.exitTime = b.time;
      pos.exitReason = "EOD_EXIT";
      events.push({
        id: idOf("ev", b.time, "EOD"),
        kind: "EOD_EXIT",
        time: b.time,
        side: candidate.side,
        spot: NaN,
        premium: exitPrem,
        pnl: pos.realizedPnl,
        label: candidate.side === "LONG" ? "Long Sell — EOD" : "Short Buy — EOD",
        note: "15:45 ET zorunlu 0DTE kapaması.",
      });
      break;
    }

    // §4 — 45 dakikalık süre sınırı
    if (b.time >= forceExitTime) {
      const exitPrem = b.open;
      pos.realizedPnl = r2((exitPrem - entryPremium) * 100);
      pos.status = "CLOSED";
      pos.exitTime = b.time;
      pos.exitReason = "TIME_EXIT";
      events.push({
        id: idOf("ev", b.time, "TIME"),
        kind: "TIME_EXIT",
        time: b.time,
        side: candidate.side,
        spot: NaN,
        premium: exitPrem,
        pnl: pos.realizedPnl,
        label: candidate.side === "LONG" ? "Long Sell — Süre" : "Short Buy — Süre",
        note: `${FORCE_EXIT_MINUTES} dakikalık taşıma süresi doldu, mevcut fiyattan kapatıldı.`,
      });
      break;
    }

    // Stop önce kontrol edilir (aynı mumda ikisi de dokunmuşsa kötümser varsayım)
    if (b.low <= pos.stopLevel!) {
      const exitPrem = pos.stopLevel!;
      pos.realizedPnl = r2((exitPrem - entryPremium) * 100);
      pos.status = "CLOSED";
      pos.exitTime = b.time;
      pos.exitReason = "STOP";
      events.push({
        id: idOf("ev", b.time, "STOP"),
        kind: "STOP",
        time: b.time,
        side: candidate.side,
        spot: NaN,
        premium: exitPrem,
        pnl: pos.realizedPnl,
        label: candidate.side === "LONG" ? "Long Sell — Stop" : "Short Buy — Stop",
        note: `Prim sabit stopa (×${rules.stopMult}, ${exitPrem.toFixed(2)}) değdi.`,
      });
      break;
    }

    // Hedef — TAM kapama (V3'te kısmi kapama yok)
    if (b.high >= pos.targetLevel!) {
      const exitPrem = pos.targetLevel!;
      pos.realizedPnl = r2((exitPrem - entryPremium) * 100);
      pos.status = "CLOSED";
      pos.exitTime = b.time;
      pos.exitReason = "TARGET";
      events.push({
        id: idOf("ev", b.time, "TARGET"),
        kind: "TARGET",
        time: b.time,
        side: candidate.side,
        spot: NaN,
        premium: exitPrem,
        pnl: pos.realizedPnl,
        label: candidate.side === "LONG" ? "Long Sell — Hedef" : "Short Buy — Hedef",
        note: `Prim hedefe (×${rules.targetMult}, ${exitPrem.toFixed(2)}) ulaştı, tam kapandı.`,
      });
      break;
    }
  }

  if (pos.status !== "CLOSED") {
    const live = input.livePremium ?? pos.lastPremium;
    if (live != null) {
      pos.lastPremium = live;
      pos.unrealizedPnl = r2((live - entryPremium) * 100);
    }
  } else {
    pos.unrealizedPnl = 0;
  }

  return pos;
}

/**
 * Aynı anda tek pozisyon KURALI + talimat §5 yeniden giriş (re-arm) kuralı:
 * bir pozisyon kapandığında, o pozisyonun yönünün TERSİNE kapanan İLK 1m
 * mumu görülene kadar yeni aday kabul edilmez ("düzeltme mumu" beklenir).
 * `m1` seans mumları, kapanış zamanından sonraki ilk zıt-yönlü mumu bulmak
 * için kullanılır — bu da yalnızca kapanmış mumlara bakar, non-repainting.
 */
export function filterOverlapping(candidates: EntryCandidate[], positions: PositionState[], m1: Bar[]): EntryCandidate[] {
  const posByKey = new Map<string, PositionState>();
  for (const p of positions) posByKey.set(`${p.entryTime}:${p.side}:${p.contractType}`, p);

  const out: EntryCandidate[] = [];
  let blockedUntil = -Infinity;

  for (const c of candidates) {
    if (c.time < blockedUntil) continue;
    out.push(c);

    const pos = posByKey.get(`${c.time}:${c.side}:${c.contractType}`);
    if (!pos || pos.exitTime == null) {
      // Pozisyon hâlâ açık veya sonucu bilinmiyor — sonrasındaki her şeyi blokla
      blockedUntil = Infinity;
      continue;
    }

    const exitSide = pos.side;
    const correction = m1.find((b) => b.time > pos.exitTime! && candleDir(b) === (exitSide === "LONG" ? "DOWN" : "UP"));
    blockedUntil = correction ? correction.time : Infinity;
  }
  return out;
}

// ── Etiketler (UI) ────────────────────────────────────────────────

export const EVENT_LABEL: Record<EventKind, string> = {
  ENTRY: "Giriş",
  TARGET: "Hedef — Tam Kapama",
  STOP: "Stop",
  TIME_EXIT: "Süre Doldu",
  EOD_EXIT: "Gün Sonu Kapama",
};

/** Her olay tipinin kendi işareti ve rengi */
export const EVENT_STYLE: Record<EventKind, { color: string; shape: "arrowUp" | "arrowDown" | "circle" | "square"; glyph: string }> = {
  ENTRY:     { color: "#22c55e", shape: "arrowUp",   glyph: "▲" },
  TARGET:    { color: "#38bdf8", shape: "arrowDown", glyph: "◆" },
  STOP:      { color: "#ef4444", shape: "circle",    glyph: "✕" },
  TIME_EXIT: { color: "#f59e0b", shape: "square",    glyph: "◷" },
  EOD_EXIT:  { color: "#94a3b8", shape: "square",    glyph: "■" },
};

export const CONTRACT_TONE: Record<ContractType, string> = {
  A: "#38bdf8",
  B: "#a855f7",
};
