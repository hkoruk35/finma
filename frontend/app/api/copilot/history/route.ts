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

  // GÜVENLİK: chat_state, bu özellik eklenmeden önce ham CoreMessage formatında
  // (content bir dizi/obje, role "tool" olabilir) yazılmış OLABİLİR. Bu eski
  // kayıtlar useChat/Drawer'ın beklediği UI-mesaj şekline uymaz ve render'ı
  // çökertir (global beyaz ekran — canlı olay buydu). Sadece güvenle render
  // edilebilir mesajları döndür; tanınmayan/eski kayıtları at (bir sonraki
  // mesajda onFinish zaten doğru formatla üzerine yazıp kendini onarır).
  const raw = Array.isArray(data?.chat_state) ? data!.chat_state : [];
  const messages = raw.filter(
    (m: any) =>
      m &&
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string"
  );

  return NextResponse.json({ messages });
}
