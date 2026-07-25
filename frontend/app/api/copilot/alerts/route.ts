import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Görev motorunun (spec böl. 19-23) ürettiği copilot_alerts kayıtlarını üyeye
// gösterir — in-app bildirim rozeti/listesi için. Push/e-posta değildir.

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ alerts: [], unreadCount: 0 });

  const { data } = await supabaseAdmin
    .from("copilot_alerts")
    .select("id, task_id, ticker, severity, title, body, is_read, created_at")
    .eq("user_id", userData.user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const alerts = data || [];
  return NextResponse.json({
    alerts,
    unreadCount: alerts.filter((a) => !a.is_read).length,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const alertId: string | undefined = body.alertId;
  const markAll: boolean = !!body.markAll;

  let query = supabaseAdmin.from("copilot_alerts").update({ is_read: true }).eq("user_id", userData.user.id);
  query = markAll ? query : query.eq("id", alertId || "");
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  return NextResponse.json({ success: true });
}
