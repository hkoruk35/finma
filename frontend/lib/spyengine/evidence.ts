/**
 * SPY Engine — gerekçe kartlarının sonuç üreten okumaları (VWAP · EMA20 · alıcı/satıcı hacmi · emir defteri ·
 * opsiyon Call/Put akışı) ve bunlardan tek satırlık gün yönelimi. Yalnız ölçülmüş veriden; yön kararı
 * Karar Merdiveni'nde kalır, burası "neden" sorusunu sade cümlelerle cevaplar.
 */

import { nyClock, type Bar } from "./core";
import type { OptionFlow, QuoteBook } from "./optionFetch";

export type Side = 1 | 0 | -1;

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

// ── VWAP ──────────────────────────────────────────────────────────

export interface VwapRead {
  vwap: number;
  /** Hacim ağırlıklı standart sapma (fiyatın VWAP etrafındaki dağılımı) */
  sigma: number;
  dev: number;
  devAtr: number | null;
  /** Kaç σ uzakta */
  z: number;
  /** Son 30 dk'da VWAP'ın değişimi (puan) */
  slope30: number | null;
  /** Bugün kapanmış 5m mumların yüzde kaçı VWAP üstünde kapandı */
  abovePct: number;
  /** Son 2 saatte kapanışların VWAP'ı kaç kez kestiği */
  crosses2h: number;
  bands: { up1: number; dn1: number; up2: number; dn2: number };
  side: Side;
  headline: string;
  verdict: string;
}

/** `bars`: bugünün RTH 5m mumları (kapanmış), `price`: son fiyat, `atr`: ATR14 (5m) */
export function vwapRead(bars: Bar[], price: number | null, atr: number | null): VwapRead | null {
  if (!bars.length || price == null) return null;
  let pv = 0, vol = 0;
  const vw: number[] = [];
  for (const b of bars) {
    const v = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * v;
    vol += v;
    vw.push(vol > 0 ? pv / vol : b.close);
  }
  const vwap = vw[vw.length - 1];
  let vv = 0;
  for (const b of bars) vv += (b.volume || 0) * (((b.high + b.low + b.close) / 3) - vwap) ** 2;
  const sigma = Math.max(0.05, vol > 0 ? Math.sqrt(vv / vol) : 0.05);
  const dev = price - vwap;
  const z = dev / sigma;
  const k30 = vw.length - 7;
  const slope30 = k30 >= 0 ? vwap - vw[k30] : null;
  const abovePct = Math.round((bars.filter((b, i) => b.close > vw[i]).length / bars.length) * 100);
  let crosses2h = 0;
  const from = Math.max(1, bars.length - 24);
  for (let i = from; i < bars.length; i++) {
    if (Math.sign(bars[i].close - vw[i]) !== Math.sign(bars[i - 1].close - vw[i - 1])) crosses2h++;
  }
  const side: Side = z > 0.3 ? 1 : z < -0.3 ? -1 : 0;
  const slopeDir = slope30 == null ? 0 : slope30 > 0.05 ? 1 : slope30 < -0.05 ? -1 : 0;
  let headline: string;
  let verdict: string;
  const v2 = vwap.toFixed(2);
  if (crosses2h >= 4) {
    headline = "TESTERE — YÖN YOK";
    verdict = `Son 2 saatte fiyat VWAP'ı ${crosses2h} kez kesti: VWAP sinyalleri bugün güvenilmez. Açılış aralığı ya da gün tepe/dibi kırılımını bekle.`;
  } else if (side === 0) {
    headline = "DENGE — VWAP ÜZERİNDE";
    verdict = `Fiyat VWAP'a (${v2}) yapışık. Bir tarafta 5m kapanışlar başlayana kadar yön yok.`;
  } else if (Math.abs(z) >= 2) {
    headline = side === 1 ? "AŞIRI UZAMIŞ — YUKARIDA" : "AŞIRI UZAMIŞ — AŞAĞIDA";
    verdict = `Fiyat VWAP'tan ${Math.abs(z).toFixed(1)}σ uzakta: kovalama. ${side === 1 ? "Yeni CALL için" : "Yeni PUT için"} ±1σ bandına (${(side === 1 ? vwap + sigma : vwap - sigma).toFixed(2)}) geri çekilme bekle; VWAP'a dönüş riski yüksek.`;
  } else {
    const ctrl = side === 1 ? "ALICI KONTROLÜ" : "SATICI KONTROLÜ";
    headline = slopeDir === side ? `${ctrl} · TREND` : ctrl;
    verdict = side === 1
      ? `Fiyat VWAP üstünde${slopeDir === 1 ? " ve VWAP yükseliyor" : ""}: VWAP'a (${v2}) geri çekilmeler alım bölgesi. 5m kapanış ${v2} altına inerse görüş bozulur.`
      : `Fiyat VWAP altında${slopeDir === -1 ? " ve VWAP düşüyor" : ""}: VWAP'a (${v2}) tepkiler satış bölgesi. 5m kapanış ${v2} üstüne çıkarsa görüş bozulur.`;
  }
  return {
    vwap, sigma, dev, devAtr: atr ? dev / atr : null, z, slope30, abovePct, crosses2h,
    bands: { up1: vwap + sigma, dn1: vwap - sigma, up2: vwap + 2 * sigma, dn2: vwap - 2 * sigma },
    side, headline, verdict,
  };
}

