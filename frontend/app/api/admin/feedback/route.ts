import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isStaffAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("feedback")
    .select("*, feedback_replies(id, sender_type, message, created_at, email_sent)")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("[api/admin/feedback GET] error:", error);
    return NextResponse.json({ error: "Load failed" }, { status: 500 });
  }

  return NextResponse.json({ feedback: data || [] });
}

const STATUSES = new Set(["new", "reviewing", "planned", "in_progress", "waiting_user", "resolved", "closed", "archived"]);
const PRIORITIES = new Set(["low", "normal", "high", "critical"]);
const ACTIONS = new Set(["no_action", "investigate", "fix_bug", "improve_ux", "roadmap", "data_review", "contact_user"]);

export async function PATCH(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    id?: string;
    status?: string;
    priority?: string;
    action?: string;
    action_note?: string;
    assigned_to?: string;
    archived?: boolean;
    reply?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { id } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const update: Record<string, any> = {};
  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
  }
  if (body.priority !== undefined) {
    if (!PRIORITIES.has(body.priority)) return NextResponse.json({ error: "Invalid priority" }, { status: 400 });
    update.priority = body.priority;
  }
  if (body.action !== undefined) {
    if (body.action && !ACTIONS.has(body.action)) return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    update.action = body.action || null;
  }
  if (body.action_note !== undefined) update.action_note = String(body.action_note).slice(0, 2000) || null;
  if (body.assigned_to !== undefined) update.assigned_to = String(body.assigned_to).slice(0, 100) || null;
  if (body.archived) update.archived_at = new Date().toISOString();

  if (Object.keys(update).length > 0) {
    const { error } = await supabaseAdmin.from("feedback").update(update).eq("id", id);
    if (error) {
      console.error("[api/admin/feedback PATCH] update error:", error);
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }
  }

  // Cevap yazıldıysa ayrı bir feedback_replies satırı eklenir (v1: email
  // gönderilmiyor — bkz. docs/DATA_CONTRACTS.md, e-posta sağlayıcı entegre
  // edilene kadar cevap sadece admin panelinde/ileride "My Feedback"ta görünür).
  const replyText = body.reply?.trim();
  if (replyText) {
    const { error: replyError } = await supabaseAdmin.from("feedback_replies").insert({
      feedback_id: id,
      sender_type: "admin",
      message: replyText.slice(0, 5000),
      email_sent: false,
    });
    if (replyError) {
      console.error("[api/admin/feedback PATCH] reply insert error:", replyError);
      return NextResponse.json({ error: "Reply failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
