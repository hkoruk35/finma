import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { AVATAR_OPTIONS } from "@/lib/copilot/persona";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data } = await supabaseAdmin
    .from("copilot_profiles")
    .select("display_name, avatar_id")
    .eq("user_id", userData.user.id)
    .single();

  return NextResponse.json({
    displayName: data?.display_name ?? null,
    avatarId: data?.avatar_id ?? "aylin",
  });
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error } = await supabase.auth.getUser();
  if (error || !userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { displayName, avatarId } = body;

    if (typeof displayName === "string") displayName = displayName.trim().slice(0, 30) || null;
    else displayName = null;

    if (!AVATAR_OPTIONS.some((a) => a.id === avatarId)) {
      avatarId = AVATAR_OPTIONS[0].id;
    }

    const { error: upsertError } = await supabaseAdmin.from("copilot_profiles").upsert(
      { user_id: userData.user.id, display_name: displayName, avatar_id: avatarId, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, displayName, avatarId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
