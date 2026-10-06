/**
 * SPY Engine — Gün tipi (saf). DAVRANIŞ temelli: fiyatın VWAP'a göre gerçekte
 * ne yaptığına bakar. VIX yalnızca seans ÖNCESİ zayıf bir beklentidir ve
 * uyarı/etiket üretmez (eski VIX < 16 "SIKIŞMA RİSKİ" etiketi, 5 Ekim'in
 * %99'u VWAP üstünde geçen net trend gününde sürekli yanlış alarm verdi).
 *
 * Ölçüm (58 seans, SPY 5m, 11:30'da etiketlenip kalan gün izlendi):
 *   TREND   : kalan gün aralığı ort. 5,1 puan · fiyat kalan sürede VWAP'ın ters tarafında %31
 *   SIKIŞMA : kalan gün aralığı ort. 3,3 puan · ters tarafta %57
 *   KARIŞIK : 3,8 puan · %45
 * Yön devamı (trend yönünde kapanış) TREND'de %50–58 — etiket YÖN söylemez,
 * "bu gün hareketli/yönlü mü yoksa VWAP etrafında mı" söyler.
 */

import type { DaySeries } from "./openingMap";
import { r2 } from "./core";

export type DayTypeKind = "OLUŞUYOR" | "TREND" | "SIKIŞMA" | "KARIŞIK";

export interface DayTypeLive {
  kind: DayTypeKind;
  /** TREND iken baskın taraf: UP = VWAP üstü, DOWN = VWAP altı */
  side: "UP" | "DOWN" | null;
  /** Baskın tarafın payı (0-1) ve VWAP kesişim sayısı (09:30'dan beri) */
  sideFrac: number;
  crosses: number;
  /** Seans içindeki en uzak sapma (ATR₅ cinsinden) */
  maxExtATR: number | null;
  /** Son kapanışın VWAP'a uzaklığı (puan, işaretli) */
  devNow: number | null;
  bars: number;
  headline: string;
  text: string;
}

export const MIN_BARS_FOR_TYPE = 12; // 10:30

export function dayTypeLive(s5: DaySeries, atr5: number | null): DayTypeLive {
  const n = s5.bars.length;
  let up = 0, dn = 0, cr = 0, prev = 0, maxExt = 0;
  for (let i = 0; i < n; i++) {
    const v = s5.vwap[i];
    if (v == null) continue;
    const s = Math.sign(s5.bars[i].close - v);
    if (s > 0) up++;
    if (s < 0) dn++;
    if (prev && s && s !== prev) cr++;
    if (s) prev = s;
    if (atr5 && atr5 > 0) maxExt = Math.max(maxExt, Math.abs(s5.bars[i].close - v) / atr5);
  }
  const counted = up + dn;
  const frac = counted ? Math.max(up, dn) / counted : 0;
  const side: "UP" | "DOWN" = up >= dn ? "UP" : "DOWN";
  const lastV = n ? s5.vwap[n - 1] : null;
  const devNow = n && lastV != null ? r2(s5.bars[n - 1].close - lastV) : null;
  const base = { sideFrac: frac, crosses: cr, maxExtATR: atr5 ? Math.round(maxExt * 10) / 10 : null, devNow, bars: n };

  if (n < MIN_BARS_FOR_TYPE) {
    return {
      kind: "OLUŞUYOR", side: null, ...base,
      headline: "Gün tipi oluşuyor",
      text: `10:30'da (12 mum) netleşir. Şimdilik ${n} mum: %${Math.round(frac * 100)} ${side === "UP" ? "VWAP üstü" : "VWAP altı"}, ${cr} VWAP kesişimi.`,
    };
  }
  const pct = Math.round(frac * 100);
  const sideTxt = side === "UP" ? "VWAP üstünde" : "VWAP altında";
  if (frac >= 0.8 && (cr <= 2 || (frac >= 0.9 && cr <= 3))) {
    return {
      kind: "TREND", side, ...base,
      headline: `TREND GÜNÜ ${side === "UP" ? "▲ yukarı" : "▼ aşağı"}`,
      text: `Kapanışların %${pct}'i ${sideTxt}, ${cr} VWAP kesişimi${atr5 ? `, en uzak sapma ${maxExt.toFixed(1)}×ATR` : ""}. Geri çekilmeler VWAP/EMA20'ye kadar gelip trend devam ediyor — sağlıklı trend. Geçmişte bu günlerde kalan gün aralığı ort. 5,1 puan, fiyat VWAP'ın ters tarafında yalnızca %31 kaldı.`,
    };
  }
  if (cr >= 4 && frac < 0.7) {
    return {
      kind: "SIKIŞMA", side: null, ...base,
      headline: "SIKIŞMA · VWAP etrafında gidip geliyor",
      text: `${cr} VWAP kesişimi, kapanışların en çok %${pct}'i aynı tarafta. Geçmişte bu günlerde kalan gün aralığı ort. 3,3 puan (trend günlerinde 5,1), fiyat VWAP'ın ters tarafında %57 kaldı — dar aralıkta yön işlemi isabetsiz: bekle ya da uçlardan VWAP'a dönüş.`,
    };
  }
  return {
    kind: "KARIŞIK", side: null, ...base,
    headline: "KARIŞIK · trend teyitsiz",
    text: `Kapanışların %${pct}'i ${sideTxt}, ${cr} VWAP kesişimi — ne net trend ne net sıkışma. Taşıma yerine hedeflerde kâr al.`,
  };
}

/** Seans ÖNCESİ zayıf beklenti (VIX) — uyarı değil, bilgi. Seans başlayınca davranış (dayTypeLive) esas alınır. */
export function vixExpectation(vix: number | null): string | null {
  if (vix == null || !Number.isFinite(vix)) return null;
  if (vix >= 18) return `VIX ${vix.toFixed(1)} yüksek: geçmişte bu günlerde gün aralığı ort. 8,1 puan — geniş hareket beklentisi.`;
  if (vix >= 16) return `VIX ${vix.toFixed(1)}: geçmişte gün aralığı ort. 6,9 puan — normal/hareketli beklenti.`;
  return `VIX ${vix.toFixed(1)} düşük: geçmişte gün aralığı ort. 4,9 puan — dar aralık olasılığı biraz yüksek. Bu yalnızca beklenti; seans başlayınca gün tipi gerçek davranıştan (VWAP) belirlenir ve VIX'i geçersiz kılar (5 Ekim VIX < 16 iken net trend günüydü).`;
}
