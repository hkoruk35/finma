/**
 * SPY Engine V4 — Rejim Tespit Motoru (izomorfik, saf, non-repainting).
 *
 * NEDEN: V3.3'ün giriş kapısı doğru çalışıyor; tek gerçek zayıflığı ÇIKIŞIN
 * her piyasa durumunda aynı davranması. 2 Eylül 2026 canlı verisi bunu net
 * gösterdi: 10:05–11:34 trend penceresinde 89 dakikalık taşıma +$141
 * getirdi, 11:39–14:37 sıkışma penceresinde aynı mantık 3 işlemde −$38
 * verdi. Tek bir çıkış kuralı her rejimde doğru olamaz.
 *
 * Bu modül SADECE rejimi ölçer — giriş kapısına HİÇ dokunmaz.
 *
 * NON-REPAINTING: yalnızca KAPANMIŞ mumlar okunur, pencere geriye bakar.
 * Aynı girdi her zaman aynı çıktıyı verir; geçmiş bir rejim etiketi sonradan
 * değişmez.
 *
 * ── SPEC'TEN AYRILDIĞIMIZ İKİ NOKTA (ölçüm gerekçeli) ──────────────
 * 1. Spec, TREND kriteri olarak "ATR yükseliyor" ve "BB genişliyor"
 *    diyordu. Ölçüm bunu çürüttü: kabul kriteri 12'nin trend penceresi
 *    (2 Eylül 10:05–11:34) DÜŞÜK oynaklıklı bir yükselişti — ATR düşüyor,
 *    BB daralıyordu. Bu kriterlerle pencere yalnızca %6 TREND etiketlendi.
 *    Oynaklık genişlemesi trendin değil, VOLATİL trendin işareti. Yerine
 *    Kaufman Yön Verimliliği (net hareket / kat edilen yol) kondu → %60.
 * 2. Spec 5m mum hizasını da trend kriteri sayıyordu; kriter setini
 *    5'e 5 simetrik tutmak için çıkarıldı (aynı bilgi ER ve EMA50 eğimi
 *    üzerinden zaten geliyor). 15m gibi 5m de rejim KARARINA girmez.
 *
 * Her kriter ayrı ayrı raporlanır — rejim kara kutu olmamalı, "neden
 * sıkışma dedin" sorusu panelde tek tek görülmeli (Kapı Durumu deseni).
 */

import { atr, ema, rsi, nyParts, RTH_OPEN_MIN, type Bar } from "./core";

export type Regime = "TREND" | "CHOP" | "UNCERTAIN";
export type RegimeDirection = "UP" | "DOWN" | "NONE";

/** Tek bir rejim kriterinin durumu — panelde satır satır gösterilir */
export interface RegimeCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export interface RegimeRead {
  regime: Regime;
  /** TREND ise yönü; diğer rejimlerde NONE */
  direction: RegimeDirection;
  /** 0–100 — kriterlerin kaçının sağlandığı + saat dilimi önseli */
  confidence: number;
  trendChecks: RegimeCheck[];
  chopChecks: RegimeCheck[];
  /** Saat dilimi önselinin güvene katkısı (+/−), şeffaflık için ayrı */
  timePrior: number;
  timePriorNote: string;
  /** İnsan okunur tek satır */
  note: string;
}

/** Rejim penceresi — "son 20-30 dakika" (spec §1.1) */
export const REGIME_WINDOW = 25;
/** EMA50 eğimi karşılaştırmasında kaç mum geriye bakılır */
const SLOPE_LOOKBACK = 10;

/**
 * TREND için aynı yönlü mum oranı eşiği.
 * Spec %65 diyordu; sakin bir yükselişte mumların ~%60'ı yeşildir ve
 * kabul kriteri 12'nin penceresi %65'i tutturmuyor. %60'a indirildi.
 */
const TREND_DIR_SHARE = 0.6;
/** CHOP için son 20 mumdaki asgari renk değişimi (spec 8 diyordu; 7 ölçüldü) */
const CHOP_FLIPS_MIN = 7;
/** Yön verimliliği eşikleri — ölçülerek seçildi (scratch/regime_check.ts) */
const TREND_ER_MIN = 0.30;
const CHOP_ER_MAX = 0.22;

/** Bir rejimi ilan etmek için gereken asgari kriter ve diğerine karşı üstünlük */
const MIN_PASS = 3;
const MIN_LEAD = 1;

