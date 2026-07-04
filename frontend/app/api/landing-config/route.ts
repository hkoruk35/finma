import { NextRequest, NextResponse } from "next/server";
import { getLandingConfigFromDB, getLandingConfigsFromDB } from "@/lib/landingConfig";

// Use zero revalidation to disable CDN caching for this endpoint if dynamic is needed
// but we can use revalidate = 60
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang) {
    const cfg = await getLandingConfigFromDB(lang);
    if (!cfg) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(cfg, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  }
  const configs = await getLandingConfigsFromDB();
  return NextResponse.json(configs, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
}
