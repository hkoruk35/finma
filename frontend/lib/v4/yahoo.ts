/**
 * SPX SuperTrade — Piyasa Verisi Erişim Katmanı
 * Yahoo Finance v8 chart uç noktasından mum verisi çeker (projedeki
 * /api/chart-data ve /api/quote ile aynı desen), New York seans saatlerine
 * göre dilimleme ve zaman dilimi yardımcıları sunar.
 */

import type { Bar, CompactBar } from "./types";

export const YF_SYMBOLS = {
  "ES=F": "ES=F",
  "^GSPC": "^GSPC",
  "NQ=F": "NQ=F",
  "^VIX": "^VIX",
  "^VXN": "^VXN",
  "SPY": "SPY",
  "QQQ": "QQQ",
  "^XSP": "^XSP",
  "^NDX": "^NDX",
  "^XND": "^XND",
} as const;

export type EngineSymbol = string;

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
  Referer: "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

const HOSTS = ["query1.finance.yahoo.com", "query2.finance.yahoo.com"];

export interface FetchBarsResult {
  bars: Bar[];
  /** Yahoo meta.regularMarketPrice — son mumdan daha taze olabilir */
  marketPrice: number | null;
  marketTime: number | null;
  previousClose: number | null;
  error: string | null;
}

/**
 * Tek sembol için mum verisi çeker. İki Yahoo hostunu sırayla dener.
 */
export async function fetchBars(
  symbol: EngineSymbol,
  interval: "1m" | "5m" | "15m" | "1d",
  range: string,
  includePrePost = true,
  timeoutMs = 9000
): Promise<FetchBarsResult> {
  const ySymbol = symbol;
  let lastError = "bilinmeyen hata";

  for (const host of HOSTS) {
    try {
      const url =
        `https://${host}/v8/finance/chart/${encodeURIComponent(ySymbol)}` +
        `?interval=${interval}&range=${range}&includePrePost=${includePrePost ? "true" : "false"}`;

      const res = await fetch(url, {
        headers: YF_HEADERS,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }

      const raw = await res.json();
      const result = raw?.chart?.result?.[0];
      if (!result) {
        lastError = raw?.chart?.error?.description || "boş yanıt";
        continue;
      }

      const timestamps: number[] = result.timestamp || [];
      const q = result.indicators?.quote?.[0] || {};
      const opens = q.open || [];
      const highs = q.high || [];
      const lows = q.low || [];
      const closes = q.close || [];
      const volumes = q.volume || [];

      const bars: Bar[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const o = opens[i];
        const h = highs[i];
        const l = lows[i];
        const c = closes[i];
        if (o == null || h == null || l == null || c == null) continue;
        if (!Number.isFinite(o) || !Number.isFinite(c)) continue;
        bars.push({
          time: timestamps[i],
          open: o,
          high: h,
          low: l,
          close: c,
          volume: volumes[i] ?? 0,
        });
      }

      bars.sort((a, b) => a.time - b.time);

      return {
        bars,
        marketPrice: result.meta?.regularMarketPrice ?? null,
        marketTime: result.meta?.regularMarketTime ?? null,
        previousClose: result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? null,
        error: null,
      };
    } catch (e: unknown) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }

  return { bars: [], marketPrice: null, marketTime: null, previousClose: null, error: lastError };
}

// ── New York zaman dilimi yardımcıları ───────────────────────────

const NY_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export interface NyParts {
  ymd: string; // YYYY-MM-DD
  minutes: number; // gün başından itibaren dakika (ET)
  hhmm: string; // HH:mm
  weekday: number; // 0 = Pazar
  month: number; // 1-12
  day: number;
  year: number;
}

const nyCache = new Map<number, NyParts>();

export function nyParts(unixSec: number): NyParts {
  const cached = nyCache.get(unixSec);
  if (cached) return cached;

  const parts = NY_FORMAT.formatToParts(new Date(unixSec * 1000));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));

  const value: NyParts = {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: hour * 60 + minute,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
    month,
    day,
    year,
  };

  // Sınırsız büyümeyi engelle
  if (nyCache.size > 20000) nyCache.clear();
  nyCache.set(unixSec, value);
  return value;
}

