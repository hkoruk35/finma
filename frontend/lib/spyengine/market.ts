/**
 * SPY Engine V2 — Piyasa Verisi Katmanı (SADECE SUNUCU)
 *
 * Tek kural: **uydurma veri yok.** Yahoo bir alanı vermezse o alan `null`
 * döner ve arayüz "veri yok" gösterir. Hiçbir yerde interpolasyon, son
 * bilinen değerin tekrarı veya teorik model çıktısı canlı veri gibi
 * sunulmaz.
 *
 * Kaynaklar:
 *   1. Yahoo Finance v8 chart — 1m/5m/15m mumlar, `includePrePost=true`
 *      (premarket 04:00 ve afterhours 20:00 ET'ye kadar gerçek veri).
 *   2. `robinhood_spy_bars` (Supabase) — Yahoo'nun HİÇ taşımadığı overnight
 *      (20:00–04:00 ET) penceresi. Kullanıcının kendi makinesindeki poller
 *      yazar (bkz. app/api/internal/robinhood-spy-sync); tablo yoksa, boşsa
 *      veya bayatsa (>6 dk) sessizce devre dışı kalır ve saf Yahoo'ya düşeriz.
 *   3. Yahoo v8 chart, OCC opsiyon sembolüyle — 0DTE kontrat primi mumları.
 *
 * Hız/limit dengesi: modül düzeyinde kısa ömürlü bir önbellek var. Sayfa
 * 1 saniyede bir yoklasa bile Yahoo'ya giden istek sayısı TTL ile sınırlanır
 * ve aynı anda birden fazla sekme açıksa istekler tekilleştirilir.
 */

import "server-only";
import type { Bar } from "./core";
import {
  normalizeBars, snapToInterval, dropBadPrints, nyParts,
  PRE_OPEN_MIN, POST_CLOSE_MIN, RTH_OPEN_MIN, RTH_CLOSE_MIN,
} from "./core";
import { supabaseAdmin } from "@/lib/supabase-admin";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

/** Yahoo aralık etiketi → saniye (mumları kendi kovalarına oturtmak için) */
const INTERVAL_SEC: Record<string, number> = {
  "1m": 60, "2m": 120, "5m": 300, "15m": 900, "30m": 1800,
  "60m": 3600, "90m": 5400, "1h": 3600, "1d": 86400,
};

// ── Genel amaçlı TTL önbellek + istek tekilleştirme ───────────────

interface CacheEntry<T> {
  value: T;
  ts: number;
  inflight: Promise<T> | null;
}

const cache = new Map<string, CacheEntry<unknown>>();

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && now - hit.ts < ttlMs) return hit.value;
  if (hit?.inflight) return hit.inflight;

  const inflight = loader()
    .then((value) => {
      cache.set(key, { value, ts: Date.now(), inflight: null });
      return value;
    })
    .catch((err) => {
      // Hata durumunda önceki (bayat) değeri KORUMA — çağıran taraf hatayı
      // görüp "veri yok" gösterebilsin diye ileri fırlat.
      if (hit) cache.set(key, { ...hit, inflight: null });
      else cache.delete(key);
      throw err;
    });

  cache.set(key, { value: (hit?.value as T) ?? (undefined as T), ts: hit?.ts ?? 0, inflight });
  return inflight;
}

// ── Yahoo chart ───────────────────────────────────────────────────

export interface ChartFetch {
  bars: Bar[];
  /** Hacimsiz ve her iki komşusundan da kopuk olduğu için atılan bozuk print sayısı */
  sanitized: number;
  marketPrice: number | null;
  marketTime: number | null;
  previousClose: number | null;
  currency: string | null;
  error: string | null;
}

const EMPTY_CHART: ChartFetch = {
  bars: [], sanitized: 0, marketPrice: null, marketTime: null, previousClose: null, currency: null, error: "istek yapılmadı",
};

