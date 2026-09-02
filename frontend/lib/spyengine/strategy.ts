/**
 * SPY Engine V3.2 — Strateji ve Pozisyon Durum Makinesi (izomorfik, saf)
 *
 * V3.1'in sorunu ölçülerek bulundu: giriş kapısı yoktu. Sadece "2 ardışık
 * mum" arandığı için günde ~85 aday / saatte 2,4 işlem üretiliyor, 0DTE'de
 * her işlemin spread + theta maliyeti bu gürültüyü doğrudan zarara
 * çeviriyordu. V3.2 girişe ZORUNLU bir kalite kapısı koyar.
 *
 * ── GİRİŞ (hepsi zorunlu) ─────────────────────────────────────────
 *   1. 2 ardışık aynı yönlü KAPALI 1m mum (ENTRY_STREAK)
 *   2. Mum paterni: gövde ≥ %50, kapanış yön tarafında ≥ %60
 *   3. Tetik mumu hacmi > son 15 mumun ortalaması
 *   4. 1m RSI(14) o yönde hareket ediyor   (YÖN)
 *   5. Son kapalı 5m mum aynı yönde
 *   6. 5m RSI(14) o yönde hareket ediyor   (YÖN)
 *   7. Saatte en fazla 3 giriş (kayan pencere)
 *   8. Aynı anda tek pozisyon + kapanıştan sonra düzeltme mumu beklenir
 *
 * RSI'da SADECE YÖN aranır, 50 seviyesi ARANMAZ. Seviye şartı iki kez
 * denendi, iki kez kaldırıldı: 20 seansta işlem 87 → 65'e düşüyor, işlem
 * başına beklenti +0,018 → −0,011 puana geriliyor ve "yakalama" %41 → %37
 * oluyor, yani girişi geciktiriyor. Tekrar eklenmesin.
 *
 * ── ÇIKIŞ (ilk oluşan) ────────────────────────────────────────────
 *   1. 3 ardışık TERS yönlü 1m mum + 1m RSI de dönmüş
 *      → 5m mum VE 5m RSI de ters döndüyse eşik 2 muma iner
 *   2. 15:45 ET — mutlak, koşulsuz (0DTE)
 * Sabit yüzde hedef/stop, süre sınırı ve prim trailing YOK — hepsi ölçüldü
 * ve net beklentiyi düşürdüğü görüldü (aşağıdaki ölçüm notlarına bakın).
 *
 * ── ÖLÇÜM (2026-08-25…08-31, 5 seans, gerçek SPY 1m/5m) ───────────
 *   giriş serisi   2 mum: 2,4 işlem/saat · +$0,107/işlem
 *                  3 mum: 0,8 işlem/saat · +$0,284/işlem   ← seçilen
 *                  4 mum: 0,5 işlem/saat · +$0,173/işlem
 *   RSI seviye (50 çizgisi) şartı: +$0,284 → +$0,181  (ZARARLI, eklenmedi)
 *   RSI yön şartı:                 +$0,284 → +$0,284  (bedava, eklendi)
 *   5m bağımsız çıkış tetikleyici: +$0,284 → +$0,119  (çok erken, eklenmedi)
 *   5m hızlandırıcı (eşiği 2'ye):  isabet %52 → %55, taşıma 21 → 16 mum ✓
 *   prim trailing (tüm varyantlar): net beklentiyi düşürdü, eklenmedi
 *
 * Çıkış kararı GİRİŞLE AYNI VERİDEN (SPY 1m/5m) üretilir; opsiyon primi
 * yalnızca $ kâr/zararı FİYATLAMAK için kullanılır. Bu yüzden prim verisi
 * gelmese bile çıkış zamanı ve gerekçesi her zaman bilinir.
 *
 * NON-REPAINTING: tüm kararlar SADECE kapanmış mumlarla verilir. Her
 * fonksiyon saftır; aynı girdi her zaman aynı çıktıyı verir.
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
  A: { label: "Kapılı Giriş (2 mum + patern + hacim + 5m teyidi)" },
  B: { label: "Kontrat B (emekli)" },
};

/**
 * Girişi tetikleyen ardışık aynı yönlü KAPALI 1m mum sayısı.
 * İlk mum kapanır, İKİNCİ mumun kapanışında onay seti kontrol edilir.
 */
