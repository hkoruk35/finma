import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET() {
  const masterPaths = [
    path.join(process.cwd(), "..", "data", "latest", "master.json"),
    path.join(process.cwd(), "data", "latest", "master.json"),
    path.join(process.cwd(), "..", "..", "data", "latest", "master.json"),
  ];

  for (const p of masterPaths) {
    try {
      if (fs.existsSync(p)) {
        const master = JSON.parse(fs.readFileSync(p, "utf-8"));
        return NextResponse.json({
          date: master.date || "",
          breakout:  master.menus?.breakout?.tickers  || [],
          momentum:  master.menus?.momentum?.tickers  || [],
          value:     master.menus?.value?.tickers     || [],
          reversal:  master.menus?.reversal?.tickers  || [],
        });
      }
    } catch {}
  }

  return NextResponse.json({ breakout: [], momentum: [], value: [], reversal: [], date: "" });
}
