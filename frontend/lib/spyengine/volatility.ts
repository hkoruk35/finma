/**
 * SPY Engine — Gerçekleşen volatilite + gün-içi mevsimsellik (Faz 1,
 * bkz. tasks/active/013).
 *
 * Monte Carlo modülünün TEK girdisi budur. VIX BİLİNÇLİ OLARAK
 * kullanılmıyor — VIX 30 günlük İMA EDİLEN volatiliteyi fiyatlar, 5
 * dakikalık bir ufka uygulamak yanlış ölçekte bir sinyal demektir (bkz.
 * tasks/active/013 §2.6). Bunun yerine:
 *   1) Son birkaç saatin GERÇEKLEŞEN (realized) log-getiri oynaklığı,
 *   2) çok günlük geçmişten türetilen GÜN-İÇİ MEVSİMSELLİK çarpanı
 *      (açılış/kapanışta yüksek, öğlen durgunluğunda düşük — U şekli)
 * çarpılarak "şu an, bu dakika için" bir sigma üretilir.
 *
 * Mevsimsellik profili RVOL baseline'ıyla (strategy.ts) AYNI çok günlü 5m
 * veri setini (fetchSpy5mHistory) kullanır — ayrı bir veri çekimi YOK.
 *
 * Uydurma yok: örneklem yetersizse (`SEASONALITY_MIN_SAMPLE_DAYS`den az
 * gün, veya `REALIZED_VOL_WINDOW_BARS`e yakın kapalı bar yok) ilgili değer
 * `null` döner ya da çarpan nötr (1) kalır — asla icat edilmiş bir şekil
 * dayatılmaz.
 */

import { nyParts, type Bar } from "./core";

/** Gerçekleşen volatilite penceresi — ~6,5 saat (tam bir RTH günü), 5m bar */
export const REALIZED_VOL_WINDOW_BARS = 78;
/** Mevsimsellik bucket genişliği — RVOL ile aynı hizada */
export const SEASONALITY_BUCKET_MIN = 5;
/** Mevsimsellik güvenilir sayılmadan önce gereken asgari geçmiş gün sayısı */
export const SEASONALITY_MIN_SAMPLE_DAYS = 10;

function logReturns(closes: number[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) out.push(Math.log(closes[i] / closes[i - 1]));
  }
  return out;
}

function stdev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Son N kapalı 5m barın log-getiri standart sapması — "bir 5m adımlık"
 * HAM gerçekleşen volatilite (henüz mevsimsellikle ayarlanmamış). En az
 * 20 bar yoksa `null` — güvenilmez bir örneklemden sigma üretilmez.
 */
export function realizedVolPerBar(m5Closed: Bar[], window: number = REALIZED_VOL_WINDOW_BARS): number | null {
  if (m5Closed.length < 20) return null;
  const slice = m5Closed.slice(-Math.min(window, m5Closed.length));
  return stdev(logReturns(slice.map((b) => b.close)));
}

export interface SeasonalityProfile {
  /** bucket (ET gün-içi dakika, SEASONALITY_BUCKET_MIN'e hizalı) → o dilimin ortalama |log-getiri| büyüklüğü */
  bucketAvgAbsReturn: Map<number, number>;
  bucketDays: Map<number, number>;
  /** tüm bucket'ların ortalaması — normalize etmek için referans */
  overallAvg: number | null;
}

export const EMPTY_SEASONALITY: SeasonalityProfile = { bucketAvgAbsReturn: new Map(), bucketDays: new Map(), overallAvg: null };

/**
 * Çok günlü 5m geçmişinden gün-içi mevsimsellik profili kurar. Getiriler
 * GÜN SINIRLARI İÇİNDE hesaplanır (bir günün son barından ertesi günün
 * ilk barına sahte bir "gece getirisi" sızmasın diye), `excludeDate`
 * (bugünkü/canlı seans) hariç tutulur.
 */
export function buildSeasonalityProfile(history: Bar[], excludeDate: string): SeasonalityProfile {
  const sums = new Map<number, number>();
  const counts = new Map<number, number>();
  const daysSeen = new Map<number, Set<string>>();

  const byDay = new Map<string, Bar[]>();
  for (const b of history) {
    const p = nyParts(b.time);
    if (p.ymd === excludeDate) continue;
    if (!byDay.has(p.ymd)) byDay.set(p.ymd, []);
    byDay.get(p.ymd)!.push(b);
  }

  for (const [, dayBars] of byDay) {
    dayBars.sort((a, b) => a.time - b.time);
    for (let i = 1; i < dayBars.length; i++) {
      if (dayBars[i].close <= 0 || dayBars[i - 1].close <= 0) continue;
      const ret = Math.abs(Math.log(dayBars[i].close / dayBars[i - 1].close));
      const p = nyParts(dayBars[i].time);
      const bucket = Math.floor(p.minutes / SEASONALITY_BUCKET_MIN) * SEASONALITY_BUCKET_MIN;
      sums.set(bucket, (sums.get(bucket) ?? 0) + ret);
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
      if (!daysSeen.has(bucket)) daysSeen.set(bucket, new Set());
      daysSeen.get(bucket)!.add(p.ymd);
    }
  }

  const bucketAvgAbsReturn = new Map<number, number>();
  const bucketDays = new Map<number, number>();
  let totalSum = 0, totalCount = 0;
  for (const [bucket, sum] of sums) {
    const n = counts.get(bucket) ?? 1;
    bucketAvgAbsReturn.set(bucket, sum / n);
    bucketDays.set(bucket, daysSeen.get(bucket)?.size ?? 0);
    totalSum += sum;
    totalCount += n;
  }
  const overallAvg = totalCount > 0 ? totalSum / totalCount : null;

  return { bucketAvgAbsReturn, bucketDays, overallAvg };
}

/**
 * Belirli bir an için mevsimsellik çarpanı: >1 açılış/kapanış gibi hareketli
 * dilimlerde, <1 öğlen durgunluğunda. Yetersiz veri varsa NÖTR (1) döner —
 * hiçbir zaman uydurma bir şekil dayatılmaz.
 */
export function seasonalityMultiplierAt(
  profile: SeasonalityProfile, unixSec: number
): { multiplier: number; sampleDays: number } {
  const p = nyParts(unixSec);
  const bucket = Math.floor(p.minutes / SEASONALITY_BUCKET_MIN) * SEASONALITY_BUCKET_MIN;
  const bucketAvg = profile.bucketAvgAbsReturn.get(bucket);
  const days = profile.bucketDays.get(bucket) ?? 0;
  if (bucketAvg == null || profile.overallAvg == null || profile.overallAvg <= 0 || days < SEASONALITY_MIN_SAMPLE_DAYS) {
    return { multiplier: 1, sampleDays: days };
  }
  return { multiplier: bucketAvg / profile.overallAvg, sampleDays: days };
}
