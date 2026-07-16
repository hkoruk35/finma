import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: { username?: string; region?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { username, region } = body;
  if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-24 characters (letters, numbers, underscore)." },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("members")
    .update({ username, region })
    .eq("id", userData.user.id);

  if (error) {
    const msg = /members_username_key|duplicate key.*username/i.test(error.message)
      ? "This username is already taken."
      : error.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
