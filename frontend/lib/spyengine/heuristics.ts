/**
 * SPY Engine — Reversal Score / Seller-Buyer Exhaustion / Edge Score
 * (Faz 3 + Faz 5, bkz. tasks/active/013).
 *
 * BUNLAR OLASILIK DEĞİL, SKORDUR. Ağırlıklar istatistiksel kalibrasyondan
 * DEĞİL sezgiden geliyor (tasks/active/013 §2.2'nin kendi eleştirisi) —
 * yeterli canlı veri birikene kadar (Faz 4, lojistik regresyon) arayüzde
 * HER ZAMAN "Skor: 67/100" olarak gösterilmeli, "%67 olasılık" olarak
 * ASLA. Bu dosyadaki hiçbir fonksiyon "probability" kelimesi taşıyan bir
 * alan döndürmez — bilinçli bir isimlendirme kararı.
 *
 * VIX ve SPX bilinçli olarak GİRDİ OLARAK KULLANILMIYOR (bkz.
 * tasks/active/013 §2.6-2.7): VIX 30 günlük ufku fiyatlıyor, 5 dakikalık
 * bir soruya yanlış ölçekte bir sinyal; SPX zaten SPY ile ~%99 korelasyonlu,
 * ek bilgi katmıyor. Bunun yerine motorun ZATEN HESAPLADIĞI RSI14/MACD/
 * EMA21 (Layer 1) ve RVOL (volatility.ts/strategy.ts) kullanılıyor —
 * ikinci bir kopya değil, aynı veriden üretilmiş bir okuma.
 */

import type { Bar } from "./core";
import type { Layer1Read, Side } from "./strategy";

// ── Normal dağılım CDF (BVC için) ───────────────────────────────────

/** Abramowitz-Stegun 7.1.26 yaklaşımı — yeterli hassasiyette, bağımlılıksız */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

// ── Bulk Volume Classification (BVC) ────────────────────────────────

export interface BarVolumeSplit {
  buyVolume: number;
  sellVolume: number;
  buyFraction: number;
}

/**
 * Bir barın hacmini alıcı/satıcı kaynaklı diye ikiye ayırır (Easley-López
 * de Prado BVC yöntemi). Tick verisi GEREKMEZ — bar kapanış-açılış
 * değişimini barın kendi volatilitesine (sigmaBar, KESİR olarak) göre
 * normalize edip standart normal CDF'den geçirir: mum ne kadar güçlü ve
 * "beklenenden" ne kadar büyük yükseldiyse, hacminin o kadar büyük kısmı
 * alıcı kaynaklı sayılır.
 */
export function bvcSplit(bar: Bar, sigmaBar: number | null): BarVolumeSplit {
  const volume = bar.volume || 0;
  if (sigmaBar == null || sigmaBar <= 0 || bar.open <= 0) {
    return { buyVolume: volume / 2, sellVolume: volume / 2, buyFraction: 0.5 };
  }
  const pctChange = (bar.close - bar.open) / bar.open;
  const z = pctChange / sigmaBar;
  const buyFraction = normCdf(z);
  return { buyVolume: volume * buyFraction, sellVolume: volume * (1 - buyFraction), buyFraction };
}

// ── Exhaustion (Katman 3 — "Skor", olasılık değil) ──────────────────

export interface ExhaustionRead {
  side: Side;
  /** 0-100 — karşıt yöndeki (LONG için satıcı, SHORT için alıcı) hacmin son barlarda ne kadar zayıfladığı */
  score: number;
  recentOpposingVolume: number;
  priorOpposingVolume: number;
  note: string;
}

const EXHAUSTION_LOOKBACK_BARS = 3;

/**
 * `side` yönünde bir dönüş aranırken KARŞIT tarafın (LONG için satıcı,
 * SHORT için alıcı) hacminin son N barda önceki N bara göre ne kadar
 * azaldığını ölçer. Azalma ne kadar büyükse skor o kadar yüksek — "karşı
 * taraf gücünü kaybediyor" sinyali. Yetersiz bar varsa nötr (50) döner.
 */
export function computeExhaustion(m5Bars: Bar[], sigmaBar: number | null, side: Side): ExhaustionRead {
  const need = EXHAUSTION_LOOKBACK_BARS * 2;
  if (m5Bars.length < need) {
    return { side, score: 50, recentOpposingVolume: 0, priorOpposingVolume: 0, note: "Yeterli 5m geçmişi yok — nötr" };
  }
  const splits = m5Bars.slice(-need).map((b) => bvcSplit(b, sigmaBar));
  // LONG dönüşü ararken SATICI hacmi (sellVolume), SHORT dönüşü ararken ALICI hacmi (buyVolume) izlenir
  const opposing = side === "LONG" ? splits.map((s) => s.sellVolume) : splits.map((s) => s.buyVolume);
  const prior = opposing.slice(0, EXHAUSTION_LOOKBACK_BARS);
  const recent = opposing.slice(EXHAUSTION_LOOKBACK_BARS);
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0);
  const priorAvg = avg(prior);
  const recentAvg = avg(recent);

  if (priorAvg <= 0) {
    return { side, score: 50, recentOpposingVolume: recentAvg, priorOpposingVolume: priorAvg, note: "Karşı taraf hacmi ölçülemedi — nötr" };
  }
  const fade = (priorAvg - recentAvg) / priorAvg; // >0 = karşı taraf hacmi azalıyor
  const score = Math.max(0, Math.min(100, 50 + fade * 50));
  const opposingWord = side === "LONG" ? "satıcı" : "alıcı";
  return {
    side, score, recentOpposingVolume: recentAvg, priorOpposingVolume: priorAvg,
    note: fade > 0
      ? `${opposingWord} hacmi son ${EXHAUSTION_LOOKBACK_BARS} barda %${(fade * 100).toFixed(0)} azaldı — tükenme sinyali`
      : `${opposingWord} hacmi hâlâ güçlü — tükenme yok`,
  };
}

