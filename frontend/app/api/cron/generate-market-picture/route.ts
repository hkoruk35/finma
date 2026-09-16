import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getLatestDailySnapshots, getLatestWeeklySnapshot } from "@/lib/indexSnapshots";
import { generateLocalizedTexts, LOCALES, type MarketPictureMode } from "@/lib/x/generateContent";
import { computeBogaView } from "@/lib/marketBiasEngine";

export const runtime = "nodejs";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

// Sayfalardaki (app/global/{locale}/home/page.tsx) endeks/sektör listeleriyle
// aynı ticker seti — tek kaynak burada, homepage widget'ı bu tabloyu okur.
const INDEX_ITEMS = [
  { ticker: "^GSPC", label: "S&P 500" },
  { ticker: "^NDX",  label: "Nasdaq 100" },
  { ticker: "^DJI",  label: "Dow Jones" },
  { ticker: "^RUT",  label: "Russell 2000" },
  { ticker: "^VIX",  label: "VIX" },
];

const COMMODITY_FX_ITEMS = [
  { ticker: "CL=F",    label: "WTI Crude Oil" },
  { ticker: "GC=F",    label: "Gold" },
  { ticker: "SI=F",    label: "Silver" },
  { ticker: "EURUSD=X", label: "EUR/USD" },
  { ticker: "DX-Y.NYB", label: "US Dollar Index" },
  { ticker: "^TNX",   label: "10Y Treasury Yield" },
];

const SECTOR_ITEMS = [
  { ticker: "XLK",  label: "Technology" },
  { ticker: "XLF",  label: "Financials" },
  { ticker: "XLE",  label: "Energy" },
  { ticker: "XLV",  label: "Health Care" },
  { ticker: "XLY",  label: "Consumer Discretionary" },
  { ticker: "XLP",  label: "Consumer Staples" },
  { ticker: "XLI",  label: "Industrials" },
  { ticker: "XLB",  label: "Materials" },
  { ticker: "XLRE", label: "Real Estate" },
  { ticker: "XLU",  label: "Utilities" },
  { ticker: "XLC",  label: "Communication Services" },
];

const INTRADAY_MIN_GAP_MIN = 110;

const YF_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": "https://finance.yahoo.com/",
  "Accept-Language": "en-US,en;q=0.9",
};

