import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Sadece Supabase'den okur — Yahoo Finance'e her istekte GİTMEZ, sadece cron
// (process-earnings-calendar) günde bir kez tazeler.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(90, Math.max(1, parseInt(searchParams.get("days") || "30", 10)));

  const today = new Date().toISOString().split("T")[0];
  const until = new Date();
  until.setDate(until.getDate() + days);
  const untilStr = until.toISOString().split("T")[0];

  const { data, error } = await supabaseAdmin
    .from("earnings_calendar")
    .select("*")
    .gte("earnings_date", today)
    .lte("earnings_date", untilStr)
    .order("earnings_date", { ascending: true })
    .limit(300);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || []).map((row: any) => ({
    ticker: row.ticker,
    companyName: row.company_name,
    earningsDate: row.earnings_date,
    isEstimate: row.is_estimate,
    epsEstimate: row.eps_estimate,
    revenueEstimate: row.revenue_estimate_usd,
  }));

  return NextResponse.json(
    { days, data: items },
    { headers: { "Cache-Control": "s-maxage=1800, stale-while-revalidate=300" } }
  );
}
