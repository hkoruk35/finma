/**
 * Copilot — SPY anlık okuma (sunucu). TEK KAYNAK: SPY Engine Takip Sistemi (lib/spyengine/tracker.ts · trackerRead),
 * /admin/spyengine/v1 sayfasının üst bandıyla aynı motor (AI_BEHAVIOR.md Kural 1/5). Copilot SPY yön/işlem cümlesini
 * yalnız bu çıktıdan kurar; kendi yorumuyla yeni giriş/stop/hedef üretmez.
 * Veri: Yahoo 5m (1 ay, premarket dahil) — sayfa 1m akıştan türetir, son mumda küçük gecikme farkı olabilir. 30 sn önbellek.
 */

import { chart } from "../spyengine/openForecastFetch";
import { normalizeBars, snapToInterval, dropBadPrints, nyParts, nyClock, type Bar } from "../spyengine/core";
import { rvolBaseline } from "../spyengine/ladder";
import { trackerRead, FC_RULES } from "../spyengine/tracker";

let cache: { at: number; value: SpyLive } | null = null;

export interface SpyLive {
  ok: boolean;
  asOfEt: string | null;
  session: "seans öncesi" | "seans içi" | "seans sonrası / kapalı";
  date: string | null;
  price: number | null;
  prevClose: number | null;
  changePts: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  gap: { pts: number | null; type: string } | null;
  /** üst bant: başlık + ne yapılmalı */
  headline: string | null;
  action: string | null;
  trend: string | null;
  direction15m: "YUKARI" | "AŞAĞI" | "BELİRSİZ" | null;
  position5m: "VWAP+EMA20 üstü" | "VWAP+EMA20 altı" | "arada" | null;
  score: number | null;
  strength: string | null;
  levels: { vwap: number | null; ema20_5m: number | null; ema20_15m: number | null; poc: number | null; or15: { high: number; low: number } | null } | null;
  forecast30m: { text: string; rule: string | null; measuredHitPct: number | null; targetHitPct: number | null } | null;
  setup: { side: string; status: string; trigger: number | null; stop: number | null; missing: string[] } | null;
  openPosition: { side: string; entry: number; stop: number; target1R: number; liveR: number; contracts: number | null } | null;
  runners: { side: string; entry: number; stop: number; liveR: number }[];
  tradesToday: { time: string; side: string; contracts: number | null; entry: number; stop: number; exit: string | null; resultR: number | null; why: string | null }[];
  last30m: { time: string; headline: string; trend: string }[];
  forecastHitToday: string | null;
  /** bugünün seansı başlamadıysa son tamamlanan seansın özeti (aynı motor) */
  lastSession: { date: string; close: number; high: number; low: number; closingTrend: string | null; trades: { time: string; side: string; resultR: number | null }[]; totalR: number } | null;
  note: string;
}