// ── Reversal Score (Katman 3 — "Skor", olasılık değil) ──────────────

export interface ReversalScoreParts {
  label: string;
  value: number;
}

export interface ReversalScoreRead {
  side: Side;
  score: number;
  parts: ReversalScoreParts[];
  note: string;
}

/**
 * `side` yönünde bir dönüş için sezgisel skor. Ağırlıklar İSTATİSTİKSEL
 * DEĞİL (bkz. dosya başlığı) — motorun zaten hesapladığı Layer 1
 * (RSI14/MACD/EMA21) + RVOL + BVC tükenme skorundan üretilir. VIX/SPX
 * BİLİNÇLİ OLARAK kullanılmaz.
 */
export function computeReversalScore(
  layer1: Layer1Read, rvol: number | null, exhaustion: ExhaustionRead, side: Side
): ReversalScoreRead {
  const isLong = side === "LONG";
  const parts: ReversalScoreParts[] = [{ label: "Taban", value: 30 }];
  let total = 30;

  // RSI14 (5m) — asiri satim/alimdan donus
  const rsi = layer1.rsi;
  let rsiPts = 0;
  if (rsi != null) {
    if (isLong && rsi < 40) rsiPts = Math.round(((40 - rsi) / 40) * 20);
    if (!isLong && rsi > 60) rsiPts = Math.round(((rsi - 60) / 40) * 20);
  }
  parts.push({ label: `RSI14 ${rsi == null ? "veri yok" : rsi.toFixed(0)}`, value: rsiPts });
  total += rsiPts;

  // MACD histogram yon degisimi (Layer1'in kendi rising/falling bayraklari)
  const macdPts = isLong ? (layer1.macdRising ? 15 : 0) : (layer1.macdFalling ? 15 : 0);
  parts.push({ label: `MACD histogram ${isLong ? "yükseliyor" : "düşüyor"}`, value: macdPts });
  total += macdPts;

  // RVOL — donus mumunun hacim katilimi
  let rvolPts = 0;
  if (rvol != null) rvolPts = Math.round(Math.max(0, Math.min(1, (rvol - 1) / 1.5)) * 15);
  parts.push({ label: `RVOL ${rvol == null ? "veri yok" : `${rvol.toFixed(2)}×`}`, value: rvolPts });
  total += rvolPts;

  // BVC tukenme skoru
  const exhaustionPts = Math.round(((exhaustion.score - 50) / 50) * 20);
  parts.push({ label: `${side === "LONG" ? "Satıcı" : "Alıcı"} tükenmesi ${exhaustion.score.toFixed(0)}/100`, value: exhaustionPts });
  total += exhaustionPts;

  const clamped = Math.max(0, Math.min(100, total));
  return {
    side, score: clamped, parts,
    note: `Skor — olasılık DEĞİL, kalibre edilmemiş sezgisel gösterge (bkz. tasks/active/013 Faz 4)`,
  };
}

// ── Edge Score (Katman 5 — sürekli, hard-gate değil) ────────────────

export interface EdgeScoreInput {
  /** Katman 1: Monte Carlo erişim olasılığı (0-1) o seviyeye */
  touchProbability: number;
  /** Katman 2: opsiyon delta-örtük olasılık (0-1), yoksa null */
  marketImpliedProbability: number | null;
  /** Katman 3: ilgili yöndeki Reversal Score (0-100) */
  reversalScore: number;
}

/**
 * Katman 1-3'ü TEK, SÜREKLİ bir 0-100 skora birleştirir. Sabit bir
 * "NO TRADE" bandı YOK (tasks/active/013 §2.8) — düşük skorlu bölgeler
 * arayüzde sadece görsel olarak sönük gösterilir, sistem hiçbir zaman
 * "kör" olmaz. Ağırlıklar (0.4/0.3/0.3) da Reversal Score gibi sezgiseldir.
 */
export function computeEdgeScore(input: EdgeScoreInput): number {
  const marketPts = input.marketImpliedProbability != null ? input.marketImpliedProbability * 100 : input.touchProbability * 100;
  const raw = 0.4 * (input.touchProbability * 100) + 0.3 * marketPts + 0.3 * input.reversalScore;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
