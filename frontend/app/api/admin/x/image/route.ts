import { NextRequest, NextResponse } from "next/server";
import { renderCardPng, type CardParams } from "@/lib/x/renderTemplate";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

// Önizleme amaçlı: sabit şablonu paylaşmadan PNG olarak render eder.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const cardParams = (await req.json().catch(() => null)) as CardParams | null;
  if (!cardParams) return NextResponse.json({ error: "cardParams required" }, { status: 400 });

  try {
    const png = await renderCardPng(cardParams);
    return new NextResponse(new Uint8Array(png), {
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    console.error("[x/image] failed:", e?.stack || e?.message);
    return NextResponse.json({ error: e?.message || "render failed" }, { status: 500 });
  }
}