export async function getSpyLive(): Promise<SpyLive> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  const empty: SpyLive = {
    ok: false, asOfEt: null, session: "seans sonrası / kapalı", date: null, price: null, prevClose: null, changePts: null, dayHigh: null, dayLow: null,
    gap: null, headline: null, action: null, trend: null, direction15m: null, position5m: null, score: null, strength: null, levels: null,
    forecast30m: null, setup: null, openPosition: null, runners: [], tradesToday: [], last30m: [], forecastHitToday: null, lastSession: null,
    note: "SPY verisi şu an alınamadı.",
  };
  try {
    const raw = await chart("SPY", "1mo");
    const m5: Bar[] = dropBadPrints(snapToInterval(normalizeBars(raw), 300)).bars;
    if (!m5.length) return empty;
    const nowSec = Math.floor(Date.now() / 1000);
    const np = nyParts(nowSec);
    const lastBar = m5[m5.length - 1];
    const date = nyParts(lastBar.time).ymd;
    const r = trackerRead({ date, m5, nowSec, rvol: rvolBaseline(m5, date) });
    const cur = r.current;
    const rth = r.steps.filter((s) => !s.pre);
    const today = m5.filter((b) => nyParts(b.time).ymd === date && nyParts(b.time).minutes >= 570 && nyParts(b.time).minutes < 960);
    const price = lastBar.close;
    const session: SpyLive["session"] = np.ymd === date && np.minutes >= 570 && np.minutes < 960 ? "seans içi" : np.ymd === date && np.minutes < 570 ? "seans öncesi" : "seans sonrası / kapalı";
    const p = cur?.pos ?? null;
    // seans başlamadıysa: son tamamlanan seansın özeti
    let lastSession: SpyLive["lastSession"] = null;
    if (!rth.length) {
      const prevDates = Array.from(new Set(m5.map((b) => nyParts(b.time)).filter((x) => x.ymd < date && x.minutes >= 570 && x.minutes < 960).map((x) => x.ymd))).sort();
      const pd = prevDates[prevDates.length - 1];
      if (pd) {
        const pr = trackerRead({ date: pd, m5, nowSec: Math.min(nowSec, m5.filter((b) => nyParts(b.time).ymd === pd).slice(-1)[0].time + 300), rvol: rvolBaseline(m5, pd) });
        const pdBars = m5.filter((b) => nyParts(b.time).ymd === pd && nyParts(b.time).minutes >= 570 && nyParts(b.time).minutes < 960);
        const last = pr.steps.filter((x) => !x.pre && x.min <= 960).slice(-1)[0];
        lastSession = {
          date: pd, close: pdBars[pdBars.length - 1].close, high: Math.max(...pdBars.map((b) => b.high)), low: Math.min(...pdBars.map((b) => b.low)),
          closingTrend: last?.trend ?? null, trades: pr.trades.map((t) => ({ time: t.entryClock, side: t.side, resultR: t.resultR })), totalR: pr.realizedR,
        };
      }
    }
    const value: SpyLive = {
      ok: true,
      asOfEt: cur ? `${cur.clock} kapanışı` : nyClock(lastBar.time + 300),
      session, date, price,
      prevClose: r.prevClose,
      changePts: r.prevClose != null ? Math.round((price - r.prevClose) * 100) / 100 : null,
      dayHigh: today.length ? Math.max(...today.map((b) => b.high)) : null,
      dayLow: today.length ? Math.min(...today.map((b) => b.low)) : null,
      gap: r.gap,
      headline: cur?.headline ?? null,
      action: cur?.action ?? null,
      trend: cur?.trend ?? null,
      direction15m: cur && !cur.pre ? (cur.side15 > 0 ? "YUKARI" : cur.side15 < 0 ? "AŞAĞI" : "BELİRSİZ") : null,
      position5m: cur && !cur.pre ? (cur.side5 > 0 ? "VWAP+EMA20 üstü" : cur.side5 < 0 ? "VWAP+EMA20 altı" : "arada") : null,
      score: cur?.score ?? null,
      strength: cur?.strength ?? null,
      levels: cur && !cur.pre ? { vwap: cur.vwap, ema20_5m: cur.ema5, ema20_15m: cur.ema15, poc: cur.poc, or15: r.or15 ? { high: r.or15.high, low: r.or15.low } : null } : null,
      forecast30m: cur ? { text: cur.fc.text, rule: cur.fc.rule ? FC_RULES[cur.fc.rule].label : null, measuredHitPct: cur.fc.rule ? FC_RULES[cur.fc.rule].hit : null, targetHitPct: cur.fc.rule ? FC_RULES[cur.fc.rule].tHit ?? null : null } : null,
      setup: cur?.setup && cur.setup.status !== "OPEN" ? { side: cur.setup.side, status: cur.setup.status === "ARMED" ? "HAZIR (bir sonraki 5m kapanışta tetiklenebilir)" : "izleniyor", trigger: cur.setup.trigger, stop: cur.setup.stop, missing: cur.setup.missing } : null,
      openPosition: p ? { side: p.side, entry: p.entry, stop: p.stop, target1R: p.h1, liveR: p.liveR, contracts: p.contracts ?? null } : null,
      runners: (cur?.runners ?? []).map((x) => ({ side: x.side, entry: x.entry, stop: x.stop, liveR: x.liveR })),
      tradesToday: r.trades.map((t) => ({ time: t.entryClock, side: t.side, contracts: t.contracts ?? null, entry: t.entry, stop: t.stop0, exit: t.exitClock ? `${t.exitClock} ${t.exitReason} ${t.exit}` : null, resultR: t.resultR, why: t.why ?? null })),
      last30m: rth.slice(-6).map((s) => ({ time: s.clock, headline: s.headline, trend: s.trend })),
      forecastHitToday: r.pred.n ? `${r.pred.hit}/${r.pred.n}` : null,
      lastSession,
      note: "Kural seti: 15m VWAP+EMA20 yön teyidi → 5m tetik (VWAP · EMA20 · hacim çubuğu · mum formasyonu) → stop son 2 mumun ucu → 1R'de yarısı + stop girişe → kalan yarı her 15m kapanışında 15m dip/tepe ∓ tampon. Kazanç yön tahmininden değil bu düzenden gelir; 30 dk yön tahmini tek başına ~%47.",
    };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return empty;
  }
}
