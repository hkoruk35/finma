import { NextResponse } from "next/server";
import { getDailyOnePick } from "@/lib/dailyOnePick";

export const dynamic = "force-dynamic";

export async function GET() {
  const pick = await getDailyOnePick();
  if (!pick) {
    return NextResponse.json({ pick: null }, { status: 200 });
  }
  return NextResponse.json({ pick });
}
