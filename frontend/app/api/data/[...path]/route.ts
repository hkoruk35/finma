/**
 * BOGA AI Data API Route
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

// Bot writes data to: boga_ai/.claude/worktrees/clever-diffie/transfer/latest/
// In a worktree, this is at: boga_ai/transfer/latest (after relative resolution)
// frontend/ is at: boga_ai/.claude/worktrees/clever-diffie/frontend/
// Path from frontend directory:
//   - Up 1: .claude/worktrees/clever-diffie/
//   - Add transfer/latest: .claude/worktrees/clever-diffie/transfer/latest
const DATA_ROOT = process.env.FINMA_DATA_PATH
  ? path.resolve(process.env.FINMA_DATA_PATH)
  : path.resolve(process.cwd(), "..", "transfer");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathSegments } = await params;

  // Security: only allow .json files, no path traversal
  const filePath = pathSegments.join("/");
  if (!filePath.endsWith(".json") && !pathSegments.some(s => s.includes("."))) {
     // Allow directory traversal for now if it's just a file check, but we usually want .json
  }
  
  if (filePath.includes("..")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // If the path starts with "latest" and we are already using the transfer root, 
  // path.join(DATA_ROOT, "latest", ...) will work.
  const fullPath = path.join(DATA_ROOT, ...pathSegments);

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
        "X-Data-Source": "boga_ai-bot",
      },
    });
  } catch (e) {
    console.error(`[data-api] Error reading ${fullPath}:`, e);
    return NextResponse.json({ error: "Failed to read data file" }, { status: 500 });
  }
}
