/**
 * Geniş Harita tahmini — saf, izomorfik. v3 (2026-11-12, kullanıcı incelemesi sonrası).
 *
 * Model (her girdi gerçek veriden, uydurma yön yok):
 *   • YÖN EĞİMİ (drift) = 0. 4h okuması yalnız bilgi olarak gösterilir; geçmişte işe yaradığı ölçülmeden olasılığa girmez.
 *     Kayıt + kalibrasyon (evaluateSnapshots) modelin mesafe-oranı baseline'ını geçip geçmediğini ölçer.
 *   • Başlangıç: seans içindeyse anlık fiyat; seans dışındaysa SON RTH KAPANIŞI — açılış, tarihsel gece boşluğu dağılımından
 *     (bootstrap) üretilir. Seans dışı fiyat ayrı bilgi olarak gösterilir. Dokunuşlar yalnız RTH içinde sayılır.
 *   • Getiriler: son ≤10 seansın 15m getirileri, gün içi dilim oynaklığına bölünüp (U şekli) ortalaması sıfırlanır,
 *     4'lük bloklar hâlinde yeniden örneklenir (blok bootstrap: kalın kuyruk + kısa otokorelasyon korunur).
 *   • Oynaklık seviyesi: varsa örtük oynaklık (SPY ^VIX · QQQ ^VXN · IWM ^RVX; günlük σ = IV/√252) — piyasanın fiyatladığı aralık.
 *     Yoksa (hisseler) gerçekleşen oynaklık. Makro/Fed takvimi verisi yok — o günlere ayrı varyans verilmez.
 *   • Pivot tepkisi: bir seviyeye ilk temasta %55 geri sekme (mtfPivots.ts: ilk temasta tutma %54–59, 44 seans).
 * Çıktı: önce hangi seviye (+%95 güven aralığı, mesafe oranı baseline'ı), zamana bağlı dokunuş, koni, medoid yol + örnek yollar.
 * Kalibre edilmiş bir model DEĞİLDİR; doğruluğu kayıt üzerinden ölçülür.
 */

import { nyDateTimeToEpoch, nyParts, RTH_CLOSE_MIN, RTH_OPEN_MIN, type Bar } from "./core";

export const SLOT_MIN = 15;
export const SLOTS_PER_DAY = (RTH_CLOSE_MIN - RTH_OPEN_MIN) / SLOT_MIN; // 26
export const N_PATHS = 3000;
const MICRO = 3;
const BLOCK = 4;
const HOLD_FIRST = 0.55;

export interface WideInput {
  symbol: string;
  /** anlık fiyat (seans dışında AH/PM olabilir) */
  livePrice: number;
  t: number;
  /** kapanmış RTH 15m mumlar (çok günlük) */
  bars15: Bar[];
  levels: { price: number; label: string }[];
  /** yıllık örtük oynaklık (0,17 = %17); yoksa null */
  ivAnnual: number | null;
  ivLabel: string | null;
  basis4h: number | null;
}

export interface FutureSlot { time: number; day: number; endsAt: number }

export interface ClassPath {
  key: "up" | "down" | "none";
  /** 0..100, tam sayı */
  pct: number;
  /** %95 güven aralığı yarı genişliği (puan) */
  ci: number;
  /** medoid yol (slot sonu kapanışlar) */
  medoid: number[];
  /** soluk çizilecek örnek yollar */
  samples: number[][];
}

export interface TouchRow { label: string; slot: number; up: number; down: number }
export interface LevelOdds { price: number; label: string; touchPct: number; side: "UP" | "DOWN" }
export interface Quant { endsAt: number; slot: number; p10: number; p25: number; p50: number; p75: number; p90: number }

