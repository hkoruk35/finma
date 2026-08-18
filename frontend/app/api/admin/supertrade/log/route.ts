import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

// Yeni bir işlemi loglar (Otomatik olarak veya Manuel)
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const {
    session_date,
    signal_state,
    direction,
    entry_price,
    invalidation_price,
    net_score,
    strategy_json,
    asset,
  } = body;

  if (!session_date || !signal_state || !direction || !entry_price || !invalidation_price) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  const recordAsset = asset || "SPX";

  // Aynı yönde (LONG/SHORT) ve aynı state için (örn: CONFIRMED_SHORT) gün içinde mükerrer kayıt açmamak için kontrol edebiliriz
  const { data: existing } = await supabaseAdmin
    .from("supertrade_logs")
    .select("id")
    .eq("session_date", session_date)
    .eq("signal_state", signal_state)
    .eq("direction", direction)
    .eq("asset", recordAsset)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Already logged today.", id: existing[0].id }, { status: 200 });
  }

  const { data, error } = await supabaseAdmin
    .from("supertrade_logs")
    .insert({
      asset: recordAsset,
      session_date,
      signal_state,
      direction,
      entry_price,
      invalidation_price,
      net_score,
      strategy_json,
      status: "PENDING",
    })
    .select()
    .single();

  if (error) {
    console.error("Supertrade log error:", error);
    return NextResponse.json({ error: "Could not insert log." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, data });
}

// Açık (PENDING) bir işlemin sonucunu günceller
export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { id, status, exit_price, analysis } = body;
  if (!id || !status) return NextResponse.json({ error: "ID and status required." }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("supertrade_logs")
    .update({
      status,
      exit_price,
      exit_time: new Date().toISOString(),
      analysis,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Could not update log." }, { status: 502 });

  return NextResponse.json({ ok: true, data });
}

// Performans analizi için geçmiş işlemleri getirir
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const asset = req.nextUrl.searchParams.get("asset");
  let query = supabaseAdmin
    .from("supertrade_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (asset && asset !== "ALL") {
    query = query.eq("asset", asset);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: "Could not fetch logs." }, { status: 502 });

  return NextResponse.json({ logs: data ?? [] });
}