export const ENTRY_STREAK = 2;

/**
 * Çıkışı tetikleyen ardışık TERS yönlü mum sayısı — girişle SİMETRİK.
 * Çıkışta da girişin AYNI onay seti (mum paterni + hacim + 1m RSI yönü +
 * 5m mum yönü + 5m RSI yönü) ters yönde aranır.
 */
export const EXIT_REVERSAL_BARS = 2;

/** Mum paterni: gövde, mumun toplam aralığının en az bu kadarı olmalı */
export const BODY_MIN_RATIO = 0.5;
/**
 * Mum paterni: kapanış, hareketin yönünde mumun bu kadar ilerisinde olmalı.
 * (LONG için tepeye, SHORT için dibe yakın kapanış = kararlı mum.)
 */
export const CLOSE_POSITION_MIN = 0.6;

/** Hacim teyidi için bakılan geçmiş mum sayısı */
export const VOLUME_LOOKBACK = 15;


/**
 * Saatte azami giriş (kayan 60 dakikalık pencere).
 * Kural: "saatte 2-3'ten fazla işlem yakalamak fazla gürültüde zarar
 * üretmektir." Kapı bunu zaten nadiren zorlar; tavan görevi görür.
 */
export const MAX_ENTRIES_PER_HOUR = 3;

/** "son swing high/low'a yakınlık" (trend kırılma riski) için pencere */
export const SWING_LOOKBACK = 10;

// ── Tipler ────────────────────────────────────────────────────────

export type Side = "LONG" | "SHORT";

export type StreakDir = "UP" | "DOWN" | "NONE";

export type Direction = "BULLISH" | "BEARISH" | "NEUTRAL";

export type ExitKind = "REVERSAL_EXIT" | "EOD_EXIT";
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
  /** 5m mum + 5m RSI birlikte ters döndü mü (çıkış eşiğini 2 muma düşürür) */
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

/** Tek bir kapının o anki durumu — canlı karar desteği için */
export interface GateCheck {
  label: string;
  ok: boolean;
  detail: string;
}

