/**
 * SPY Engine V3.1 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * GİRİŞ MANTIĞI DEĞİŞMEDİ (V3'te doğrulandı, 2026-08-31'de canlı veriyle
 * 6 sinyalin 5'i yön olarak tuttu). Değişen tek şey ÇIKIŞ tarafı:
 *
 *   V3'te çıkış  : sabit SL/TP yüzdeleri + 45 dakikalık süre sınırı
 *   V3.1'de çıkış: girişin AYNASI — sinyal tabanlı, trend devam ettiği
 *                  sürece pozisyon açık kalır.
 *
 * ── Hiyerarşi (V3'ten devam) ──────────────────────────────────────
 *   1m → ANA SÜRÜCÜ: giriş, art arda aynı yönlü kapanan mum SERİSİ
 *        üzerinden üretilir (Kontrat A: 2. mum, Kontrat B: 4. mum +
 *        5m RSI teyidi + trend kırılmamış şartı).
 *   5m → DESTEK: RSI yönü güven puanını ayarlar, sinyali ASLA iptal etmez.
 *   15m → karar mekanizmasında YOK (yalnızca "15m Bağlam" sekmesinde bilgi).
 *
 * ── Çıkış (V3.1) ──────────────────────────────────────────────────
 * Sabit yüzde yok. Pozisyon şu dört koşuldan biri oluşana kadar taşınır:
 *
 *   1. TREND KIRILIMI  — 3 ardışık TERS yönlü 1m mum kapanışı.
 *      Girişin aynası ama bilinçli olarak ASİMETRİK: giriş 2 mumla açılır,
 *      çıkış 3 mum ister. Trend içindeki 2 mumluk geri çekilmeler normal
 *      gürültüdür; 2'de çıkmak "trend devam ettiği sürece taşı" kuralını
 *      bozardı.
 *   2. 5m RSI DÖNÜŞÜ   — RSI, pozisyonu destekler hâldeyken 50 çizgisini
 *      pozisyonun tersine geçti. Rejim değişimi, 1m gürültüsünden bağımsız.
 *      Giriş anında RSI zaten ters yöndeyse bu kural HİÇ silahlanmaz —
 *      aksi hâlde pozisyon daha ilk mumda kapanırdı.
 *   3. HACİM TÜKENMESİ — ters yönlü mum + hacim son 15 mum ortalamasının
 *      %70'inin altında + fiyat giriş seviyesinin gerisinde. Hareket
 *      alıcısını/satıcısını kaybetmiş, geri çekilme başlamış demektir.
 *   4. 15:45 ET        — mutlak, koşulsuz (0DTE). Her şeyden önceliklidir.
 *
 * Çıkış kararı GİRİŞLE AYNI VERİDEN (SPY 1m/5m mumları) üretilir; opsiyon
 * primi yalnızca $ kâr/zararı FİYATLAMAK için kullanılır. Bu yüzden prim
 * verisi gelmese bile çıkış zamanı ve gerekçesi her zaman bilinir.
 *
 * ── Yeniden giriş (re-arm) ────────────────────────────────────────
 * Bir pozisyon kapandığında sistem, o pozisyonun yönünün TERSİNE kapanan
 * İLK 1m mumu görene kadar yeni aday üretmez ("düzeltme mumu" beklenir).
 *
 * NON-REPAINTING: tüm kararlar SADECE kapanmış mumlarla verilir. Her
 * fonksiyon saftır; aynı girdi her zaman aynı çıktıyı verir, bu yüzden
 * geçmiş bir işaret asla yerinden oynamaz.
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

/**
 * A ve B artık yalnızca GİRİŞ ZAMANLAMASI bakımından ayrışır (V3.1'de
 * sabit SL/TP kaldırıldığı için ikisinin risk profili aynıdır).
 * A = erken/hızlı giriş, B = teyitli/geç giriş.
 */