export interface WideForecast {
  generatedAt: number;
  basis4h: number | null;
  inRth: boolean;
  start: number;
  startNote: string;
  slots: FutureSlot[];
  sigma15: number;
  sigmaDay: number;
  sigmaDayRealized: number;
  volSource: string;
  cone: { p10: number[]; p25: number[]; p50: number[]; p75: number[]; p90: number[] };
  u1: { price: number; label: string };
  d1: { price: number; label: string };
  up: ClassPath;
  down: ClassPath;
  none: ClassPath;
  /** yön varsaymayan mesafe oranı: önce üst seviye olasılığı (%) */
  baseUp: number;
  touches: TouchRow[];
  dayEnds: Quant[];
  levelOdds: LevelOdds[];
  lines: string[];
  n: number;
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
const pctile = (sorted: number[], p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(p * (sorted.length - 1))))];
function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}
const isWeekday = (ymd: string) => { const w = new Date(`${ymd}T12:00:00Z`).getUTCDay(); return w >= 1 && w <= 5; };
const slotOfDay = (sec: number) => Math.min(SLOTS_PER_DAY - 1, Math.max(0, Math.floor((nyParts(sec).minutes - RTH_OPEN_MIN) / SLOT_MIN)));
const TR_MON = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
export const trDate = (ymd: string) => `${Number(ymd.slice(8, 10))} ${TR_MON[Number(ymd.slice(5, 7)) - 1]}`;
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** seans içi mi (hafta içi 09:30–16:00 ET) */
export function isRthNow(t: number): boolean {
  const p = nyParts(t);
  return isWeekday(p.ymd) && p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
}

/** `t`'den sonraki 15m slotlar: bugünün kalanı (seans içi/öncesi) + sonraki 3 işlem günü (hafta sonu atlanır; tatiller bilinmez) */
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

interface VolModel { sigma15: number; mult: number[]; sessions: number[][]; gaps: number[]; sigmaGap: number }

/** gerçekleşen oynaklık + dilim çarpanları + standartlaştırılmış (sıfır ortalamalı) getiri havuzu + gece boşlukları */
function volModel(bars15: Bar[]): VolModel {
  const bySession = new Map<string, Bar[]>();
  for (const b of bars15) {
    const y = nyParts(b.time).ymd;
    const a = bySession.get(y) ?? [];
    a.push(b); bySession.set(y, a);
  }
  const days = [...bySession.keys()].sort().slice(-10);
  const raw: { r: number; slot: number }[][] = [];
  const bucket: number[][] = Array.from({ length: SLOTS_PER_DAY }, () => []);
  const all: number[] = [];
  const gaps: number[] = [];
  let prevClose: number | null = null;
  for (const y of days) {
    const bs = bySession.get(y)!;
    const sess: { r: number; slot: number }[] = [];
    for (let i = 0; i < bs.length; i++) {
      const from = i === 0 ? bs[0].open : bs[i - 1].close;
      if (from > 0 && bs[i].close > 0) {
        const r = Math.log(bs[i].close / from);
        const slot = slotOfDay(bs[i].time);
        sess.push({ r, slot }); bucket[slot].push(r); all.push(r);
      }
    }
    raw.push(sess);
    if (prevClose != null && bs[0].open > 0) gaps.push(Math.log(bs[0].open / prevClose));
    prevClose = bs[bs.length - 1].close;
  }
  const rms = (a: number[]) => Math.sqrt(a.reduce((x, y) => x + y * y, 0) / Math.max(1, a.length));
  const sigma15 = Math.max(0.0004, all.length >= 20 ? rms(all) : 0.0012);
  const mult = bucket.map((a) => {
    if (!a.length) return 1;
    const w = a.length / (a.length + 5);
    return Math.min(2.2, Math.max(0.6, w * (rms(a) / sigma15) + (1 - w)));
  });
  // standartlaştır + ortalamayı sıfırla (geçmişin yönü geleceğe taşınmasın)
  const zAll: number[] = [];
  const zs = raw.map((s) => s.map(({ r, slot }) => { const z = r / (sigma15 * mult[slot]); zAll.push(z); return z; }));
  const zMean = zAll.length ? zAll.reduce((a, b) => a + b, 0) / zAll.length : 0;
  const zRms = Math.sqrt(zAll.reduce((a, b) => a + (b - zMean) ** 2, 0) / Math.max(1, zAll.length)) || 1;
  const norm = zs.map((s) => s.map((z) => (z - zMean) / zRms));
  const gMean = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
  const g0 = gaps.map((g) => g - gMean);
  // blok örneklemesinde seans kenarları daha az seçilir — çekilen bir getirinin BEKLENEN değerini tam sıfırla (gizli yön eğimi kalmasın)
  const pool = norm.filter((s) => s.length >= BLOCK);
  let ew = 0;
  for (const sess of pool) {
    const starts = sess.length - BLOCK + 1;
    let e = 0;
    for (let st = 0; st < starts; st++) for (let j = 0; j < BLOCK; j++) e += sess[st + j];
    ew += e / (starts * BLOCK);
  }
  ew = pool.length ? ew / pool.length : 0;
  const sessions = pool.map((sess) => sess.map((z) => z - ew));
  return { sigma15, mult, sessions, gaps: g0, sigmaGap: Math.max(0.0003, g0.length >= 3 ? rms(g0) : sigma15 * 3) };
}

