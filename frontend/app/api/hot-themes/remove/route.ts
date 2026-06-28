import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

const ADMIN_EMAILS = ["haskor3578@gmail.com", "hulyakoksal89@gmail.com"];

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();

    if (!data.user || !ADMIN_EMAILS.includes(data.user.email || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }

    // Insert into removed_hot_themes table
    const { error } = await supabase
      .from("removed_hot_themes")
      .insert([{ slug, removed_by: data.user.email, removed_at: new Date().toISOString() }]);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
