import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getRecentFilingsForTicker, getKeyFinancialMetrics } from "@/lib/earnings/secClient";
import { analyzeEarningsWithDeepSeek } from "@/lib/earnings/deepseekAnalysis";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
// Maliyet/hız dengesi: tüm evreni (1300+ ticker) değil, en likit/takip edilen
// ilk N tickerı tarar — SEC'e günlük onlarca kez tekrar sorulan bu tarama
// zaten ucuz (sadece submissions JSON), asıl maliyet DeepSeek çağrısıdır ve
// o SADECE gerçekten yeni bir bildirim bulunduğunda (nadiren) tetiklenir.
const TICKER_SCAN_LIMIT = 200;
const LOOKBACK_DAYS = 10;
const CONCURRENCY = 8;

function derivePeriod(formType: string, reportDate: string): string {
  const d = new Date(reportDate);
  const year = d.getFullYear();
  if (formType === "10-K") return `FY ${year}`;
  const quarter = Math.floor(d.getMonth() / 3) + 1;
  return `Q${quarter} ${year}`;
}

async function processTicker(ticker: string): Promise<{ ticker: string; newReports: number; error?: string }> {
  try {
    const filings = await getRecentFilingsForTicker(ticker, LOOKBACK_DAYS);
    if (filings.length === 0) return { ticker, newReports: 0 };

    let newReports = 0;
    for (const filing of filings) {
      // NOT: 'report_date' kolonu SEC'e BİLDİRİM tarihini (filingDate) tutar,
      // mali dönem bitiş tarihini DEĞİL — Günlük/Haftalık/Aylık filtresi
      // "ne zaman açıklandı"yı gösterir, "hangi çeyrek"i değil (bu ayrı olarak
      // 'period' alanında saklanır, örn. "Q2 2026").
      const { data: existing } = await supabaseAdmin
        .from("earnings_reports")
        .select("id")
        .eq("ticker", filing.ticker)
        .eq("report_date", filing.filingDate)
        .eq("sec_form_type", filing.form)
        .maybeSingle();
      if (existing) continue; // zaten işlenmiş — DeepSeek'i tekrar tetikleme

      const metrics = await getKeyFinancialMetrics(filing.cik);
      const aiSummary = await analyzeEarningsWithDeepSeek(filing.ticker, filing.companyName, filing.form, metrics);

      const { error: insertError } = await supabaseAdmin.from("earnings_reports").insert({
        ticker: filing.ticker,
        company_name: filing.companyName,
        period: derivePeriod(filing.form, filing.reportDate),
        report_date: filing.filingDate,
        sec_form_type: filing.form,
        sec_accession_no: filing.accessionNo,
        raw_metrics: metrics,
        ai_summary: aiSummary,
      });
      if (!insertError) newReports++;
      else console.error(`[process-sec-earnings] insert failed for ${filing.ticker}:`, insertError.message);
    }
    return { ticker, newReports };
  } catch (err: any) {
    return { ticker, newReports: 0, error: err?.message || String(err) };
  }
}

async function processBatch(tickers: string[], concurrency: number) {
  const results: Awaited<ReturnType<typeof processTicker>>[] = [];
  for (let i = 0; i < tickers.length; i += concurrency) {
    const batch = tickers.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(processTicker));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let tickers: string[] = [];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "public", "data", "daily_universe.json"), "utf8");
    tickers = (JSON.parse(raw)?.tickers || []).slice(0, TICKER_SCAN_LIMIT);
  } catch (err: any) {
    return NextResponse.json({ error: `universe read failed: ${err?.message || err}` }, { status: 500 });
  }
  if (tickers.length === 0) {
    return NextResponse.json({ skipped: "empty ticker universe" });
  }

  const results = await processBatch(tickers, CONCURRENCY);
  const newReportsTotal = results.reduce((s, r) => s + r.newReports, 0);
  const errors = results.filter((r) => r.error).map((r) => ({ ticker: r.ticker, error: r.error }));

  return NextResponse.json({
    scanned: tickers.length,
    newReports: newReportsTotal,
    errors: errors.slice(0, 20),
  });
}
