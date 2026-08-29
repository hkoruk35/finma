/**
 * SPY Engine V2 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * Talimat §3–§5'in birebir uygulaması:
 *
 *   5m → kurulum (breakout / breakdown / pullback)
 *     ↓
 *   1m → hassas tetik (rejection / confirmation) → GİRİŞ
 *     ↓
 *   Pozisyon (0DTE opsiyon primi üzerinden):
 *     · sabit stop  = giriş primi × 0,70   (−%30, ASLA değişmez)
 *     · hedef       = giriş primi × 1,60   (+%60 → %50 kısmi kapama)
 *     · kalan yarı  = peak × 0,50 trailing (sadece yukarı güncellenir)
 *     · 15:45 ET    = koşulsuz kapama
 *
 * NON-REPAINTING (§7): tüm kararlar SADECE kapanmış mumlarla verilir.
 * `generate()` her çağrıldığında sıfırdan yeniden hesaplanır; aynı girdi
 * her zaman aynı çıktıyı verir, bu yüzden geçmiş bir işaret asla yerinden
 * oynamaz. Trailing seviyesinin yükselmesi repaint değildir — geçmişi
 * `trailPath` içinde adım adım saklanır (§7 genişletmesi).
 */

import {
  Bar,
  SessionInfo,
  ema,
  rsi,
  macd,
  bollinger,
  sma,
  nyParts,
  ENTRY_START_MIN,
  ENTRY_END_MIN,
  EOD_FORCE_MIN,
  RTH_OPEN_MIN,
  r2,
} from "./core";

// ── Sabitler (talimat §4) ─────────────────────────────────────────

export const STOP_MULT = 0.70;        // giriş × 0,70  → −%30 sabit stop
export const TARGET_MULT = 1.60;      // giriş × 1,60  → +%60 kısmi kapama
export const TRAIL_MULT = 0.50;       // peak  × 0,50  → geniş bantlı trailing
export const PARTIAL_FRACTION = 0.5;  // kısmi kapamada kapatılan oran
/** İki giriş arasındaki en kısa süre (saniye) — aynı hareketin tekrar tekrar sinyal üretmesini engeller */
export const ENTRY_COOLDOWN_SEC = 10 * 60;
/** Opsiyon primi verisi yoksa pozisyonun açık sayılacağı azami süre (saniye) */
export const BLIND_POSITION_MAX_SEC = 30 * 60;

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";

export type SetupKind =
  | "NONE"
  | "BREAKOUT"
  | "BREAKDOWN"
  | "PULLBACK_LONG"
  | "PULLBACK_SHORT";

export type TriggerKind =
  | "NONE"
  | "BULL_CONFIRMATION"
  | "BULL_REJECTION"
  | "BEAR_CONFIRMATION"
  | "BEAR_REJECTION";

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type EventKind =
  | "ENTRY"
  | "PARTIAL"
  | "STOP"
  | "TRAIL_EXIT"
  | "EOD_EXIT";

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
  /** Pozisyonun bu olayda kapatılan yüzdesi (0 = giriş) */
  closedPct: number;
  /** Bu olaya kadarki kümülatif kâr/zarar (kontrat başına $, prim × 100) */
  pnl: number | null;
  label: string;
  note: string;
}

export interface TrailStep {
  time: number;
  level: number;
}

export interface PositionState {
  id: string;
  side: Side;
  entryTime: number;
  entrySpot: number;
  /** 0DTE kontrat sembolü (OCC) — prim takibi bu sembolden yapılır */
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  /** Gerçek giriş primi (Yahoo'dan). Veri yoksa null. */
  entryPremium: number | null;
  stopLevel: number | null;      // entryPremium × 0,70 (sabit)
  targetLevel: number | null;    // entryPremium × 1,60
  peakPremium: number | null;    // kısmi kapama sonrası izlenen zirve
  trailLevel: number | null;     // peak × 0,50 (sadece yukarı)
  trailPath: TrailStep[];        // trailing seviyesinin geçmişi (§7)
  /** 0 = tam açık, 50 = yarısı kapandı, 100 = kapandı */
  closedPct: number;
  status: "OPEN" | "HALF" | "CLOSED";
  /** Son bilinen prim (canlıysa anlık) */
  lastPremium: number | null;
  /** Kontrat başına gerçekleşen kâr/zarar ($) */
  realizedPnl: number;
  /** Açık kalan yarının anlık kâr/zararı ($) */
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
  setup: SetupKind;
  trigger: TriggerKind;
  confidence: number;
  reasoning: string;
}

