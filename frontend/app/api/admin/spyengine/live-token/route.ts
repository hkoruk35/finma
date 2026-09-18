/**
 * Tek satırlık amaç: taraycıya, SPY sinyal motoru WebSocket'ine (nginx-only
 * /admin/spyengine/live/ws, proxy.ts'nin dışında) bağlanmak için gereken
 * paylaşımlı sırrı SADECE boga_auth doğrulamasından geçen istekler için
 * verir. Sır asla NEXT_PUBLIC_* olarak build'e gömülmez — bu route her
 * çağrıldığında sunucu env'inden okunur.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında kaldığı için (bkz.
 * frontend/AGENTS.md §3, tasks/active/001) boga_auth kontrolü burada satır
 * içinde yapılır — aynı desen: app/api/admin/spyengine/v2/route.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const token = process.env.SPY_ENGINE_SECRET;
  if (!token) {
    return NextResponse.json({ error: "SPY_ENGINE_SECRET yapılandırılmamış" }, { status: 503 });
  }
  return NextResponse.json({ token });
}
