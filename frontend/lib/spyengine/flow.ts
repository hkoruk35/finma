/**
 * SPY Engine — Akış katmanı: hacim profili (POC/VAH/VAL), likidite havuzları
 * ve süpürmeler, kümülatif delta ve uyumsuzluk, akıllı para izleri (emilim /
 * kurumsal itki), sıkışma–ivme ve ERKEN UYARI (saf, izomorfik — DOM/ağ yok).
 *
 * Motorun giriş/çıkış kurallarına (strategy.ts) DOKUNMAZ; sunum katmanıdır.
 * Hepsi KAPANMIŞ 5m mumlardan ve bugünün 1m akışından üretilir.
 *
 * Önemli sınır: alıcı/satıcı hacmi (delta) tick verisi olmadan ölçülemez.
 * Burada her 1m mumun hacmi kapanışın aralıktaki konumuyla bölüştürülür
 * (close location value). Yön bilgisini iyi taşır ama gerçek emir defteri
 * deltası değildir; "akıllı para" etiketleri de hacim/fiyat davranışından
 * çıkarımdır.
 */

import { nyParts, nyClock, isRthBar, r2, type Bar } from "./core";
import type { DaySeries } from "./openingMap";

const fmt = (n: number) => n.toFixed(2);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : 0);
/** Medyan — 09:30 mumunun dev hacmi kıyas ortalamasını şişirmesin diye */
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const a = xs.slice().sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const clv = (b: Bar) => {
  const rg = b.high - b.low;
  return rg > 0 ? (b.close - b.low) / rg : 0.5;
};
/** Mumun tahmini deltası: +hacim (tamamı alıcı) … −hacim (tamamı satıcı) */
const barDelta = (b: Bar) => (b.volume || 0) * (2 * clv(b) - 1);

// ── Salınım dip/tepeleri (fraktal) ───────────────────────────────────

export interface Swing {
  time: number;
  clock: string;
  price: number;
  kind: "HIGH" | "LOW";
}

/** Kendi ±n mumunun en yükseği/en düşüğü olan KAPANMIŞ mum (sağda n mum gerekir → teyitli) */
export function swingPoints(bars: Bar[], n = 2): Swing[] {
  const out: Swing[] = [];
  for (let i = n; i < bars.length - n; i++) {
    let isH = true, isL = true;
    for (let k = i - n; k <= i + n; k++) {
      if (k === i) continue;
      if (bars[k].high >= bars[i].high) isH = false;
      if (bars[k].low <= bars[i].low) isL = false;
    }
    if (isH) out.push({ time: bars[i].time, clock: nyClock(bars[i].time), price: bars[i].high, kind: "HIGH" });
    if (isL) out.push({ time: bars[i].time, clock: nyClock(bars[i].time), price: bars[i].low, kind: "LOW" });
  }
  return out;
}

// ── Hacim profili ────────────────────────────────────────────────────

export interface VolumeProfile {
  poc: number;
  vah: number;
  val: number;
  /** POC'nin seans içindeki göçü (her 30 dk) — yukarı kayan POC = yukarıda kabul */
  pocPath: { clock: string; poc: number }[];
  /** Son 60 dk'daki POC kayması (puan) */
  pocShift: number;
}

const BIN = 0.05;

function profileOf(bars: Bar[]): { poc: number; vah: number; val: number } | null {
  const hist = new Map<number, number>();
  let total = 0;
  for (const b of bars) {
    const v = b.volume || 0;
    if (v <= 0) continue;
    const lo = Math.round(b.low / BIN), hi = Math.round(b.high / BIN);
    const n = hi - lo + 1;
    for (let k = lo; k <= hi; k++) hist.set(k, (hist.get(k) ?? 0) + v / n);
    total += v;
  }
  if (!hist.size || total <= 0) return null;
  const keys = Array.from(hist.keys()).sort((a, b) => a - b);
  let pocK = keys[0];
  for (const k of keys) if ((hist.get(k) ?? 0) > (hist.get(pocK) ?? 0)) pocK = k;
  // Değer alanı: POC'tan başlayıp hacmi büyük olan komşu tarafa genişle (%70)
  let lo = keys.indexOf(pocK), hi = lo, acc = hist.get(pocK) ?? 0;
  while (acc < total * 0.7 && (lo > 0 || hi < keys.length - 1)) {
    const dn = lo > 0 ? hist.get(keys[lo - 1]) ?? 0 : -1;
    const up = hi < keys.length - 1 ? hist.get(keys[hi + 1]) ?? 0 : -1;
    if (up >= dn) acc += hist.get(keys[++hi]) ?? 0;
    else acc += hist.get(keys[--lo]) ?? 0;
  }
  return { poc: r2(pocK * BIN), vah: r2(keys[hi] * BIN), val: r2(keys[lo] * BIN) };
}

