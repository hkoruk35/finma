import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { EARNINGS_LOCALES, type EarningsLocale } from "@/lib/earnings/deepseekAnalysis";

export const dynamic = "force-dynamic";

function resolveLocale(raw: string | null): EarningsLocale {
  return (EARNINGS_LOCALES as readonly string[]).includes(raw || "") ? (raw as EarningsLocale) : "en";
}

// Bu route DeepSeek'i ASLA çağırmaz — sadece cron ile önceden doldurulmuş
// earnings_reports tablosundan okur (Redis'in yerini tutan Postgres önbelleği).
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get("range") || "daily"; // daily | weekly | monthly
  const locale = resolveLocale(searchParams.get("locale"));

  const today = new Date();
  let query = supabaseAdmin.from("earnings_reports").select("*");

  if (range === "daily") {
    const dateStr = today.toISOString().split("T")[0];
    query = query.eq("report_date", dateStr);
  } else if (range === "weekly") {
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    query = query.gte("report_date", lastWeek.toISOString().split("T")[0]);
  } else {
    const lastMonth = new Date(today);
    lastMonth.setDate(today.getDate() - 30);
    query = query.gte("report_date", lastMonth.toISOString().split("T")[0]);
  }

  const { data, error } = await query.order("report_date", { ascending: false }).limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data || []).map((row: any) => ({
    id: row.id,
    ticker: row.ticker,
    companyName: row.company_name,
    period: row.period,
    reportDate: row.report_date,
    formType: row.sec_form_type,
    metrics: row.raw_metrics,
    ai: row.ai_summary?.[locale] ?? row.ai_summary?.en ?? null,
  }));

  return NextResponse.json(
    { range, locale, data: items },
    {
      // Vercel Edge/CDN önbelleği — 5 dk taze, sonrasında arka planda
      // yenilenirken eski veri anında servis edilir (Supabase'e bile gitmez).
      headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=59" },
    }
  );
}
