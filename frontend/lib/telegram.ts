import { supabaseAdmin } from "@/lib/supabase-admin";

export const TELEGRAM_API_KEY = process.env.TELEGRAM_API_KEY || "8501733970:AAHM1l2wkPRKOWQdtq8jRqWZazGQhYteH5k";
export const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "-1003569445341";

export interface MemberStats {
  newToday: number;
  canceledCount: number;
  newThisMonth: number;
  totalActive: number;
  totalMembers: number;
}

export async function fetchMemberStats(): Promise<MemberStats> {
  const now = new Date();
  
  // Today midnight UTC
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  
  // First day of current month UTC
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const { data: members, error } = await supabaseAdmin
    .from("members")
    .select("id, plan, subscription_status, cancel_at_period_end, created_at");

  if (error || !members) {
    console.error("[Telegram] Error fetching members:", error?.message);
    return { newToday: 0, canceledCount: 0, newThisMonth: 0, totalActive: 0, totalMembers: 0 };
  }

  let newToday = 0;
  let newThisMonth = 0;
  let canceledCount = 0;
  let totalActive = 0;

  for (const m of members) {
    const createdAt = m.created_at || "";
    if (createdAt >= todayStart) {
      newToday++;
    }
    if (createdAt >= monthStart) {
      newThisMonth++;
    }
    const isCanceled = m.plan === "canceled" || m.subscription_status === "canceled";
    if (isCanceled) {
      canceledCount++;
    } else {
      totalActive++;
    }
  }

  return {
    newToday,
    canceledCount,
    newThisMonth,
    totalActive,
    totalMembers: members.length,
  };
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_API_KEY}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.description || "Telegram API Error" };
    }

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Network Error" };
  }
}

export async function sendHourlyMemberReport(): Promise<{ ok: boolean; stats: MemberStats; error?: string }> {
  const stats = await fetchMemberStats();

  const timeStr = new Date().toLocaleTimeString("tr-TR", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" }) + " UTC";

  const message = `📊 <b>BOGASTOCK — Üye Raporu (${timeStr})</b>

🔹 <b>Bugün yeni üye sayısı:</b> <code>${stats.newToday}</code>
🔹 <b>İptal edilen üye sayısı:</b> <code>${stats.canceledCount}</code>
🔹 <b>Bu ay yeni üye sayısı:</b> <code>${stats.newThisMonth}</code>
🔹 <b>Güncel aktif üye sayısı:</b> <code>${stats.totalActive}</code> (Toplam: <code>${stats.totalMembers}</code>)

⚡ <i>Sistem Otomatik Saatlik Raporlama</i>`;

  const result = await sendTelegramMessage(message);
  return { ok: result.ok, stats, error: result.error };
}