export interface EngineRead {
  /** 15m yön/rejim — talimat §3 gereği KARAR MEKANİZMASININ PARÇASI DEĞİL, sadece bilgi */
  m15Direction: Direction;
  m15Note: string;
  m5Setup: SetupKind;
  m5Note: string;
  m1Trigger: TriggerKind;
  m1Note: string;
  action: "LONG" | "SHORT" | "BEKLE";
  state: "WATCHING" | "ARMED" | "TRIGGERED" | "IN_POSITION";
  confidence: number;
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

// ── 15m yön (bilgi amaçlı) ────────────────────────────────────────

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

// ── 5m kurulum motoru ─────────────────────────────────────────────

interface M5Context {
  setup: SetupKind[];
  note: string[];
  orh: number | null;
  orl: number | null;
}

/**
 * Her 5m mumu için kurulum tipini önceden hesaplar.
 * Açılış aralığı (OR) = 09:30–10:00 ET arasındaki RTH mumlarının uç noktaları;
 * yalnızca 10:00'dan SONRAKİ mumlarda kullanılır (bakış-ileri sızıntısı yok).
 */
function buildM5Context(m5: Bar[]): M5Context {
  const c = closes(m5);
  const e20 = ema(c, 20);
  const e50 = ema(c, 50);
  const r = rsi(c, 14);
  const { hist } = macd(c);
  const bb = bollinger(c, 20, 2);
  const volAvg = sma(m5.map((b) => b.volume || 0), 20);

  const setup: SetupKind[] = new Array(m5.length).fill("NONE");
  const note: string[] = new Array(m5.length).fill("");

  // Açılış aralığı, gün gün
  let orh: number | null = null;
  let orl: number | null = null;
  let orDay = "";

  for (let i = 0; i < m5.length; i++) {
    const p = nyParts(m5[i].time);
    if (p.ymd !== orDay) {
      orDay = p.ymd;
      orh = null;
      orl = null;
    }
    // İlk 30 dakika: aralığı büyüt, kurulum arama
    if (p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_OPEN_MIN + 30) {
      orh = orh == null ? m5[i].high : Math.max(orh, m5[i].high);
      orl = orl == null ? m5[i].low : Math.min(orl, m5[i].low);
      note[i] = "Açılış aralığı oluşuyor";
      continue;
    }

    const close = c[i];
    const a20 = e20[i];
    const a50 = e50[i];
    const h = hist[i];
    const rv = r[i];
    const va = volAvg[i];
    const vol = m5[i].volume || 0;
    if (a20 == null || h == null || rv == null) {
      note[i] = "Gösterge ısınıyor";
      continue;
    }

    const volOk = va == null || va === 0 ? true : vol >= va * 0.9;
    const trendUp = a50 != null && a20 > a50;
    const trendDown = a50 != null && a20 < a50;

    if (orh != null && close > orh && close > a20 && h > 0 && volOk) {
      setup[i] = "BREAKOUT";
      note[i] = `Açılış aralığı üstü kırılım (ORH ${r2(orh)}), MACD+ ve EMA20 üstü`;
    } else if (orl != null && close < orl && close < a20 && h < 0 && volOk) {
      setup[i] = "BREAKDOWN";
      note[i] = `Açılış aralığı altı kırılım (ORL ${r2(orl)}), MACD− ve EMA20 altı`;
    } else if (trendUp && m5[i].low <= a20 && close > a20 && rv > 45) {
      setup[i] = "PULLBACK_LONG";
      note[i] = `Yükselen trendde EMA20'ye geri çekilme, RSI ${rv.toFixed(0)}`;
    } else if (trendDown && m5[i].high >= a20 && close < a20 && rv < 55) {
      setup[i] = "PULLBACK_SHORT";
      note[i] = `Düşen trendde EMA20'ye tepki, RSI ${rv.toFixed(0)}`;
    } else {
      const bandPos = bb.pctB[i];
      note[i] = bandPos == null
        ? "Kurulum yok — bant verisi bekleniyor"
        : `Kurulum yok — %B ${(bandPos * 100).toFixed(0)}, MACD ${h > 0 ? "+" : "−"}`;
    }
  }

  return { setup, note, orh, orl };
}

// ── 1m tetik motoru ───────────────────────────────────────────────

interface M1Context {
  trigger: TriggerKind[];
  note: string[];
}

function buildM1Context(m1: Bar[]): M1Context {
  const c = closes(m1);
  const e9 = ema(c, 9);
  const r14 = rsi(c, 14);
  const volAvg = sma(m1.map((b) => b.volume || 0), 20);

  const trigger: TriggerKind[] = new Array(m1.length).fill("NONE");
  const note: string[] = new Array(m1.length).fill("");

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    const prev = m1[i - 1];
    const e = e9[i];
    const rsi = r14[i];
    if (e == null) {
      note[i] = "EMA9 ısınıyor";
      continue;
    }
    const va = volAvg[i];
    const vol = b.volume || 0;
    const volSurge = va != null && va > 0 ? vol >= va * 1.2 : false;

    // Kapalı 2 mumun yön tutarlılığı
    const bullishCandle = b.close > b.open;
    const bearishCandle = b.close < b.open;
    const prevBullishCandle = prev.close > prev.open;
    const prevBearishCandle = prev.close < prev.open;
    const twoBarBullish = bullishCandle && prevBullishCandle;
    const twoBarBearish = bearishCandle && prevBearishCandle;

    // RSI yön kontrolü (RSI > 50 = yükseliş yönü, < 50 = düşüş yönü)
    const rsiOk = rsi != null;
    const rsiBullish = rsi != null && rsi > 50;
    const rsiBearish = rsi != null && rsi < 50;

    const body = Math.abs(b.close - b.open);
    const lowerWick = Math.min(b.open, b.close) - b.low;
    const upperWick = b.high - Math.max(b.open, b.close);
    const range = b.high - b.low;

    // Yükseliş tetikleri: 2 mum yön tutarlılığı + RSI yön tutarlılığı + hacim teyiti
    if (b.close > prev.high && b.close > e && twoBarBullish && rsiBullish && volSurge) {
      trigger[i] = "BULL_CONFIRMATION";
      note[i] = `Önceki 1m zirvesi (${r2(prev.high)}) aşıldı, 2 mum yükseliş, EMA9 üstü, RSI ${r2(rsi)}, hacim patlaması`;
      continue;
    }
    if (range > 0 && lowerWick > body * 2 && lowerWick / range > 0.5 && b.close > e && twoBarBullish && rsiBullish) {
      trigger[i] = "BULL_REJECTION";
      note[i] = `Alt fitil reddi (fitil gövdenin ${(lowerWick / Math.max(body, 0.0001)).toFixed(1)}×'i), 2 mum yükseliş, EMA9 üstü, RSI ${r2(rsi)}`;
      continue;
    }
    // Düşüş tetikleri: 2 mum yön tutarlılığı + RSI yön tutarlılığı + hacim teyiti
    if (b.close < prev.low && b.close < e && twoBarBearish && rsiBearish && volSurge) {
      trigger[i] = "BEAR_CONFIRMATION";
      note[i] = `Önceki 1m dibi (${r2(prev.low)}) kırıldı, 2 mum düşüş, EMA9 altı, RSI ${r2(rsi)}, hacim patlaması`;
      continue;
    }
    if (range > 0 && upperWick > body * 2 && upperWick / range > 0.5 && b.close < e && twoBarBearish && rsiBearish) {
      trigger[i] = "BEAR_REJECTION";
      note[i] = `Üst fitil reddi (fitil gövdenin ${(upperWick / Math.max(body, 0.0001)).toFixed(1)}×'i), 2 mum düşüş, EMA9 altı, RSI ${r2(rsi)}`;
      continue;
    }
    note[i] = "Tetik yok";
  }

