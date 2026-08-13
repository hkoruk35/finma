import { NextResponse } from "next/server";
import { getDailyOnePicks } from "@/lib/dailyOnePick";

export const dynamic = "force-dynamic";

export async function GET() {
  const picks = await getDailyOnePicks();
  return NextResponse.json({ picks });
}
