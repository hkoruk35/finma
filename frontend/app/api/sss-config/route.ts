import { NextRequest, NextResponse } from "next/server";
import { getSssConfigFromDB, getSssConfigsFromDB, upsertSssConfigToDB } from "@/lib/sssConfig";

export const revalidate = 60;

export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get("lang");
  if (lang) {
    const cfg = await getSssConfigFromDB(lang);
    if (!cfg) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(cfg, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
  }
  const configs = await getSssConfigsFromDB();
  return NextResponse.json(configs, { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    const body = await req.json();
    const { lang, data } = body;
    
    if (!lang || !data) {
      return NextResponse.json({ error: "Missing lang or data" }, { status: 400 });
    }

    await upsertSssConfigToDB(lang, data);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Failed to save SSS config:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
