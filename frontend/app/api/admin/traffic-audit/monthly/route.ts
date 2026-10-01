import { NextRequest, NextResponse } from "next/server";
import { buildMonthlyReport } from "@/lib/trafficMonthly";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin" || role === "readonly";
}

/** Monthly comparison + per-country sessions/page views (see lib/trafficMonthly.ts). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    return NextResponse.json(await buildMonthlyReport(), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "monthly report failed" }, { status: 500 });
  }
}