  return { trigger, note };
}

function sideOfSetup(s: SetupKind): Side | null {
  if (s === "BREAKOUT" || s === "PULLBACK_LONG") return "LONG";
  if (s === "BREAKDOWN" || s === "PULLBACK_SHORT") return "SHORT";
  return null;
}

function sideOfTrigger(t: TriggerKind): Side | null {
  if (t === "BULL_CONFIRMATION" || t === "BULL_REJECTION") return "LONG";
  if (t === "BEAR_CONFIRMATION" || t === "BEAR_REJECTION") return "SHORT";
  return null;
}

// ── Giriş adaylarının üretimi ─────────────────────────────────────

export interface GenerateInput {
  /** Bugünkü seansa ait 1m mumlar (pre/post dahil) */
  m1: Bar[];
  /** 5m mumlar — göstergelerin ısınması için birkaç seans geriye gidebilir */
  m5: Bar[];
  /** 15m mumlar — sadece yön okuması için */
  m15: Bar[];
  session: SessionInfo;
  nowSec: number;
}

export interface GenerateOutput {
  candidates: EntryCandidate[];
  read: EngineRead;
  /** Karar anında kullanılan son kapalı mum zamanları — şeffaflık için */
  lastClosed: { m1: number | null; m5: number | null; m15: number | null };
}

