/**
 * GET /api/admin/supertrade
 * SPX SuperTrade canlı anlık görüntüsü. Tüm hesaplama Node tarafında yapılır;
 * harici Python süreci veya yerel kurulum gerektirmez.
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { getSnapshot } from "@/lib/spx/snapshot";
import { evaluatePendingLogs } from "@/lib/spx/performance-tracker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const snapshot = await getSnapshot();
    // Arka planda evaluatePendingLogs çalıştır
    evaluatePendingLogs(snapshot).catch((err) => console.error("[supertrade] evaluator error:", err));
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
