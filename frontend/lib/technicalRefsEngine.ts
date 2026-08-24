// Teknik Referans (Technical Refs) motoru — Swing / Position / Investment
// ufuklarına göre giriş bölgesi, stop, T1-T3, R/R ve trailing kuralı üretir.
//
// Bu dosya, components/DeepAnalysisReport.tsx içinde tanımlı olan (ve şu an
// admin-only /admin/analysis/[ticker] raporunda kullanılan) `tradePlan()`
// fonksiyonunun BİREBİR aynısıdır — 2026-08-24'te buraya taşındı ki hem
// admin raporu hem de public /global/{locale}/graphic/{ticker} sayfasındaki
// TickerTechnicalRefsPanel AYNI hesaplamayı kullansın (tek kaynak, veri
// tutarsızlığı riski yok). Mantığı DEĞİŞTİRMEDEN taşındı.

import { formatNumber } from "@/lib/formatNumber";

export type TechRefsLocale = "tr" | "en" | "es" | "fr" | "pt" | "id";
export type TechRefsHorizon = "swing" | "position" | "investment";

export interface TechnicalRefsPlan {
  timeframe: string;
  entry: number;
  entryLow: number;
  entryHigh: number;
  stop: number;
  t1: number;
  t2: number;
  t3: number | null;
  rr1: number;
  rr2: number;
  invalidation: number;
  anchor: string;
  trailRule: string;
  waitWarning: string | null;
}

const L = (lang: TechRefsLocale | string, tr: string, en: string, es?: string, fr?: string) =>
  lang === "tr" ? tr : lang === "es" ? (es || en) : lang === "fr" ? (fr || en) : en;

function fmtUsd(v: number) {
  return "$" + formatNumber(v, 2);
}