export const CONTRACT_RULES: Record<ContractType, { label: string }> = {
  A: { label: "Kontrat A · hızlı giriş (2. mum)" },
  B: { label: "Kontrat B · teyitli giriş (4. mum)" },
};

/** Girişi tetikleyen ardışık aynı yönlü mum sayısı (Kontrat A) */
export const ENTRY_STREAK_A = 2;
/** Girişi tetikleyen ardışık aynı yönlü mum sayısı (Kontrat B) */
export const ENTRY_STREAK_B = 4;

/**
 * Çıkışı tetikleyen ardışık TERS yönlü mum sayısı. Girişten (2) bilinçli
 * olarak BÜYÜK: trend içindeki 2 mumluk geri çekilmeler gürültüdür, 3 mum
 * gerçek bir kırılımdır. Asimetri "kazananı koştur" ilkesinin karşılığıdır.
 */
export const EXIT_REVERSAL_BARS = 3;

/** Hacim teyidi/tükenmesi için bakılan geçmiş mum sayısı */
export const VOLUME_LOOKBACK = 15;
/** Hacim "tükenmiş" sayılma eşiği: 15 mum ortalamasının bu katının altı */
export const VOLUME_FADE_RATIO = 0.7;
/**
 * Hacim tükenmesi çıkışının isteyeceği ardışık ters mum sayısı.
 * Trend kırılımından (3) bir eksik: hem ters mum hem ölü hacim hem de zarar
 * bir aradaysa tam kırılımı beklemeden bir mum erken çıkılır.
 */
export const VOLUME_FADE_BARS = 2;
/** "son swing high/low'a yakınlık" (trend kırılma riski) için pencere */
export const SWING_LOOKBACK = 10;

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";

export type StreakDir = "UP" | "DOWN" | "NONE";

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type ExitKind = "REVERSAL_EXIT" | "RSI_FLIP_EXIT" | "VOLUME_FADE_EXIT" | "EOD_EXIT";
export type EventKind = "ENTRY" | ExitKind;

export interface ConfidencePart {
  label: string;
  /** Puana katkısı (+/−) — güven skoru kara kutu olmamalı, her bileşen görülebilir */
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

/** Açık pozisyonun çıkışa ne kadar yaklaştığı — canlı takip için şeffaflık */
export interface ExitProgress {
  /** Şu ana kadar biriken ardışık ters yönlü mum sayısı */
  againstBars: number;
  /** Çıkış için gereken ardışık ters mum sayısı */
  reversalNeeded: number;
  /** 5m RSI pozisyonu destekliyor mu (null = 5m verisi yok) */
  rsiSupportive: boolean | null;
  /** RSI dönüş kuralı silahlandı mı (giriş sonrası RSI en az bir kez destekledi mi) */
  rsiArmed: boolean;
  /** Girişten bu yana taşınan 1m mum sayısı */
  barsHeld: number;
  /** Pozisyon lehine görülen en iyi SPY seviyesi */
  bestSpot: number | null;
  /** İnsan okunur özet */
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
  status: "OPEN" | "CLOSED";
  /** Son bilinen prim (canlıysa anlık) */
  lastPremium: number | null;
  /** Kontrat başına gerçekleşen kâr/zarar ($) */
  realizedPnl: number;
  /** Açıkken anlık kâr/zarar ($) */
  unrealizedPnl: number | null;
  events: EngineEvent[];
  exitTime: number | null;
  exitSpot: number | null;
  exitPremium: number | null;
  exitReason: ExitKind | null;
  exitNote: string | null;
  /** Açık pozisyonun çıkışa yakınlığı (kapalıysa son durumu) */
  progress: ExitProgress;
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

/** Motorun o anki okuması — panelde insan diliyle gösterilir */
export type EngineState = "WATCHING" | "ARMED" | "TRIGGERED" | "IN_POSITION";

export interface EngineRead {
  /** 15m yön/rejim — KARAR MEKANİZMASININ PARÇASI DEĞİL, sadece 15m Bağlam sekmesi için */
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
  state: EngineState;
  /** Durumun Türkçe, teknik olmayan karşılığı (ekranda "ARMED" yazmasın diye) */
  stateLabel: string;
  /** Bir sonraki adımın ne olduğu — "şimdi ne bekleniyor" */
  nextStep: string;
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

/** 15:45 ET zorunlu kapama anı (unix sn) */
function eodEpochOf(session: SessionInfo): number {
  return session.rthOpen + (EOD_FORCE_MIN - RTH_OPEN_MIN) * 60;
}

function candleDir(b: Bar): StreakDir {
  if (b.close > b.open) return "UP";
  if (b.close < b.open) return "DOWN";
  return "NONE";
}

/** Gövde/aralık oranı (0..1) — "1m mum paterni gücü" */
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
 * "Trend kırılması riski (son swing high/low'a yakınlık)".
 * Pozisyonun yönüne karşıt en yakın swing noktasına mesafe, o pencerenin
 * ortalama mum aralığına oranlanır. 0 = güvenli mesafe, 1 = swing noktasına
 * yapışık/kırılmış (yüksek risk).
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

/** Güven skoru — dört şeffaf bileşen, kara kutu değil */
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

// ── Giriş adaylarının üretimi (1m ana sürücü) ─────────────────────

export interface GenerateInput {
  /** Bugünkü seansa ait 1m mumlar (pre/post dahil) */
  m1: Bar[];
  /** 5m mumlar — RSI destek okuması için */
  m5: Bar[];
  /** 15m mumlar — sadece 15m Bağlam sekmesi için */
  m15: Bar[];
  session: SessionInfo;
  nowSec: number;
  /** Şu an açık bir pozisyon var mı (yalnızca durum etiketi için) */
  hasOpenPosition?: boolean;
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
      // Doji: yön belirsiz, seri sıfırlanır ("art arda aynı yönde kapanıyor"
      // ifadesi net bir yön gerektirir; kararsız bir mum seriyi bozar).
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