async function fetchChartRaw(
  symbol: string,
  interval: string,
  range: string,
  prePost: boolean,
  timeoutMs = 8000
): Promise<ChartFetch> {
  let lastError = "bilinmeyen hata";
  for (const host of HOSTS) {
    try {
      const url =
        `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=${prePost ? "true" : "false"}`;
      const res = await fetch(url, {
        headers: YF_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        lastError = `Yahoo HTTP ${res.status}`;
        continue;
      }
      const raw = await res.json();
      const result = raw?.chart?.result?.[0];
      if (!result) {
        lastError = raw?.chart?.error?.description || "Yahoo boş yanıt";
        continue;
      }

      const ts: number[] = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const o = q.open || [], h = q.high || [], l = q.low || [], c = q.close || [], v = q.volume || [];

      const bars: Bar[] = [];
      for (let i = 0; i < ts.length; i++) {
        if (o[i] == null || h[i] == null || l[i] == null || c[i] == null) continue;
        if (!Number.isFinite(o[i]) || !Number.isFinite(c[i])) continue;
        bars.push({ time: ts[i], open: o[i], high: h[i], low: l[i], close: c[i], volume: v[i] ?? 0 });
      }

      // Son mumun damgası regularMarketTime olduğu için kovasına indiriliyor
      // (bkz. snapToInterval) — grafikte zaman kayması bırakmaz.
      const span = INTERVAL_SEC[interval] ?? 0;
      const aligned = span ? snapToInterval(normalizeBars(bars), span) : normalizeBars(bars);
      const clean = dropBadPrints(aligned);

      return {
        bars: clean.bars,
        sanitized: clean.dropped,
        marketPrice: Number.isFinite(result.meta?.regularMarketPrice) ? result.meta.regularMarketPrice : null,
        marketTime: Number.isFinite(result.meta?.regularMarketTime) ? result.meta.regularMarketTime : null,
        previousClose:
          Number.isFinite(result.meta?.chartPreviousClose) ? result.meta.chartPreviousClose
          : Number.isFinite(result.meta?.previousClose) ? result.meta.previousClose
          : null,
        currency: result.meta?.currency ?? null,
        error: null,
      };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ...EMPTY_CHART, error: lastError };
}

export function fetchChart(
  symbol: string,
  interval: string,
  range: string,
  prePost: boolean,
  ttlMs: number
): Promise<ChartFetch> {
  return cached(`chart:${symbol}:${interval}:${range}:${prePost}`, ttlMs, () =>
    fetchChartRaw(symbol, interval, range, prePost)
  );
}

// ── Overnight köprüsü (Robinhood → Supabase) ──────────────────────

/** Poller ~60-90 sn'de bir yazar; bundan eskisi "bayat" sayılır ve kullanılmaz. */
const OVERNIGHT_STALE_AFTER_SEC = 6 * 60;

/**
 * `robinhood_spy_bars` tablosundan overnight barları okur. Bu katman
 * Robinhood'a HİÇ canlı istek atmaz — OAuth/MFA karmaşıklığı tamamen
 * kullanıcının kendi makinesindeki poller'da kalır, sunucu tarafı asla
 * Robinhood kimlik bilgisi görmez.
 *
 * Tablo yoksa, boşsa veya son satır bayatsa boş dizi döner: bayat overnight
 * verisiyle canlı motoru beslemektense Yahoo'ya düşmek daha güvenli.
 */
async function fetchOvernightBars(sinceUnixSec: number): Promise<Bar[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("robinhood_spy_bars")
      .select("time, open, high, low, close, volume")
      .gte("time", sinceUnixSec)
      .order("time", { ascending: true })
      .limit(5000);

    if (error || !data?.length) return [];

    const newest = Number(data[data.length - 1].time);
    if (Date.now() / 1000 - newest > OVERNIGHT_STALE_AFTER_SEC) return [];

    return data
      .map((r) => ({
        time: Number(r.time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume) || 0,
      }))
      .filter((b) => Number.isFinite(b.open) && Number.isFinite(b.close));
  } catch {
    return [];
  }
}

// ── SPY mum paketi ────────────────────────────────────────────────

export interface SpyBundle {
  m1: Bar[];
  m5: Bar[];
  m15: Bar[];
  /** Yahoo meta'dan gelen en taze fiyat (mumdan daha yeni olabilir) */
  marketPrice: number | null;
  marketTime: number | null;
  previousClose: number | null;
  /** Overnight barları Robinhood köprüsünden geldi mi */
  overnightSource: "robinhood" | null;
  /** Atılan bozuk print sayısı (şeffaflık için arayüzde gösterilir) */
  sanitized: number;
  errors: string[];
}

/**
 * TTL'ler bilinçli olarak farklı: 1m mumlar sık (canlı akış için), 5m/15m
 * seyrek yenilenir. Sayfa 1 sn'de bir yoklar; RTH içinde 1m TTL 1,2 sn
 * olduğu için Yahoo'ya dakikada ~50 istek gider, 60 değil. RTH dışında
 * (pre/post/kapalı) fiyat zaten seyrek değiştiği için 1m TTL 4 sn'ye
 * gevşer — sayfa yine 1 sn'de bir yoklasa bile Yahoo'ya giden istek
 * dakikada ~15'e düşer. 5m/15m her durumda seyrek.
 */
export const TTL = {
  m1: 1200,
  m1Extended: 4000,
  m5: 20000,
  m15: 60000,
  option: 2500,
  chain: 60000,
  quotes: 12000,
  overnight: 30000,
};

/** Regular Trading Hours (09:30–16:00 ET, hafta içi) — "borsa açık" */
export function isRth(nowSec: number): boolean {
  const p = nyParts(nowSec);
  return p.weekday >= 1 && p.weekday <= 5 && p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
}

export async function fetchSpyBundle(): Promise<SpyBundle> {
  const errors: string[] = [];
  const m1Ttl = isRth(Math.floor(Date.now() / 1000)) ? TTL.m1 : TTL.m1Extended;

  const [c1, c5, c15] = await Promise.all([
    fetchChart("SPY", "1m", "5d", true, m1Ttl).catch((e) => ({ ...EMPTY_CHART, error: String(e) })),
    fetchChart("SPY", "5m", "5d", true, TTL.m5).catch((e) => ({ ...EMPTY_CHART, error: String(e) })),
    fetchChart("SPY", "15m", "1mo", true, TTL.m15).catch((e) => ({ ...EMPTY_CHART, error: String(e) })),
  ]);

  if (c1.error) errors.push(`1m: ${c1.error}`);
  if (c5.error) errors.push(`5m: ${c5.error}`);
  if (c15.error) errors.push(`15m: ${c15.error}`);

  // Overnight (20:00–04:00 ET) — Yahoo bu pencereyi HİÇ taşımıyor.
  //
  // Kapsam bilinçli olarak SADECE overnight ile sınırlı: Robinhood
  // historicals en ince 5 DAKİKALIK bar veriyor, Yahoo ise 04:00–20:00
  // arasında gerçek 1 dakikalık bar veriyor. İkisini pre/after penceresinde
  // karıştırmak "1m" dizisine 5 dakikalık bar sokardı — granülarite yalanı.
  // Bu yüzden sadece Yahoo'nun hiç veri vermediği saatler doldurulur.
  let m1 = c1.bars;
  let overnightSource: "robinhood" | null = null;
  try {
    const since = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
    const rh = await cached("overnight", TTL.overnight, () => fetchOvernightBars(since));
    const known = new Set(m1.map((b) => b.time));
    const extra = rh.filter((b) => {
      if (known.has(b.time)) return false;
      const min = nyParts(b.time).minutes;
      return min >= POST_CLOSE_MIN || min < PRE_OPEN_MIN;
    });
    if (extra.length) {
      m1 = normalizeBars([...m1, ...extra]);
      overnightSource = "robinhood";
    }
  } catch {
    // Köprü yoksa sessizce saf Yahoo ile devam — bu bir hata değil.
  }

  return {
    m1,
    m5: c5.bars,
    m15: c15.bars,
    marketPrice: c1.marketPrice ?? c5.marketPrice,
    marketTime: c1.marketTime ?? c5.marketTime,
    previousClose: c1.previousClose ?? c5.previousClose ?? c15.previousClose,
    overnightSource,
    sanitized: c1.sanitized + c5.sanitized + c15.sanitized,
    errors,
  };
}

// ── Ticker şeridi ─────────────────────────────────────────────────

export interface TickerQuote {
  /** Ekranda gösterilen etiket */
  label: string;
  /** Yahoo sembolü */
  symbol: string;
  name: string;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  /** Son ~60 dakikaya göre yüzde değişim -- ayrı bir istek gerektirmez, aynı 5m mumlardan hesaplanır */
  changePctHour: number | null;
  /** Fiyatın alındığı an (unix sn) */
  time: number | null;
  /** Fiyat düzenli seans dışından mı geliyor */
  extended: boolean;
  error: string | null;
}

export const STRIP_SYMBOLS: { label: string; symbol: string; name: string }[] = [
  { label: "SPX",  symbol: "^GSPC", name: "S&P 500 Endeks" },
  { label: "ES",   symbol: "ES=F",  name: "E-mini S&P Vadeli" },
  { label: "MES",  symbol: "MES=F", name: "Micro E-mini S&P Vadeli" },
  { label: "NDX",  symbol: "^NDX",  name: "Nasdaq 100" },
  { label: "NQ",   symbol: "NQ=F",  name: "E-mini Nasdaq Vadeli" },
  { label: "MNQ",  symbol: "MNQ=F", name: "Micro E-mini Nasdaq Vadeli" },
  { label: "YM",   symbol: "YM=F",  name: "E-mini Dow Vadeli" },
  { label: "QQQ",  symbol: "QQQ",   name: "Invesco QQQ" },
  { label: "DIA",  symbol: "DIA",   name: "Dow Jones ETF" },
  { label: "IWM",  symbol: "IWM",   name: "Russell 2000 ETF" },
  { label: "RSP",  symbol: "RSP",   name: "S&P Eşit Ağırlık" },
  { label: "XSP",  symbol: "^XSP",  name: "Mini S&P 500 Endeks" },
  { label: "VIX",  symbol: "^VIX",  name: "Volatilite Endeksi" },
  { label: "XLK",  symbol: "XLK",   name: "Teknoloji Sektörü" },
  { label: "XLF",  symbol: "XLF",   name: "Finans Sektörü" },
  { label: "SMH",  symbol: "SMH",   name: "Yarı İletken ETF" },
  { label: "NVDA", symbol: "NVDA",  name: "NVIDIA" },
  { label: "AAPL", symbol: "AAPL",  name: "Apple" },
  { label: "MSFT", symbol: "MSFT",  name: "Microsoft" },
  { label: "GOOGL",symbol: "GOOGL", name: "Alphabet" },
  { label: "AMZN", symbol: "AMZN",  name: "Amazon" },
];

async function quoteOne(entry: { label: string; symbol: string; name: string }): Promise<TickerQuote> {
  const base: TickerQuote = {
    label: entry.label, symbol: entry.symbol, name: entry.name,
    price: null, prevClose: null, change: null, changePct: null, changePctHour: null,
    time: null, extended: false, error: null,
  };
  try {
    // 5m/1d + prePost: hem düzenli seans hem pre/after gerçek fiyatı taşır.
    const c = await fetchChart(entry.symbol, "5m", "1d", true, TTL.quotes);
    if (c.error) return { ...base, error: c.error };

    const lastBar = c.bars.length ? c.bars[c.bars.length - 1] : null;
    // En taze fiyat: son mum kapanışı ile meta.regularMarketPrice'tan
    // hangisi daha yeniyse o. İkisi de yoksa "veri yok".
    let price: number | null = null;
    let time: number | null = null;
    if (lastBar && c.marketTime != null) {
      if (lastBar.time >= c.marketTime) { price = lastBar.close; time = lastBar.time; }
      else { price = c.marketPrice; time = c.marketTime; }
    } else if (lastBar) {
      price = lastBar.close; time = lastBar.time;
    } else if (c.marketPrice != null) {
      price = c.marketPrice; time = c.marketTime;
    }
    if (price == null) return { ...base, error: "fiyat yok" };

    const prevClose = c.previousClose;
    const change = prevClose != null ? price - prevClose : null;
    const changePct = prevClose != null && prevClose !== 0 ? (change as number) / prevClose * 100 : null;

    // Saatlik değişim: ~60 dk önceki en yakın (kendisinden ÖNCEKİ) 5m mumun
    // kapanışına göre -- 5m mumlar zaten çekilmiş, ek istek gerekmiyor.
    // Yeterli geçmiş yoksa (örn. seans yeni açıldıysa) null kalır.
    let changePctHour: number | null = null;
    if (time != null) {
      const target = time - 3600;
      let hourBar: Bar | null = null;
      for (const b of c.bars) {
        if (b.time <= target) hourBar = b;
        else break;
      }
      if (hourBar && hourBar.close) {
        changePctHour = ((price - hourBar.close) / hourBar.close) * 100;
      }
    }

    return {
      ...base,
      price,
      prevClose,
      change,
      changePct,
      changePctHour,
      time,
      extended: c.marketTime != null && time != null ? time > c.marketTime : false,
      error: null,
    };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : String(e) };
  }
}