export function computeTechnicalRefs(
  rd: any,
  sr: any,
  horizon: TechRefsHorizon,
  lang: TechRefsLocale
): TechnicalRefsPlan {
  const price = rd.currentPrice || 100;

  // Defensive: enforce supports below price, resistances above
  const s1 = Math.min(sr.support1 || price * 0.95, price * 0.98);
  const s2 = Math.min(sr.support2 || price * 0.91, price * 0.95);
  const r1raw = sr.resistance1 || 0;
  const r2raw = sr.resistance2 || 0;
  const r3raw = sr.resistance3 || 0;
  const r1 = Math.max(r1raw > price * 0.99 ? r1raw : 0, price * 1.04);
  const r2 = Math.max(r2raw > price * 0.99 ? r2raw : 0, price * 1.09);
  const r3 = Math.max(r3raw > price * 0.99 ? r3raw : 0, price * 1.15);

  const ema20 = rd.ema20 || price;
  const ema50 = rd.ema50 || price * 0.97;
  const ema200 = rd.ema200 || price * 0.93;
  const low52 = rd.low52w || price * 0.7;
  const high52 = Math.max(rd.high52w || 0, price * 1.1);
  const atr = rd.atr || price * 0.02;

  if (horizon === "swing") {
    // Downtrend (price below both EMAs, EMA20 sagging below EMA50): don't
    // suggest chasing the falling price — require a confirmed EMA20
    // breakout instead, and flag it so the user knows to wait.
    const isDowntrend = price < ema20 && ema20 < ema50;
    let waitWarning: string | null = null;
    if (isDowntrend) {
      waitWarning = L(
        lang,
        `Bekleme: Düşüş trendi — EMA20 (${fmtUsd(ema20)}) üstünde günlük kapanış onayı bekleniyor`,
        `Wait: Downtrend — waiting for a daily close above EMA20 (${fmtUsd(ema20)}) to confirm reversal`,
        `Espera: Tendencia bajista — esperando un cierre diario por encima de EMA20 (${fmtUsd(ema20)})`,
        `Attente : Tendance baissière — en attente d'une clôture journalière au-dessus de l'EMA20 (${fmtUsd(ema20)})`
      );
    }

    // Paylasilan motorun (lib/tradePlanEngine.ts) plani varsa BIREBIR onu
    // goster — /graphic ve /en/stock ile ayni giris araligi / stop / TP1-3.
    const ep = rd.enginePlan;
    let entryLow: number, entryHigh: number, stop: number, t1: number, t2: number, t3: number;
    if (ep && ep.entryLow > 0 && ep.t1 > 0) {
      entryLow = ep.entryLow;
      entryHigh = ep.entryHigh;
      stop = ep.stop;
      t1 = ep.t1;
      t2 = ep.t2;
      t3 = ep.t3;
    } else {
      // Motor verisi yoksa ayni formulun lokal karsiligi: pivot direnc
      // merdiveni (r1/r2/r3) + yuzde tabanlari, giris destek->fiyat araligi.
      entryHigh = +(isDowntrend ? ema20 * 1.005 : price >= ema20 * 0.995 ? price : Math.min(price, ema20) * 1.002).toFixed(2);
      entryLow = +Math.min(entryHigh * 0.995, Math.max(s1 * 1.002, entryHigh - atr)).toFixed(2);
      const mid = (entryLow + entryHigh) / 2;
      stop = +Math.min(s1, mid * 0.975).toFixed(2);
      t1 = +Math.max(r1, mid * 1.05).toFixed(2);
      t2 = +Math.max(r2, mid * 1.1, t1 * 1.02).toFixed(2);
      t3 = +Math.max(r3, mid * 1.15, t2 * 1.02).toFixed(2);
    }
    const entry = +(((entryLow + entryHigh) / 2)).toFixed(2);
    const risk = Math.max(entry - stop, price * 0.01);
    const rr1 = +(((t1 - entry) / risk)).toFixed(1);
    const rr2 = +(((t2 - entry) / risk)).toFixed(1);
    const trailStop = +((entry + (t1 - entry) * 0.5)).toFixed(2);
    const trailRule =
      lang === "tr"
        ? `${fmtUsd(t1)} üstünde günlük kapanış → stop ${fmtUsd(trailStop)}'a taşı (giriş +%50R)`
        : `Daily close above ${fmtUsd(t1)} → trail stop to ${fmtUsd(trailStop)} (entry +50%R)`;
    return {
      timeframe: L(lang, "Swing (90 Güne Kadar)", "Swing (Up to 90 Days)"),
      entry,
      entryLow,
      entryHigh,
      stop,
      t1,
      t2,
      t3,
      rr1,
      rr2,
      invalidation: +Math.min(s1, stop).toFixed(2),
      anchor: L(lang, "Pivot destek bazlı giriş aralığı", "Pivot-support entry zone"),
      trailRule,
      waitWarning,
    };
  }

  if (horizon === "position") {
    const entryHigh = +(price >= ema50 * 0.995 ? price : Math.min(price, ema50) * 1.002).toFixed(2);
    const entryLow = +Math.min(entryHigh * 0.995, Math.max(ema50 * 1.002, entryHigh * 0.94)).toFixed(2);
    const entry = +(((entryLow + entryHigh) / 2)).toFixed(2);
    const stop = +Math.min(s2, entry * 0.94).toFixed(2);
    const risk = Math.max(entry - stop, price * 0.02);
    const t1 = +Math.max(r2, entry * 1.09).toFixed(2);
    const t2 = +Math.max(r3, entry * 1.18).toFixed(2);
    const rr1 = +(((t1 - entry) / risk)).toFixed(1);
    const rr2 = +(((t2 - entry) / risk)).toFixed(1);
    const trailRule =
      lang === "tr"
        ? `${fmtUsd(t1)} üstünde haftalık kapanış → stop'u giriş bölgesine (${fmtUsd(entry)}) taşı`
        : `Weekly close above ${fmtUsd(t1)} → move stop to break-even (${fmtUsd(entry)})`;
    return {
      timeframe: L(lang, "Pozisyon (1-3 Ay)", "Position (1-3 Months)"),
      entry,
      entryLow,
      entryHigh,
      stop,
      t1,
      t2,
      t3: null,
      rr1,
      rr2,
      invalidation: s2,
      anchor: L(lang, "EMA50 baz", "EMA50 anchor"),
      trailRule,
      waitWarning: null,
    };
  }

  // investment
  const entryHigh = +(price >= ema200 * 0.995 ? price : Math.min(price, ema200) * 1.002).toFixed(2);
  const entryLow = +Math.min(entryHigh * 0.995, Math.max(ema200 * 1.002, entryHigh * 0.88)).toFixed(2);
  const entry = +(((entryLow + entryHigh) / 2)).toFixed(2);
  const stop = +Math.min(low52, ema200 * 0.87, entry * 0.88).toFixed(2);
  const risk = Math.max(entry - stop, price * 0.05);
  const t1 = +Math.max(high52, entry * 1.18).toFixed(2);
  const t2 = +Math.max(r3, entry * 1.3).toFixed(2);
  const rr1 = +(((t1 - entry) / risk)).toFixed(1);
  const rr2 = +(((t2 - entry) / risk)).toFixed(1);
  const trailRule =
    lang === "tr"
      ? `${fmtUsd(t1)} üstünde aylık kapanış → %50 çıkış yap, kalan T2 için tut`
      : `Monthly close above ${fmtUsd(t1)} → take 50% off, hold rest to T2`;
  return {
    timeframe: L(lang, "Yatırım (6+ Ay)", "Investment (6M+)"),
    entry,
    entryLow,
    entryHigh,
    stop,
    t1,
    t2,
    t3: null,
    rr1,
    rr2,
    invalidation: ema200,
    anchor: L(lang, "EMA200 baz", "EMA200 anchor"),
    trailRule,
    waitWarning: null,
  };
}