export function generateCandidates(input: GenerateInput): GenerateOutput {
  const { session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m15 = closedBars(input.m15, 15, nowSec);

  const m15Read = readM15(m15);
  const m5ctx = buildM5Context(m5);
  const m1ctx = buildM1Context(m1);

  // 5m zaman → indeks haritası (her 1m mumu için geçerli son KAPALI 5m mumu bulmak üzere)
  const candidates: EntryCandidate[] = [];
  let m5Cursor = -1;
  let lastEntryTime = -Infinity;

  for (let i = 0; i < m1.length; i++) {
    const bar = m1[i];
    // Bu 1m mumu kapandığı anda kapanmış olan son 5m mumu
    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    if (m5Cursor < 0) continue;

    const p = nyParts(bar.time);
    if (p.ymd !== session.date) continue;
    if (p.minutes < ENTRY_START_MIN || p.minutes >= ENTRY_END_MIN) continue;
    if (bar.time - lastEntryTime < ENTRY_COOLDOWN_SEC) continue;

    const setup = m5ctx.setup[m5Cursor];
    const trigger = m1ctx.trigger[i];
    const sSide = sideOfSetup(setup);
    const tSide = sideOfTrigger(trigger);
    if (!sSide || !tSide || sSide !== tSide) continue;

    // Güven skoru: kurulum tipi + tetik tipi + 15m yön uyumu
    let conf = 60;
    if (setup === "BREAKOUT" || setup === "BREAKDOWN") conf += 12;
    if (trigger === "BULL_CONFIRMATION" || trigger === "BEAR_CONFIRMATION") conf += 8;
    if (
      (sSide === "LONG" && m15Read.direction === "BULLISH") ||
      (sSide === "SHORT" && m15Read.direction === "BEARISH")
    ) conf += 15;
    else if (m15Read.direction !== "NEUTRAL") conf -= 10;
    conf = Math.max(0, Math.min(100, conf));

    candidates.push({
      time: bar.time,
      side: sSide,
      spot: bar.close,
      setup,
      trigger,
      confidence: conf,
      reasoning: `${m5ctx.note[m5Cursor]} → ${m1ctx.note[i]}`,
    });
    lastEntryTime = bar.time;
  }

  // Canlı okuma (en son kapalı mumlar)
  const lastM5 = m5.length - 1;
  const lastM1 = m1.length - 1;
  const curSetup = lastM5 >= 0 ? m5ctx.setup[lastM5] : "NONE";
  const curTrigger = lastM1 >= 0 ? m1ctx.trigger[lastM1] : "NONE";
  const curSide = sideOfSetup(curSetup);
  const trigSide = sideOfTrigger(curTrigger);

  let state: EngineRead["state"] = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let reasoning = "Kurulum aranıyor.";
  if (curSide && trigSide && curSide === trigSide) {
    state = "TRIGGERED";
    action = curSide;
    reasoning = `${curSide === "LONG" ? "Long" : "Short"} tetik aktif: 5m kurulum + 1m onay birlikte.`;
  } else if (curSide) {
    state = "ARMED";
    reasoning = `5m ${curSide === "LONG" ? "yükseliş" : "düşüş"} kurulumu hazır, 1m tetik bekleniyor.`;
  }

  const confidence = candidates.length && candidates[candidates.length - 1].time === (lastM1 >= 0 ? m1[lastM1].time : -1)
    ? candidates[candidates.length - 1].confidence
    : state === "ARMED" ? 55 : 40;

  return {
    candidates,
    read: {
      m15Direction: m15Read.direction,
      m15Note: m15Read.note,
      m5Setup: curSetup,
      m5Note: lastM5 >= 0 ? m5ctx.note[lastM5] : "5m verisi yok",
      m1Trigger: curTrigger,
      m1Note: lastM1 >= 0 ? m1ctx.note[lastM1] : "1m verisi yok",
      action,
      state,
      confidence,
      reasoning,
    },
    lastClosed: {
      m1: lastM1 >= 0 ? m1[lastM1].time : null,
      m5: lastM5 >= 0 ? m5[lastM5].time : null,
      m15: m15.length ? m15[m15.length - 1].time : null,
    },
  };
}

// ── Pozisyon durum makinesi (talimat §4) ──────────────────────────

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
 * üzerinde adım adım oynatır. Prim verisi yoksa pozisyon "prim verisi yok"
 * olarak işaretlenir ve hiçbir seviye uydurulmaz.
 */
export function runLifecycle(input: LifecycleInput): PositionState {
  const { candidate, premiumBars, session, nowSec } = input;
  const events: EngineEvent[] = [];

  const pos: PositionState = {
    id: idOf("pos", candidate.time, candidate.side),
    side: candidate.side,
    entryTime: candidate.time,
    entrySpot: candidate.spot,
    contract: input.contract,
    strike: input.strike,
    expiry: input.expiry,
    entryPremium: null,
    stopLevel: null,
    targetLevel: null,
    peakPremium: null,
    trailLevel: null,
    trailPath: [],
    closedPct: 0,
    status: "OPEN",
    lastPremium: null,
    realizedPnl: 0,
    unrealizedPnl: null,
    events,
    exitTime: null,
    exitReason: null,
    premiumDataMissing: true,
  };

  // Giriş primi = giriş mumunun kapandığı andaki (veya hemen sonrasındaki)
  // ilk prim mumunun kapanışı. Bulunamazsa prim verisi yok demektir.
  const entryIdx = premiumBars.findIndex((b) => b.time >= candidate.time);
  const eodEpoch = session.rthOpen + (EOD_FORCE_MIN - RTH_OPEN_MIN) * 60;

  if (entryIdx < 0 || !premiumBars.length) {
    events.push({
      id: idOf("ev", candidate.time, "ENTRY"),
      kind: "ENTRY",
      time: candidate.time,
      side: candidate.side,
      spot: candidate.spot,
      premium: null,
      closedPct: 0,
      pnl: null,
      label: candidate.side === "LONG" ? "Long Buy" : "Short Sell",
      note: `${candidate.reasoning} · Opsiyon primi verisi yok — seviyeler hesaplanamadı.`,
    });
    // Prim verisi yoksa pozisyonu süresiz açık bırakma
    if (nowSec - candidate.time > BLIND_POSITION_MAX_SEC || nowSec >= eodEpoch) {
      pos.status = "CLOSED";
      pos.closedPct = 100;
      pos.exitTime = Math.min(nowSec, eodEpoch);
      pos.exitReason = "EOD_EXIT";
    }
    return pos;
  }

  pos.premiumDataMissing = false;
  const entryPremium = premiumBars[entryIdx].close;
  pos.entryPremium = entryPremium;
  pos.stopLevel = entryPremium * STOP_MULT;
  pos.targetLevel = entryPremium * TARGET_MULT;

  events.push({
    id: idOf("ev", candidate.time, "ENTRY"),
    kind: "ENTRY",
    time: candidate.time,
    side: candidate.side,
    spot: candidate.spot,
    premium: entryPremium,
    closedPct: 0,
    pnl: 0,
    label: candidate.side === "LONG" ? "Long Buy" : "Short Sell",
    note: `${candidate.reasoning} · Stop ${entryPremium.toFixed(2)}×0,70 = ${(entryPremium * STOP_MULT).toFixed(2)} (sabit), hedef ${(entryPremium * TARGET_MULT).toFixed(2)}`,
  });

  let half = false;
  let peak = entryPremium;
  let trail: number | null = null;

  for (let i = entryIdx; i < premiumBars.length; i++) {
    const b = premiumBars[i];
    pos.lastPremium = b.close;

    // §4.4 — mutlak öncelikli kural
    if (b.time >= eodEpoch) {
      const exitPrem = b.open;
      const closing = half ? 0.5 : 1;
      pos.realizedPnl += (exitPrem - entryPremium) * 100 * closing;
      pos.closedPct = 100;
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
        closedPct: 100,
        pnl: r2(pos.realizedPnl),
        label: candidate.side === "LONG" ? "Long Sell — EOD" : "Short Buy — EOD",
        note: "15:45 ET zorunlu 0DTE kapaması.",
      });
      break;
    }

    if (!half) {
      // Stop önce kontrol edilir (aynı mumda ikisi de dokunmuşsa kötümser varsayım)
      if (b.low <= (pos.stopLevel as number)) {
        const exitPrem = pos.stopLevel as number;
        pos.realizedPnl += (exitPrem - entryPremium) * 100;
        pos.closedPct = 100;
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
          closedPct: 100,
          pnl: r2(pos.realizedPnl),
          label: candidate.side === "LONG" ? "Long Sell — Stop" : "Short Buy — Stop",
          note: `Prim −%30 sabit stopa (${exitPrem.toFixed(2)}) değdi.`,
        });
        break;
      }
      if (b.high >= (pos.targetLevel as number)) {
        const fillPrem = pos.targetLevel as number;
        pos.realizedPnl += (fillPrem - entryPremium) * 100 * PARTIAL_FRACTION;
        pos.closedPct = 50;
        pos.status = "HALF";
        half = true;
        peak = Math.max(peak, b.high);
        trail = peak * TRAIL_MULT;
        pos.trailPath.push({ time: b.time, level: r2(trail) });
        events.push({
          id: idOf("ev", b.time, "PARTIAL"),
          kind: "PARTIAL",
          time: b.time,
          side: candidate.side,
          spot: NaN,
          premium: fillPrem,
          closedPct: 50,
          pnl: r2(pos.realizedPnl),
          label: "Kısmi Kapama (%50)",
          note: `Kâr kilitlendi — %50 kapatıldı @ ${fillPrem.toFixed(2)} (+%60). Kalan yarı için trailing başladı: ${trail.toFixed(2)}`,
        });
        continue;
      }
      continue;
    }

    // §4.3 — kalan yarı: peak × 0,50, sadece yukarı
    if (b.high > peak) {
      peak = b.high;
      const nextTrail = peak * TRAIL_MULT;
      if (trail == null || nextTrail > trail) {
        trail = nextTrail;
        pos.trailPath.push({ time: b.time, level: r2(trail) });
      }
    }
    if (trail != null && b.low <= trail) {
      const exitPrem = trail;
      pos.realizedPnl += (exitPrem - entryPremium) * 100 * 0.5;
      pos.closedPct = 100;
      pos.status = "CLOSED";
      pos.exitTime = b.time;
      pos.exitReason = "TRAIL_EXIT";
      events.push({
        id: idOf("ev", b.time, "TRAIL"),
        kind: "TRAIL_EXIT",
        time: b.time,
        side: candidate.side,
        spot: NaN,
        premium: exitPrem,
        closedPct: 100,
        pnl: r2(pos.realizedPnl),
        label: candidate.side === "LONG" ? "Long Sell — Trailing" : "Short Buy — Trailing",
        note: `Kalan %50, peak ${peak.toFixed(2)} × 0,50 = ${exitPrem.toFixed(2)} seviyesinde kapandı.`,
      });
      break;
    }
  }

  pos.peakPremium = half ? r2(peak) : null;
  pos.trailLevel = trail != null ? r2(trail) : null;

  // Canlı prim (varsa) açık yarının anlık P/L'i için
  if (pos.status !== "CLOSED") {
    const live = input.livePremium ?? pos.lastPremium;
    if (live != null) {
      pos.lastPremium = live;
      const openFraction = half ? 0.5 : 1;
      pos.unrealizedPnl = r2((live - entryPremium) * 100 * openFraction);
    }
  } else {
    pos.unrealizedPnl = 0;
  }
  pos.realizedPnl = r2(pos.realizedPnl);

  return pos;
}

