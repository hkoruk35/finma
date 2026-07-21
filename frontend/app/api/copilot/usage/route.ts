import { NextResponse } from "next/server";
import { getMemberAccess } from "@/lib/apiAuth";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DEFAULT_CREDIT_LIMIT = { premium: 200, admin: 200 } as const;

export async function GET() {
  const access = await getMemberAccess();
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dailyLimit = access.isPremium ? DEFAULT_CREDIT_LIMIT.premium : 0;

  if (dailyLimit === 0) {
    return NextResponse.json({ currentUsage: 0, dailyLimit: 0, hasAccess: false });
  }

  const { data: statusRows, error } = await supabaseAdmin.rpc("get_copilot_credit_status", {
    p_user_id: user.id,
    p_default_limit: dailyLimit,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const status = Array.isArray(statusRows) ? statusRows[0] : statusRows;

  return NextResponse.json({
    currentUsage: status?.current_usage ?? 0,
    dailyLimit: status?.daily_limit ?? dailyLimit,
    hasAccess: true,
  });
}