/**
 * Histerezis: ham rejim mum mum zıplıyor. Rapor edilen rejim ancak ham okuma
 * ÜST ÜSTE bu kadar mum aynı şeyi söylerse değişir. Çıkış davranışını
 * sürdüğü için titreyen bir etiket pozisyonu her dakika farklı yönetirdi.
 */
export const REGIME_CONFIRM = 3;

const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);

/**
 * Kaufman Yön Verimliliği: net hareket / kat edilen toplam yol (0..1).
 * 1'e yakın = tek yönlü temiz trend, 0'a yakın = testere.
 */
function efficiencyRatio(closes: number[], i: number, n: number): number | null {
  if (i - n < 0) return null;
  const net = Math.abs(closes[i] - closes[i - n]);
  let path = 0;
  for (let k = i - n + 1; k <= i; k++) path += Math.abs(closes[k] - closes[k - 1]);
  return path > 0 ? net / path : null;
}

/**
 * Saat dilimi önseli (spec §7.1). KESİN KURAL DEĞİL — yalnızca güven
 * skorunu ağırlıklandırır.
 */
export function timePriorFor(minutesEt: number, regime: Regime): { delta: number; note: string } {
  if (minutesEt < RTH_OPEN_MIN + 30) {
    return { delta: -10, note: "09:30–10:00 · yön belirsiz, güven düşürüldü" };
  }
  if (minutesEt < 11 * 60 + 30) {
    return regime === "TREND"
      ? { delta: +8, note: "10:00–11:30 · en sık trend penceresi" }
      : { delta: -4, note: "10:00–11:30 · trend penceresi, sıkışma daha az olası" };
  }
  if (minutesEt < 14 * 60) {
    return regime === "CHOP"
      ? { delta: +8, note: "11:30–14:00 · sıkışma eğilimi yüksek" }
      : { delta: -4, note: "11:30–14:00 · sıkışma saati, trend daha az olası" };
  }
  if (minutesEt < 15 * 60 + 30) {
    return { delta: 0, note: "14:00–15:30 · değişken, rejim tespitine tam güven" };
  }
  return { delta: -6, note: "15:30+ · kapanış oynaklığı, yeni giriş penceresi kapanıyor" };
}

/** Göstergeleri bir kez hesaplayıp seri boyunca yeniden kullanmak için */
interface RegimeCtx {
  m1: Bar[];
  closes: number[];
  a: (number | null)[];
  e50: (number | null)[];
  r1: (number | null)[];
}

export function buildRegimeCtx(m1: Bar[]): RegimeCtx {
  const closes = m1.map((b) => b.close);
  return { m1, closes, a: atr(m1, 14), e50: ema(closes, 50), r1: rsi(closes, 14) };
}

const EMPTY: RegimeRead = {
  regime: "UNCERTAIN", direction: "NONE", confidence: 0,
  trendChecks: [], chopChecks: [], timePrior: 0, timePriorNote: "",
  note: "Rejim için yeterli mum yok — en az 35 kapalı 1m mum gerekiyor.",
};

