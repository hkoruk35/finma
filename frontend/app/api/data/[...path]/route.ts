/**
 * FinMA Data API Route
 * Serves JSON files from the bot's transfer/latest/ directory.
 *
 * Routes:
 *   GET /api/data/master.json
 *   GET /api/data/all_tickers_list.json
 *   GET /api/data/stocks/AAPL.json
 */

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

// Bot writes data here: transfer/latest/ under the main finma directory.
// frontend/ is at: finma/.claude/worktrees/clever-diffie/frontend/
// data is at:      finma/transfer/latest/
// Path from frontend up to finma root: ../../../../
const DATA_ROOT = process.env.FINMA_DATA_PATH
  ? path.resolve(process.env.FINMA_DATA_PATH)
  : path.resolve(process.cwd(), "..", "..", "..", "..", "transfer", "latest");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // Security: only allow .json files, no path traversal
  const filePath = pathSegments.join("/");
  if (!filePath.endsWith(".json") || filePath.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const fullPath = path.join(DATA_ROOT, filePath);

  // Check file exists
  if (!fs.existsSync(fullPath)) {
    console.warn(`[data-api] File not found: ${fullPath}`);
    return NextResponse.json(
      { error: "Data not available. Bot may not have run yet." },
      { status: 404 }
    );
  }

  try {
    let content = fs.readFileSync(fullPath, "utf-8");

    // The bot sometimes writes Python NaN/Infinity values which are invalid JSON.
    // Replace them with null before parsing.
    content = content
      .replace(/:\s*NaN/g, ": null")
      .replace(/:\s*Infinity/g, ": null")
      .replace(/:\s*-Infinity/g, ": null");

    const json = JSON.parse(content);

    return NextResponse.json(json, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Data-Source": "finma-bot",
      },
    });
  } catch (e) {
    console.error(`[data-api] Error reading ${fullPath}:`, e);
    return NextResponse.json({ error: "Failed to read data file" }, { status: 500 });
  }
}
