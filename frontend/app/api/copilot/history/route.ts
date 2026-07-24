import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("copilot_chats")
    .select("chat_state, updated_at")
    .eq("user_id", userData.user.id)
    .single();

  const raw = Array.isArray(data?.chat_state) ? data!.chat_state : [];
  const messages = raw.filter(
    (m: any) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );

  // Format dated archive entry
  const updatedAt = data?.updated_at ? new Date(data.updated_at) : new Date();
  const formattedDate = updatedAt.toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const preview = lastUserMsg?.content ? String(lastUserMsg.content).slice(0, 45) + "..." : "Sohbet Geçmişi";

  const archives = messages.length > 0
    ? [
        {
          id: "current_session",
          date: formattedDate,
          preview,
          messageCount: messages.length,
        },
      ]
    : [];

  return NextResponse.json({ messages, archives });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Clear visible chat messages from copilot_chats table.
  // NOTE: copilot_search_history and custom_watchlists REMAIN INTACT
  // so Copilot's long-term memory continues learning user preferences!
  await supabaseAdmin
    .from("copilot_chats")
    .update({ chat_state: [] })
    .eq("user_id", userData.user.id);

  return NextResponse.json({ success: true });
}