// ── ana hesap ────────────────────────────────────────────────────

export function buildWideForecast(inp: WideInput): WideForecast | null {
  const { t } = inp;
  if (inp.bars15.length < 30) return null;
  const inRth = isRthNow(t);
  const lastBar = inp.bars15[inp.bars15.length - 1];
  const start = inRth && inp.livePrice > 0 ? inp.livePrice : lastBar.close;
  const startNote = inRth
    ? `Seans içi — başlangıç anlık fiyat ${start.toFixed(2)}.`
    : `Seans dışı — başlangıç son RTH kapanışı ${start.toFixed(2)} (${trDate(nyParts(lastBar.time).ymd)} 16:00); açılış tarihsel gece boşluğundan üretilir. Seans dışı fiyat ${inp.livePrice > 0 ? inp.livePrice.toFixed(2) : "—"} yalnız bilgi.`;
  const slots = futureSlots(t, 3);
  if (slots.length < 10) return null;
  const S = slots.length;

  const vm = volModel(inp.bars15);
  if (!vm.sessions.length) return null;
  const sigmaDayRealized = vm.sigma15 * Math.sqrt(SLOTS_PER_DAY);
  const ivDay = inp.ivAnnual != null && inp.ivAnnual > 0 ? inp.ivAnnual / Math.sqrt(252) : null;
  // ölçek: hedef günlük σ (IV varsa IV, yoksa gerçekleşen) — gün içi profil ve gece boşluğu aynı oranla ölçeklenir
  const k = ivDay ? ivDay / sigmaDayRealized : 1;
  const sigma15 = vm.sigma15 * k;
  const sigmaDay = sigmaDayRealized * k;
  const volSource = ivDay
    ? `örtük oynaklık ${inp.ivLabel ?? "IV"} %${(inp.ivAnnual! * 100).toFixed(1)} → günlük σ %${(ivDay * 100).toFixed(2)} (gerçekleşen %${(sigmaDayRealized * 100).toFixed(2)})`
    : `gerçekleşen oynaklık (son ≤10 seans) günlük σ %${(sigmaDayRealized * 100).toFixed(2)} — bu sembolde örtük oynaklık verisi yok`;

  // seviyeler: yakın kopyalar birleştirilir (0,15 σgün)
  const lv: { price: number; label: string }[] = [];
  for (const l of [...inp.levels].filter((x) => Number.isFinite(x.price)).sort((a, b) => a.price - b.price)) {
    const prev = lv[lv.length - 1];
    if (prev && Math.abs(prev.price - l.price) < 0.15 * sigmaDay * start) { if (!prev.label.includes(l.label)) prev.label = `${prev.label} · ${l.label}`; continue; }
    lv.push({ ...l });
  }
  const minDist = 0.35 * sigmaDay * start;
  const ups = lv.filter((l) => l.price >= start + minDist);
  const dns = lv.filter((l) => l.price <= start - minDist).reverse();
  const u1 = ups[0] ?? { price: +(start * (1 + sigmaDay * 0.8)).toFixed(2), label: "+0,8σ (seviye yok)" };
  const d1 = dns[0] ?? { price: +(start * (1 - sigmaDay * 0.8)).toFixed(2), label: "−0,8σ (seviye yok)" };
  const watch = lv.filter((l) => Math.abs(l.price - start) <= 4 * sigmaDay * start);
  const react = watch.map((l) => Math.log(l.price));

  const rng = mulberry32(hashStr(`${inp.symbol}|${inp.basis4h ?? 0}|${Math.round(start * 100)}|${inRth ? Math.floor(t / 900) : 0}`));
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
  const drawGap = () => (vm.gaps.length >= 5 ? vm.gaps[Math.floor(rng() * vm.gaps.length)] * k : vm.sigmaGap * k * gauss());

  const slotSig = slots.map((s) => sigma15 * vm.mult[slotOfDay(s.time)]);
  const closes: Float32Array[] = [];
  const lvHit = new Array(watch.length).fill(0);
  const cls = new Int8Array(N_PATHS);
  const tU = new Int16Array(N_PATHS).fill(-1), tD = new Int16Array(N_PATHS).fill(-1);

  for (let n = 0; n < N_PATHS; n++) {
    const arr = new Float32Array(S);
    let x = Math.log(start);
    const tested = new Uint8Array(watch.length);
    let block: number[] = [], bi = 0;
    for (let s = 0; s < S; s++) {
      const newDay = s === 0 ? !inRth : slots[s].day !== slots[s - 1].day;
      if (newDay) { x += drawGap(); block = []; bi = 0; }
      if (bi >= block.length) {
        const sess = vm.sessions[Math.floor(rng() * vm.sessions.length)];
        const st = Math.floor(rng() * (sess.length - BLOCK + 1));
        block = sess.slice(st, st + BLOCK); bi = 0;
      }
      const sig = slotSig[s];
      const r = block[bi++] * sig;
      // slot içi 3 alt adım: toplamı r olan köprü (dokunuş tespiti için)
      const e1 = gauss() * sig * 0.4, e2 = gauss() * sig * 0.4;
      const steps = [r / 3 + e1, r / 3 + e2 - e1, r / 3 - e2];
      let hi = x, lo = x;
      for (let m = 0; m < MICRO; m++) {
        const x0 = x;
        x += steps[m];
        for (let kk = 0; kk < react.length; kk++) {
          if (tested[kk]) continue;
          const L = react[kk];
          if ((x0 < L && x >= L) || (x0 > L && x <= L)) {
            tested[kk] = 1; lvHit[kk]++;
            if (x >= L) hi = Math.max(hi, L); else lo = Math.min(lo, L);
            if (rng() < HOLD_FIRST) { x = L - (x - L) * 0.6; break; }
          }
        }
        if (x > hi) hi = x;
        if (x < lo) lo = x;
      }
      // açılış boşluğu seviyeyi atladıysa da dokunuş sayılır (RTH açılış fiyatı)
      if (tU[n] < 0 && Math.exp(hi) >= u1.price) tU[n] = s;
      if (tD[n] < 0 && Math.exp(lo) <= d1.price) tD[n] = s;
      arr[s] = Math.exp(x);
    }
    closes.push(arr);
    const a = tU[n], b = tD[n];
    cls[n] = a >= 0 && (b < 0 || a < b) ? 0 : b >= 0 && (a < 0 || b < a) ? 1 : a >= 0 && a === b ? (rng() < 0.5 ? 0 : 1) : 2;
  }

  const pctOf = (c: number) => (c / N_PATHS) * 100;
  const ciOf = (c: number) => { const p = c / N_PATHS; return 1.96 * Math.sqrt((p * (1 - p)) / N_PATHS) * 100; };

  const classOf = (key: ClassPath["key"], k0: number): ClassPath => {
    const idx: number[] = [];
    for (let i = 0; i < N_PATHS; i++) if (cls[i] === k0) idx.push(i);
    const c = idx.length;
    let medoid: number[] = [];
    if (idx.length >= 10) {
      const smp = idx.length > 300 ? idx.filter((_, j) => j % Math.ceil(idx.length / 300) === 0) : idx;
      let best = smp[0], bestD = Infinity;
      for (const i of smp) {
        let d = 0;
        for (const j of smp) { if (i === j) continue; let e = 0; for (let s = 0; s < S; s++) { const q = closes[i][s] - closes[j][s]; e += q * q; } d += Math.sqrt(e); }
        if (d < bestD) { bestD = d; best = i; }
      }
      medoid = Array.from(closes[best]);
    }
    const samples = idx.slice(0, 14).map((i) => Array.from(closes[i]));
    return { key, pct: Math.round(pctOf(c)), ci: Math.round(ciOf(c) * 10) / 10, medoid, samples };
  };

  const p10: number[] = [], p25: number[] = [], p50: number[] = [], p75: number[] = [], p90: number[] = [];
  for (let s = 0; s < S; s++) {
    const col = closes.map((a) => a[s]).sort((a, b) => a - b);
    p10.push(pctile(col, 0.1)); p25.push(pctile(col, 0.25)); p50.push(pctile(col, 0.5)); p75.push(pctile(col, 0.75)); p90.push(pctile(col, 0.9));
  }
  const up = classOf("up", 0), down = classOf("down", 1), none = classOf("none", 2);
  const baseUp = Math.round(((start - d1.price) / (u1.price - d1.price)) * 100);

  // zamana bağlı dokunuş: her gün 11:00 · 13:00 · kapanış
  const touches: TouchRow[] = [];
  const days = [...new Set(slots.map((s) => s.day))];
  for (const d of days) {
    const ds = slots.map((s, i) => ({ s, i })).filter((x) => x.s.day === d);
    const ymd = nyParts(ds[0].s.time).ymd;
    for (const cm of [11 * 60, 13 * 60, RTH_CLOSE_MIN]) {
      const cut = nyDateTimeToEpoch(ymd, cm);
      const last = ds.filter((x) => x.s.endsAt <= cut).pop();
      if (!last) continue;
      let cu = 0, cd = 0;
      for (let n = 0; n < N_PATHS; n++) { if (tU[n] >= 0 && tU[n] <= last.i) cu++; if (tD[n] >= 0 && tD[n] <= last.i) cd++; }
      touches.push({ label: `${trDate(ymd)} ${cm === RTH_CLOSE_MIN ? "kapanış" : hhmm(cm)}`, slot: last.i, up: Math.round(pctOf(cu)), down: Math.round(pctOf(cd)) });
    }
  }

  const dayEnds: Quant[] = days.map((d) => {
    const i = slots.map((s, j) => (s.day === d ? j : -1)).filter((j) => j >= 0).pop()!;
    return { endsAt: slots[i].endsAt, slot: i, p10: p10[i], p25: p25[i], p50: p50[i], p75: p75[i], p90: p90[i] };
  });

  const levelOdds: LevelOdds[] = watch.map((l, kk) => ({
    price: l.price, label: l.label, touchPct: Math.round(pctOf(lvHit[kk])), side: l.price >= start ? "UP" as const : "DOWN" as const,
  })).sort((a, b) => b.price - a.price);

  const lines: string[] = [];
  lines.push(startNote);
  lines.push(`Oynaklık: ${volSource}. Gün içi profil (ölçülen): açılış ×${vm.mult[0].toFixed(2)} · öğlen ×${vm.mult[13].toFixed(2)} · kapanış ×${vm.mult[SLOTS_PER_DAY - 1].toFixed(2)}.`);
  lines.push(`Getiriler: son ≤10 seansın 15m getirileri, ortalaması sıfırlanmış 4'lük blok bootstrap · gece boşluğu tarihsel dağılımdan (${vm.gaps.length} örnek) · yön eğimi YOK.`);
  lines.push(`Önce hangi seviye (3 işlem günü, yalnız RTH): ▲ ${u1.price.toFixed(2)} %${up.pct} ±${up.ci} · ▼ ${d1.price.toFixed(2)} %${down.pct} ±${down.ci} · ikisi de değil %${none.pct}. Yön varsaymayan mesafe oranı: ▲ %${baseUp} / ▼ %${100 - baseUp}.`);
  const de = dayEnds[dayEnds.length - 1];
  lines.push(`3. gün kapanış aralığı: %50 olasılıkla ${de.p25.toFixed(2)}–${de.p75.toFixed(2)} · %80 olasılıkla ${de.p10.toFixed(2)}–${de.p90.toFixed(2)} · medyan ${de.p50.toFixed(2)} (başlangıca göre ${de.p50 - start >= 0 ? "+" : ""}${(de.p50 - start).toFixed(2)}; yön eğimi yok — fark yalnız seviye tepkisinden ve örneklemeden).`);

  return {
    generatedAt: t, basis4h: inp.basis4h, inRth, start, startNote, slots, sigma15, sigmaDay, sigmaDayRealized, volSource,
    cone: { p10, p25, p50, p75, p90 }, u1, d1, up, down, none, baseUp, touches, dayEnds, levelOdds, lines, n: N_PATHS,
  };
}

