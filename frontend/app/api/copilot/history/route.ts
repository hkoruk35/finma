import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Sayfa yenilenince veya yeni sekmede açılınca sohbetin kaybolmaması için
// copilot_chats'teki son kaydedilmiş durumu döner (route.ts'in onFinish'te
// yazdığı aynı tablo).
export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("copilot_chats")
    .select("chat_state")
    .eq("user_id", userData.user.id)
    .single();

  return NextResponse.json({ messages: data?.chat_state ?? [] });
}