export function volumeProfile(m1Today: Bar[]): VolumeProfile | null {
  const p = profileOf(m1Today);
  if (!p) return null;
  const pocPath: VolumeProfile["pocPath"] = [];
  if (m1Today.length) {
    const t0 = m1Today[0].time;
    for (let t = t0 + 1800; t <= m1Today[m1Today.length - 1].time + 60; t += 1800) {
      const q = profileOf(m1Today.filter((b) => b.time < t));
      if (q) pocPath.push({ clock: nyClock(t), poc: q.poc });
    }
  }
  const lastT = m1Today[m1Today.length - 1].time;
  const hourAgo = profileOf(m1Today.filter((b) => b.time <= lastT - 3600));
  return { ...p, pocPath, pocShift: hourAgo ? r2(p.poc - hourAgo.poc) : 0 };
}

// ── Likidite havuzları + süpürmeler ──────────────────────────────────

export interface LiquidityPool {
  price: number;
  /** BUY = tepelerin üstü (açığa satanların stopları) · SELL = diplerin altı (alıcıların stopları) */
  side: "BUY" | "SELL";
  label: string;
  /** Havuzun oluştuğu an (bu andan sonraki mumlar süpürebilir) */
  from: number;
  swept: boolean;
  sweptClock: string | null;
}

export interface FlowEvent {
  time: number;
  clock: string;
  kind: "SWEEP_HIGH" | "SWEEP_LOW" | "ABSORB_BUY" | "ABSORB_SELL" | "PUSH_UP" | "PUSH_DOWN" | "DIV_BULL" | "DIV_BEAR";
  /** +1 alıcı lehine · −1 satıcı lehine */
  bias: 1 | -1;
  price: number;
  text: string;
}

// ── Erken uyarı ──────────────────────────────────────────────────────

export interface FlowTarget {
  price: number;
  label: string;
  dist: number;
}

export interface EarlyWarning {
  /** STARTED: hareket başladı · BUILDING: hazırlık birikiyor · NONE: sinyal yok */
  level: "STARTED" | "BUILDING" | "NONE";
  side: "LONG" | "SHORT" | null;
  bull: number;
  bear: number;
  bullWhy: string[];
  bearWhy: string[];
  headline: string;
  /** Hareket yönündeki olası duraklar (yakından uzağa) */
  targets: FlowTarget[];
  /** Senaryonun bozulduğu seviye */
  invalidation: number | null;
}

export interface FlowRead {
  profile: VolumeProfile | null;
  swings: Swing[];
  pools: LiquidityPool[];
  events: FlowEvent[];
  /** Seans kümülatif deltası (tahmini) ve son 30 dk değişimi */
  cumDelta: number;
  delta30: number;
  /** Son 30 dk deltası / son 30 dk hacmi (−1…+1) */
  deltaPct30: number | null;
  /** Kümülatif delta, kapanmış her 5m mumun sonunda */
  deltaSeries: { time: number; value: number }[];
  compression: { active: boolean; ratio: number | null; boxHigh: number | null; boxLow: number | null };
  /** Son 3 mum aynı yönde, gövde ve hacim büyüyor */
  accel: { dir: 1 | -1 | 0; text: string | null };
  warning: EarlyWarning;
}

const RECENT_BARS = 4;

