import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const u = userData.user;
  const { data: member } = await supabase
    .from("members")
    .select(
      "username, email, trial_ends_at, plan, last_login_at, created_at, subscription_status, current_period_end, cancel_at_period_end, region"
    )
    .eq("id", u.id)
    .single();

  const fallbackUsername =
    u.user_metadata?.full_name ||
    u.user_metadata?.name ||
    u.email?.split("@")[0] ||
    "Üye";
  const avatarUrl =
    u.user_metadata?.avatar_url ||
    u.user_metadata?.picture ||
    null;

  const finalMember = {
    username: member?.username || fallbackUsername,
    email: member?.email || u.email || "",
    avatar_url: avatarUrl,
    plan: member?.plan || "free",
    trial_ends_at: member?.trial_ends_at || null,
    created_at: member?.created_at || u.created_at,
    subscription_status: member?.subscription_status || null,
    current_period_end: member?.current_period_end || null,
    cancel_at_period_end: member?.cancel_at_period_end || false,
    region: member?.region || null,
  };

  return NextResponse.json({ member: finalMember });
}