// Yahoo Finance'den cache'SİZ (no-store) doğrudan veri çeker.
// getMultiQuote kullanılmıyor çünkü o 15 dakika Next.js cache'i kullanıyor —
// kapanış saatinde eski intraday değeri gelebilir ve AI yanlış analiz üretir.
async function fetchYFChangePct(yahooSymbol: string): Promise<number | null> {
  try {
    const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: YF_HEADERS,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    // regularMarketChangePercent: piyasa kapandıysa günlük kapanış değişimi
    if (meta?.regularMarketChangePercent != null) {
      return +meta.regularMarketChangePercent.toFixed(2);
    }
    // Fallback: closes dizisinden hesapla
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const closes = rawCloses.filter((c): c is number => c != null && c > 0);
    if (closes.length >= 2) {
      const today = closes[closes.length - 1];
      const prev  = closes[closes.length - 2];
      if (prev > 0) return +(((today - prev) / prev) * 100).toFixed(2);
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchFreshQuotes(
  items: { ticker: string; label: string }[]
): Promise<{ label: string; changePct: number }[]> {
  const results = await Promise.all(
    items.map(async (item) => {
      const pct = await fetchYFChangePct(item.ticker);
      return { label: item.label, changePct: pct ?? 0, raw: pct };
    })
  );
  return results;
}

function nowInNY(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false, weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
}

function nyWeekday(): number {
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

function nyDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function nyTimeString(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date());
}

function determineMode(): MarketPictureMode {
  const ny = nowInNY();
  const weekday = nyWeekday();
  const minutesOfDay = ny.getHours() * 60 + ny.getMinutes();
  const marketOpenMin  = 9 * 60 + 30;
  const marketCloseMin = 16 * 60;

  if (weekday === 0 || weekday === 6) return "week_close";
  if (minutesOfDay < marketOpenMin) return weekday === 1 ? "week_close" : "day_close";
  if (minutesOfDay < marketCloseMin) return "intraday";
  return weekday === 5 ? "week_close" : "day_close";
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = determineMode();
  const tradeDate = nyDateString();
  const nyTime = nyTimeString();
  const force = req.nextUrl.searchParams.get("force") === "1";

  const { data: existing } = await supabaseAdmin.from("market_picture").select("*").eq("id", 1).maybeSingle();

  if (existing && !force) {
    const sameDay = existing.trade_date === tradeDate;
    if (mode === "intraday") {
      const elapsedMin = (Date.now() - new Date(existing.generated_at).getTime()) / 60000;
      if (existing.mode === "intraday" && sameDay && elapsedMin < INTRADAY_MIN_GAP_MIN) {
        return NextResponse.json({ skipped: "intraday interval not elapsed", elapsedMin });
      }
    } else if (existing.mode === mode && sameDay) {
      return NextResponse.json({ skipped: `${mode} already generated for ${tradeDate}` });
    } else if (mode === "week_close" && existing.mode === "week_close") {
      const elapsedHours = (Date.now() - new Date(existing.generated_at).getTime()) / 3600_000;
      if (elapsedHours < 60) {
        return NextResponse.json({ skipped: "week_close already generated recently", elapsedHours });
      }
    }
  }

  // Yahoo Finance'den CACHE'SİZ doğrudan çek — 15dk cache'li getMultiQuote değil.
  // Bu, kapanış saatinde hâlâ intraday yüksek değerin AI'ya gitmesini engeller.
  const [indicesRaw, sectorsRaw, commoditiesFxRaw] = await Promise.all([
    fetchFreshQuotes(INDEX_ITEMS),
    fetchFreshQuotes(SECTOR_ITEMS),
    fetchFreshQuotes(COMMODITY_FX_ITEMS),
  ]);

  // Veri kalitesi kontrolü: tüm ana endeksler 0 ise YF fetch başarısız olmuştur.
  const majorAllZero = indicesRaw.slice(0, 3).every((i) => i.changePct === 0);
  if (majorAllZero && !force) {
    console.error("[cron/generate-market-picture] All major indices returned 0 from Yahoo Finance — skipping to prevent wrong analysis.", JSON.stringify(indicesRaw.slice(0, 3)));
    return NextResponse.json({ skipped: "all-zero quotes, YF fetch likely failed" }, { status: 200 });
  }

  // Hangi verilerle analiz üretildiğini logla — yanlış analiz debug için kritik.
  console.log(`[cron/generate-market-picture] mode=${mode} date=${tradeDate} time=${nyTime} ET — indices:`, JSON.stringify(indicesRaw));

  const spxSnapshots = await getLatestDailySnapshots("SPX");
  const latestSpx = spxSnapshots[spxSnapshots.length - 1] ?? null;
  const quant = (latestSpx?.quant_snapshot ?? null) as Record<string, unknown> | null;
  const rawGainers = Array.isArray(quant?.top_gainers) ? (quant!.top_gainers as any[]) : [];
  const rawLosers  = Array.isArray(quant?.top_losers)  ? (quant!.top_losers  as any[]) : [];
  const topGainers = rawGainers.slice(0, 5).map((g) => ({ ticker: g.ticker, changePct: g.change_pct ?? 0 })).filter((g) => g.ticker);
  const topLosers  = rawLosers.slice(0, 5).map((l)  => ({ ticker: l.ticker, changePct: l.change_pct ?? 0 })).filter((l) => l.ticker);

  const previousSummary = (existing as any)?.previous_summary as string | null ?? null;

  let weekChangePct: number | null = null;
  let weekSectorRotation: { label: string; changePct: number }[] | undefined;
  if (mode === "week_close") {
    const weekly = await getLatestWeeklySnapshot("SPX");
    weekChangePct = weekly?.change_pct_week ?? null;
    const rotation = Array.isArray(weekly?.sector_rotation) ? (weekly!.sector_rotation as any[]) : [];
    if (rotation.length > 0) {
      weekSectorRotation = rotation
        .map((r) => ({ label: r.sector ?? r.label ?? r.name, changePct: r.change_pct ?? r.changePct ?? 0 }))
        .filter((r) => r.label);
    }
  }

  const facts = {
    mode,
    tradeDate,
    nyTime,
    indices:      indicesRaw,
    sectors:      sectorsRaw,
    commoditiesFx: commoditiesFxRaw,
    advancers:    latestSpx?.advancers ?? null,
    decliners:    latestSpx?.decliners ?? null,
    topGainers,
    topLosers,
    weekChangePct,
    weekSectorRotation,
  };

  try {
    const texts = await generateLocalizedTexts({
      contentType: "market_picture",
      mode,
      nyTime,
      indices:      indicesRaw,
      sectors:      sectorsRaw,
      commoditiesFx: commoditiesFxRaw,
      advancers:    latestSpx?.advancers ?? null,
      decliners:    latestSpx?.decliners ?? null,
      topGainers,
      topLosers,
      weekChangePct,
      weekSectorRotation,
      previousSummary,
    });

    const bogaView = computeBogaView({
      indices:  indicesRaw,
      sectors:  sectorsRaw,
      advancers: latestSpx?.advancers ?? null,
      decliners: latestSpx?.decliners ?? null,
    });

    const newSummary = typeof texts.en === "string" ? texts.en.slice(0, 600) : null;

    const upsertPayload: Record<string, unknown> = {
      id: 1,
      mode,
      trade_date: tradeDate,
      facts,
      texts,
      boga_view: bogaView,
      generated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabaseAdmin.from("market_picture").upsert({ ...upsertPayload, previous_summary: newSummary });
      if (error) {
        console.warn("[cron/generate-market-picture] upsert with previous_summary failed, retrying without:", error.message);
        await supabaseAdmin.from("market_picture").upsert(upsertPayload);
      }
    } catch {
      await supabaseAdmin.from("market_picture").upsert(upsertPayload);
    }

    return NextResponse.json({ generated: true, mode, tradeDate, nyTime, locales: LOCALES });
  } catch (err: any) {
    console.error("[cron/generate-market-picture] failed:", err?.message || err);
    return NextResponse.json({ error: err?.message || "generation failed" }, { status: 500 });
  }
}