// ── kayıt + kalibrasyon ─────────────────────────────────────────

export interface Snapshot {
  ts: number;
  basis4h: number | null;
  start: number;
  u1: number;
  d1: number;
  pUp: number;
  pDown: number;
  baseUp: number;
  /** ilk slotun başlangıcı — gerçekleşen bu andan sonraki RTH mumlarıyla ölçülür */
  from: number;
  dayEnds: Quant[];
  manual?: boolean;
}

export const toSnapshot = (fc: WideForecast, manual = false): Snapshot => ({
  ts: fc.generatedAt, basis4h: fc.basis4h, start: fc.start, u1: fc.u1.price, d1: fc.d1.price,
  pUp: fc.up.pct, pDown: fc.down.pct, baseUp: fc.baseUp, from: fc.slots[0].time, dayEnds: fc.dayEnds, manual,
});

export interface Calibration {
  /** önce-hangi sorusu çözülmüş tahmin sayısı */
  resolved: number;
  /** model Brier (iki sınıf, olasılıklar ikisi-arasında normalize) */
  brierModel: number | null;
  brierBase: number | null;
  /** kapsama: gerçekleşen gün sonu kapanışı bantta mı */
  cov80: { n: number; hit: number };
  cov50: { n: number; hit: number };
}

/** Kayıtlı tahminleri gerçekleşen RTH 15m mumlarla ölçer (yalnız mumların kapsadığı kısım) */
export function evaluateSnapshots(snaps: Snapshot[], bars15: Bar[]): Calibration {
  let resolved = 0, bm = 0, bb = 0;
  const cov80 = { n: 0, hit: 0 }, cov50 = { n: 0, hit: 0 };
  const lastT = bars15.length ? bars15[bars15.length - 1].time + SLOT_MIN * 60 : 0;
  for (const s of snaps) {
    if (s.manual) continue;
    const after = bars15.filter((b) => b.time >= s.from);
    // önce hangi seviye
    let out: 0 | 1 | null = null;
    for (const b of after) {
      const hu = b.high >= s.u1, hd = b.low <= s.d1;
      if (hu && hd) { out = null; break; }
      if (hu) { out = 1; break; }
      if (hd) { out = 0; break; }
    }
    if (out != null) {
      resolved++;
      const pm = s.pUp + s.pDown > 0 ? s.pUp / (s.pUp + s.pDown) : 0.5;
      const pb = s.baseUp / 100;
      bm += (pm - out) ** 2; bb += (pb - out) ** 2;
    }
    // gün sonu kapsaması
    for (const q of s.dayEnds) {
      if (q.endsAt > lastT) continue;
      const bar = bars15.find((b) => b.time + SLOT_MIN * 60 === q.endsAt);
      if (!bar) continue;
      cov80.n++; if (bar.close >= q.p10 && bar.close <= q.p90) cov80.hit++;
      cov50.n++; if (bar.close >= q.p25 && bar.close <= q.p75) cov50.hit++;
    }
  }
  return { resolved, brierModel: resolved ? bm / resolved : null, brierBase: resolved ? bb / resolved : null, cov80, cov50 };
}
