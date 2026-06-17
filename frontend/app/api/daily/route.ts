import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const maxDuration = 30;
export const revalidate = 0;

// Next.js cwd() = frontend/ directory, so public is direct
function getPublicDir(): string {
  // In Next.js, process.cwd() is the project root (frontend/)
  const direct = path.join(process.cwd(), "public");
  if (fs.existsSync(direct)) return direct;
  // Fallback: absolute path
  return "C:/Users/afksm/finma/frontend/public";
}

function getHistoryDir(pubDir: string): string {
  return path.join(pubDir, "intraday_history");
}

function safeRead(filePath: string): any {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

// Get all unique trading dates from history folder
function getAvailableDates(histDir: string): string[] {
  try {
    if (!fs.existsSync(histDir)) return [];
    const files = fs.readdirSync(histDir);
    const dates = new Set<string>();
    for (const f of files) {
      // Format: 2026-06-09T10.json
      const m = f.match(/^(\d{4}-\d{2}-\d{2})T/);
      if (m) dates.add(m[1]);
    }
    return Array.from(dates).sort().reverse(); // newest first
  } catch {
    return [];
  }
}

// Build full day data from history files for a given date
function buildDayData(histDir: string, date: string) {
  try {
    if (!fs.existsSync(histDir)) return null;
    const files = fs.readdirSync(histDir)
      .filter(f => f.startsWith(date + "T") && f.endsWith(".json"))
      .sort();

    if (files.length === 0) return null;

    // Collect all signals across hours for this day
    const tickerMap: Record<string, any> = {};
    let market_regime = "Unknown";
    let vix_level = 0;
    const hourSlots: string[] = [];

    for (const file of files) {
      const hourSlot = file.replace(".json", "").split("T")[1]; // e.g. "10"
      const hourLabel = `${hourSlot}:00`;
      hourSlots.push(hourLabel);

      const data = safeRead(path.join(histDir, file));
      if (!data) continue;

      market_regime = data.market_regime || market_regime;
      vix_level = data.vix_level || vix_level;

      const signals: any[] = data.signals || [];
      for (const sig of signals) {
        const t = sig.ticker;
        if (!t) continue;

        if (!tickerMap[t]) {
          tickerMap[t] = {
            ticker: t,
            company: sig.company || t,
            sector: sig.sector || "Unknown",
            swing_pick_date: sig.swing_pick_date || date,
            first_seen: hourLabel,
            first_seen_price: sig.current_price,
            entry_price: null,
            entry_triggered_at: null,
            current_price: sig.current_price,
            current_status: sig.status,
            current_detail: sig.status_detail,
            alert_level: sig.alert_level,
            buy_zone: sig.buy_zone || {},
            stop_zone: sig.stop_zone || {},
            profit_zone: sig.profit_zone || {},
            status_history: [],
            intraday: sig.intraday || {},
            notes: sig.notes || [],
          };
        }

        // Update current snapshot
        tickerMap[t].current_price = sig.current_price;
        tickerMap[t].current_status = sig.status;
        tickerMap[t].current_detail = sig.status_detail;
        tickerMap[t].intraday = sig.intraday || tickerMap[t].intraday;
        tickerMap[t].notes = sig.notes || tickerMap[t].notes;
        tickerMap[t].alert_level = sig.alert_level;

        // Track entry
        if (sig.status === "ENTRY_NOW" && !tickerMap[t].entry_price) {
          tickerMap[t].entry_price = sig.current_price;
          tickerMap[t].entry_triggered_at = hourLabel;
        }

        // Add to status history
        tickerMap[t].status_history.push({
          hour: hourLabel,
          status: sig.status,
          price: sig.current_price,
        });
      }
    }

    // Compute P&L for each ticker (from first_seen_price to current_price)
    for (const t of Object.keys(tickerMap)) {
      const tk = tickerMap[t];
      const refPrice = tk.entry_price || tk.first_seen_price;
      if (refPrice && tk.current_price) {
        tk.pnl_pct = ((tk.current_price - refPrice) / refPrice) * 100;
      } else {
        tk.pnl_pct = 0;
      }
    }

    return {
      date,
      market_regime,
      vix_level,
      hour_slots: hourSlots,
      tickers: Object.values(tickerMap).sort((a, b) => {
        // Sort by alert_level then status
        const alertOrder: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (alertOrder[b.alert_level] || 0) - (alertOrder[a.alert_level] || 0);
      }),
      total: Object.keys(tickerMap).length,
    };
  } catch (e) {
    console.error("[daily] buildDayData error:", e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date") || "today";
  const mode = searchParams.get("mode") || "day"; // "day" | "dates"

  const pubDir = getPublicDir();
  const histDir = getHistoryDir(pubDir);

  // Return list of available dates
  if (mode === "dates") {
    const dates = getAvailableDates(histDir);
    return NextResponse.json({ dates });
  }

  // Determine which date to load
  let targetDate: string;
  if (dateParam === "today") {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    targetDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  } else {
    targetDate = dateParam;
  }

  // Build day data from history files
  const dayData = buildDayData(histDir, targetDate);

  if (!dayData) {
    // Fall back to latest signals for today
    const latestPath = path.join(pubDir, "intraday_signals.json");
    const summaryPath = path.join(pubDir, "intraday_signals_summary.json");
    const latest = safeRead(latestPath);
    const summary = safeRead(summaryPath);

    if (!latest && !summary) {
      return NextResponse.json({ error: "No data found", date: targetDate }, { status: 404 });
    }

    const normalizedSignals = (latest?.signals || []).map((sig: any) => ({
      ticker: sig.ticker,
      company: sig.company || sig.ticker,
      sector: sig.sector || "Unknown",
      swing_pick_date: sig.swing_pick_date || targetDate,
      first_seen: "",
      first_seen_price: sig.current_price,
      entry_price: sig.entry_price ?? null,
      entry_triggered_at: sig.entry_triggered_at ?? null,
      current_price: sig.current_price,
      current_status: sig.status,
      current_detail: sig.status_detail,
      alert_level: sig.alert_level,
      pnl_pct: 0,
      buy_zone: sig.buy_zone || {},
      stop_zone: sig.stop_zone || {},
      profit_zone: sig.profit_zone || {},
      status_history: [],
      intraday: sig.intraday || {},
      notes: sig.notes || [],
    }));

    return NextResponse.json({
      date: targetDate,
      market_regime: latest?.market_regime || "Unknown",
      vix_level: latest?.vix_level || 0,
      hour_slots: [],
      tickers: normalizedSignals,
      total: latest?.total_scanned || 0,
      source: "latest",
    });
  }

  // Enrich with summary data if available for today
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  if (targetDate === todayStr) {
    const summaryPath = path.join(pubDir, "intraday_signals_summary.json");
    const summary = safeRead(summaryPath);
    if (summary && summary.date === todayStr) {
      // Enrich entry tracking from summary
      for (const tk of dayData.tickers) {
        const s = summary.tickers?.[tk.ticker];
        if (s) {
          if (s.entry_price) tk.entry_price = s.entry_price;
          if (s.entry_triggered_at) tk.entry_triggered_at = s.entry_triggered_at;
        }
      }
    }
  }

  return NextResponse.json(dayData);
}
