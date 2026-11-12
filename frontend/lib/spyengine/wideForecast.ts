/**
 * Geniş Harita tahmini — saf, izomorfik (2026-11-12, kullanıcı isteği; v2 aynı gün: daha gerçekçi yollar).
 *
 * Bugünden itibaren 3 işlem günü için Monte Carlo senaryo hesabı:
 *   • Oynaklık: son ≤10 seansın 15m getiri sapması (σ15) GÜN İÇİ SAATE GÖRE ölçeklenir (açılış/kapanış daha oynak — her 15m dilimin
 *     kendi sapması, az örnekte genele doğru büzülür) + seans arası boşluk sapması (σgap). Hepsi GERÇEK veriden.
 *   • Seviye tepkisi: yol bir pivot seviyesine İLK kez değdiğinde %55 olasılıkla geri seker (mtfPivots.ts ölçümü: ilk temasta tutma
 *     %54–59, 44 seans, 5m). Böylece yollar seviyelerde duraksar/döner — düz çizgi yerine gerçek fiyat davranışına yakın.
 *   • Eğilim (drift): 4h okuması (htf4h.ts, −4…+4 puan) × küçük katsayı; son 4h mumun hacmi yönü teyit ediyorsa ×1,25, zayıfsa ×0,75.
 *     Katsayı ölçülmüş değil, "hafif eğim": puan +4 iken 3 günde yaklaşık +0,6σ kayma.
 * Sistem senaryoları: en yakın üst seviye (U1) ile alt seviyeye (D1) hangisine ÖNCE değileceği + ikisine de değmeme.
 * Kullanıcı senaryosu (isteğe bağlı): [H0 zayıf yükseliş] → L1 geri çekilme → T kırılım hedefi | B planı L2 — sıralı dokunma olasılıkları.
 * Her senaryo için TEMSİLİ YOL: o senaryoya düşen simülasyonlardan sınıf medyanına en yakın GERÇEK yol (mumlarıyla) — düzgün ortalama çizgi değil.
 *
 * DÜRÜSTLÜK: kalibre edilmiş bir tahmin modeli DEĞİL; olasılıklar "bu oynaklık, seviye tepkisi ve hafif eğimle neler olurdu"
 * sorusunun cevabıdır. Geriye dönük isabet ölçümü yapılmadı. Tohumlu rastgele sayı: aynı 4h kapanışı + aynı girdi → aynı sonuç.
 */

import { nyDateTimeToEpoch, nyParts, RTH_CLOSE_MIN, RTH_OPEN_MIN, type Bar } from "./core";
import type { Htf4hRead } from "./htf4h";

export const SLOT_MIN = 15;
export const SLOTS_PER_DAY = (RTH_CLOSE_MIN - RTH_OPEN_MIN) / SLOT_MIN; // 26
const N_PATHS = 3000;
const MICRO = 3; // slot başına alt adım (fitil/dokunma tespiti için)
/** pivotta ilk temasta geri sekme olasılığı (mtfPivots.ts: ilk temasta tutma %54–59) */
const HOLD_FIRST = 0.55;

export interface UserScenarioInput {
  h0?: number | null;
  l1: number | null;
  l2?: number | null;
  t?: number | null;
}

export interface WideInput {
  symbol: string;
  price: number;
  t: number;
  bars15: Bar[];
  read4h: Htf4hRead | null;
  levels: { price: number; label: string }[];
  user: UserScenarioInput | null;
  basis4h: number | null;
  volRatio4h: number | null;
}

export interface FutureSlot { time: number; day: number; endsAt: number }
export interface Ohlc { o: number; h: number; l: number; c: number }

export interface ClassPath {
  key: string;
  title: string;
  /** 0..100 */
  pct: number;
  /** slot sonu medyan yol (class üyelerinin); üye yoksa boş */
  median: number[];
  /** temsili gerçek simülasyon yolu (slot mumları); üye yoksa boş */
  rep: Ohlc[];
}

export interface LevelOdds { price: number; label: string; touchPct: number; side: "UP" | "DOWN" }

export interface UserResult {
  pH0: number | null;
  pL1: number;
  pMain: number | null;
  pPlanB: number | null;
  main: ClassPath | null;
  planB: ClassPath | null;
  l1Path: ClassPath | null;
}