// ── EMA20 ─────────────────────────────────────────────────────────

export interface EmaTf {
  value: number;
  dist: number;
  /** Son 3 mumda EMA eğimi, ATR cinsinden */
  slopeAtr: number | null;
  side: Side;
  /** Kapanışın EMA'yı son kesişi */
  lastCross: { clock: string; dir: Side; barsAgo: number } | null;
}

/** `bars`: kapanmış mumlar (çok günlük), `ema`: zaman → EMA20, `atr`: aynı TF ATR */
export function emaTf(bars: Bar[], ema: Map<number, number>, price: number | null, atr: number | null): EmaTf | null {
  const pts = bars.filter((b) => ema.has(b.time));
  if (pts.length < 4 || price == null) return null;
  const n = pts.length - 1;
  const value = ema.get(pts[n].time) as number;
  const e3 = ema.get(pts[n - 3].time) as number;
  const slopeAtr = atr ? (value - e3) / atr : null;
  let lastCross: EmaTf["lastCross"] = null;
  for (let i = n; i >= 1 && i >= n - 60; i--) {
    const a = Math.sign(pts[i].close - (ema.get(pts[i].time) as number));
    const b = Math.sign(pts[i - 1].close - (ema.get(pts[i - 1].time) as number));
    if (a !== b && a !== 0) { lastCross = { clock: nyClock(pts[i].time), dir: a as Side, barsAgo: n - i }; break; }
  }
  const dist = price - value;
  const side: Side = atr && Math.abs(dist) < 0.1 * atr ? 0 : dist > 0 ? 1 : -1;
  return { value, dist, slopeAtr, side, lastCross };
}

export function emaVerdict(e5: EmaTf | null, e15: EmaTf | null): { side: Side; headline: string; verdict: string } {
  if (!e5 || !e15) return { side: 0, headline: "VERİ BEKLENİYOR", verdict: "EMA20 için yeterli kapanmış mum yok." };
  const up = (e: EmaTf) => e.side === 1 && (e.slopeAtr ?? 0) > 0.1;
  const dn = (e: EmaTf) => e.side === -1 && (e.slopeAtr ?? 0) < -0.1;
  if (up(e5) && up(e15)) return { side: 1, headline: "KISA VADE TREND YUKARI", verdict: `Fiyat 5m ve 15m EMA20'nin üstünde, ikisi de yükseliyor. 5m EMA20 (${e5.value.toFixed(2)}) dinamik destek; altında 5m kapanış = kısa vade bozulur, 15m EMA20 (${e15.value.toFixed(2)}) son savunma.` };
  if (dn(e5) && dn(e15)) return { side: -1, headline: "KISA VADE TREND AŞAĞI", verdict: `Fiyat 5m ve 15m EMA20'nin altında, ikisi de düşüyor. 5m EMA20 (${e5.value.toFixed(2)}) dinamik direnç; üstünde 5m kapanış = kısa vade bozulur, 15m EMA20 (${e15.value.toFixed(2)}) son savunma.` };
  if (e5.side === e15.side && e5.side !== 0) return { side: 0, headline: e5.side === 1 ? "YUKARI AMA YAVAŞ" : "AŞAĞI AMA YAVAŞ", verdict: `Fiyat iki EMA20'nin de ${e5.side === 1 ? "üstünde" : "altında"} ama eğim zayıf — trend olgunlaşmadı, kırılımla teyit bekle.` };
  if (e5.side !== e15.side && e5.side !== 0 && e15.side !== 0) return { side: 0, headline: "ÇATIŞMA — 5m ile 15m TERS", verdict: `5m EMA20 ${e5.side === 1 ? "üstü" : "altı"}, 15m EMA20 ${e15.side === 1 ? "üstü" : "altı"}: kısa vadeli ${e5.side === 1 ? "tepki yükselişi" : "geri çekilme"}. 15m tarafı netleşene kadar büyük pozisyon yok.` };
  return { side: 0, headline: "EMA20 ÜZERİNDE KARARSIZ", verdict: "Fiyat EMA20'ye yapışık; yön için EMA'dan uzaklaşan bir 5m kapanış bekle." };
}

