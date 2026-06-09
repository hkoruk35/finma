/**
 * /api/screener-archive
 * Screener scan results archive with timestamp
 */

import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";

interface ArchivedScan {
  id: string;
  preset: string;
  timestamp: string;
  date: string;
  total_results: number;
  top_5_tickers: string[];
  regime: string;
}

const ARCHIVE_PATH = join(process.cwd(), "public", "data", "screener_archive.json");

async function readArchive(): Promise<ArchivedScan[]> {
  try {
    const data = await readFile(ARCHIVE_PATH, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeArchive(scans: ArchivedScan[]): Promise<void> {
  try {
    await writeFile(ARCHIVE_PATH, JSON.stringify(scans, null, 2), "utf-8");
  } catch (e) {
    console.error("Failed to write archive:", e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { preset, results, regime } = body;

    if (!preset || !results) {
      return NextResponse.json({ error: "Missing preset or results" }, { status: 400 });
    }

    const archive = await readArchive();
    const now = new Date();
    const timestamp = now.toISOString();
    const dateStr = now.toLocaleString("tr-TR");

    const topTickers = results.slice(0, 5).map((r: any) => r.ticker);

    const scan: ArchivedScan = {
      id: `scan_${Date.now()}`,
      preset,
      timestamp,
      date: dateStr,
      total_results: results.length,
      top_5_tickers: topTickers,
      regime: regime?.label || "unknown",
    };

    archive.push(scan);
    // Keep last 100 scans
    if (archive.length > 100) {
      archive.splice(0, archive.length - 100);
    }

    await writeArchive(archive);
    return NextResponse.json({ success: true, scan });
  } catch (e) {
    console.error("Archive error:", e);
    return NextResponse.json({ error: "Archive failed" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const archive = await readArchive();
    return NextResponse.json({ scans: archive.reverse() }); // Latest first
  } catch (e) {
    console.error("Archive read error:", e);
    return NextResponse.json({ scans: [] });
  }
}
