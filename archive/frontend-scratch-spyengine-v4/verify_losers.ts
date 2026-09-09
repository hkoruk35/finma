/**
 * Kullanıcının 2026-08-31'de kaybeden 9 gerçek işlemini, V3.3 giriş kapısının
 * ENGELLEYİP engellemeyeceğini tek tek kontrol eder.
 *
 * Yetkili karar `generateCandidates`ten (üretim kodu) gelir; kapı bileşenleri
 * ayrıca tek tek hesaplanıp gerekçe olarak yazdırılır.
 */
import {
  normalizeBars, snapToInterval, dropBadPrints, barsOfSessionDay,
  nyParts, nyDateTimeToEpoch, rsi, sma, RTH_OPEN_MIN, RTH_CLOSE_MIN, type Bar,
} from "../lib/spyengine/core";
import {
  generateCandidates, BODY_MIN_RATIO, CLOSE_POSITION_MIN, VOLUME_LOOKBACK, ENTRY_STREAK,
} from "../lib/spyengine/strategy";

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

const dirOf = (b: Bar) => (b.close > b.open ? "UP" : b.close < b.open ? "DOWN" : "NONE");

/** Kullanıcının kaybeden işlemleri (saat ET, yön, kayıp $) */
const LOSERS: [string, "LONG" | "SHORT", number][] = [
  ["09:35", "SHORT", -20], ["09:48", "LONG", -40], ["10:06", "LONG", -20],
  ["10:14", "LONG", -5],  ["10:53", "SHORT", -23], ["11:01", "LONG", -25],
  ["11:28", "LONG", -28], ["11:37", "SHORT", -5], ["12:51", "LONG", -5],
];

async function main() {
  const date = "2026-08-31";
  const [m1All, m5All] = await Promise.all([chart("SPY", "1m", "5d"), chart("SPY", "5m", "5d")]);
  const m1 = barsOfSessionDay(m1All, date);
  const session = {
    date, phase: "CLOSED" as const, isLive: false, note: null,
    rthOpen: nyDateTimeToEpoch(date, RTH_OPEN_MIN), rthClose: nyDateTimeToEpoch(date, RTH_CLOSE_MIN),
  };
  const gen = generateCandidates({ m1, m5: m5All, m15: [], session, nowSec: session.rthClose + 4 * 3600 });
  const sigAt = new Map(gen.candidates.map((c) => [nyParts(c.time).hhmm, c]));

  const r1 = rsi(m1.map((b) => b.close), 14);
  const r5 = rsi(m5All.map((b) => b.close), 14);
  const va = sma(m1.map((b) => b.volume || 0), VOLUME_LOOKBACK);

  // RSI ısınma kontrolü: V3.3 premarket mumlarını da kullanıyor mu
  const openIdx = m1.findIndex((b) => nyParts(b.time).hhmm === "09:35");
  console.log(`V3.3, seans mumlarını 04:00 ET'den itibaren alıyor (premarket dahil).`);
  console.log(`09:35'te 1m RSI = ${r1[openIdx]?.toFixed(1) ?? "YOK"} · toplam ${m1.length} mum, 09:35 indeksi ${openIdx}`);
  console.log(`→ RSI ısınma kör noktası ${r1[openIdx] != null ? "YOK — açılıştan itibaren hesaplı." : "VAR."}\n`);

  console.log("KULLANICININ 9 KAYBEDEN İŞLEMİ · V3.3 kapısı ne derdi?\n");
  console.log("saat  yön   kayıp  V3.3      gerekçe");
  let blocked = 0;
  for (const [hhmm, side, loss] of LOSERS) {
    const i = m1.findIndex((b) => nyParts(b.time).hhmm === hhmm);
    if (i < 1) { console.log(`${hhmm} ${side} — mum bulunamadı`); continue; }
    const bar = m1[i];
    let c5 = -1;
    while (c5 + 1 < m5All.length && m5All[c5 + 1].time + 300 <= bar.time + 60) c5++;

    // Kapı bileşenleri
    const rng = Math.max(1e-9, bar.high - bar.low);
    const bodyR = Math.abs(bar.close - bar.open) / rng;
    const posInRange = (bar.close - bar.low) / rng;
    const closeStr = side === "LONG" ? posInRange : 1 - posInRange;
    const avgV = va[i - 1];
    const volRatio = avgV && avgV > 0 ? (bar.volume || 0) / avgV : 1;
    const rsi1 = r1[i], rsi1p = r1[i - 1];
    const rsi1Ok = rsi1 != null && rsi1p != null && (side === "LONG" ? rsi1 > rsi1p : rsi1 < rsi1p);
    const c5dir = c5 >= 0 ? dirOf(m5All[c5]) : "—";
    const c5Ok = side === "LONG" ? c5dir === "UP" : c5dir === "DOWN";
    const rsi5 = c5 >= 1 ? r5[c5] : null, rsi5p = c5 >= 1 ? r5[c5 - 1] : null;
    const rsi5Ok = rsi5 != null && rsi5p != null && (side === "LONG" ? rsi5 >= rsi5p : rsi5 <= rsi5p);

    const fails: string[] = [];
    if (bodyR < BODY_MIN_RATIO) fails.push(`gövde %${(bodyR * 100).toFixed(0)}`);
    if (closeStr < CLOSE_POSITION_MIN) fails.push(`kapanış %${(closeStr * 100).toFixed(0)}`);
    if (volRatio < 1) fails.push(`hacim %${(volRatio * 100).toFixed(0)}`);
    if (!rsi1Ok) fails.push(`1m RSI ters (${rsi1?.toFixed(0) ?? "—"})`);
    if (!c5Ok) fails.push(`5m mum ${c5dir === "UP" ? "yeşil" : c5dir === "DOWN" ? "kırmızı" : "doji"}`);
    if (!rsi5Ok) fails.push(`5m RSI ters (${rsi5?.toFixed(0) ?? "—"})`);

    const emitted = sigAt.get(hhmm);
    const verdict = emitted && emitted.side === side ? "İZİN VERİR" : "ENGELLER ";
    if (verdict === "ENGELLER ") blocked++;
    console.log(`${hhmm} ${side.padEnd(5)} $${String(loss).padStart(4)}  ${verdict} ${fails.length ? fails.join(" · ") : "(seri/kota kuralı)"}`);
  }
  console.log(`\n→ 9 kaybeden işlemin ${blocked}'i V3.3 kapısından geçemezdi.`);

  console.log(`\nV3.3'ün bu seansta ürettiği ${gen.candidates.length} sinyal:`);
  for (const c of gen.candidates) console.log(`  ${nyParts(c.time).hhmm} ${c.side} güven ${c.confidence}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