export async function fetchStripQuotes(): Promise<TickerQuote[]> {
  return cached("strip", TTL.quotes, async () => Promise.all(STRIP_SYMBOLS.map(quoteOne)));
}

// ── 0DTE opsiyon primi ────────────────────────────────────────────

export interface OptionSeries {
  contract: string;
  bars: Bar[];
  /** Yahoo meta'dan gelen en taze prim */
  livePremium: number | null;
  error: string | null;
}

/**
 * Bir OCC kontratının 1 dakikalık prim mumlarını çeker. Yahoo, opsiyon
 * sembollerini de v8/chart üzerinden servis eder — bu sayede pozisyon
 * yaşam döngüsü GERÇEK prim geçmişi üzerinde oynatılabilir; hiçbir
 * Black-Scholes modeli devreye girmez.
 *
 * SÜRESİ DOLMUŞ KONTRATLAR: prim geçmişi vade gününden sonra da geliyor —
 * yaygın "Yahoo expired 0DTE primini siliyor" varsayımı yanlış. Ama SADECE
 * doğru pencereyle (2026-09-02'de SPY260831C00765000 üzerinde ölçüldü):
 *   range=5d   → 639 bar  ✓  (varsayılan; geriye dönük oynatmayı besleyen bu)
 *   range=1d   → 0 bar    ✗  (vade günü "bugün" değil)
 *   range=1mo  → 0 bar    ✗  ("Only 8 days worth of 1m granularity data")
 * Daha eskisi için period1/period2'yi 8 günlük 1m sınırının içinde tutmak
 * gerekir; o sınırın ötesinde veri gerçekten yok, uydurulmaz.
 */
