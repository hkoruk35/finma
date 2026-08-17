/**
 * GET /api/admin/supertrade
 * SPX SuperTrade canlı anlık görüntüsü. Tüm hesaplama Node tarafında yapılır;
 * harici Python süreci veya yerel kurulum gerektirmez.
 */

import { NextResponse } from "next/server";
import { buildSnapshot } from "@/lib/spx/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  try {
    const snapshot = await buildSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    console.error("[supertrade] snapshot hatası:", message);
    return NextResponse.json(
      { ok: false, error: message, hint: "Piyasa veri sağlayıcısına erişilemiyor olabilir." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
