/**
 * SPY sinyal motorunun (spy_signal_engine/, standalone Python/FastAPI,
 * 127.0.0.1:8787) /history uç noktasını sunucu tarafında çağırır. Bilinçli
 * olarak nginx'ten DEĞİL — bu route'un kendisi boga_auth ile korunuyor,
 * localhost çağrısı hiç dışarıya açılmıyor (bkz. spy_signal_engine/README.md,
 * nginx_snippet.conf, tasks/active/014-spy-signal-engine-realtime.md).
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında kaldığı için (bkz.
 * frontend/AGENTS.md §3, tasks/active/001) boga_auth kontrolü burada satır
 * içinde yapılır — aynı desen: app/api/admin/spyengine/v2/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";

const INTERNAL_URL = process.env.SPY_ENGINE_INTERNAL_URL || "http://127.0.0.1:8787";

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const secret = process.env.SPY_ENGINE_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "SPY_ENGINE_SECRET yapılandırılmamış", rows: [] }, { status: 503 });
  }

  const limit = req.nextUrl.searchParams.get("limit") || "20";
  try {
    const res = await fetch(`${INTERNAL_URL}/history?limit=${encodeURIComponent(limit)}`, {
      headers: { "X-Spy-Engine-Secret": secret },
      cache: "no-store",
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "spy_signal_engine erişilemedi", rows: [] },
      { status: 502 },
    );
  }
}