/** Her iki yön için kapıların anlık durumu */
export interface GateStatus {
  long: GateCheck[];
  short: GateCheck[];
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
  /**
   * Son kapalı 1m mum için kapıların LONG ve SHORT yönünde tek tek durumu.
   * Motor kendi sinyalini üretmese bile burada "şu an LONG açsam hangi kapı
   * geçer, hangisi geçmez" görülebilir — el ile işlem açarken veto listesi.
   */
  gateStatus: GateStatus;
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

/**
 * GİRİŞ KAPISI — hepsi ZORUNLU. Biri bile sağlanmazsa giriş üretilmez.
 *
 * Eskiden yalnızca mum serisine bakılıyor, hacim/RSI sadece güven puanını
 * değiştiriyordu; bu, günde ~85 aday ve saatte 2,4 işlem üretiyordu. 0DTE'de
 * her işlemin spread + theta maliyeti olduğu için gürültülü girişler
 * doğrudan zarar demek. 5 seanslık ölçümde bu kapı işlem sayısını üçte bire
 * indirirken işlem başına beklentiyi 2,7 katına çıkardı.
 *
 * ÖNEMLİ AYRINTI — RSI'da YÖN kontrol edilir, SEVİYE (50 çizgisi) DEĞİL.
 * "RSI > 50" şartı denendi ve ZARAR verdi (+$0,284 → +$0,181): dipten dönen
 * erken girişleri eliyordu. Yön kontrolü ise bedava — 3 mumluk seri + hacim
 * + 5m uyumu varken RSI zaten o yönde hareket ediyor, dolayısıyla hiçbir
 * geçerli girişi yanlışlıkla engellemiyor ama uyumsuz bir sapma olursa
 * güvenlik ağı görevi görüyor.
 */
function checkGate(
  m1: Bar[], m5: Bar[],
  m1Rsi: (number | null)[], m5Rsi: (number | null)[],
  i: number, m5Cursor: number, side: Side
): { ok: true; volRatio: number; rsi1: number; rsi5: number } | { ok: false; blockedBy: string } {
  const bar = m1[i];

  // 0) MUM PATERNİ — kararlı bir mum mu, yoksa fitilli/kararsız mı
  const rng = Math.max(1e-9, bar.high - bar.low);
  const bodyR = Math.abs(bar.close - bar.open) / rng;
  if (bodyR < BODY_MIN_RATIO) {
    return { ok: false, blockedBy: `mum gövdesi zayıf (aralığın %${(bodyR * 100).toFixed(0)}'i, en az %${BODY_MIN_RATIO * 100} gerek)` };
  }
  const posInRange = (bar.close - bar.low) / rng;
  const closeStrength = side === "LONG" ? posInRange : 1 - posInRange;
  if (closeStrength < CLOSE_POSITION_MIN) {
    return { ok: false, blockedBy: `kapanış ${side === "LONG" ? "tepeye" : "dibe"} yakın değil (%${(closeStrength * 100).toFixed(0)})` };
  }

  // 1) Hacim — tetik mumu son 15 mumun ortalamasının üzerinde olmalı
  const va = avgVolume(m1, i, VOLUME_LOOKBACK);
  const volRatio = va != null && va > 0 ? (bar.volume || 0) / va : 1;
  if (va != null && va > 0 && (bar.volume || 0) < va) {
    return { ok: false, blockedBy: `hacim zayıf (ortalamanın ×${volRatio.toFixed(2)}'i)` };
  }

  // 2) 1m RSI yönü
  const r1 = m1Rsi[i], r1p = m1Rsi[i - 1];
  if (r1 == null || r1p == null) return { ok: false, blockedBy: "1m RSI ısınıyor" };
  if (side === "LONG" ? r1 <= r1p : r1 >= r1p) {
    return { ok: false, blockedBy: `1m RSI ${side === "LONG" ? "yükselmiyor" : "düşmüyor"} (${r1.toFixed(0)})` };
  }

  // 3) 5m mum yönü
  if (m5Cursor < 1) return { ok: false, blockedBy: "5m verisi yetersiz" };
  const c5 = candleDir(m5[m5Cursor]);
  if ((side === "LONG" && c5 !== "UP") || (side === "SHORT" && c5 !== "DOWN")) {
    return { ok: false, blockedBy: `5m mum ters yönde (${c5 === "UP" ? "yeşil" : c5 === "DOWN" ? "kırmızı" : "doji"})` };
  }

  // 4) 5m RSI yönü
  const r5 = m5Rsi[m5Cursor], r5p = m5Rsi[m5Cursor - 1];
  if (r5 == null || r5p == null) return { ok: false, blockedBy: "5m RSI ısınıyor" };
  if (side === "LONG" ? r5 < r5p : r5 > r5p) {
    return { ok: false, blockedBy: `5m RSI ${side === "LONG" ? "yükselmiyor" : "düşmüyor"} (${r5.toFixed(0)})` };
  }

  return { ok: true, volRatio, rsi1: r1, rsi5: r5 };
}


/**
 * Belirli bir 1m mumunda, verilen yön için kapıların tek tek durumu.
 * `checkGate` ile AYNI eşikleri kullanır; fark, ilk hatada durmak yerine
 * hepsini raporlamasıdır — el ile işlem açarken veto listesi olarak okunur.
 */
function gateChecksFor(
  m1: Bar[], m5: Bar[],
  m1Rsi: (number | null)[], m5Rsi: (number | null)[],
  i: number, m5Cursor: number, side: Side
): GateCheck[] {
  if (i < 1) return [];
  const bar = m1[i];
  const rng = Math.max(1e-9, bar.high - bar.low);
  const bodyR = Math.abs(bar.close - bar.open) / rng;
  const posInRange = (bar.close - bar.low) / rng;
  const closeStr = side === "LONG" ? posInRange : 1 - posInRange;
  const va = avgVolume(m1, i, VOLUME_LOOKBACK);
  const volRatio = va != null && va > 0 ? (bar.volume || 0) / va : 1;
  const r1 = m1Rsi[i], r1p = m1Rsi[i - 1];
  const c5 = m5Cursor >= 0 ? candleDir(m5[m5Cursor]) : "NONE";
  const r5 = m5Cursor >= 1 ? m5Rsi[m5Cursor] : null;
  const r5p = m5Cursor >= 1 ? m5Rsi[m5Cursor - 1] : null;
  const wantDir: StreakDir = side === "LONG" ? "UP" : "DOWN";

  return [
    {
      label: `Mum gövdesi ≥ %${BODY_MIN_RATIO * 100}`,
      ok: bodyR >= BODY_MIN_RATIO,
      detail: `%${(bodyR * 100).toFixed(0)}`,
    },
    {
      label: `Kapanış ${side === "LONG" ? "tepeye" : "dibe"} yakın ≥ %${CLOSE_POSITION_MIN * 100}`,
      ok: closeStr >= CLOSE_POSITION_MIN,
      detail: `%${(closeStr * 100).toFixed(0)}`,
    },
    {
      label: "Hacim ≥ son 15 mum ort.",
      ok: va == null || va === 0 ? true : (bar.volume || 0) >= va,
      detail: `ort.×${volRatio.toFixed(2)}`,
    },
    {
      label: `1m RSI ${side === "LONG" ? "yükseliyor" : "düşüyor"}`,
      ok: r1 != null && r1p != null && (side === "LONG" ? r1 > r1p : r1 < r1p),
      detail: r1 == null ? "veri yok" : r1.toFixed(0),
    },
    {
      label: `5m mum ${side === "LONG" ? "yeşil" : "kırmızı"}`,
      ok: c5 === wantDir,
      detail: c5 === "UP" ? "yeşil" : c5 === "DOWN" ? "kırmızı" : "doji",
    },
    {
      label: `5m RSI ${side === "LONG" ? "yükseliyor" : "düşüyor"}`,
      ok: r5 != null && r5p != null && (side === "LONG" ? r5 >= r5p : r5 <= r5p),
      detail: r5 == null ? "veri yok" : r5.toFixed(0),
    },
  ];
}

/**
 * Güven skoru — kapıyı GEÇMİŞ bir girişin ne kadar güçlü olduğunu anlatır.
 * Kapı zaten zorunlu olduğu için buradaki bileşenler artık "geçti/kaldı"
 * değil, "ne kadar iyi geçti" ölçüsüdür. Kara kutu değil: her bileşen
 * panelde tek tek görünür.
 */
function buildConfidence(
  bar: Bar, volRatio: number, risk: number, rsi1: number, rsi5: number
): { total: number; parts: ConfidencePart[] } {
  const parts: ConfidencePart[] = [{ label: "Kapı geçildi (taban)", value: 50 }];
  let total = 50;

  const bodyPts = Math.round(bodyRatio(bar) * 20);
  parts.push({ label: "1m mum gövde gücü", value: bodyPts });
  total += bodyPts;

  // Hacim ortalamanın 2 katına kadar puan verir
  const volPts = Math.round(Math.min(1, Math.max(0, volRatio - 1)) * 20);
  parts.push({ label: `Hacim fazlası (ort.×${volRatio.toFixed(2)})`, value: volPts });
  total += volPts;

  // RSI'ın 50'den uzaklığı — momentum ne kadar yerleşmiş
  const rsiPts = Math.round((Math.min(20, Math.abs(rsi5 - 50)) / 20) * 10);
  parts.push({ label: `5m RSI momentumu (${rsi5.toFixed(0)})`, value: rsiPts });
  total += rsiPts;

  const riskPts = -Math.round(risk * 15);
  parts.push({ label: "Trend kırılma riski", value: riskPts });
  total += riskPts;

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
  const m1Rsi = rsi(closes(m1), 14);
  const m5Rsi = rsi(closes(m5), 14);

  const candidates: EntryCandidate[] = [];

  let streakDir: StreakDir = "NONE";
  let streakLen = 0;
  let firedThisStreak = false;
  let m5Cursor = -1;
  /** En son değerlendirilen mumda hangi kapının engellediği — panel için */
  let lastBlock: string | null = null;

  for (let i = 1; i < m1.length; i++) {
    const bar = m1[i];
    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;

    const dir = candleDir(bar);
    if (dir === "NONE") {
      streakDir = "NONE"; streakLen = 0; firedThisStreak = false;
      continue;
    }
    if (dir === streakDir) streakLen++;
    else { streakDir = dir; streakLen = 1; firedThisStreak = false; }

    const p = nyParts(bar.time);
    const inWindow = p.ymd === session.date && p.minutes >= ENTRY_START_MIN && p.minutes < ENTRY_END_MIN;
    if (!inWindow) continue;
    if (streakLen !== ENTRY_STREAK || firedThisStreak) continue;

    const side: Side = streakDir === "UP" ? "LONG" : "SHORT";
    const gate = checkGate(m1, m5, m1Rsi, m5Rsi, i, m5Cursor, side);
    if (!gate.ok) { lastBlock = gate.blockedBy; continue; }

    firedThisStreak = true;
    const risk = trendBreakRisk(m1, i, side);
    const { total, parts } = buildConfidence(bar, gate.volRatio, risk, gate.rsi1, gate.rsi5);
    candidates.push({
      time: bar.time,
      side,
      spot: bar.close,
      contractType: "A",
      confidence: total,
      confidenceParts: parts,
      reasoning:
        `${ENTRY_STREAK} ardışık ${side === "LONG" ? "yükseliş" : "düşüş"} 1m mumu · ` +
        `hacim ort.×${gate.volRatio.toFixed(2)} · 1m RSI ${gate.rsi1.toFixed(0)} ${side === "LONG" ? "yükseliyor" : "düşüyor"} · ` +
        `5m mum ${side === "LONG" ? "yeşil" : "kırmızı"} · 5m RSI ${gate.rsi5.toFixed(0)} aynı yönde`,
    });
  }

  // ── Canlı okuma (son kapalı mumlar üzerinden, panel için) ────────
  const lastM1Idx = m1.length - 1;
  const lastM1 = lastM1Idx >= 0 ? m1[lastM1Idx] : null;
  const lastCandidate =
    candidates.length && lastM1 && candidates[candidates.length - 1].time === lastM1.time
      ? candidates[candidates.length - 1]
      : null;

  const dirWord = streakDir === "UP" ? "yükseliş" : "düşüş";
  const sideWord = streakDir === "UP" ? "LONG" : "SHORT";

  let state: EngineState = "WATCHING";
  let action: EngineRead["action"] = "BEKLE";
  let contractType: ContractType | null = null;
  let confidence = 40;
  let confidenceParts: ConfidencePart[] = [{ label: "Taban (seri yok)", value: 40 }];
  let reasoning = "Kurulum aranıyor — net yönlü mum serisi yok.";
  let stateLabel = "İZLEMEDE";
  let nextStep = `Arka arkaya ${ENTRY_STREAK} aynı yönlü 1m mum bekleniyor. Şu an yönlü seri yok.`;

  if (input.hasOpenPosition) {
    state = "IN_POSITION";
    stateLabel = "POZİSYONDA";
    nextStep = "Açık pozisyon taşınıyor — çıkış sinyali bekleniyor (Açık Pozisyon kutusuna bak).";
    reasoning = "Pozisyon açık; trend devam ettiği sürece taşınıyor.";
  } else if (lastCandidate) {
    state = "TRIGGERED";
    action = lastCandidate.side;
    contractType = lastCandidate.contractType;
    confidence = lastCandidate.confidence;
    confidenceParts = lastCandidate.confidenceParts;
    reasoning = lastCandidate.reasoning;
    stateLabel = lastCandidate.side === "LONG" ? "LONG GİRİŞ SİNYALİ" : "SHORT GİRİŞ SİNYALİ";
    nextStep = "Tüm kapılar geçildi — pozisyon açılıyor.";
  } else if (streakLen >= 1) {
    state = "ARMED";
    confidence = Math.min(55, 40 + streakLen * 5);
    confidenceParts = [
      { label: "Taban", value: 40 },
      { label: `${streakLen} mumluk seri`, value: confidence - 40 },
    ];
    const need = Math.max(0, ENTRY_STREAK - streakLen);
    reasoning = `${streakLen} ardışık ${dirWord} mumu.`;
    stateLabel = "HAZIRLANIYOR";
    nextStep =
      need > 0
        ? `${streakLen} ${dirWord} mumu oluştu. ${need} tane daha aynı yönde kapanmalı, ardından hacim + 1m RSI + 5m mum + 5m RSI kapıları da geçilirse ${sideWord} giriş açılır.`
        : lastBlock
        ? `Seri tamam ama kapı geçilemedi: ${lastBlock}. Yeni bir seri bekleniyor.`
        : `Seri ${streakLen} muma ulaştı, kapı kontrolü yapılıyor.`;
  }

  const m5RsiLast = m5Cursor >= 0 ? m5Rsi[m5Cursor] : null;
  const gateStatus: GateStatus = {
    long: gateChecksFor(m1, m5, m1Rsi, m5Rsi, lastM1Idx, m5Cursor, "LONG"),
    short: gateChecksFor(m1, m5, m1Rsi, m5Rsi, lastM1Idx, m5Cursor, "SHORT"),
  };

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
          : `RSI ${m5RsiLast.toFixed(1)} · 5m mum ${m5Cursor >= 0 ? (candleDir(m5[m5Cursor]) === "UP" ? "yeşil" : candleDir(m5[m5Cursor]) === "DOWN" ? "kırmızı" : "nötr") : "—"}`,
      m1StreakDir: streakDir,
      m1StreakLen: streakLen,
      m1Note: streakLen >= 1 ? `${streakLen} ardışık ${dirWord} 1m mumu` : "Net yönlü seri yok",
      action,
      contractType,
      state,
      stateLabel,
      nextStep,
      confidence,
      confidenceParts,
      reasoning,
      gateStatus,
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
  const { side, entryTime, session, nowSec } = input;
  const m1 = closedBars(input.m1, 1, nowSec);
  const m5 = closedBars(input.m5, 5, nowSec);
  const m1Rsi = rsi(closes(m1), 14);
  const m5Rsi = rsi(closes(m5), 14);
  const eodEpoch = eodEpochOf(session);
  /** Çıkış, girişin aynası: aynı onay seti TERS yönde aranır */
  const exitSide: Side = side === "LONG" ? "SHORT" : "LONG";

  let m5Cursor = -1;
  let against = 0;
  let barsHeld = 0;
  let bestSpot: number | null = null;
  let gateReady = false;          // ters seri tamam, onay seti bekleniyor
  let rsiSupportive: boolean | null = null;
  let lastBlock: string | null = null;

  const progressOf = (note: string): ExitProgress => ({
    againstBars: against,
    reversalNeeded: EXIT_REVERSAL_BARS,
    rsiSupportive,
    rsiArmed: gateReady,
    barsHeld,
    bestSpot,
    note,
  });

  for (let i = 1; i < m1.length; i++) {
    const bar = m1[i];
    if (bar.time <= entryTime) continue;

    while (m5Cursor + 1 < m5.length && m5[m5Cursor + 1].time + 300 <= bar.time + 60) m5Cursor++;
    barsHeld++;

    // Pozisyon lehine görülen en iyi seviye (şeffaflık — karar vermez)
    const favorable = side === "LONG" ? bar.high : bar.low;
    bestSpot = bestSpot == null ? favorable : side === "LONG" ? Math.max(bestSpot, favorable) : Math.min(bestSpot, favorable);

    // 1. 15:45 ET — mutlak öncelikli, hiçbir onay aranmaz
    if (bar.time >= eodEpoch) {
      return {
        signal: {
          time: bar.time, spot: bar.close, reason: "EOD_EXIT",
          note: "15:45 ET zorunlu 0DTE kapaması — diğer tüm kurallardan önceliklidir.",
        },
        progress: progressOf("Gün sonu kapaması."),
      };
    }

    // 5m RSI pozisyonu hâlâ destekliyor mu (yalnızca gösterge)
    if (m5Cursor >= 1) {
      const r5 = m5Rsi[m5Cursor], r5p = m5Rsi[m5Cursor - 1];
      rsiSupportive = r5 == null || r5p == null ? null : side === "LONG" ? r5 >= r5p : r5 <= r5p;
    }

    const dir = candleDir(bar);
    const isAgainst = side === "LONG" ? dir === "DOWN" : dir === "UP";
    if (isAgainst) against++;
    else if (dir !== "NONE") against = 0; // lehte mum seriyi sıfırlar; doji sayacı korur

    gateReady = against >= EXIT_REVERSAL_BARS;
    if (!gateReady) continue;

    // 2. ÇIKIŞ — girişin AYNI onay seti, ters yönde:
    //    mum paterni + hacim + 1m RSI yönü + 5m mum yönü + 5m RSI yönü
    const gate = checkGate(m1, m5, m1Rsi, m5Rsi, i, m5Cursor, exitSide);
    if (!gate.ok) { lastBlock = gate.blockedBy; continue; }

    return {
      signal: {
        time: bar.time, spot: bar.close, reason: "REVERSAL_EXIT",
        note:
          `${against} ardışık ters yönlü 1m mum + giriş onay setinin tamamı ters yönde: ` +
          `mum paterni · hacim ort.×${gate.volRatio.toFixed(2)} · 1m RSI ${gate.rsi1.toFixed(0)} · 5m mum ve 5m RSI ters yönde.`,
      },
      progress: progressOf("Ters yönlü onay setiyle kapandı."),
    };
  }

  const remaining = Math.max(0, EXIT_REVERSAL_BARS - against);
  return {
    signal: null,
    progress: progressOf(
      against >= EXIT_REVERSAL_BARS
        ? `${against} ters mum oluştu ama çıkış onayı tamamlanmadı: ${lastBlock ?? "onay bekleniyor"}.`
        : against > 0
        ? `${against} ardışık ters mum oluştu — ${remaining} tane daha ve ardından ters yönlü onay seti (patern + hacim + 1m/5m RSI) gerekiyor.`
        : "Trend devam ediyor — ters yönlü seri yok."
    ),
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
 * Aynı anda tek pozisyon + yeniden giriş (re-arm) + SAATLİK KOTA.
 *
 * Bir pozisyon kapandığında, o pozisyonun yönünün TERSİNE kapanan İLK 1m
 * mumu görülene kadar yeni aday kabul edilmez ("düzeltme mumu" beklenir).
 *
 * Saatlik kota bilinçli olarak BURADA uygulanır, `generateCandidates`
 * içinde değil: kota gerçekten AÇILAN pozisyonları saymalı, üretilip
 * çakışma yüzünden zaten elenen adayları değil. Ölçüm de bu sırayla
 * yapıldı; aksi hâlde canlı davranış ölçümden sapardı.
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
  const recent: number[] = []; // son 60 dakikadaki giriş zamanları

  for (const c of candidates) {
    if (c.time < blockedUntil) continue;

    while (recent.length && c.time - recent[0] > 3600) recent.shift();
    if (recent.length >= MAX_ENTRIES_PER_HOUR) continue;

    out.push(c);
    recent.push(c.time);

    const pos = posByKey.get(`${c.time}:${c.side}:${c.contractType}`);
    if (!pos || pos.exitTime == null) {
      // Pozisyon hâlâ açık veya sonucu bilinmiyor — sonrasındaki her şeyi blokla
      blockedUntil = Infinity;
      continue;
    }
    const correction = m1.find((b) => b.time > pos.exitTime! && candleDir(b) === (pos.side === "LONG" ? "DOWN" : "UP"));
    blockedUntil = correction ? correction.time : Infinity;
  }
  return out;
}

// ── Etiketler (UI) ────────────────────────────────────────────────

export const EVENT_LABEL: Record<EventKind, string> = {
  ENTRY: "Giriş",
  REVERSAL_EXIT: "Trend Kırılımı — Çıkış",
  EOD_EXIT: "Gün Sonu Kapama",
};

/** Kısa etiket — tablo hücreleri için */
export const EXIT_LABEL_SHORT: Record<ExitKind, string> = {
  REVERSAL_EXIT: "Trend Kırılımı",
  EOD_EXIT: "Gün Sonu",
};

/** Her olay tipinin kendi işareti ve rengi */
export const EVENT_STYLE: Record<EventKind, { color: string; shape: "arrowUp" | "arrowDown" | "circle" | "square"; glyph: string }> = {
  ENTRY:         { color: "#22c55e", shape: "arrowUp",   glyph: "▲" },
  REVERSAL_EXIT: { color: "#ef4444", shape: "arrowDown", glyph: "▼" },
  EOD_EXIT:      { color: "#94a3b8", shape: "square",    glyph: "■" },
};

export const CONTRACT_TONE: Record<ContractType, string> = {
  A: "#38bdf8",
  B: "#a855f7",
};
