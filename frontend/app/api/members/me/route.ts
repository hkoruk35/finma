import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("username, email, trial_ends_at, plan, last_login_at, created_at")
    .eq("id", userData.user.id)
    .single();

  if (error || !member) {
    return NextResponse.json({ error: "Member profile not found." }, { status: 404 });
  }

  return NextResponse.json({ member });
}