/** Aynı anda tek pozisyon: bir adayı, önceki pozisyon kapanmadan kabul etme */
export function filterOverlapping(candidates: EntryCandidate[], positions: PositionState[]): EntryCandidate[] {
  const out: EntryCandidate[] = [];
  let blockedUntil = -Infinity;
  for (const c of candidates) {
    if (c.time < blockedUntil) continue;
    out.push(c);
    const pos = positions.find((p) => p.entryTime === c.time && p.side === c.side);
    blockedUntil = pos?.exitTime != null ? pos.exitTime : Infinity;
  }
  return out;
}

// ── Etiketler (UI) ────────────────────────────────────────────────

export const SETUP_LABEL: Record<SetupKind, string> = {
  NONE: "Kurulum yok",
  BREAKOUT: "Breakout",
  BREAKDOWN: "Breakdown",
  PULLBACK_LONG: "Pullback (Long)",
  PULLBACK_SHORT: "Pullback (Short)",
};

export const TRIGGER_LABEL: Record<TriggerKind, string> = {
  NONE: "Tetik yok",
  BULL_CONFIRMATION: "Bullish Confirmation",
  BULL_REJECTION: "Bullish Rejection",
  BEAR_CONFIRMATION: "Bearish Confirmation",
  BEAR_REJECTION: "Bearish Rejection",
};

export const EVENT_LABEL: Record<EventKind, string> = {
  ENTRY: "Giriş",
  PARTIAL: "Kısmi Kapama %50",
  STOP: "Stop",
  TRAIL_EXIT: "Trailing Kapama",
  EOD_EXIT: "Gün Sonu Kapama",
};

/** Talimat §5: her olay tipinin kendi işareti ve rengi */
export const EVENT_STYLE: Record<EventKind, { color: string; shape: "arrowUp" | "arrowDown" | "circle" | "square"; glyph: string }> = {
  ENTRY:      { color: "#22c55e", shape: "arrowUp",   glyph: "▲" },
  PARTIAL:    { color: "#38bdf8", shape: "circle",    glyph: "◐" },
  STOP:       { color: "#ef4444", shape: "circle",    glyph: "✕" },
  TRAIL_EXIT: { color: "#a855f7", shape: "arrowDown", glyph: "▼" },
  EOD_EXIT:   { color: "#94a3b8", shape: "square",    glyph: "■" },
};