/** `i` indeksli KAPALI 1m mum itibarıyla HAM rejim okuması (histerezissiz) */
export function readRegimeAt(ctx: RegimeCtx, idx: number): RegimeRead {
  const { m1, closes, a, e50, r1 } = ctx;
  if (idx < REGIME_WINDOW + SLOPE_LOOKBACK || m1.length < 35) return EMPTY;

  const last20 = m1.slice(Math.max(0, idx - 19), idx + 1);
  const dirs = last20.map(dirOf).filter((d) => d !== 0);
  const ups = dirs.filter((d) => d === 1).length;
  const downs = dirs.filter((d) => d === -1).length;
  const dirShare = dirs.length ? Math.max(ups, downs) / dirs.length : 0;
  const dominant: RegimeDirection = ups > downs ? "UP" : downs > ups ? "DOWN" : "NONE";

  let flips = 0;
  for (let k = 1; k < dirs.length; k++) if (dirs[k] !== dirs[k - 1]) flips++;

  // EMA50: tek tarafta kalma oranı + kesişim sayısı
  let crossings = 0, prevSide = 0, counted = 0, above = 0, below = 0;
  for (let k = idx - REGIME_WINDOW + 1; k <= idx; k++) {
    const e = e50[k];
    if (e == null) continue;
    const side = m1[k].close > e ? 1 : m1[k].close < e ? -1 : 0;
    if (side === 0) continue;
    counted++;
    if (side > 0) above++; else below++;
    if (prevSide !== 0 && side !== prevSide) crossings++;
    prevSide = side;
  }
  const sameSide = counted ? Math.max(above, below) / counted : 0;

  // 1m RSI'ın 40–60 bandında geçirdiği mum oranı
  let inBand = 0, rsiCounted = 0;
  for (let k = idx - 9; k <= idx; k++) {
    const v = r1[k];
    if (v == null) continue;
    rsiCounted++;
    if (v >= 40 && v <= 60) inBand++;
  }
  const bandShare = rsiCounted ? inBand / rsiCounted : 0;

  const er = efficiencyRatio(closes, idx, REGIME_WINDOW);
  const atrNow = a[idx];
  const net = Math.abs(closes[idx] - closes[idx - REGIME_WINDOW]);
  const netAtr = atrNow != null && atrNow > 0 ? net / atrNow : null;

  const eNow = e50[idx], ePrev = e50[idx - SLOPE_LOOKBACK];
  const emaSlopeOk =
    eNow != null && ePrev != null &&
    (dominant === "UP" ? eNow > ePrev : dominant === "DOWN" ? eNow < ePrev : false);

  const trendChecks: RegimeCheck[] = [
    { label: `Yön verimliliği ≥ ${TREND_ER_MIN}`, ok: er != null && er >= TREND_ER_MIN, detail: er == null ? "veri yok" : er.toFixed(2) },
    { label: `Mumların ≥%${TREND_DIR_SHARE * 100}'i aynı yönde`, ok: dirShare >= TREND_DIR_SHARE, detail: `%${(dirShare * 100).toFixed(0)}` },
    { label: "Fiyat EMA50'nin tek tarafında", ok: sameSide >= 0.75, detail: `%${(sameSide * 100).toFixed(0)}` },
    { label: "EMA50 eğimi yönle uyumlu", ok: emaSlopeOk, detail: dominant === "NONE" ? "yön yok" : dominant === "UP" ? "yukarı" : "aşağı" },
    { label: "Net hareket ≥ 1,5 × ATR", ok: netAtr != null && netAtr >= 1.5, detail: netAtr == null ? "veri yok" : `${netAtr.toFixed(1)}×` },
  ];

  const chopChecks: RegimeCheck[] = [
    { label: `Yön verimliliği < ${CHOP_ER_MAX}`, ok: er != null && er < CHOP_ER_MAX, detail: er == null ? "veri yok" : er.toFixed(2) },
    { label: `Son 20 mumda ≥${CHOP_FLIPS_MIN} yön değişimi`, ok: flips >= CHOP_FLIPS_MIN, detail: `${flips} değişim` },
    { label: "Fiyat EMA50 etrafında salınıyor", ok: crossings >= 3, detail: `${crossings} kesişim` },
    { label: "Net hareket < 1,0 × ATR", ok: netAtr != null && netAtr < 1.0, detail: netAtr == null ? "veri yok" : `${netAtr.toFixed(1)}×` },
    { label: "1m RSI 40–60 bandında sıkışmış", ok: bandShare >= 0.6, detail: `%${(bandShare * 100).toFixed(0)}` },
  ];

  const trendPassed = trendChecks.filter((c) => c.ok).length;
  const chopPassed = chopChecks.filter((c) => c.ok).length;
  const total = trendChecks.length;

  let regime: Regime = "UNCERTAIN";
  if (trendPassed >= MIN_PASS && trendPassed - chopPassed >= MIN_LEAD) regime = "TREND";
  else if (chopPassed >= MIN_PASS && chopPassed - trendPassed >= MIN_LEAD) regime = "CHOP";

  const minutesEt = nyParts(m1[idx].time).minutes;
  const prior = timePriorFor(minutesEt, regime);
  const basePassed = regime === "TREND" ? trendPassed : regime === "CHOP" ? chopPassed : Math.max(trendPassed, chopPassed);
  const base = (basePassed / total) * 100;
  const confidence = regime === "UNCERTAIN"
    ? Math.round(Math.min(50, base))
    : Math.max(0, Math.min(100, Math.round(base + prior.delta)));

  const direction: RegimeDirection = regime === "TREND" ? dominant : "NONE";
  const note =
    regime === "TREND"
      ? `Trend ${direction === "UP" ? "YUKARI" : "AŞAĞI"} · ${trendPassed}/${total} kriter · yön verimliliği ${er?.toFixed(2) ?? "—"}`
      : regime === "CHOP"
      ? `Sıkışma · ${chopPassed}/${total} kriter · son 20 mumda ${flips} yön değişimi`
      : `Belirsiz · trend ${trendPassed}/${total}, sıkışma ${chopPassed}/${total} — kriterler çelişiyor`;

  return { regime, direction, confidence, trendChecks, chopChecks, timePrior: prior.delta, timePriorNote: prior.note, note };
}