// ── Alıcı / satıcı hacmi (1m mumlardan tahmin) ────────────────────

export interface PressureWin { buy: number; sell: number; /** alıcı payı 0–1 */ buyPct: number }
export interface PressureRead { day: PressureWin; m30: PressureWin; m5: PressureWin; side: Side; headline: string; verdict: string }

/**
 * Her 1m mumun hacmi alıcı/satıcı arasında bölünür: yarısı kapanışın mum içindeki konumuna (CLV),
 * yarısı fiyatın bir önceki kapanışa göre yönüne (tick kuralı) göre. Gerçek işlem tarafı değil, tahmindir.
 */
export function pressureRead(today1: Bar[], nowSec: number): PressureRead | null {
  if (today1.length < 3) return null;
  const parts = today1.map((b, i) => {
    const v = b.volume || 0;
    const rg = b.high - b.low;
    const clv = rg > 0 ? (b.close - b.low) / rg : 0.5;
    const pc = i > 0 ? today1[i - 1].close : b.open;
    const tick = b.close > pc ? 1 : b.close < pc ? 0 : 0.5;
    const f = 0.5 * clv + 0.5 * tick;
    return { t: b.time, buy: v * f, sell: v * (1 - f) };
  });
  const win = (fromT: number): PressureWin => {
    const xs = parts.filter((p) => p.t >= fromT);
    const buy = sum(xs.map((x) => x.buy)), sell = sum(xs.map((x) => x.sell));
    return { buy, sell, buyPct: buy + sell > 0 ? buy / (buy + sell) : 0.5 };
  };
  const day = win(0), m30 = win(nowSec - 1800), m5 = win(nowSec - 300);
  const s = (w: PressureWin): Side => (w.buyPct >= 0.54 ? 1 : w.buyPct <= 0.46 ? -1 : 0);
  const sd = s(day), s30 = s(m30);
  const side: Side = s30 !== 0 ? s30 : sd;
  const pct = (w: PressureWin) => `%${Math.round(w.buyPct * 100)}`;
  let verdict: string;
  if (sd === 1 && s30 === 1) verdict = `Alıcılar gün boyu ve son 30 dk baskın (${pct(day)} / ${pct(m30)}) — yükselişler hacimle destekleniyor.`;
  else if (sd === -1 && s30 === -1) verdict = `Satıcılar gün boyu ve son 30 dk baskın (alıcı ${pct(day)} / ${pct(m30)}) — düşüşler hacimle destekleniyor.`;
  else if (s30 !== 0 && s30 !== sd) verdict = `Son 30 dk ${s30 === 1 ? "alıcılara" : "satıcılara"} döndü (alıcı ${pct(m30)}) — günün akışına ters; dönüş başlangıcı olabilir, teyit bekle.`;
  else if (sd !== 0 && s30 === 0) verdict = `Gün genelinde ${sd === 1 ? "alıcılar" : "satıcılar"} önde (alıcı ${pct(day)}) ama son 30 dk dengeye geldi (${pct(m30)}) — ivme azalıyor.`;
  else verdict = `Alıcı-satıcı dengede (gün ${pct(day)}, 30 dk ${pct(m30)}) — hacim tek yönü desteklemiyor.`;
  const who = (x: Side) => (x === 1 ? "ALICILAR" : "SATICILAR");
  const headline = side === 0 ? "ALICI = SATICI" : s30 === 0 ? `${who(sd)} ÖNDE · İVME ZAYIF` : sd !== 0 && sd !== s30 ? `${who(s30)} DEVRALIYOR` : `${who(side)} BASKIN`;
  return { day, m30, m5, side, headline, verdict };
}

// ── Emir defteri (Level 1) ────────────────────────────────────────

export interface BookSample { t: number; bidSize: number; askSize: number; spread: number }
export interface BookRead {
  bid: number | null; ask: number | null; bidSize: number | null; askSize: number | null; spread: number | null;
  /** Anlık dengesizlik −1…+1 (+ alış tarafı kalabalık) */
  imbNow: number | null;
  /** Son ~5 dk ortalama dengesizlik */
  imbAvg: number | null;
  samples: number;
  side: Side;
  verdict: string;
}

