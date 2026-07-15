import { NextResponse } from "next/server";
import { getWatchlistPicks } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getWatchlistPicks();
  return NextResponse.json(data);
}
