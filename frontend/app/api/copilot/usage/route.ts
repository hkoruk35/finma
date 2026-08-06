import { NextResponse } from "next/server";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const access = await getMemberAccess();
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tier = resolveMemberTierFromAccess(access);

  // Free tier: hasAccess artık true (Copilot free'e de açık, bkz. Faz 3) —
  // günlük sabit kota user_credits/get_copilot_credit_status'tan okunur.
  // topupCredits burada members.topup_credit_balance'tan okunur — free
  // üye 9 USD/100 kredi paketini aldıysa günlük 10 dolunca ondan devam
  // edebilir (bkz. copilot/chat/route.ts freeTierUsesTopup).
  if (tier === "free") {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    const [{ data: creditStatus }, { data: memberRow }] = userData.user
      ? await Promise.all([
          supabaseAdmin
            .rpc("get_copilot_credit_status", { p_user_id: userData.user.id, p_default_limit: 10 })
            .single<{ current_usage: number; daily_limit: number }>(),
          supabaseAdmin
            .from("members")
            .select("topup_credit_balance")
            .eq("id", userData.user.id)
            .single<{ topup_credit_balance: number }>(),
        ])
      : [{ data: null }, { data: null }];
    return NextResponse.json({
      monthlyCredits: 0,
      topupCredits: memberRow?.topup_credit_balance ?? 0,
      unlimited: false,
      hasAccess: true,
      tier: "free",
      dailyUsed: creditStatus?.current_usage ?? 0,
      dailyLimit: creditStatus?.daily_limit ?? 10,
    });
  }

  return NextResponse.json({
    monthlyCredits: access.monthlyCredits,
    topupCredits: access.topupCredits,
    // admin (staff comp) kredi sistemine tabi değil — bkz. copilot/chat/route.ts
    unlimited: access.plan === "admin",
    hasAccess: true,
    tier,
  });
}