export interface WideForecast {
  generatedAt: number;
  basis4h: number | null;
  slots: FutureSlot[];
  sigma15: number;
  sigmaDay: number;
  sigmaGap: number;
  tilt: number;
  tiltNote: string;
  cone: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  u1: { price: number; label: string };
  d1: { price: number; label: string };
  up: ClassPath;
  down: ClassPath;
  none: ClassPath;
  pU2: number | null;
  pD2: number | null;
  u2: { price: number; label: string } | null;
  d2: { price: number; label: string } | null;
  levelOdds: LevelOdds[];
  user: UserResult | null;
  lines: string[];
}

// ── yardımcılar ──────────────────────────────────────────────────

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const pctile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];

function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
const isWeekday = (ymd: string) => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return w >= 1 && w <= 5; };
const slotOfDay = (sec: number) => Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((nyParts(sec).minutes - RTH_OPEN_MIN) / SLOT_MIN)));

/** `t`'den sonraki 15m slotlar: bugünün kalanı (seans içindeyse) + sonraki `days` işlem günü (hafta sonu atlanır; tatiller bilinmez) */
export function futureSlots(t: number, days = 3): FutureSlot[] {
  const out: FutureSlot[] = [];
  const p = nyParts(t);
  let day = 0;
  const push = (ymd: string, fromMin: number) => {
    for (let m = fromMin; m < RTH_CLOSE_MIN; m += SLOT_MIN) {
      const s = nyDateTimeToEpoch(ymd, m);
      out.push({ time: s, day, endsAt: s + SLOT_MIN * 60 });
    }
  };
  let ymd = p.ymd;
  if (isWeekday(ymd)) {
    if (p.minutes < RTH_OPEN_MIN) push(ymd, RTH_OPEN_MIN);
    else if (p.minutes < RTH_CLOSE_MIN) push(ymd, Math.ceil((p.minutes + 0.01) / SLOT_MIN) * SLOT_MIN);
  }
  for (let k = 0; k < days; k++) {
    do { ymd = addDays(ymd, 1); } while (!isWeekday(ymd));
    day += 1;
    push(ymd, RTH_OPEN_MIN);
  }
  return out;
}

/** σ15 + gün içi dilim çarpanları (26) + seans arası boşluk σ */
function estimateVol(bars15: Bar[]): { sigma15: number; sigmaGap: number; mult: number[] } {
  const bySession = new Map<string, Bar[]>();
  for (const b of bars15) {
    const y = nyParts(b.time).ymd;
    const a = bySession.get(y) ?? [];
    a.push(b); bySession.set(y, a);
  }
  const days = [...bySession.keys()].sort().slice(-10);
  const rets: number[] = [];
  const bucket: number[][] = Array.from({ length: SLOTS_PER_DAY }, () => []);
  const gaps: number[] = [];
  let prevClose: number | null = null;
  for (const y of days) {
    const bs = bySession.get(y)!;
    for (let i = 0; i < bs.length; i++) {
      // dilimin kendi hareketi: açılış dilimi için open→close, diğerleri önceki kapanış→kapanış
      const from = i === 0 ? bs[0].open : bs[i - 1].close;
      if (from > 0 && bs[i].close > 0) {
        const r = Math.log(bs[i].close / from);
        rets.push(r);
        bucket[slotOfDay(bs[i].time)].push(r);
      }
    }
    if (prevClose != null && bs[0].open > 0) gaps.push(Math.log(bs[0].open / prevClose));
    prevClose = bs[bs.length - 1].close;
  }
  const rms = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
  const sigma15 = Math.max(0.0004, rets.length >= 20 ? rms(rets) : 0.0012);
  const sigmaGap = Math.max(0.0003, gaps.length >= 3 ? rms(gaps) : sigma15 * 3);
  // dilim çarpanı: az örnekte 1'e doğru büzülür (n/(n+5)), 0,6–2,2 arasında sınırlı
  const mult = bucket.map((a) => {
    if (!a.length) return 1;
    const w = a.length / (a.length + 5);
    const m = rms(a) / sigma15;
    return Math.min(2.2, Math.max(0.6, w * m + (1 - w)));
  });
  return { sigma15, sigmaGap, mult };
}

// ── ana hesap ────────────────────────────────────────────────────