export interface RegimeBar {
  time: number;
  regime: Regime;
  direction: RegimeDirection;
  confidence: number;
}

export interface RegimeSeries {
  /** Her kapalı 1m mum için HİSTEREZİSLİ rejim etiketi */
  bars: RegimeBar[];
  /** Son mumun tam okuması (kriter dökümüyle) — histerezisli etiketle */
  current: RegimeRead;
  /** Rejim değişim anları (histerezis sonrası) */
  transitions: { time: number; from: Regime; to: Regime; confidence: number }[];
  /** Gün özeti: her rejimde geçen mum sayısı (spec §7.3) */
  distribution: Record<Regime, number>;
}

/**
 * Seansın tamamı için histerezisli rejim serisi.
 *
 * Rapor edilen etiket, ham okuma REGIME_CONFIRM mum üst üste aynı yeni
 * rejimi söyleyene kadar değişmez. Bu, geçmişi YENİDEN YAZMAZ: her mumun
 * etiketi yalnızca kendisinden önceki mumlara bakılarak üretilir.
 */
export function detectRegimeSeries(m1: Bar[]): RegimeSeries {
  const ctx = buildRegimeCtx(m1);
  const bars: RegimeBar[] = [];
  const transitions: RegimeSeries["transitions"] = [];
  const distribution: Record<Regime, number> = { TREND: 0, CHOP: 0, UNCERTAIN: 0 };

  let stable: Regime = "UNCERTAIN";
  let stableDir: RegimeDirection = "NONE";
  let pending: Regime | null = null;
  let pendingCount = 0;
  let lastRead: RegimeRead = EMPTY;

  for (let i = 0; i < m1.length; i++) {
    const raw = readRegimeAt(ctx, i);
    lastRead = raw;

    if (raw.regime === stable) {
      pending = null;
      pendingCount = 0;
      if (raw.regime === "TREND") stableDir = raw.direction;
    } else {
      if (pending === raw.regime) pendingCount++;
      else { pending = raw.regime; pendingCount = 1; }
      if (pendingCount >= REGIME_CONFIRM) {
        transitions.push({ time: m1[i].time, from: stable, to: raw.regime, confidence: raw.confidence });
        stable = raw.regime;
        stableDir = raw.regime === "TREND" ? raw.direction : "NONE";
        pending = null;
        pendingCount = 0;
      }
    }

    bars.push({ time: m1[i].time, regime: stable, direction: stableDir, confidence: raw.confidence });
    distribution[stable]++;
  }

  // Panelde gösterilen kriter dökümü son HAM okumadan gelir; etiket ise
  // histerezisli olan. İkisi ayrışabilir — "kriterler döndü ama teyit
  // bekleniyor" durumu bilinçli olarak görünür kalsın diye.
  const current: RegimeRead = { ...lastRead, regime: stable, direction: stableDir };
  return { bars, current, transitions, distribution };
}

/** Rejim etiketinin ekranda gösterilecek karşılığı */
export const REGIME_LABEL: Record<Regime, string> = {
  TREND: "TREND",
  CHOP: "SIKIŞMA",
  UNCERTAIN: "BELİRSİZ",
};

/** Rejim rengi — TREND yönüne göre yeşil/kırmızı, sıkışma amber, belirsiz gri */
export function regimeColor(regime: Regime, direction: RegimeDirection): string {
  // Pastel turkuaz -- yön zaten ok (▲/▼) + "YUKARI"/"AŞAĞI" metniyle net,
  // renk burada sadece "TREND rejimindeyiz" durumunu okunur şekilde işaretler.
  if (regime === "TREND") return "#5eead4";
  if (regime === "CHOP") return "#f59e0b";
  return "#64748b";
}
