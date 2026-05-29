/**
 * BOGA AI Data API Route
 * Serves JSON files from the bot's transfer/latest/ directory.
 *
 * Routes:
 *   GET /api/data/master.json
 *   GET /api/data/latest/master.json   ← "latest" prefix is stripped automatically
 *   GET /api/data/all_tickers_list.json
 *   GET /api/data/stocks/AAPL.json
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Primary: bot writes to transfer/latest/ (local dev)
// Fallback: public/data/latest/ (Vercel — committed to git)
const TRANSFER_ROOT = process.env.FINMA_DATA_PATH
  ? path.resolve(process.env.FINMA_DATA_PATH)
  : path.resolve(process.cwd(), "..", "transfer", "latest");

const PUBLIC_ROOT = path.resolve(process.cwd(), "public", "data", "latest");

function sanitize(content: string): string {
  return content
    .replace(/:\s*NaN/g, ": null")
    .replace(/:\s*Infinity/g, ": null")
    .replace(/:\s*-Infinity/g, ": null");
}

function readFile(fullPath: string): string | null {
  try {
    if (fs.existsSync(fullPath)) return fs.readFileSync(fullPath, "utf-8");
  } catch {}
  return null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // Security: no path traversal
  if (pathSegments.join("/").includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Strip leading "latest" segment — DATA_ROOT already points to the latest dir
  const segments = pathSegments[0] === "latest" ? pathSegments.slice(1) : pathSegments;

  if (segments.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Try transfer root first, then public/data/latest fallback
  const candidates = [
    path.join(TRANSFER_ROOT, ...segments),
    path.join(PUBLIC_ROOT, ...segments),
  ];

  let raw: string | null = null;
  let usedPath = "";
  for (const p of candidates) {
    raw = readFile(p);
    if (raw) { usedPath = p; break; }
  }

  if (!raw) {
    console.warn(`[data-api] File not found. Tried:\n  ${candidates.join("\n  ")}`);
    return NextResponse.json(
      { error: "Data not available. Bot may not have run yet." },
      { status: 404 }
    );
  }

  try {
    const json = JSON.parse(sanitize(raw));
    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Data-Source": usedPath.includes("public") ? "static" : "bot",
      },
    });
  } catch (e) {
    console.error(`[data-api] Parse error for ${usedPath}:`, e);
    return NextResponse.json({ error: "Failed to read data file" }, { status: 500 });
  }
}
