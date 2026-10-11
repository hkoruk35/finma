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
const cacheBySymbol = new Map<string, { at: number; value: OptionLevels }>();

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
    return { strike: n(x.strike), openInterest: n(x.openInterest), volume: n(x.volume), bid: n(x.bid), ask: n(x.ask), iv: n(x.impliedVolatility) };
  });

/** 0DTE (yoksa en yakın) vadenin duvar / max pain seviyeleri. Zincir gelmezse null — uydurma yok. */
export async function fetchOptionLevels(symbol = "SPY"): Promise<OptionLevels | null> {
  const cache = cacheBySymbol.get(symbol) ?? null;
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

  const list = await call(`/v7/finance/options/${symbol}`);
  const res0 = (list.json as { optionChain?: { result?: { expirationDates?: number[] }[] } } | null)?.optionChain?.result?.[0];
  const dates = (res0?.expirationDates ?? []).map(Number).filter(Number.isFinite);
  if (!dates.length) return cache?.value ?? null;

  const todayNy = nyParts(Math.floor(Date.now() / 1000)).ymd;
  const withYmd = dates.map((e) => ({ e, ymd: new Date(e * 1000).toISOString().slice(0, 10) })).sort((x, y) => x.e - y.e);
  const pick = withYmd.find((x) => x.ymd >= todayNy);
  if (!pick) return cache?.value ?? null;

  const chain = await call(`/v7/finance/options/${symbol}?date=${pick.e}`);
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
  cacheBySymbol.set(symbol, { at: Date.now(), value });
  return value;
}

// ── Emir defteri (Level 1) + opsiyon Call/Put akışı ─────────────────

async function callAuthed(path: string): Promise<{ status: number; json: unknown }> {
  let a = await getAuth();
  if (!a) return { status: 0, json: null };
  let r = await getJson(path, a);
  if (r.status === 401) {
    a = await getAuth(true);
    if (!a) return r;
    r = await getJson(path, a);
  }
  return r;
}

export interface QuoteBook {
  bid: number | null;
  ask: number | null;
  /** En iyi alış / satış kademesindeki miktar (Yahoo'nun verdiği adet) */
  bidSize: number | null;
  askSize: number | null;
  price: number | null;
  volume: number | null;
  marketState: string | null;
  /** Kotasyonun alındığı an (unix sn) */
  fetchedAt: number;
}

const bookCache = new Map<string, { at: number; value: QuoteBook }>();

/**
 * En iyi alış/satış fiyatı ve miktarı (Level 1). Yahoo ücretsiz uçta derinlik (Level 2) vermez —
 * bu yüzden "emir defteri" burada yalnız en üst kademedir. 2 sn önbellekli.
 */
export async function fetchQuoteBook(symbol = "SPY"): Promise<QuoteBook | null> {
  const c = bookCache.get(symbol);
  if (c && Date.now() - c.at < 2000) return c.value;
  const r = await callAuthed(`/v7/finance/quote?symbols=${symbol}`);
  const q = (r.json as { quoteResponse?: { result?: Record<string, unknown>[] } } | null)?.quoteResponse?.result?.[0];
  if (!q) return c?.value ?? null;
  const num = (v: unknown) => (Number.isFinite(Number(v)) && v != null ? Number(v) : null);
  const value: QuoteBook = {
    bid: num(q.bid), ask: num(q.ask), bidSize: num(q.bidSize), askSize: num(q.askSize),
    price: num(q.regularMarketPrice), volume: num(q.regularMarketVolume),
    marketState: typeof q.marketState === "string" ? q.marketState : null,
    fetchedAt: Math.floor(Date.now() / 1000),
  };
  bookCache.set(symbol, { at: Date.now(), value });
  return value;
}

export interface OptionSideFlow {
  /** Toplam işlem hacmi (kontrat) */
  volume: number;
  /** Prim hacmi ($) = hacim × orta fiyat × 100 — yalnız para dışı + fiyata ±%0,5 yakın strike (derin para içi kontratlar oranı şişirmesin) */
  premium: number;
  /** Fiyata ±%1 yakın strike'lardaki hacim */
  nearVolume: number;
  /** Para dışı (OTM) strike'lardaki hacim */
  otmVolume: number;
  /** En çok işlem gören 3 strike */
  top: { strike: number; volume: number }[];
}

export interface OptionFlow {
  expiry: string;
  isZeroDte: boolean;
  spot: number;
  calls: OptionSideFlow;
  puts: OptionSideFlow;
  fetchedAt: number;
}

const flowCache = new Map<string, { at: number; value: OptionFlow }>();

/** En yakın vadenin (0DTE) Call/Put hacim ve prim dengesi. 60 sn önbellekli. Zincir gelmezse null. */
export async function fetchOptionFlow(symbol = "SPY"): Promise<OptionFlow | null> {
  const c = flowCache.get(symbol);
  if (c && Date.now() - c.at < 60_000) return c.value;
  const list = await callAuthed(`/v7/finance/options/${symbol}`);
  const res0 = (list.json as { optionChain?: { result?: { expirationDates?: number[] }[] } } | null)?.optionChain?.result?.[0];
  const dates = (res0?.expirationDates ?? []).map(Number).filter(Number.isFinite).sort((x, y) => x - y);
  const todayNy = nyParts(Math.floor(Date.now() / 1000)).ymd;
  const pick = dates.map((e) => ({ e, ymd: new Date(e * 1000).toISOString().slice(0, 10) })).find((x) => x.ymd >= todayNy);
  if (!pick) return c?.value ?? null;
  const chain = await callAuthed(`/v7/finance/options/${symbol}?date=${pick.e}`);
  const r = (chain.json as {
    optionChain?: { result?: { quote?: { regularMarketPrice?: number }; options?: { calls?: unknown[]; puts?: unknown[] }[] }[] };
  } | null)?.optionChain?.result?.[0];
  const opt = r?.options?.[0];
  const spot = Number(r?.quote?.regularMarketPrice);
  if (!opt || !Number.isFinite(spot)) return c?.value ?? null;
  const side = (raw: unknown[] | undefined, isCall: boolean): OptionSideFlow => {
    const rows = (raw ?? []).map((x) => {
      const o = x as Record<string, unknown>;
      const bid = n(o.bid), ask = n(o.ask), last = n(o.lastPrice);
      const mid = bid > 0 && ask > 0 ? (bid + ask) / 2 : last;
      return { strike: n(o.strike), volume: n(o.volume), mid };
    });
    return {
      volume: rows.reduce((a, x) => a + x.volume, 0),
      premium: rows.filter((x) => (isCall ? x.strike >= spot * 0.995 : x.strike <= spot * 1.005)).reduce((a, x) => a + x.volume * x.mid * 100, 0),
      nearVolume: rows.filter((x) => Math.abs(x.strike - spot) / spot <= 0.01).reduce((a, x) => a + x.volume, 0),
      otmVolume: rows.filter((x) => (isCall ? x.strike > spot : x.strike < spot)).reduce((a, x) => a + x.volume, 0),
      top: [...rows].sort((a, b) => b.volume - a.volume).slice(0, 3).map((x) => ({ strike: x.strike, volume: x.volume })),
    };
  };
  const value: OptionFlow = {
    expiry: pick.ymd, isZeroDte: pick.ymd === todayNy, spot,
    calls: side(opt.calls, true), puts: side(opt.puts, false),
    fetchedAt: Math.floor(Date.now() / 1000),
  };
  flowCache.set(symbol, { at: Date.now(), value });
  return value;
}
