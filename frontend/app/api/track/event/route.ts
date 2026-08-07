import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SESSION_COOKIE } from "@/lib/trafficAudit";

// Client-side milestone events (page_loaded / active_5s / active_15s /
// active_30s / user_interaction / signup_started). signup_completed is
// intentionally NOT accepted here — it must only be written server-side
// from an actual successful auth result (see /api/members/register).
const CLIENT_ALLOWED_EVENTS = new Set([
  "page_loaded",
  "active_5s",
  "active_15s",
  "active_30s",
  "user_interaction",
  "signup_started",
]);

const SESSION_PATCH_FIELD: Record<string, string> = {
  page_loaded: "page_loaded",
  active_5s: "active_5s",
  active_15s: "active_15s",
  active_30s: "active_30s",
  user_interaction: "interacted",
  signup_started: "signup_started",
};

export async function POST(req: NextRequest) {
  let body: { event_name?: string; pathname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const eventName = body.event_name;
  if (!eventName || !CLIENT_ALLOWED_EVENTS.has(eventName)) {
    return NextResponse.json({ ok: false, error: "unsupported event" }, { status: 200 });
  }

  const sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    // Henuz proxy'den gecmemis / cookie yok — sessizce yut, siteyi bozma.
    return NextResponse.json({ ok: false, error: "no session" }, { status: 200 });
  }

  const now = Date.now();
  const pathname = body.pathname ?? null;

  // Milestone event append-log — (session_id, event_name) uzerinde partial
  // unique index var (bkz. migration 002), ayni event tekrar gelirse yut.
  await supabaseAdmin
    .from("traffic_events")
    .upsert(
      { session_id: sessionId, event_name: eventName, timestamp: now, pathname },
      { onConflict: "session_id,event_name", ignoreDuplicates: true }
    );

  const patch: Record<string, unknown> = { last_activity: now };
  const field = SESSION_PATCH_FIELD[eventName];
  if (field) patch[field] = true;
  if (eventName === "signup_started") patch.signup_started_at = now;

  await supabaseAdmin.from("traffic_sessions").update(patch).eq("session_id", sessionId);

  return NextResponse.json({ ok: true });
}