export function flowRead(input: {
  /** Çok günlük 1m akış (önceki gün tepe/dibi için) */
  m1: Bar[];
  ymd: string;
  /** Bugünün kapanmış 5m mumları + VWAP */
  s5: DaySeries;
  /** Oluşan mum dahil son fiyat */
  price: number | null;
  premarket?: { high: number | null; low: number | null } | null;
}): FlowRead | null {
  const { m1, ymd, s5, premarket } = input;
  const bars = s5.bars;
  const n = bars.length;
  if (!n) return null;
  const lastClosedEnd = bars[n - 1].time + 300;
  const price = input.price ?? bars[n - 1].close;

  const today1 = m1.filter((b) => isRthBar(b) && nyParts(b.time).ymd === ymd && b.time < lastClosedEnd);
  const profile = volumeProfile(today1);
  const swings = swingPoints(bars, 2);

  // — önceki RTH günü tepe/dip —
  let prevYmd = "";
  for (const b of m1) {
    const d = nyParts(b.time).ymd;
    if (d < ymd && isRthBar(b) && d > prevYmd) prevYmd = d;
  }
  const prevDay = prevYmd ? m1.filter((b) => isRthBar(b) && nyParts(b.time).ymd === prevYmd) : [];

  // — havuzlar —
  const open = bars[0].time;
  const pools: LiquidityPool[] = [];
  const addPool = (price: number | null | undefined, side: LiquidityPool["side"], label: string, from: number) => {
    if (price == null || !Number.isFinite(price)) return;
    if (pools.some((p) => p.side === side && Math.abs(p.price - price) < 0.1)) return;
    pools.push({ price: r2(price), side, label, from, swept: false, sweptClock: null });
  };
  if (prevDay.length) {
    addPool(Math.max(...prevDay.map((b) => b.high)), "BUY", "Dünkü zirve", open);
    addPool(Math.min(...prevDay.map((b) => b.low)), "SELL", "Dünkü dip", open);
  }
  addPool(premarket?.high, "BUY", "Premarket zirvesi", open);
  addPool(premarket?.low, "SELL", "Premarket dibi", open);
  if (n >= 3) {
    const or = bars.slice(0, 3);
    addPool(Math.max(...or.map((b) => b.high)), "BUY", "Açılış aralığı zirvesi", or[2].time + 300);
    addPool(Math.min(...or.map((b) => b.low)), "SELL", "Açılış aralığı dibi", or[2].time + 300);
  }
  // eşit tepe/dipler (≥2 salınım 0,10 içinde) güçlü havuzdur; tekil salınımlar da havuzdur
  for (const s of swings) {
    const twin = swings.filter((o) => o.kind === s.kind && o !== s && Math.abs(o.price - s.price) <= 0.1 && o.time < s.time);
    const label = twin.length ? (s.kind === "HIGH" ? "Eşit tepeler" : "Eşit dipler") : s.kind === "HIGH" ? `Tepe ${s.clock}` : `Dip ${s.clock}`;
    addPool(s.price, s.kind === "HIGH" ? "BUY" : "SELL", label, s.time + 3 * 300);
  }

  // — mum mum olaylar —
  const events: FlowEvent[] = [];
  const ranges = bars.map((b) => b.high - b.low);
  const deltaSeries: FlowRead["deltaSeries"] = [];
  let cum = 0;
  {
    let j = 0;
    for (const b of bars) {
      const end = b.time + 300;
      while (j < today1.length && today1[j].time < end) cum += barDelta(today1[j++]);
      deltaSeries.push({ time: b.time, value: cum });
    }
  }

  for (let i = 0; i < n; i++) {
    const b = bars[i];
    const clock = nyClock(b.time);
    // süpürme: havuzu fitille geçip içeride kapanış
    for (const p of pools) {
      if (p.swept || b.time < p.from) continue;
      if (p.side === "BUY" && b.high > p.price + 0.02) {
        p.swept = true;
        p.sweptClock = clock;
        if (b.close < p.price) events.push({ time: b.time, clock, kind: "SWEEP_HIGH", bias: -1, price: p.price, text: `${p.label} (${fmt(p.price)}) üstündeki stoplar süpürüldü, mum altında kapandı → tepe reddi, aşağı dönüş riski` });
      } else if (p.side === "SELL" && b.low < p.price - 0.02) {
        p.swept = true;
        p.sweptClock = clock;
        if (b.close > p.price) events.push({ time: b.time, clock, kind: "SWEEP_LOW", bias: 1, price: p.price, text: `${p.label} (${fmt(p.price)}) altındaki stoplar süpürüldü, mum üstünde kapandı → dip reddi, yukarı dönüş` });
      }
    }
    if (i < 3) continue;
    const prior = bars.slice(Math.max(0, i - 10), i);
    const vAvg = median(prior.map((x) => x.volume || 0));
    const rAvg = median(ranges.slice(Math.max(0, i - 10), i));
    const vr = vAvg > 0 ? (b.volume || 0) / vAvg : 0;
    const rg = ranges[i];
    const body = Math.abs(b.close - b.open);
    // kurumsal itki: yüksek hacim + geniş gövde + geniş aralık
    if (vr >= 1.5 && rg >= 1.4 * rAvg && body >= 0.6 * rg) {
      const up = b.close > b.open;
      events.push({
        time: b.time, clock, kind: up ? "PUSH_UP" : "PUSH_DOWN", bias: up ? 1 : -1, price: b.close,
        text: `Kurumsal itki: ${vr.toFixed(1)}× hacim, ${fmt(rg)} puanlık ${up ? "yeşil" : "kırmızı"} gövde → büyük oyuncu ${up ? "alıyor" : "satıyor"}`,
      });
    } else if (vr >= 1.6 && rg <= 0.75 * rAvg) {
      // emilim: çok hacim ama fiyat ilerlemiyor
      const win = bars.slice(Math.max(0, i - 11), i + 1);
      const wHi = Math.max(...win.map((x) => x.high)), wLo = Math.min(...win.map((x) => x.low));
      const pos = wHi > wLo ? (b.close - wLo) / (wHi - wLo) : 0.5;
      if (pos <= 0.4) events.push({ time: b.time, clock, kind: "ABSORB_BUY", bias: 1, price: b.close, text: `Emilim (dipte): ${vr.toFixed(1)}× hacim ama dar mum → satışlar büyük alıcı tarafından karşılanıyor` });
      else if (pos >= 0.6) events.push({ time: b.time, clock, kind: "ABSORB_SELL", bias: -1, price: b.close, text: `Emilim (tepede): ${vr.toFixed(1)}× hacim ama dar mum → alımlar büyük satıcıya çarpıyor` });
    }
    // delta uyumsuzluğu: fiyat yeni dip/tepe yapıyor, delta yapmıyor
    if (i >= 11) {
      const A = { s: i - 11, e: i - 6 }, B = { s: i - 5, e: i };
      const idxMin = (s: number, e: number) => { let k = s; for (let x = s; x <= e; x++) if (bars[x].low < bars[k].low) k = x; return k; };
      const idxMax = (s: number, e: number) => { let k = s; for (let x = s; x <= e; x++) if (bars[x].high > bars[k].high) k = x; return k; };
      const la = idxMin(A.s, A.e), lb = idxMin(B.s, B.e);
      const ha = idxMax(A.s, A.e), hb = idxMax(B.s, B.e);
      const already = (k: FlowEvent["kind"]) => events.some((e) => e.kind === k && b.time - e.time < 1800);
      if (lb === i && bars[lb].low < bars[la].low - 0.05 && deltaSeries[lb].value > deltaSeries[la].value && !already("DIV_BULL"))
        events.push({ time: b.time, clock, kind: "DIV_BULL", bias: 1, price: bars[lb].low, text: `Pozitif uyumsuzluk: fiyat yeni dip (${fmt(bars[lb].low)}) ama kümülatif delta daha yüksek → satış gücü tükeniyor, gizli alım` });
      if (hb === i && bars[hb].high > bars[ha].high + 0.05 && deltaSeries[hb].value < deltaSeries[ha].value && !already("DIV_BEAR"))
        events.push({ time: b.time, clock, kind: "DIV_BEAR", bias: -1, price: bars[hb].high, text: `Negatif uyumsuzluk: fiyat yeni tepe (${fmt(bars[hb].high)}) ama kümülatif delta daha düşük → alım gücü tükeniyor, gizli satış` });
    }
  }

  // — delta özeti —
  const cumDelta = cum;
  const k30 = Math.max(0, n - 6);
  const delta30 = cum - (k30 > 0 ? deltaSeries[k30 - 1].value : 0);
  const vol30 = bars.slice(k30).reduce((a, b) => a + (b.volume || 0), 0);
  const deltaPct30 = vol30 > 0 ? delta30 / vol30 : null;

  // — sıkışma —
  let compression: FlowRead["compression"] = { active: false, ratio: null, boxHigh: null, boxLow: null };
  if (n >= 12) {
    const last6 = bars.slice(-6);
    const ratio = avg(ranges.slice(-6)) / Math.max(0.01, avg(ranges.slice(-30)));
    compression = {
      active: ratio <= 0.7,
      ratio: r2(ratio),
      boxHigh: Math.max(...last6.map((b) => b.high)),
      boxLow: Math.min(...last6.map((b) => b.low)),
    };
  }

  // — ivme —
  let accel: FlowRead["accel"] = { dir: 0, text: null };
  if (n >= 3) {
    const [a, b2, c] = bars.slice(-3);
    const dirs = [a, b2, c].map((x) => Math.sign(x.close - x.open));
    const bodies = [a, b2, c].map((x) => Math.abs(x.close - x.open));
    if (dirs[0] === dirs[1] && dirs[1] === dirs[2] && dirs[0] !== 0 && bodies[2] >= bodies[1] && (c.volume || 0) >= (b2.volume || 0) * 0.9) {
      const d = dirs[0] as 1 | -1;
      accel = { dir: d, text: `3 mumdur ${d > 0 ? "yeşil" : "kırmızı"}, gövde büyüyor, hacim düşmüyor → ${d > 0 ? "yukarı" : "aşağı"} ivme artıyor` };
    }
  }

  // — erken uyarı puanlaması —
  const bullWhy: string[] = [], bearWhy: string[] = [];
  let bull = 0, bear = 0;
  const recent = events.filter((e) => e.time >= bars[Math.max(0, n - RECENT_BARS)].time);
  const add = (side: 1 | -1, pts: number, why: string) => {
    if (side > 0) { bull += pts; bullWhy.push(why); } else { bear += pts; bearWhy.push(why); }
  };
  for (const e of recent) {
    // önemli havuz (dünkü/premarket/açılış aralığı/eşit tepe-dip) süpürmesi daha güçlü
    const major = (e.kind === "SWEEP_LOW" || e.kind === "SWEEP_HIGH") && !/^(Tepe|Dip) \d/.test(e.text);
    if (e.kind === "SWEEP_LOW" && price > e.price) add(1, major ? 2.5 : 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "SWEEP_HIGH" && price < e.price) add(-1, major ? 2.5 : 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "DIV_BULL") add(1, 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "DIV_BEAR") add(-1, 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "ABSORB_BUY") add(1, 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "ABSORB_SELL") add(-1, 1.5, `${e.clock} ${e.text}`);
    if (e.kind === "PUSH_UP" && e.time >= bars[Math.max(0, n - 2)].time) add(1, 2, `${e.clock} ${e.text}`);
    if (e.kind === "PUSH_DOWN" && e.time >= bars[Math.max(0, n - 2)].time) add(-1, 2, `${e.clock} ${e.text}`);
  }
  // VWAP geri alımı / kaybı (son 2 mum)
  if (n >= 3) {
    const vNow = s5.vwap[n - 1], vPrev = s5.vwap[n - 3];
    if (vNow != null && vPrev != null) {
      if (bars[n - 3].close < vPrev && bars[n - 1].close > vNow) add(1, 1, `VWAP (${fmt(vNow)}) aşağıdan geri alındı`);
      if (bars[n - 3].close > vPrev && bars[n - 1].close < vNow) add(-1, 1, `VWAP (${fmt(vNow)}) yukarıdan kaybedildi`);
    }
  }
  // POC göçü + kabul
  if (profile) {
    if (profile.pocShift >= 0.25 && price > profile.poc) add(1, 1, `POC son 1 saatte ${fmt(profile.pocShift)} yukarı kaydı (${fmt(profile.poc)}) ve fiyat üstünde → yukarıda kabul`);
    if (profile.pocShift <= -0.25 && price < profile.poc) add(-1, 1, `POC son 1 saatte ${fmt(Math.abs(profile.pocShift))} aşağı kaydı (${fmt(profile.poc)}) ve fiyat altında → aşağıda kabul`);
    if (price > profile.vah) add(1, 0.5, `Fiyat değer alanının üstünde (VAH ${fmt(profile.vah)})`);
    if (price < profile.val) add(-1, 0.5, `Fiyat değer alanının altında (VAL ${fmt(profile.val)})`);
  }
  // salınım yapısı
  const lows = swings.filter((s) => s.kind === "LOW").slice(-3);
  const highs = swings.filter((s) => s.kind === "HIGH").slice(-3);
  if (lows.length >= 3 && lows[1].price > lows[0].price && lows[2].price > lows[1].price) add(1, 1, `Yükselen dipler: ${lows.map((s) => fmt(s.price)).join(" → ")}`);
  if (highs.length >= 3 && highs[1].price < highs[0].price && highs[2].price < highs[1].price) add(-1, 1, `Alçalan tepeler: ${highs.map((s) => fmt(s.price)).join(" → ")}`);
  // delta akışı
  if (deltaPct30 != null && deltaPct30 >= 0.12) add(1, 1, `Son 30 dk alıcı baskın (delta %${Math.round(deltaPct30 * 100)})`);
  if (deltaPct30 != null && deltaPct30 <= -0.12) add(-1, 1, `Son 30 dk satıcı baskın (delta %${Math.round(deltaPct30 * 100)})`);
  if (accel.dir !== 0 && accel.text) add(accel.dir, 1, accel.text);

  // hareket başladı mı: son 2 mumda itki ya da sıkışma kutusundan hacimli kapanış
  const last = bars[n - 1];
  const prevBox = n >= 8 ? bars.slice(-7, -1) : [];
  const pbHi = prevBox.length ? Math.max(...prevBox.map((b) => b.high)) : null;
  const pbLo = prevBox.length ? Math.min(...prevBox.map((b) => b.low)) : null;
  const lvAvg = median(bars.slice(Math.max(0, n - 11), n - 1).map((b) => b.volume || 0));
  const lvr = lvAvg > 0 ? (last.volume || 0) / lvAvg : 0;
  const boxUp = pbHi != null && last.close > pbHi && lvr >= 1.2;
  const boxDn = pbLo != null && last.close < pbLo && lvr >= 1.2;
  if (boxUp) add(1, 1.5, `Son 30 dk kutusunun tepesi (${fmt(pbHi!)}) ${lvr.toFixed(1)}× hacimle yukarı kırıldı`);
  if (boxDn) add(-1, 1.5, `Son 30 dk kutusunun dibi (${fmt(pbLo!)}) ${lvr.toFixed(1)}× hacimle aşağı kırıldı`);
  // açılış aralığı (ilk 15 dk) kırılımı — günün ilk yön hareketi çoğu zaman buradan başlar
  let orUp = false, orDn = false;
  if (n >= 4) {
    const or = bars.slice(0, 3);
    const orHi = Math.max(...or.map((b) => b.high)), orLo = Math.min(...or.map((b) => b.low));
    const fresh = (k: number) => k >= 3 && k >= n - 2;
    for (let k = 3; k < n; k++) {
      const c = bars[k].close, pc = bars[k - 1].close;
      if (fresh(k) && c < orLo && pc >= orLo) orDn = true;
      if (fresh(k) && c > orHi && pc <= orHi) orUp = true;
    }
    if (orDn) add(-1, 2, `Açılış aralığının dibi (${fmt(orLo)}) aşağı kırıldı — 5m kapanış ${fmt(last.close)}`);
    if (orUp) add(1, 2, `Açılış aralığının tepesi (${fmt(orHi)}) yukarı kırıldı — 5m kapanış ${fmt(last.close)}`);
    const vNow = s5.vwap[n - 1];
    if (!orDn && last.close < orLo && vNow != null && last.close < vNow) add(-1, 0.5, `Fiyat açılış aralığının ve VWAP'ın altında`);
    if (!orUp && last.close > orHi && vNow != null && last.close > vNow) add(1, 0.5, `Fiyat açılış aralığının ve VWAP'ın üstünde`);
  }
  const pushUp = recent.some((e) => e.kind === "PUSH_UP" && e.time >= bars[Math.max(0, n - 2)].time);
  const pushDn = recent.some((e) => e.kind === "PUSH_DOWN" && e.time >= bars[Math.max(0, n - 2)].time);

  let level: EarlyWarning["level"] = "NONE";
  let side: EarlyWarning["side"] = null;
  if (bull >= 3 && bull >= bear + 1.5) { side = "LONG"; level = boxUp || pushUp || orUp ? "STARTED" : "BUILDING"; }
  else if (bear >= 3 && bear >= bull + 1.5) { side = "SHORT"; level = boxDn || pushDn || orDn ? "STARTED" : "BUILDING"; }

  // — hedefler: hareket yönündeki süpürülmemiş havuzlar + profil seviyeleri + gün uçları —
  const dayHi = Math.max(...bars.map((b) => b.high)), dayLo = Math.min(...bars.map((b) => b.low));
  const cands: { price: number; label: string }[] = [];
  for (const p of pools) if (!p.swept) cands.push({ price: p.price, label: `${p.label} likiditesi` });
  if (profile) {
    cands.push({ price: profile.poc, label: "POC" }, { price: profile.vah, label: "VAH (değer alanı üstü)" }, { price: profile.val, label: "VAL (değer alanı altı)" });
  }
  cands.push({ price: dayHi, label: "Gün zirvesi" }, { price: dayLo, label: "Gün dibi" });
  const dirUp = side ? side === "LONG" : bull >= bear;
  const targets: FlowTarget[] = [];
  for (const c of cands
    .filter((c) => (dirUp ? c.price > price + 0.15 : c.price < price - 0.15))
    .sort((a, b) => (dirUp ? a.price - b.price : b.price - a.price))) {
    if (targets.some((t) => Math.abs(t.price - c.price) < 0.12)) continue;
    targets.push({ price: r2(c.price), label: c.label, dist: r2(Math.abs(c.price - price)) });
    if (targets.length >= 3) break;
  }
  // ölçülü hareket: sıkışma kutusu yüksekliği kırılım yönüne
  if ((boxUp || boxDn) && pbHi != null && pbLo != null) {
    const h = pbHi - pbLo;
    const mm = r2(boxUp ? pbHi + h : pbLo - h);
    if (!targets.some((t) => Math.abs(t.price - mm) < 0.12)) targets.push({ price: mm, label: "Ölçülü hareket (kutu yüksekliği)", dist: r2(Math.abs(mm - price)) });
  }

  const lastLow = lows.length ? lows[lows.length - 1].price : dayLo;
  const lastHigh = highs.length ? highs[highs.length - 1].price : dayHi;
  const invalidation = side === "LONG" ? r2(Math.min(lastLow, last.low) - 0.05) : side === "SHORT" ? r2(Math.max(lastHigh, last.high) + 0.05) : null;

  const headline =
    level === "STARTED" ? `${side === "LONG" ? "▲ YUKARI" : "▼ AŞAĞI"} HAREKET BAŞLADI — ivme ${side === "LONG" ? "alıcıda" : "satıcıda"}`
    : level === "BUILDING" ? `${side === "LONG" ? "▲ LONG" : "▼ SHORT"} HAZIRLIĞI — ${side === "LONG" ? "alıcı" : "satıcı"} izleri birikiyor, tetik bekleniyor`
    : compression.active ? "◆ SIKIŞMA — fiyat daralıyor, kırılım yakın (yön için kutu kırılımını bekle)"
    : "Sakin — belirgin akıllı para / likidite izi yok";

  return {
    profile, swings, pools, events, cumDelta, delta30, deltaPct30, deltaSeries, compression, accel,
    warning: { level, side, bull: r2(bull), bear: r2(bear), bullWhy, bearWhy, headline, targets, invalidation },
  };
}
