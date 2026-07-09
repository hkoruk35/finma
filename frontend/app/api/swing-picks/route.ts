import { NextRequest, NextResponse } from "next/server";
import { getSwingPicksBackfilled } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const minParam = req.nextUrl.searchParams.get("min");
  const min = minParam ? parseInt(minParam, 10) : 10;
  const data = await getSwingPicksBackfilled(Number.isFinite(min) && min > 0 ? min : 10);
  return NextResponse.json(data);
}
