import { supabaseAdmin } from "@/lib/supabase-admin";

export interface UpcomingEarning {
  ticker: string;
  companyName: string | null;
  earningsDate: string;
  isEstimate: boolean;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

// Ana sayfadaki "Yaklaşan Bilançolar" widget'ı için en yakın N kaydı döner.
// earnings_calendar tablosu sadece gerçek bilanço tarihlerini içerdiğinden
// (borsa tatillerinde şirket bilanço açıklamaz), sıralı ilk N kayıt otomatik
// olarak en yakın iş gününe/tarihe denk gelir — ayrı bir tatil hesaplamasına gerek yok.
export async function getUpcomingEarnings(limit = 4): Promise<UpcomingEarning[]> {
  const today = new Date().toISOString().split("T")[0];

  try {
    const { data, error } = await supabaseAdmin
      .from("earnings_calendar")
      .select("ticker, company_name, earnings_date, is_estimate, eps_estimate, revenue_estimate_usd")
      .gte("earnings_date", today)
      .order("earnings_date", { ascending: true })
      .limit(limit)
      .abortSignal(AbortSignal.timeout(5000)); // Supabase yavas/erisilemezse sayfayi askida birakmasin

    if (error) {
      console.error("[earningsCalendar] fetch failed:", error.message);
      return [];
    }

    return (data ?? []).map((row: any) => ({
      ticker: row.ticker,
      companyName: row.company_name,
      earningsDate: row.earnings_date,
      isEstimate: row.is_estimate,
      epsEstimate: row.eps_estimate,
      revenueEstimate: row.revenue_estimate_usd,
    }));
  } catch {
    return [];
  }
}