export function bookRead(book: QuoteBook | null, samples: BookSample[], nowSec: number): BookRead | null {
  if (!book) return null;
  const imb = (b: number, a: number) => (b + a > 0 ? (b - a) / (b + a) : 0);
  const imbNow = book.bidSize != null && book.askSize != null ? imb(book.bidSize, book.askSize) : null;
  const recent = samples.filter((s) => s.t >= nowSec - 300);
  const imbAvg = recent.length >= 5 ? sum(recent.map((s) => imb(s.bidSize, s.askSize))) / recent.length : null;
  const ref = imbAvg ?? null;
  const side: Side = ref == null ? 0 : ref >= 0.15 ? 1 : ref <= -0.15 ? -1 : 0;
  const verdict = ref == null
    ? "Ortalama için birkaç dakikalık örnek birikiyor."
    : side === 1 ? `Son 5 dk alış kademesi daha kalabalık (ort. ${Math.round(ref * 100)}%) — fiyatın altında bekleyen alıcı var.`
      : side === -1 ? `Son 5 dk satış kademesi daha kalabalık (ort. ${Math.round(ref * 100)}%) — fiyatın üstünde bekleyen satıcı var.`
        : `Kademeler dengede (ort. ${Math.round(ref * 100)}%).`;
  return {
    bid: book.bid, ask: book.ask, bidSize: book.bidSize, askSize: book.askSize,
    spread: book.bid != null && book.ask != null ? book.ask - book.bid : null,
    imbNow, imbAvg, samples: recent.length, side, verdict,
  };
}

// ── Opsiyon Call/Put akışı ────────────────────────────────────────

export interface OptionFlowRead {
  flow: OptionFlow;
  /** Call / Put hacim oranı (>1 call ağırlıklı) */
  cpVol: number | null;
  /** Call / Put prim oranı ($) */
  cpPrem: number | null;
  /** Fiyata ±%1 yakın strike'larda Call / Put hacim oranı */
  cpNear: number | null;
  side: Side;
  verdict: string;
}

export function optionFlowRead(flow: OptionFlow | null): OptionFlowRead | null {
  if (!flow || flow.calls.volume + flow.puts.volume === 0) return null;
  const r = (a: number, b: number) => (b > 0 ? a / b : null);
  const cpVol = r(flow.calls.volume, flow.puts.volume);
  const cpPrem = r(flow.calls.premium, flow.puts.premium);
  const cpNear = r(flow.calls.nearVolume, flow.puts.nearVolume);
  // Yön: para dışı + ATM prim dengesi (yeni pozisyon parası). SPY toplam hacminde put tarafı korunma yüzünden
  // yapısal olarak ağır (C/P ~0,7) — toplam hacim oranı bu yüzden yön için kullanılmaz, bilgi olarak gösterilir.
  const side: Side = cpPrem == null ? 0 : cpPrem >= 1.25 ? 1 : cpPrem <= 0.8 ? -1 : 0;
  const f = (x: number | null) => (x == null ? "—" : x.toFixed(2));
  const verdict = side === 1
    ? `${flow.isZeroDte ? "0DTE" : "Yakın vade"} para dışı primde Call ağırlığı (C/P prim ${f(cpPrem)}) — yeni para yükselişe oynuyor.`
    : side === -1
      ? `${flow.isZeroDte ? "0DTE" : "Yakın vade"} para dışı primde Put ağırlığı (C/P prim ${f(cpPrem)}) — yeni para düşüşe/korunmaya oynuyor.`
      : `Para dışı primde Call/Put dengede (C/P prim ${f(cpPrem)}; toplam hacim ${f(cpVol)}) — opsiyon akışı yön vermiyor.`;
  return { flow, cpVol, cpPrem, cpNear, side, verdict };
}

// ── Gün yönelimi ──────────────────────────────────────────────────

export interface DayBias {
  score: number;
  max: number;
  side: Side;
  items: { label: string; side: Side }[];
  headline: string;
}

export function dayBias(parts: { label: string; side: Side | null | undefined }[]): DayBias {
  const items = parts.filter((p) => p.side != null).map((p) => ({ label: p.label, side: p.side as Side }));
  const score = sum(items.map((i) => i.side));
  const max = items.length;
  const side: Side = max && score >= Math.ceil(max * 0.5) ? 1 : max && score <= -Math.ceil(max * 0.5) ? -1 : 0;
  const up = items.filter((i) => i.side === 1).length, dn = items.filter((i) => i.side === -1).length;
  const headline = !max ? "veri bekleniyor"
    : side === 1 ? `YUKARI ağırlıklı — ${up}/${max} gösterge alıcı tarafında`
      : side === -1 ? `AŞAĞI ağırlıklı — ${dn}/${max} gösterge satıcı tarafında`
        : `KARIŞIK — ${up} yukarı · ${dn} aşağı · ${max - up - dn} nötr`;
  return { score, max, side, items, headline };
}
