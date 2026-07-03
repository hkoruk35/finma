import { NextRequest, NextResponse } from "next/server";
import { getLandingConfig, getLandingConfigs } from "@/lib/landingConfig";

export async function GET(req: NextRequest) {
  const lang = new URL(req.url).searchParams.get("lang");
  if (lang) {
    const cfg = getLandingConfig(lang);
    if (!cfg) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(cfg, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  }
  return NextResponse.json(getLandingConfigs(), { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
}
