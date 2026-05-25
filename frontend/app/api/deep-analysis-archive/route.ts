import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";

const ARCHIVE_BASE = path.join(process.cwd(), "public", "deep-analysis-archive");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// POST /api/deep-analysis-archive  — save a report snapshot
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, reportData } = body;
    if (!ticker || !reportData) return NextResponse.json({ error: "Missing ticker or reportData" }, { status: 400 });

    const now = new Date();
    // Istanbul timezone offset (UTC+3)
    const istOffset = 3 * 60;
    const local = new Date(now.getTime() + istOffset * 60 * 1000);
    const dateStr = local.toISOString().slice(0, 10);             // YYYY-MM-DD
    const timeStr = local.toISOString().slice(11, 16).replace(":", "-"); // HH-MM

    const slug = `${dateStr}_${timeStr}`;
    const dir  = path.join(ARCHIVE_BASE, ticker.toUpperCase());
    ensureDir(dir);

    const filePath = path.join(dir, `${slug}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ ...reportData, archivedAt: now.toISOString() }, null, 0));

    return NextResponse.json({ success: true, slug, file: `${ticker.toUpperCase()}/${slug}.json` });
  } catch (err: any) {
    console.error("[deep-analysis-archive] POST:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET /api/deep-analysis-archive?ticker=TSLA[&slug=2026-05-24_14-30]
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const ticker = searchParams.get("ticker")?.toUpperCase();
    const slug   = searchParams.get("slug");

    if (!ticker) {
      // List all archived tickers
      ensureDir(ARCHIVE_BASE);
      const tickers = fs.existsSync(ARCHIVE_BASE)
        ? fs.readdirSync(ARCHIVE_BASE).filter(d => fs.statSync(path.join(ARCHIVE_BASE, d)).isDirectory())
        : [];
      return NextResponse.json({ tickers });
    }

    const dir = path.join(ARCHIVE_BASE, ticker);
    if (!fs.existsSync(dir)) return NextResponse.json({ entries: [] });

    if (slug) {
      // Return specific archive
      const file = path.join(dir, `${slug}.json`);
      if (!fs.existsSync(file)) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(JSON.parse(fs.readFileSync(file, "utf-8")));
    }

    // List entries for ticker (newest first)
    const entries = fs.readdirSync(dir)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const slug = f.replace(".json", "");
        const [datePart, timePart] = slug.split("_");
        return { slug, date: datePart, time: timePart?.replace("-", ":") ?? "" };
      })
      .sort((a, b) => b.slug.localeCompare(a.slug));

    return NextResponse.json({ ticker, entries });
  } catch (err: any) {
    console.error("[deep-analysis-archive] GET:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
