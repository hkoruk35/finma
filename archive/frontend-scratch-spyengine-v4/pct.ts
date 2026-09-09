/**
 * Kullanıcının tarif ettiği yöntemin birebir ölçümü — DOĞRU HEDEF FONKSİYONU
 * ile: prim üzerinden % getiri.
 *
 * Önceki ölçümüm SPY'ın DOLAR hareketini maksimize ediyordu. Bu yanlıştı:
 * eşit sermaye ile işlem açıldığında getiri, primin YÜZDESİ olarak birikir.
 * $0,30 primli bir kontratta $0,15'lik hareket +%50; $1,50 primli birinde
 * aynı $0,15 sadece +%10. Dolar metriği ucuz primli (yüksek gamma kaldıraçlı)
 * işlemleri sistematik olarak küçümsüyordu.
 *
 * Ayrıca "mum paterni" hiç kapı olarak test edilmemişti — burada var.
 */
import {
  normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay,
  nyParts, nyDateTimeToEpoch, rsi, sma,
  RTH_OPEN_MIN, ENTRY_START_MIN, ENTRY_END_MIN, atr, type Bar,
} from "../lib/spyengine/core";
import { buildOptionSymbol, atmStrike } from "../lib/spyengine/strategy";

const H = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json", Referer: "https://finance.yahoo.com/",
};
const SPAN: Record<string, number> = { "1m": 60, "5m": 300 };

