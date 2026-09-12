import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getMultiQuote } from "@/lib/homeFeed";
import { getLatestDailySnapshots, getLatestWeeklySnapshot } from "@/lib/indexSnapshots";
import { generateLocalizedTexts, LOCALES, type MarketPictureMode } from "@/lib/x/generateContent";
import { computeBogaView } from "@/lib/marketBiasEngine";

export const runtime = "nodejs";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

// Sayfalardaki (app/global/{locale}/home/page.tsx) endeks/sektör listeleriyle
// aynı ticker seti — tek kaynak burada, homepage widget'ı bu tabloyu okur.
const INDEX_ITEMS = [
  { ticker: "SPX", label: "S&P 500" },
  { ticker: "NDX", label: "Nasdaq 100" },
  { ticker: "DJI", label: "Dow Jones" },
  { ticker: "RUT", label: "Russell 2000" },
  { ticker: "VIX", label: "VIX" },
];

const SECTOR_ITEMS = [
  { ticker: "XLK", label: "Technology" },
  { ticker: "XLF", label: "Financials" },
  { ticker: "XLE", label: "Energy" },
  { ticker: "XLV", label: "Health Care" },
  { ticker: "XLY", label: "Consumer Discretionary" },
  { ticker: "XLP", label: "Consumer Staples" },
  { ticker: "XLI", label: "Industrials" },
  { ticker: "XLB", label: "Materials" },
  { ticker: "XLRE", label: "Real Estate" },
  { ticker: "XLU", label: "Utilities" },
  { ticker: "XLC", label: "Communication Services" },
];

// Otonom modda (piyasa saatleri disinda) tekrar tekrar ayni gunu/haftayi
// yeniden uretmemek icin: intraday 110 dk'da bir (2 saatlik hedefin altinda,
// saatlik cron'un kacirma payi icin), day_close/week_close ise gunde/haftada
// sadece bir kez.
const INTRADAY_MIN_GAP_MIN = 110;

function nowInNY(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  return new Date(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
  );
}

function nyWeekday(): number {
  // 0=Sun..6=Sat, based on the NY wall-clock date.
  const short = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(new Date());
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);
}

function nyDateString(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); // YYYY-MM-DD
}

function determineMode(): MarketPictureMode {
  const ny = nowInNY();
  const weekday = nyWeekday(); // 0 Sun .. 6 Sat
  const minutesOfDay = ny.getHours() * 60 + ny.getMinutes();
  const marketOpenMin = 9 * 60 + 30;
  const marketCloseMin = 16 * 60;

  if (weekday === 0 || weekday === 6) return "week_close"; // weekend keeps showing the weekly wrap
  if (minutesOfDay < marketOpenMin) {
    // Before today's open: previous session's close still applies. Friday
    // pre-market (or Monday pre-market) both fall back to the last
    // completed week's wrap since there's no fresher "day_close" yet today.
    return weekday === 1 ? "week_close" : "day_close";
  }
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
      // Haftasonu/Pazartesi sabahi ayni haftalik ozeti tekrar tekrar uretmesin.
      const elapsedHours = (Date.now() - new Date(existing.generated_at).getTime()) / 3600_000;
      if (elapsedHours < 60) {
        return NextResponse.json({ skipped: "week_close already generated recently", elapsedHours });
      }
    }
  }

  const allTickers = [...INDEX_ITEMS, ...SECTOR_ITEMS].map((i) => i.ticker);
  const quotes = await getMultiQuote(allTickers);

  const indices = INDEX_ITEMS.map((i) => ({ label: i.label, changePct: quotes[i.ticker]?.change_pct ?? 0 }));
  const sectors = SECTOR_ITEMS.map((s) => ({ label: s.label, changePct: quotes[s.ticker]?.change_pct ?? 0 }));

  const spxSnapshots = await getLatestDailySnapshots("SPX");
  const latestSpx = spxSnapshots[spxSnapshots.length - 1] ?? null;
  const quant = (latestSpx?.quant_snapshot ?? null) as Record<string, unknown> | null;
  const rawGainers = Array.isArray(quant?.top_gainers) ? (quant!.top_gainers as any[]) : [];
  const rawLosers = Array.isArray(quant?.top_losers) ? (quant!.top_losers as any[]) : [];
  const topGainers = rawGainers.slice(0, 3).map((g) => ({ ticker: g.ticker, changePct: g.change_pct ?? 0 })).filter((g) => g.ticker);
  const topLosers = rawLosers.slice(0, 3).map((l) => ({ ticker: l.ticker, changePct: l.change_pct ?? 0 })).filter((l) => l.ticker);

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
    indices,
    sectors,
    advancers: latestSpx?.advancers ?? null,
    decliners: latestSpx?.decliners ?? null,
    topGainers,
    topLosers,
    weekChangePct,
    weekSectorRotation,
  };

  try {
    const texts = await generateLocalizedTexts({
      contentType: "market_picture",
      mode,
      indices,
      sectors,
      advancers: latestSpx?.advancers ?? null,
      decliners: latestSpx?.decliners ?? null,
      topGainers,
      topLosers,
      weekChangePct,
      weekSectorRotation,
    });

    const bogaView = computeBogaView({
      indices,
      sectors,
      advancers: latestSpx?.advancers ?? null,
      decliners: latestSpx?.decliners ?? null,
    });

    await supabaseAdmin.from("market_picture").upsert({
      id: 1,
      mode,
      trade_date: tradeDate,
      facts,
      texts,
      boga_view: bogaView,
      generated_at: new Date().toISOString(),
    });

    return NextResponse.json({ generated: true, mode, tradeDate, locales: LOCALES });
  } catch (err: any) {
    console.error("[cron/generate-market-picture] failed:", err?.message || err);
    return NextResponse.json({ error: err?.message || "generation failed" }, { status: 500 });
  }
}