    // Kontrat A — 2. ardışık mumda tetik
    if (streakLen === ENTRY_STREAK_A && !aFiredThisStreak) {
      aFiredThisStreak = true;
      const { total, parts } = buildConfidence(bar, volOk, rsiAlignedInfo, risk, streakLen);
      candidates.push({
        time: bar.time,
        side,
        spot: bar.close,
        contractType: "A",
        confidence: total,
        confidenceParts: parts,
        reasoning: `${ENTRY_STREAK_A} ardışık ${side === "LONG" ? "yükseliş" : "düşüş"} 1m mumu${volOk ? ", hacim ortalamanın üzerinde" : " (hacim zayıf — düşük güven)"}`,
      });
    }

    // Kontrat B — 4. ardışık mumda, 5m RSI teyidi + trend kırılmamış
    if (streakLen === ENTRY_STREAK_B && !bFiredThisStreak) {
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
          reasoning: `${ENTRY_STREAK_B}. ${side === "LONG" ? "yükseliş" : "düşüş"} mum, 5m RSI ${r5 != null ? r5.toFixed(0) : "—"} teyitli, trend kırılmadı`,
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

  const dirWord = streakDir === "UP" ? "yükseliş" : "düşüş";

  let state: EngineState = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let contractType: ContractType | null = null;
  let confidence = 40;
  let confidenceParts: ConfidencePart[] = [{ label: "Taban (seri yok)", value: 40 }];
  let reasoning = "Kurulum aranıyor — net yönlü mum serisi yok.";
  let stateLabel = "İZLEMEDE";
  let nextStep = `Arka arkaya ${ENTRY_STREAK_A} aynı yönlü 1m mum bekleniyor. Şu an yönlü seri yok.`;

  if (input.hasOpenPosition) {
    state = "IN_POSITION";
    stateLabel = "POZİSYONDA";
    nextStep = "Açık pozisyon taşınıyor — çıkış sinyali bekleniyor (aşağıdaki Açık Pozisyon kutusuna bak).";
    reasoning = "Pozisyon açık; trend devam ettiği sürece taşınıyor.";
  } else if (lastCandidate) {
    state = "TRIGGERED";
    action = lastCandidate.side;
    contractType = lastCandidate.contractType;
    confidence = lastCandidate.confidence;
    confidenceParts = lastCandidate.confidenceParts;
    reasoning = lastCandidate.reasoning;
    stateLabel = lastCandidate.side === "LONG" ? "LONG GİRİŞ SİNYALİ" : "SHORT GİRİŞ SİNYALİ";
    nextStep = `Kontrat ${lastCandidate.contractType} girişi bu mumda tetiklendi. Pozisyon açılıyor.`;
  } else if (streakLen >= 1) {
    state = "ARMED";
    confidence = Math.min(55, 40 + streakLen * 5);
    confidenceParts = [
      { label: "Taban", value: 40 },
      { label: `${streakLen} mumluk seri`, value: confidence - 40 },
    ];
    reasoning = `${streakLen} ardışık ${dirWord} mumu — ${ENTRY_STREAK_A}. mumda Kontrat A tetiklenebilir.`;
    stateLabel = "HAZIRLANIYOR";
    const need = Math.max(0, ENTRY_STREAK_A - streakLen);
    nextStep =
      need > 0
        ? `${streakLen} ${dirWord} mumu oluştu. ${need} tane daha aynı yönde kapanırsa ${streakDir === "UP" ? "LONG" : "SHORT"} giriş açılır.`
        : `Seri ${streakLen} muma ulaştı; ${ENTRY_STREAK_B}. mumda Kontrat B (teyitli giriş) tetiklenebilir.`;
  }

  const m5RsiLast = m5Cursor >= 0 ? m5RsiSeries[m5Cursor] : null;

  return {
    candidates,
    read: {
      m15Direction: m15Read.direction,
      m15Note: m15Read.note,
      m5Rsi: m5RsiLast,
      m5RsiDirection: m5RsiLast == null ? "NEUTRAL" : m5RsiLast > 50 ? "BULLISH" : m5RsiLast < 50 ? "BEARISH" : "NEUTRAL",
      m5Note:
        m5RsiLast == null
          ? "5m RSI verisi yok"
          : `RSI ${m5RsiLast.toFixed(1)} — ${m5RsiLast > 50 ? "yükselişi destekliyor" : m5RsiLast < 50 ? "düşüşü destekliyor" : "nötr"}`,
      m1StreakDir: streakDir,
      m1StreakLen: streakLen,
      m1Note:
        streakLen >= 1
          ? `${streakLen} ardışık ${dirWord} 1m mumu`
          : "Net yönlü seri yok",
      action,
      contractType,
      state,
      stateLabel,
      nextStep,
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

// ── Çıkış sinyali (girişin aynası — SPY mumlarından üretilir) ──────

export interface ExitSignal {
  time: number;
  spot: number;
  reason: ExitKind;
  note: string;
}

export interface ExitScan {
  /** Çıkış oluştuysa sinyal, hâlâ açıksa null */
  signal: ExitSignal | null;
  progress: ExitProgress;
}

export interface ExitScanInput {
  m1: Bar[];
  m5: Bar[];
  entryTime: number;
  side: Side;
  entrySpot: number;
  session: SessionInfo;
  nowSec: number;
}

/**
 * Girişten sonraki kapalı 1m mumları sırayla tarar ve ilk çıkış koşulunu
 * bulur. Hiçbiri oluşmadıysa `signal: null` döner ve `progress` içinde
 * pozisyonun çıkışa ne kadar yaklaştığını bildirir (canlı takip için).
 *
 * Öncelik sırası bilinçlidir: aynı mumda birden fazla koşul sağlanırsa
 * kanıtı en güçlü olan etiket kullanılır (fiyat aynı mum olduğu için
 * kâr/zarar değişmez, yalnızca gerekçe etiketi değişir).
 */
export function findExitSignal(input: ExitScanInput): ExitScan {
  const { side, entryTime, entrySpot, session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m5Rsi = rsi(closes(m5), 14);
  const eodEpoch = eodEpochOf(session);

  const isSupportive = (r: number) => (side === "LONG" ? r > 50 : r < 50);

  let m5Cursor = -1;
  let against = 0;
  let barsHeld = 0;
  let bestSpot: number | null = null;
  let rsiArmed = false;
  let rsiSupportive: boolean | null = null;

  for (let i = 0; i < m1.length; i++) {
    const bar = m1[i];
    if (bar.time <= entryTime) continue;

    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    barsHeld++;

    // Pozisyon lehine görülen en iyi seviye (şeffaflık — karar vermez)
    const favorable = side === "LONG" ? bar.high : bar.low;
    if (bestSpot == null) bestSpot = favorable;
    else bestSpot = side === "LONG" ? Math.max(bestSpot, favorable) : Math.min(bestSpot, favorable);

    // 1. 15:45 ET — mutlak öncelikli
    if (bar.time >= eodEpoch) {
      return {
        signal: {
          time: bar.time, spot: bar.close, reason: "EOD_EXIT",
          note: "15:45 ET zorunlu 0DTE kapaması — diğer tüm kurallardan önceliklidir.",
        },
        progress: { againstBars: against, reversalNeeded: EXIT_REVERSAL_BARS, rsiSupportive, rsiArmed, barsHeld, bestSpot, note: "Gün sonu kapaması." },
      };
    }

    const dir = candleDir(bar);
    const isAgainst = side === "LONG" ? dir === "DOWN" : dir === "UP";
    if (isAgainst) against++;
    else if (dir !== "NONE") against = 0; // lehte mum seriyi sıfırlar; doji sayacı korur

    // 2. TREND KIRILIMI — 3 ardışık ters yönlü mum
    if (against >= EXIT_REVERSAL_BARS) {
      return {
        signal: {
          time: bar.time, spot: bar.close, reason: "REVERSAL_EXIT",
          note: `${EXIT_REVERSAL_BARS} ardışık ters yönlü 1m mum — trend kırıldı (giriş ${ENTRY_STREAK_A} mumla açılır, çıkış ${EXIT_REVERSAL_BARS} mum ister).`,
        },
        progress: { againstBars: against, reversalNeeded: EXIT_REVERSAL_BARS, rsiSupportive, rsiArmed, barsHeld, bestSpot, note: "Trend kırılımıyla kapandı." },
      };
    }

    // 3. 5m RSI DÖNÜŞÜ — yalnızca RSI önce destekleyici olduysa silahlanır
    const r = m5Cursor >= 0 ? m5Rsi[m5Cursor] : null;
    if (r != null) {
      const supportive = isSupportive(r);
      rsiSupportive = supportive;
      if (supportive) {
        rsiArmed = true;
      } else if (rsiArmed) {
        return {
          signal: {
            time: bar.time, spot: bar.close, reason: "RSI_FLIP_EXIT",
            note: `5m RSI ${r.toFixed(1)} — 50 çizgisini pozisyonun tersine geçti, rejim değişti.`,
          },
          progress: { againstBars: against, reversalNeeded: EXIT_REVERSAL_BARS, rsiSupportive, rsiArmed, barsHeld, bestSpot, note: "5m RSI dönüşüyle kapandı." },
        };
      }
    }

    // 4. HACİM TÜKENMESİ — trend kırılımından BİR mum önce devreye giren
    //    erken kaçış. Üç şartın hepsi birden gerekir:
    //      · en az VOLUME_FADE_BARS ardışık ters mum (tek mumluk blip değil),
    //      · hacim son 15 mum ortalamasının %70'inin altında,
    //      · fiyat giriş seviyesinin gerisinde (hareket zaten çalışmıyor).
    //    Tek ters mumda tetiklenmesi denendi ve pozisyonların 1 mum sonra
    //    kapanmasına yol açtı — "trend devam ettiği sürece taşı" kuralını
    //    bozuyordu. Bu yüzden eşik ardışık iki muma çekildi.
    if (isAgainst && against >= VOLUME_FADE_BARS) {
      const va = avgVolume(m1, i, VOLUME_LOOKBACK);
      const volDead = va != null && va > 0 && (bar.volume || 0) < va * VOLUME_FADE_RATIO;
      const beyondEntry = side === "LONG" ? bar.close < entrySpot : bar.close > entrySpot;
      if (volDead && beyondEntry) {
        return {
          signal: {
            time: bar.time, spot: bar.close, reason: "VOLUME_FADE_EXIT",
            note: `${against} ardışık ters mum + hacim son ${VOLUME_LOOKBACK} mum ortalamasının %${Math.round(VOLUME_FADE_RATIO * 100)}'inin altında + fiyat girişin gerisinde — hareket alıcısını kaybetti.`,
          },
          progress: { againstBars: against, reversalNeeded: EXIT_REVERSAL_BARS, rsiSupportive, rsiArmed, barsHeld, bestSpot, note: "Hacim tükenmesiyle kapandı." },
        };
      }
    }
  }

  const remaining = Math.max(0, EXIT_REVERSAL_BARS - against);
  return {
    signal: null,
    progress: {
      againstBars: against,
      reversalNeeded: EXIT_REVERSAL_BARS,
      rsiSupportive,
      rsiArmed,
      barsHeld,
      bestSpot,
      note:
        against > 0
          ? `${against} ardışık ters mum oluştu — ${remaining} tane daha gelirse trend kırılımıyla çıkılır.`
          : "Trend devam ediyor — ters yönlü seri yok.",
    },
  };
}

// ── Pozisyon durum makinesi ────────────────────────────────────────

export interface LifecycleInput {
  candidate: EntryCandidate;
  /** SPY mumlarından hesaplanan çıkış taraması */
  exit: ExitScan;
  /** Giriş anında seçilen 0DTE kontratın 1m prim mumları (Yahoo, GERÇEK veri) */
  premiumBars: Bar[];
  contract: string | null;
  strike: number | null;
  expiry: string | null;
  /** Canlı anlık prim (varsa) — son kapalı prim mumundan daha taze olabilir */
  livePremium?: number | null;
}

/**
 * Bir pozisyonun yaşam döngüsünü kurar. ÇIKIŞ KARARI zaten `exit` içinde
 * SPY mumlarından verilmiştir; burada yapılan tek şey o karara GERÇEK
 * opsiyon primi fiyatı iliştirmektir. Prim verisi yoksa çıkış zamanı ve
 * gerekçesi yine bilinir, sadece $ kâr/zarar hesaplanmaz — uydurulmaz.
 */
export function runLifecycle(input: LifecycleInput): PositionState {
  const { candidate, exit, premiumBars } = input;
  const events: EngineEvent[] = [];
  const rules = CONTRACT_RULES[candidate.contractType];
  const sideWord = candidate.side === "LONG" ? "LONG" : "SHORT";

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
    status: exit.signal ? "CLOSED" : "OPEN",
    lastPremium: null,
    realizedPnl: 0,
    unrealizedPnl: null,
    events,
    exitTime: exit.signal?.time ?? null,
    exitSpot: exit.signal?.spot ?? null,
    exitPremium: null,
    exitReason: exit.signal?.reason ?? null,
    exitNote: exit.signal?.note ?? null,
    progress: exit.progress,
    premiumDataMissing: true,
  };

  const entryIdx = premiumBars.findIndex((b) => b.time >= candidate.time);
  const entryPremium = entryIdx >= 0 ? premiumBars[entryIdx].close : null;
  pos.entryPremium = entryPremium;
  pos.premiumDataMissing = entryPremium == null;

  events.push({
    id: idOf("ev", candidate.time, "ENTRY"),
    kind: "ENTRY",
    time: candidate.time,
    side: candidate.side,
    spot: candidate.spot,
    premium: entryPremium,
    pnl: entryPremium == null ? null : 0,
    label: `${sideWord} GİRİŞ`,
    note: `${rules.label} · ${candidate.reasoning}${entryPremium == null ? " · Opsiyon primi verisi yok — $ kâr/zarar hesaplanamıyor." : ""}`,
  });

  if (exit.signal) {
    // Çıkış primi: çıkış anındaki (veya hemen sonrasındaki) ilk prim mumu
    const exitIdx = premiumBars.findIndex((b) => b.time >= exit.signal!.time);
    const exitPremium = exitIdx >= 0 ? premiumBars[exitIdx].close : null;
    pos.exitPremium = exitPremium;
    pos.lastPremium = exitPremium;

    if (entryPremium != null && exitPremium != null) {
      pos.realizedPnl = r2((exitPremium - entryPremium) * 100);
    }
    pos.unrealizedPnl = 0;

    events.push({
      id: idOf("ev", exit.signal.time, exit.signal.reason),
      kind: exit.signal.reason,
      time: exit.signal.time,
      side: candidate.side,
      spot: exit.signal.spot,
      premium: exitPremium,
      pnl: entryPremium != null && exitPremium != null ? pos.realizedPnl : null,
      label: `${sideWord} ÇIKIŞ`,
      note: exit.signal.note,
    });
  } else {
    // Açık pozisyon — anlık prim ile kâğıt üstü kâr/zarar
    const lastBar = premiumBars.length ? premiumBars[premiumBars.length - 1] : null;
    const live = input.livePremium ?? lastBar?.close ?? null;
    pos.lastPremium = live;
    if (entryPremium != null && live != null) {
      pos.unrealizedPnl = r2((live - entryPremium) * 100);
    }
  }

  return pos;
}

/**
 * Aynı anda tek pozisyon KURALI + yeniden giriş (re-arm) kuralı:
 * bir pozisyon kapandığında, o pozisyonun yönünün TERSİNE kapanan İLK 1m
 * mumu görülene kadar yeni aday kabul edilmez ("düzeltme mumu" beklenir).
 */
export function filterOverlapping(
  candidates: EntryCandidate[],
  positions: Pick<PositionState, "entryTime" | "side" | "contractType" | "exitTime">[],
  m1: Bar[]
): EntryCandidate[] {
  const posByKey = new Map<string, (typeof positions)[number]>();
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
  REVERSAL_EXIT: "Trend Kırılımı — Çıkış",
  RSI_FLIP_EXIT: "5m RSI Dönüşü — Çıkış",
  VOLUME_FADE_EXIT: "Hacim Tükendi — Çıkış",
  EOD_EXIT: "Gün Sonu Kapama",
};

/** Kısa etiket — tablo hücreleri için */
export const EXIT_LABEL_SHORT: Record<ExitKind, string> = {
  REVERSAL_EXIT: "Trend Kırılımı",
  RSI_FLIP_EXIT: "RSI Dönüşü",
  VOLUME_FADE_EXIT: "Hacim Tükendi",
  EOD_EXIT: "Gün Sonu",
};

/** Her olay tipinin kendi işareti ve rengi */
export const EVENT_STYLE: Record<EventKind, { color: string; shape: "arrowUp" | "arrowDown" | "circle" | "square"; glyph: string }> = {
  ENTRY:            { color: "#22c55e", shape: "arrowUp",   glyph: "▲" },
  REVERSAL_EXIT:    { color: "#ef4444", shape: "arrowDown", glyph: "▼" },
  RSI_FLIP_EXIT:    { color: "#38bdf8", shape: "circle",    glyph: "◆" },
  VOLUME_FADE_EXIT: { color: "#f59e0b", shape: "circle",    glyph: "◷" },
  EOD_EXIT:         { color: "#94a3b8", shape: "square",    glyph: "■" },
};

export const CONTRACT_TONE: Record<ContractType, string> = {
  A: "#38bdf8",
  B: "#a855f7",
};