async function chart(sym: string, iv: string, range: string): Promise<Bar[]> {
  const raw = await (await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=${iv}&range=${range}&includePrePost=true`,
    { headers: H })).json();
  const r = raw?.chart?.result?.[0];
  if (!r) return [];
  const ts: number[] = r.timestamp || [];
  const q = r.indicators?.quote?.[0] || {};
  const out: Bar[] = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.open?.[i] == null || q.close?.[i] == null) continue;
    out.push({ time: ts[i], open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i], volume: q.volume?.[i] ?? 0 });
  }
  const s = SPAN[iv] ?? 0;
  return dropBadPrints(s ? snapToInterval(normalizeBars(out), s) : normalizeBars(out)).bars;
}

const hm = (t: number) => nyParts(t).hhmm;
const dirOf = (b: Bar) => (b.close > b.open ? 1 : b.close < b.open ? -1 : 0);
const body = (b: Bar) => Math.abs(b.close - b.open);
const range = (b: Bar) => Math.max(1e-9, b.high - b.low);
/** Kapanışın mum aralığındaki konumu: 1 = tepede kapanmış, 0 = dipte */
const closePos = (b: Bar) => (b.close - b.low) / range(b);

interface Cfg {
  name: string;
  streak: number;
  exitStreak: number;
  /** mum paterni: gövde/aralık en az bu kadar olmalı (0 = kapalı) */
  bodyMin: number;
  /** mum paterni: kapanış, yön tarafındaki bu orandan iyi olmalı (0 = kapalı) */
  closeMin: number;
  /** mum paterni: 2. mum 1.'nin dip/tepesini bozmamalı */
  structure: boolean;
  volume: boolean;
  rsi1m: boolean;
  candle5m: boolean;
  rsi5m: boolean;
  /** çıkışta da aynı kapı seti uygulansın mı */
  symmetricExit: boolean;
  perHour: number | null;
}

interface Ctx { m1: Bar[]; m5: Bar[]; r1: (number | null)[]; r5: (number | null)[]; va: (number | null)[] }
const ctxOf = (m1: Bar[], m5: Bar[]): Ctx => ({
  m1, m5,
  r1: rsi(m1.map((b) => b.close), 14),
  r5: rsi(m5.map((b) => b.close), 14),
  va: sma(m1.map((b) => b.volume || 0), 15),
});

/** Yön onayı: mum paterni + hacim + 1m RSI + 5m mum + 5m RSI */
function confirms(c: Ctx, i: number, c5: number, side: 1 | -1, g: Cfg): boolean {
  const b = c.m1[i], prev = c.m1[i - 1];
  if (g.bodyMin > 0 && body(b) / range(b) < g.bodyMin) return false;
  if (g.closeMin > 0) {
    const pos = side === 1 ? closePos(b) : 1 - closePos(b);
    if (pos < g.closeMin) return false;
  }
  if (g.structure) {
    if (side === 1 ? b.low < prev.low : b.high > prev.high) return false;
  }
  if (g.volume) {
    const v = c.va[i - 1];
    if (v != null && v > 0 && (b.volume || 0) < v) return false;
  }
  if (g.rsi1m) {
    const r = c.r1[i], rp = c.r1[i - 1];
    if (r == null || rp == null || (side === 1 ? r <= rp : r >= rp)) return false;
  }
  if (g.candle5m) {
    if (c5 < 0 || dirOf(c.m5[c5]) !== side) return false;
  }
  if (g.rsi5m) {
    if (c5 < 1) return false;
    const r = c.r5[c5], rp = c.r5[c5 - 1];
    if (r == null || rp == null || (side === 1 ? r < rp : r > rp)) return false;
  }
  return true;
}

function scanExit(c: Ctx, i0: number, side: 1 | -1, eod: number, g: Cfg): { idx: number; reason: string } {
  let against = 0, c5 = -1;
  for (let i = i0 + 1; i < c.m1.length; i++) {
    const b = c.m1[i];
    while (c5 + 1 < c.m5.length && c.m5[c5 + 1].time + 300 <= b.time + 60) c5++;
    if (b.time >= eod) return { idx: i, reason: "EOD" };
    const d = dirOf(b);
    if (d === -side) against++;
    else if (d === side) against = 0;
    if (against >= g.exitStreak) {
      // "çıkışlarda da aynı yöntemi uyguladım" — aynı onay seti, ters yönde
      if (!g.symmetricExit || confirms(c, i, c5, -side as 1 | -1, g)) {
        return { idx: i, reason: "REV" };
      }
    }
  }
  return { idx: c.m1.length - 1, reason: "SON" };
}

function run(m1: Bar[], m5: Bar[], date: string, g: Cfg) {
  const c = ctxOf(m1, m5);
  const eod = nyDateTimeToEpoch(date, RTH_OPEN_MIN) + (15 * 60 + 45 - RTH_OPEN_MIN) * 60;
  const out: { i0: number; side: 1 | -1; exitIdx: number; reason: string }[] = [];
  let sd = 0, sl = 0, c5 = -1, blocked = -Infinity;
  const recent: number[] = [];

  for (let i = 1; i < m1.length; i++) {
    const b = m1[i];
    while (c5 + 1 < m5.length && m5[c5 + 1].time + 300 <= b.time + 60) c5++;
    const d = dirOf(b);
    if (d === 0) { sd = 0; sl = 0; continue; }
    if (d === sd) sl++; else { sd = d; sl = 1; }
    if (b.time < blocked || sl !== g.streak) continue;
    const p = nyParts(b.time);
    if (p.ymd !== date || p.minutes < ENTRY_START_MIN || p.minutes >= ENTRY_END_MIN) continue;
    const side = sd as 1 | -1;
    if (!confirms(c, i, c5, side, g)) continue;
    if (g.perHour != null) {
      while (recent.length && b.time - recent[0] > 3600) recent.shift();
      if (recent.length >= g.perHour) continue;
    }
    const ex = scanExit(c, i, side, eod, g);
    out.push({ i0: i, side, exitIdx: ex.idx, reason: ex.reason });
    recent.push(b.time);
    const corr = m1.find((x) => x.time > m1[ex.idx].time && dirOf(x) === -side);
    blocked = corr ? corr.time : Infinity;
  }
  return { c, trades: out };
}

async function main() {
  const date = process.argv[2] ?? "2026-08-31";
  const [m1All, m5All] = await Promise.all([chart("SPY", "1m", "5d"), chart("SPY", "5m", "5d")]);
  const m1 = barsOfSessionDay(m1All, date);

  const base: Cfg = {
    name: "", streak: 2, exitStreak: 2, bodyMin: 0, closeMin: 0, structure: false,
    volume: true, rsi1m: true, candle5m: true, rsi5m: true, symmetricExit: true, perHour: 3,
  };
  const cfgs: Cfg[] = [
    { ...base, name: "V3.2 mevcut (3 giriş/3 çıkış, patern yok)", streak: 3, exitStreak: 3, symmetricExit: false },
    { ...base, name: "K1 2/2 simetrik, patern yok" },
    { ...base, name: "K2 2/2 + gövde≥0.5",                    bodyMin: 0.5 },
    { ...base, name: "K3 2/2 + gövde≥0.5 + kapanış≥0.6",      bodyMin: 0.5, closeMin: 0.6 },
    { ...base, name: "K4 2/2 + gövde≥0.6 + kapanış≥0.7",      bodyMin: 0.6, closeMin: 0.7 },
    { ...base, name: "K5 K3 + yapı (dip/tepe bozulmasın)",    bodyMin: 0.5, closeMin: 0.6, structure: true },
    { ...base, name: "K6 K3 ama çıkış 3 mum",                 bodyMin: 0.5, closeMin: 0.6, exitStreak: 3 },
    { ...base, name: "K7 3/2 + gövde≥0.5 + kapanış≥0.6",      streak: 3, bodyMin: 0.5, closeMin: 0.6 },
    { ...base, name: "K8 K3 + saat kotası yok",               bodyMin: 0.5, closeMin: 0.6, perHour: null },
  ];

  // Tüm konfigürasyonların dokunduğu adaylar için primleri bir kez çek
  const premOf = new Map<string, Bar[]>();
  for (const g of cfgs) {
    const { trades } = run(m1, m5All, date, g);
    for (const t of trades) {
      const b = m1[t.i0];
      const key = `${b.time}:${t.side}`;
      if (premOf.has(key)) continue;
      premOf.set(key, await chart(buildOptionSymbol("SPY", date, t.side === 1, atmStrike(b.close)), "1m", "5d"));
    }
  }

  console.log(`${date} · hedef: PRİM ÜZERİNDEN % GETİRİ (eşit sermaye)\n`);
  console.log("konfigürasyon".padEnd(44), "işlem", "kazanan", " ort.%", " TOPLAM%", " ort.$");
  const details = new Map<string, string[]>();
  for (const g of cfgs) {
    const { c, trades } = run(m1, m5All, date, g);
    let n = 0, wins = 0, pctSum = 0, dollarSum = 0;
    const det: string[] = [];
    for (const t of trades) {
      const prem = premOf.get(`${c.m1[t.i0].time}:${t.side}`);
      if (!prem?.length) continue;
      const e = prem.find((b) => b.time >= c.m1[t.i0].time)?.close;
      const x = prem.find((b) => b.time >= c.m1[t.exitIdx].time)?.close ?? prem[prem.length - 1].close;
      if (e == null || e <= 0) continue;
      const pct = ((x - e) / e) * 100;
      n++; pctSum += pct; dollarSum += (x - e) * 100; if (pct > 0) wins++;
      det.push(`  ${hm(c.m1[t.i0].time)} ${t.side === 1 ? "LONG " : "SHORT"} ${e.toFixed(2)} → ${hm(c.m1[t.exitIdx].time)} ${x.toFixed(2)}  ${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`);
    }
    if (!n) { console.log(g.name.padEnd(44), "0"); continue; }
    details.set(g.name, det);
    console.log(g.name.padEnd(44), String(n).padStart(4), `${wins}/${n}`.padStart(7),
      `${(pctSum / n).toFixed(1)}`.padStart(7), `${pctSum.toFixed(0)}`.padStart(8), `${(dollarSum / n).toFixed(0)}`.padStart(7));
  }

  // ── 5 SEANS ROBUSTLUK: ATR'ye normalize hareket ──
  // NOT (2026-09-02 düzeltmesi): "prim yalnızca bugün elde" doğru değil —
  // süresi dolmuş 0DTE primi range=5d ile geliyor (bkz. market.ts
  // fetchOptionSeries). Bu script yine de ölçek-bağımsız vekil kullanıyor,
  // çünkü 5 seansın ötesine de bakıyor.
  // ATM 0DTE primi beklenen oynaklıkla ölçeklendiği için "hareket / ATR"
  // prim üzerinden % getirinin makul bir vekilidir.
  console.log("");
  console.log("=== 5 SEANS ROBUSTLUK (hareket / ATR — % getiri vekili) ===");
  const days = [...new Set(m1All.map((b) => nyParts(b.time).ymd))].sort();
  console.log("konfigürasyon".padEnd(44), "işlem", "kazanan", " ort.ATR×", " TOPLAM");
  for (const g of cfgs) {
    let n = 0, wins = 0, sum = 0;
    for (const d of days) {
      const dm1 = barsOfSessionDay(m1All, d);
      if (dm1.length < 100) continue;
      const a = atr(dm1, 14);
      const { c, trades } = run(dm1, m5All, d, g);
      for (const t of trades) {
        const av = a[t.i0];
        if (av == null || av <= 0) continue;
        const move = (c.m1[t.exitIdx].close - c.m1[t.i0].close) * t.side;
        n++; sum += move / av; if (move > 0) wins++;
      }
    }
    if (!n) { console.log(g.name.padEnd(44), "0"); continue; }
    console.log(g.name.padEnd(44), String(n).padStart(4), `${wins}/${n}`.padStart(7),
      (sum / n).toFixed(2).padStart(9), sum.toFixed(1).padStart(8));
  }

  const best = [...details.keys()].sort((a, b) => {
    const sum = (k: string) => details.get(k)!.reduce((s, l) => s + parseFloat(l.slice(l.lastIndexOf(" ") + 1)), 0);
    return sum(b) - sum(a);
  })[0];
  console.log(`\n--- ${best} ---`);
  details.get(best)!.forEach((d) => console.log(d));
}

main().catch((e) => { console.error(e); process.exit(1); });
