/**
 * SPY Engine — Yahoo opsiyon zinciri çekimi (sunucu tarafı).
 *
 * Yahoo v7/finance/options crumb + cookie ister ("Invalid Crumb" döner);
 * aynı akış lib/earnings/yahooCalendar.ts'te de var — burada bilinçli küçük
 * tekrar (SPY Engine'i başka modüle bağlamamak için).
 *
 * Vade tarihi UYARISI: Yahoo vade epoch'ları gece yarısı UTC'dir. NY saatine
 * çevrilirse bir gün geri kayar — bu yüzden vade tarihi UTC'den okunur ve
 * bugünün NY tarihiyle karşılaştırılır.
 */

import { nyParts } from "./core";
import { computeOptionLevels, type OptionLevels, type OptionRow } from "./optionLevels";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HOSTS = ["query2.finance.yahoo.com", "query1.finance.yahoo.com"];
const CACHE_MS = 5 * 60 * 1000;

let auth: { crumb: string; cookie: string; ts: number } | null = null;
let cache: { at: number; value: OptionLevels } | null = null;

async function getAuth(force = false): Promise<{ crumb: string; cookie: string } | null> {
  if (!force && auth && Date.now() - auth.ts < 50 * 60 * 1000) return auth;
  try {
    const home = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(5000) });
    const raw = home.headers.get("set-cookie") || "";
    const a3 = raw.match(/A3=([^;]+)/)?.[1];
    const a1 = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");
    const res = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Accept: "text/plain", Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const crumb = (await res.text()).trim();
    if (!crumb || crumb.length > 20) return null;
    auth = { crumb, cookie, ts: Date.now() };
    return auth;
  } catch {
    return null;
  }
}

async function getJson(path: string, a: { crumb: string; cookie: string }): Promise<{ status: number; json: unknown }> {
  for (const host of HOSTS) {
    try {
      const sep = path.includes("?") ? "&" : "?";
      const res = await fetch(`https://${host}${path}${sep}crumb=${encodeURIComponent(a.crumb)}`, {
        headers: { "User-Agent": UA, Cookie: a.cookie },
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 401) return { status: 401, json: null };
      if (res.ok) return { status: 200, json: await res.json() };
    } catch {
      // sıradaki host
    }
  }
  return { status: 0, json: null };
}

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const rowsOf = (raw: unknown): OptionRow[] =>
  (Array.isArray(raw) ? raw : []).map((r) => {
    const x = r as Record<string, unknown>;
    return { strike: n(x.strike), openInterest: n(x.openInterest), volume: n(x.volume) };
  });

/** 0DTE (yoksa en yakın) vadenin duvar / max pain seviyeleri. Zincir gelmezse null — uydurma yok. */
export async function fetchOptionLevels(): Promise<OptionLevels | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.value;

  let a = await getAuth();
  if (!a) return cache?.value ?? null;

  const call = async (path: string) => {
    let r = await getJson(path, a as { crumb: string; cookie: string });
    if (r.status === 401) {
      a = await getAuth(true);
      if (!a) return r;
      r = await getJson(path, a);
    }
    return r;
  };

  const list = await call("/v7/finance/options/SPY");
  const res0 = (list.json as { optionChain?: { result?: { expirationDates?: number[] }[] } } | null)?.optionChain?.result?.[0];
  const dates = (res0?.expirationDates ?? []).map(Number).filter(Number.isFinite);
  if (!dates.length) return cache?.value ?? null;

  const todayNy = nyParts(Math.floor(Date.now() / 1000)).ymd;
  const withYmd = dates.map((e) => ({ e, ymd: new Date(e * 1000).toISOString().slice(0, 10) })).sort((x, y) => x.e - y.e);
  const pick = withYmd.find((x) => x.ymd >= todayNy);
  if (!pick) return cache?.value ?? null;

  const chain = await call(`/v7/finance/options/SPY?date=${pick.e}`);
  const r = (chain.json as {
    optionChain?: { result?: { quote?: { regularMarketPrice?: number }; options?: { calls?: unknown; puts?: unknown }[] }[] };
  } | null)?.optionChain?.result?.[0];
  const opt = r?.options?.[0];
  const spot = Number(r?.quote?.regularMarketPrice);
  if (!opt || !Number.isFinite(spot)) return cache?.value ?? null;

  const value = computeOptionLevels({
    calls: rowsOf(opt.calls),
    puts: rowsOf(opt.puts),
    spot,
    expiry: pick.ymd,
    isZeroDte: pick.ymd === todayNy,
    fetchedAt: Math.floor(Date.now() / 1000),
  });
  if (!value) return cache?.value ?? null;
  cache = { at: Date.now(), value };
  return value;
}