export async function fetchOptionSeries(contract: string, range = "5d"): Promise<OptionSeries> {
  try {
    const c = await fetchChart(contract, "1m", range, true, TTL.option);
    if (c.error) return { contract, bars: [], livePremium: null, error: c.error };
    const lastBar = c.bars.length ? c.bars[c.bars.length - 1] : null;
    const live =
      c.marketTime != null && lastBar != null && lastBar.time >= c.marketTime
        ? lastBar.close
        : c.marketPrice ?? lastBar?.close ?? null;
    return { contract, bars: c.bars, livePremium: live, error: c.bars.length ? null : "kontrat için mum yok" };
  } catch (e) {
    return { contract, bars: [], livePremium: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export interface ChainQuote {
  contractSymbol: string;
  strike: number;
  bid: number | null;
  ask: number | null;
  last: number | null;
  mid: number | null;
  openInterest: number | null;
  volume: number | null;
  impliedVolatility: number | null;
}

/**
 * Yahoo opsiyon zincirinden, verilen vade için ATM'ye en yakın gerçek
 * kontratı döndürür. Zincir gelmezse null — teorik fiyat üretmez.
 */
export async function fetchAtmContract(
  underlying: string,
  expiryEpoch: number,
  isCall: boolean,
  spot: number
): Promise<ChainQuote | null> {
  return cached(`chain:${underlying}:${expiryEpoch}:${isCall}:${Math.round(spot)}`, TTL.chain, async () => {
    for (const host of HOSTS) {
      try {
        const url = `https://${host}/v7/finance/options/${encodeURIComponent(underlying)}?date=${expiryEpoch}`;
        const res = await fetch(url, {
          headers: YF_HEADERS,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) continue;
        const raw = await res.json();
        const chain = raw?.optionChain?.result?.[0]?.options?.[0];
        const rows: Record<string, unknown>[] = (isCall ? chain?.calls : chain?.puts) || [];
        if (!rows.length) continue;

        let best: Record<string, unknown> | null = null;
        let bestDist = Infinity;
        for (const r of rows) {
          const k = Number(r.strike);
          if (!Number.isFinite(k)) continue;
          const d = Math.abs(k - spot);
          if (d < bestDist) { bestDist = d; best = r; }
        }
        if (!best) continue;

        const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : null);
        const bid = num(best.bid);
        const ask = num(best.ask);
        return {
          contractSymbol: String(best.contractSymbol),
          strike: Number(best.strike),
          bid,
          ask,
          last: num(best.lastPrice),
          mid: bid != null && ask != null && ask > 0 ? (bid + ask) / 2 : null,
          openInterest: num(best.openInterest),
          volume: num(best.volume),
          impliedVolatility: num(best.impliedVolatility),
        } as ChainQuote;
      } catch {
        // sıradaki host
      }
    }
    return null;
  });
}
