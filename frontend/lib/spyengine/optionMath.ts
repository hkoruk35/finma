/**
 * SPY Engine — opsiyon matematiği (saf, izomorfik).
 *
 * Black-Scholes delta/greeks + zaman-değeri yardımcıları. spy_0dte_options_sync.py
 * içindeki bs_greeks ile BİREBİR aynı formül (norm_cdf, d1/d2) — Python tarafı
 * Greeks'i Supabase'e yazarken, buradaki TS eşdeğeri opsiyon zinciri route'unda
 * Yahoo'nun IV'sinden delta üretir. IV yoksa delta null döner (uydurma yok).
 */

/** Standart normal CDF — Abramowitz & Stegun 7.1.26 yaklaşımı (Python norm_cdf ile aynı). */
export function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function erf(x: number): number {
  // A&S 7.1.26 — |hata| < 1.5e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/**
 * Black-Scholes delta. T yıl cinsinden (gün/365). sigma = yıllık IV (0.15 = %15).
 * r risksiz faiz (varsayılan 0.045). Girdi geçersizse null.
 */
export function bsDelta(
  isCall: boolean,
  S: number,
  K: number,
  tYears: number,
  sigma: number,
  r = 0.045
): number | null {
  if (!(S > 0) || !(K > 0) || !(sigma > 0) || !(tYears > 0)) return null;
  const sq = sigma * Math.sqrt(tYears);
  if (sq === 0) return null;
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * tYears) / sq;
  return isCall ? normCdf(d1) : normCdf(d1) - 1;
}

/** Opsiyonun içsel değeri (ITM kısmı). */
export function intrinsicValue(isCall: boolean, spot: number, strike: number): number {
  return isCall ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
}

/** Zaman değeri = prim − içsel değer (negatifse 0'a kırpılır). */
export function timeValue(premium: number, isCall: boolean, spot: number, strike: number): number {
  return Math.max(0, premium - intrinsicValue(isCall, spot, strike));
}

/** Zaman değeri / prim oranı (v2 strike filtresi: < %35). */
export function timeValueRatio(premium: number, isCall: boolean, spot: number, strike: number): number | null {
  if (!(premium > 0)) return null;
  return timeValue(premium, isCall, spot, strike) / premium;
}