export function buildWideForecast(inp: WideInput): WideForecast | null {
  const { price, t } = inp;
  if (!(price > 0) || inp.bars15.length < 20) return null;
  const slots = futureSlots(t, 3);
  if (slots.length < 10) return null;
  const S = slots.length;

  const { sigma15, sigmaGap, mult } = estimateVol(inp.bars15);
  const sigmaDay = sigma15 * Math.sqrt(SLOTS_PER_DAY);
  const slotMult = slots.map((s) => mult[slotOfDay(s.time)]);

  // eğim: 4h puanı × 0,015σ15 / slot; hacim teyidi ×1,25 · zayıf hacim ×0,75
  const score = inp.read4h?.score ?? 0;
  let tilt = 0.015 * score * sigma15;
  let tiltNote = inp.read4h ? `4h ${inp.read4h.dir === "UP" ? "YUKARI" : inp.read4h.dir === "DOWN" ? "AŞAĞI" : "YATAY"} (${score > 0 ? "+" : ""}${score})` : "4h veri yok — eğim 0";
  if (inp.volRatio4h != null && score !== 0) {
    const lastBull = (inp.read4h?.last?.close ?? 0) >= (inp.read4h?.last?.open ?? 0);
    const agree = (score > 0) === lastBull;
    if (inp.volRatio4h >= 1.5 && agree) { tilt *= 1.25; tiltNote += " · yüksek hacimle teyitli (×1,25)"; }
    else if (inp.volRatio4h <= 0.6) { tilt *= 0.75; tiltNote += " · zayıf hacim (×0,75)"; }
  }

  // seviyeler (yakın kopyalar birleştirilir)
  const lv: { price: number; label: string }[] = [];
  for (const l of [...inp.levels].filter((x) => Number.isFinite(x.price)).sort((a, b) => a.price - b.price)) {
    const prev = lv[lv.length - 1];
    if (prev && Math.abs(prev.price - l.price) < 0.05 * sigmaDay * price) { if (!prev.label.includes(l.label)) prev.label = `${prev.label} · ${l.label}`; continue; }
    lv.push({ ...l });
  }
  const minDist = 0.35 * sigmaDay * price;
  const ups = lv.filter((l) => l.price >= price + minDist);
  const dns = lv.filter((l) => l.price <= price - minDist).reverse();
  const u1 = ups[0] ?? { price: +(price * (1 + sigmaDay * 0.8)).toFixed(2), label: "+0,8σ (seviye yok)" };
  const d1 = dns[0] ?? { price: +(price * (1 - sigmaDay * 0.8)).toFixed(2), label: "−0,8σ (seviye yok)" };
  const u2 = ups[1] ?? null;
  const d2 = dns[1] ?? null;

  const user = inp.user && inp.user.l1 != null && inp.user.l1 > 0 ? inp.user : null;
  const watch = lv.filter((l) => Math.abs(l.price - price) <= 4 * sigmaDay * price);
  const react = watch.map((l) => Math.log(l.price));

  const rng = mulberry32(hashStr(`${inp.symbol}|${inp.basis4h ?? 0}|${Math.round(price * 100)}|${user ? `${user.h0}|${user.l1}|${user.l2}|${user.t}` : ""}`));
  let spare: number | null = null;
  const gauss = () => {
    if (spare != null) { const v = spare; spare = null; return v; }
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };

  const closes: Float32Array[] = [];
  const highs: Float32Array[] = [];
  const lows: Float32Array[] = [];
  const lvHit = new Array(watch.length).fill(0);
  const cls = new Int8Array(N_PATHS);
  let cU2 = 0, cD2 = 0;
  const uL1 = new Uint8Array(N_PATHS), uMain = new Uint8Array(N_PATHS), uB = new Uint8Array(N_PATHS);
  let nH0 = 0, nL1 = 0, nMain = 0, nB = 0;
  const useH0 = !!(user && user.h0 != null && user.h0 > price);
  const l1Below = user ? user.l1! < price : true;
  const sqM = Math.sqrt(MICRO);

  for (let n = 0; n < N_PATHS; n++) {
    const cArr = new Float32Array(S), hArr = new Float32Array(S), lArr = new Float32Array(S);
    let x = Math.log(price);
    let tU1 = -1, tD1 = -1;
    const tested = new Uint8Array(watch.length);
    let reachedU2 = false, reachedD2 = false;
    let stage = user ? (useH0 ? 0 : 1) : 9;
    let sawH0 = false, sawL1 = false, main = false, planB = false;

    for (let s = 0; s < S; s++) {
      if (s > 0 && slots[s].day !== slots[s - 1].day) x += sigmaGap * gauss(); // seans arası boşluk
      const sig = (sigma15 * slotMult[s]) / sqM;
      const drift = tilt / MICRO - 0.5 * sig * sig;
      let hi = x, lo = x;
      for (let m = 0; m < MICRO; m++) {
        const x0 = x;
        x += drift + sig * gauss();
        // seviye tepkisi: ilk temasta %55 geri seker
        for (let k = 0; k < react.length; k++) {
          if (tested[k]) continue;
          const L = react[k];
          if ((x0 < L && x >= L) || (x0 > L && x <= L)) {
            tested[k] = 1;
            lvHit[k]++;
            if (x >= L) hi = Math.max(hi, L); else lo = Math.min(lo, L);
            if (rng() < HOLD_FIRST) { x = L - (x - L) * 0.6; break; }
          }
        }
        if (x > hi) hi = x;
        if (x < lo) lo = x;
        const pHi = Math.exp(hi), pLo = Math.exp(lo);
        if (tU1 < 0 && pHi >= u1.price) tU1 = s * MICRO + m;
        if (tD1 < 0 && pLo <= d1.price) tD1 = s * MICRO + m;
        if (u2 && pHi >= u2.price) reachedU2 = true;
        if (d2 && pLo <= d2.price) reachedD2 = true;
        if (user) {
          if (stage === 0 && pHi >= user.h0!) { stage = 1; sawH0 = true; }
          else if (stage === 1 && (l1Below ? pLo <= user.l1! : pHi >= user.l1!)) { stage = 2; sawL1 = true; }
          else if (stage === 2) {
            if (user.t != null && pHi >= user.t) { stage = 3; main = true; }
            else if (user.l2 != null && pLo <= user.l2) { stage = 3; planB = true; }
          }
        }
      }
      cArr[s] = Math.exp(x); hArr[s] = Math.exp(hi); lArr[s] = Math.exp(lo);
    }
    closes.push(cArr); highs.push(hArr); lows.push(lArr);
    cls[n] = tU1 >= 0 && (tD1 < 0 || tU1 < tD1) ? 0 : tD1 >= 0 && (tU1 < 0 || tD1 <= tU1) ? 1 : 2;
    if (reachedU2) cU2++;
    if (reachedD2) cD2++;
    if (sawH0) nH0++;
    if (sawL1) { nL1++; uL1[n] = 1; }
    if (main) { nMain++; uMain[n] = 1; }
    if (planB) { nB++; uB[n] = 1; }
  }

  const pct = (c: number) => Math.round((c / N_PATHS) * 1000) / 10;

  /** sınıf medyanı + medyana en yakın GERÇEK yol (mumlarıyla) */
  const classOf = (pred: (i: number) => boolean): { median: number[]; rep: Ohlc[] } => {
    const idx: number[] = [];
    for (let i = 0; i < N_PATHS; i++) if (pred(i)) idx.push(i);
    if (idx.length < 20) return { median: [], rep: [] };
    const sample = idx.length > 1500 ? idx.filter((_, k) => k % Math.ceil(idx.length / 1500) === 0) : idx;
    const med: number[] = [];
    for (let s = 0; s < S; s++) med.push(median(sample.map((i) => closes[i][s])));
    let best = sample[0], bestErr = Infinity;
    for (const i of sample) {
      let e = 0;
      for (let s = 0; s < S; s++) { const d = closes[i][s] - med[s]; e += d * d; }
      if (e < bestErr) { bestErr = e; best = i; }
    }
    const rep: Ohlc[] = [];
    for (let s = 0; s < S; s++) {
      const o = s === 0 ? price : closes[best][s - 1];
      rep.push({ o, h: Math.max(highs[best][s], o), l: Math.min(lows[best][s], o), c: closes[best][s] });
    }
    return { median: med, rep };
  };

  // koni
  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  for (let s = 0; s < S; s++) {
    const col = closes.map((a) => a[s]).sort((a, b) => a - b);
    p10.push(pctile(col, 0.1)); p25.push(pctile(col, 0.25)); p50.push(pctile(col, 0.5)); p75.push(pctile(col, 0.75)); p90.push(pctile(col, 0.9));
  }

  let c0 = 0, c1 = 0, c2 = 0;
  for (let i = 0; i < N_PATHS; i++) { if (cls[i] === 0) c0++; else if (cls[i] === 1) c1++; else c2++; }
  const mk = (key: string, title: string, k: number, c: number): ClassPath => ({ key, title, pct: pct(c), ...classOf((i) => cls[i] === k) });
  const up = mk("up", `▲ ${u1.price.toFixed(2)} (${u1.label}) önce`, 0, c0);
  const down = mk("down", `▼ ${d1.price.toFixed(2)} (${d1.label}) önce`, 1, c1);
  const none = mk("none", "İkisine de değmez (aralık)", 2, c2);

  const levelOdds: LevelOdds[] = watch.map((l, k) => ({
    price: l.price, label: l.label, touchPct: pct(lvHit[k]), side: l.price >= price ? "UP" as const : "DOWN" as const,
  })).sort((a, b) => b.price - a.price);

  let userRes: UserResult | null = null;
  if (user) {
    userRes = {
      pH0: useH0 ? pct(nH0) : null,
      pL1: pct(nL1),
      pMain: user.t != null ? pct(nMain) : null,
      pPlanB: user.l2 != null ? pct(nB) : null,
      main: user.t != null ? { key: "umain", title: `Senin ana senaryon → ${user.t.toFixed(2)}`, pct: pct(nMain), ...classOf((i) => uMain[i] === 1) } : null,
      planB: user.l2 != null ? { key: "uplanb", title: `B planı → ${user.l2.toFixed(2)}`, pct: pct(nB), ...classOf((i) => uB[i] === 1) } : null,
      l1Path: { key: "ul1", title: `Geri çekilme → ${user.l1!.toFixed(2)}`, pct: pct(nL1), ...classOf((i) => uL1[i] === 1) },
    };
  }

  const openMult = mult[0], midMult = mult[Math.floor(SLOTS_PER_DAY / 2)], closeMult = mult[SLOTS_PER_DAY - 1];
  const lines: string[] = [];
  lines.push(`Oynaklık: 15m σ %${(sigma15 * 100).toFixed(3)} · günlük σ %${(sigmaDay * 100).toFixed(2)} (≈ ${(sigmaDay * price).toFixed(2)} puan) · seans arası boşluk σ %${(sigmaGap * 100).toFixed(2)}.`);
  lines.push(`Gün içi oynaklık profili (ölçülen): açılış ×${openMult.toFixed(2)} · öğlen ×${midMult.toFixed(2)} · kapanış ×${closeMult.toFixed(2)}.`);
  lines.push(`Eğim: ${tiltNote}. Seviye tepkisi: ilk temasta %${Math.round(HOLD_FIRST * 100)} geri sekme.`);
  lines.push(`3 işlem günü içinde önce ${u1.price.toFixed(2)} (${u1.label}) %${up.pct} · önce ${d1.price.toFixed(2)} (${d1.label}) %${down.pct} · ikisine de değmez %${none.pct}.`);
  if (u2) lines.push(`Üstte bir sonraki seviye ${u2.price.toFixed(2)} (${u2.label}): 3 günde değme %${pct(cU2)}.`);
  if (d2) lines.push(`Altta bir sonraki seviye ${d2.price.toFixed(2)} (${d2.label}): 3 günde değme %${pct(cD2)}.`);
  lines.push(`3 gün sonu aralığı: %50 olasılıkla ${p25[S - 1].toFixed(2)}–${p75[S - 1].toFixed(2)} · %80 olasılıkla ${p10[S - 1].toFixed(2)}–${p90[S - 1].toFixed(2)} · medyan ${p50[S - 1].toFixed(2)}.`);

  return {
    generatedAt: t, basis4h: inp.basis4h, slots, sigma15, sigmaDay, sigmaGap, tilt, tiltNote,
    cone: { p10, p25, p50, p75, p90 }, u1, d1, up, down, none,
    pU2: u2 ? pct(cU2) : null, pD2: d2 ? pct(cD2) : null, u2, d2, levelOdds, user: userRes, lines,
  };
}
