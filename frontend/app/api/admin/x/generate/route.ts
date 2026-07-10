import { NextRequest, NextResponse } from "next/server";
import { generateLocalizedTexts } from "@/lib/x/generateContent";

export const runtime = "nodejs";
export const maxDuration = 60;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));

  try {
    const texts =
      body.contentType === "promo"
        ? await generateLocalizedTexts({ contentType: "promo" })
        : await generateLocalizedTexts({
            contentType: "stock",
            ticker: body.ticker,
            company: body.company,
            sector: body.sector,
            theme: body.theme,
            signal: body.signal,
            trend: body.trend,
            bogaScore: body.bogaScore,
          });
    return NextResponse.json({ texts });
  } catch (e: any) {
    console.error("[x/generate]", e?.message);
    return NextResponse.json({ error: e?.message || "generation failed" }, { status: 500 });
  }
}
