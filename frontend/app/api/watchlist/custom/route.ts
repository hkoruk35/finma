import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("custom_watchlists")
    .select("tickers")
    .eq("user_id", userData.user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    // PGRST116 means no row found, which is fine, we just return empty array
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tickers: data?.tickers || [] });
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const body = await req.json();
    let { tickers } = body;

    if (!Array.isArray(tickers)) {
      return NextResponse.json({ error: "Tickers must be an array" }, { status: 400 });
    }

    // Limit to 50 items, remove duplicates, convert to uppercase
    tickers = Array.from(new Set(tickers.map((t: string) => t.toUpperCase()))).slice(0, 50);

    const { error: upsertError } = await supabaseAdmin
      .from("custom_watchlists")
      .upsert({
        user_id: userData.user.id,
        tickers,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, tickers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