/** Regular Trading Hours (09:30–16:00 ET) dakika sınırları */
export const RTH_OPEN_MIN = 9 * 60 + 30; // 570
export const RTH_CLOSE_MIN = 16 * 60; // 960
export const PREMARKET_OPEN_MIN = 4 * 60; // 240
export const GLOBEX_OPEN_MIN = 18 * 60; // 1080

export function isRth(bar: Bar): boolean {
  const p = nyParts(bar.time);
  return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
}

/** sessionDate'den sonraki bir sonraki işlem günü — hafta sonu atlanır */
export function nextWeekday(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  do {
    date.setUTCDate(date.getUTCDate() + 1);
  } while (date.getUTCDay() === 0 || date.getUTCDay() === 6);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

/** 
 * Veride bulunan en son RTH seans tarihini (YYYY-MM-DD) döndürür.
 * Eğer nowSec verilirse ve saat 00:00 ET'yi geçmişse (veya Pazar akşamı Globex açılmışsa), 
 * o güne ait SPX datası olmasa bile "sonraki seans" tarihini döndürerek gün devrini (rollover) sağlar.
 */
export function latestSessionDate(bars: Bar[], nowSec?: number): string | null {
  let lastRth = null;
  for (let i = bars.length - 1; i >= 0; i--) {
    const p = nyParts(bars[i].time);
    if (p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN) {
      lastRth = p.ymd;
      break;
    }
  }
  if (!lastRth) {
    lastRth = bars.length ? nyParts(bars[bars.length - 1].time).ymd : null;
  }
  if (!lastRth) return null;

  if (nowSec) {
    const now = nyParts(nowSec);
    // Gece yarısını geçmişsek devir yap
    if (now.ymd !== lastRth) {
      if (now.weekday >= 1 && now.weekday <= 5) {
        return now.ymd;
      }
      // Pazar akşamı Globex açıldıysa Pazartesiye devret
      if (now.weekday === 0 && now.minutes >= GLOBEX_OPEN_MIN) {
        return nextWeekday(lastRth);
      }
    }
  }
  
  return lastRth;
}

/** Veride bulunan tüm RTH seans tarihleri, eskiden yeniye */
export function sessionDates(bars: Bar[]): string[] {
  const set = new Set<string>();
  for (const b of bars) {
    const p = nyParts(b.time);
    if (p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN) set.add(p.ymd);
  }
  return Array.from(set).sort();
}

export function barsOnDate(bars: Bar[], ymd: string, opts?: { rthOnly?: boolean }): Bar[] {
  const rthOnly = opts?.rthOnly ?? true;
  return bars.filter((b) => {
    const p = nyParts(b.time);
    if (p.ymd !== ymd) return false;
    if (!rthOnly) return true;
    return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
  });
}

/** Globex gece seansı: önceki gün 18:00 → hedef gün 09:29 ET */
export function overnightBars(bars: Bar[], ymd: string, prevYmd: string | null): Bar[] {
  return bars.filter((b) => {
    const p = nyParts(b.time);
    if (p.ymd === ymd) return p.minutes < RTH_OPEN_MIN;
    if (prevYmd && p.ymd === prevYmd) return p.minutes >= GLOBEX_OPEN_MIN;
    return false;
  });
}

export function premarketBars(bars: Bar[], ymd: string): Bar[] {
  return bars.filter((b) => {
    const p = nyParts(b.time);
    return p.ymd === ymd && p.minutes >= PREMARKET_OPEN_MIN && p.minutes < RTH_OPEN_MIN;
  });
}

/** 1 dakikalık mumları daha büyük zaman dilimine toplar */
export function aggregate(bars: Bar[], factor: number): Bar[] {
  if (factor <= 1) return bars;
  const out: Bar[] = [];
  for (let i = 0; i < bars.length; i += factor) {
    const slice = bars.slice(i, i + factor);
    if (!slice.length) continue;
    out.push({
      time: slice[0].time,
      open: slice[0].open,
      high: Math.max(...slice.map((b) => b.high)),
      low: Math.min(...slice.map((b) => b.low)),
      close: slice[slice.length - 1].close,
      volume: slice.reduce((s, b) => s + (b.volume || 0), 0),
    });
  }
  return out;
}

export function toCompact(bars: Bar[]): CompactBar[] {
  return bars.map((b) => [
    b.time,
    round2(b.open),
    round2(b.high),
    round2(b.low),
    round2(b.close),
    Math.round(b.volume || 0),
  ]);
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
