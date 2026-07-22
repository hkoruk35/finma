import { NextRequest, NextResponse } from "next/server";
import { sendHourlyMemberReport } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    // Also allow manual admin triggers or query secret
    const secretParam = req.nextUrl.searchParams.get("secret");
    if (secretParam !== cronSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await sendHourlyMemberReport();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Could not send report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stats: result.stats });
}

export async function POST(req: NextRequest) {
  // Manual trigger from Admin UI
  const role = req.cookies.get("boga_auth")?.value;
  if (role !== "admin" && role !== "readonly") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await sendHourlyMemberReport();
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Could not send report" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stats: result.stats });
}
