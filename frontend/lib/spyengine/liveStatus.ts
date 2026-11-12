/**
 * Tüm motorların ANLIK durumu (sunucu) — Endeks Merkezi izleme listesi için (2026-11-12, kullanıcı: "bakmadığım müddetçe hangisinde
 * işlem olduğunu bilmiyorum").
 *
 * Canlı motorun AYNI fonksiyonu (tracker.ts · trackerRead) Yahoo 5m mumlarla bugünü baştan oynatır (sunucu günlüğüyle aynı girdi:
 * m5 + RVOL tabanı + sembol ayarı). Sayfadaki motor ayrıca 1m/canlı tik kullandığından durum son KAPANMIŞ 5m muma göredir —
 * birkaç dakikalık gecikme olabilir; kesin karar için motor sayfası açılmalıdır. 60 sn önbellekli.
 */

import { normalizeBars, snapToInterval, dropBadPrints, nyParts, nyDateTimeToEpoch, nyClock, type Bar } from "./core";
import { chart } from "./openForecastFetch";
import { rvolBaseline } from "./ladder";
import { trackerRead, refSide15Of } from "./tracker";
import { ENGINES, ENGINE_SYMBOLS, type EngineSymbol } from "./engines";

export interface EngineLiveStatus {
  symbol: EngineSymbol;
  ok: boolean;
  error?: string;
  /** son kapanmış 5m mumun bitişi (ET saat) */
  asOf: string | null;
  price: number | null;
  phase: string | null;
  stage: string | null;
  headline: string | null;
  action: string | null;
  /** 15m yönü: 1 yukarı · −1 aşağı · 0 yok */
  dir15: number;
  /** açık pozisyon */
  pos: { side: string; entry: number; stop: number; liveR: number } | null;
  /** tetik için hazır (bir eksik kalmış) kurulum */
  armed: { side: string; trigger: number } | null;
  /** bu kapanışta oluşan erken uyarı */
  early: string | null;
  /** günün son önemli uyarısı */
  last: { clock: string; level: string; side: string | null; text: string } | null;
  trades: number;
  realizedR: number;
  /** sıralama/uyarı için: 3 pozisyon · 2 tetik hazır · 1 erken uyarı · 0 bekle */
  rank: number;
}

const memo = new Map<string, { at: number; v: EngineLiveStatus }>();
const barMemo = new Map<string, { at: number; m5: Bar[] }>();

async function bars(sym: string): Promise<Bar[]> {
  const hit = barMemo.get(sym);
  if (hit && Date.now() - hit.at < 55_000) return hit.m5;
  const m5 = dropBadPrints(snapToInterval(normalizeBars(await chart(sym, "1mo")), 300)).bars as Bar[];
  barMemo.set(sym, { at: Date.now(), m5 });
  return m5;
}

export async function engineLiveStatus(sym: EngineSymbol): Promise<EngineLiveStatus> {
  const hit = memo.get(sym);
  if (hit && Date.now() - hit.at < 60_000) return hit.v;
  const empty: EngineLiveStatus = { symbol: sym, ok: false, asOf: null, price: null, phase: null, stage: null, headline: null, action: null, dir15: 0, pos: null, armed: null, early: null, last: null, trades: 0, realizedR: 0, rank: 0 };
  try {
    const m5 = await bars(sym);
    if (!m5.length) return { ...empty, error: "veri yok" };
    const nowSec = Math.floor(Date.now() / 1000);
    const date = nyParts(m5[m5.length - 1].time).ymd;
    const end = Math.min(nowSec, nyDateTimeToEpoch(date, 16 * 60 + 5));
    const cfg = ENGINES[sym].cfg;
    const refSide15 = sym !== "SPY" && cfg.refAlign15 !== "off" ? refSide15Of(await bars("SPY"), date, end) : null;
    const r = trackerRead({ date, m5, nowSec: end, rvol: rvolBaseline(m5, date), cfg, refSide15 });
    const c = r.current;
    const last = [...r.alerts].reverse().find((a) => a.level !== "KADEME") ?? null;
    const pos = c?.pos ? { side: c.pos.side, entry: c.pos.entry, stop: c.pos.stop, liveR: c.pos.liveR } : null;
    const armed = !pos && r.armed ? { side: r.armed.side, trigger: r.armed.trigger } : null;
    const early = c?.earlyWarn ?? null;
    const v: EngineLiveStatus = {
      symbol: sym, ok: true, asOf: c ? nyClock(c.t) : null, price: c?.price ?? null, phase: c?.phase ?? null, stage: c?.stageLabel ?? null,
      headline: c?.headline ?? null, action: c?.action ?? null, dir15: c?.side15 ?? 0, pos, armed, early,
      last: last ? { clock: last.clock, level: last.level, side: last.side, text: last.text } : null,
      trades: r.trades.length, realizedR: Math.round(r.realizedR * 100) / 100,
      rank: pos ? 3 : armed ? 2 : early ? 1 : 0,
    };
    memo.set(sym, { at: Date.now(), v });
    return v;
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}

/** sembol listesi (boşsa tümü); 5'erli gruplar hâlinde (Yahoo'yu boğmamak için) */
export async function engineLiveStatuses(symbols?: EngineSymbol[]): Promise<EngineLiveStatus[]> {
  const list = symbols?.length ? symbols : [...ENGINE_SYMBOLS];
  const out: EngineLiveStatus[] = [];
  for (let i = 0; i < list.length; i += 5) out.push(...(await Promise.all(list.slice(i, i + 5).map(engineLiveStatus))));
  return out;
}
