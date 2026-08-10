import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  // To get distinct tickers, we can query them. Supabase doesn't have a direct distinct() via JS,
  // but we can just fetch all tickers or use a view. Given it's a small dataset, we can fetch all and distinct in JS.
  const { data, error } = await supabaseAdmin
    .from("earnings_reports")
    .select("ticker")
    .order("ticker", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const distinctTickers = Array.from(new Set(data.map((d: any) => d.ticker)));

  return NextResponse.json(
    { tickers: distinctTickers },
    {
      headers: { "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400" },
    }
  );
}
