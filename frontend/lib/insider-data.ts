import { supabaseAdmin } from "@/lib/supabase-admin";

export interface InsiderTransaction {
  cik: string;
  ticker: string;
  executiveName: string;
  title: string;
  transactionType: "BUY" | "SELL" | "GRANT" | "EXERCISE";
  sharesTransacted: number;
  transactionPrice: number | null;
  transactionDate: string;
  filedDate: string;
  formType: string;
}

export interface InsiderSummary {
  ticker: string;
  totalBuys: number;
  totalSells: number;
  netBias: string; // "BUY", "SELL", "NEUTRAL"
  lastTransactionDate: string | null;
  totalTransactions: number;
}

/**
 * Fetch insider transactions for a specific ticker
 */
export async function getInsiderTransactions(
  ticker: string,
  days: number = 90,
  limit: number = 100
): Promise<InsiderTransaction[]> {
  try {
    if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === "none") {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("insider_transactions")
      .select("*")
      .eq("ticker", ticker)
      .gte("transaction_date", cutoffDateStr)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching insider transactions for ${ticker}:`, error);
      return [];
    }

    return (data || []).map((row: any) => ({
      cik: row.cik,
      ticker: row.ticker,
      executiveName: row.executive_name,
      title: row.title || "",
      transactionType: row.transaction_type,
      sharesTransacted: row.shares_transacted,
      transactionPrice: row.transaction_price,
      transactionDate: row.transaction_date,
      filedDate: row.filed_date,
      formType: row.form_type || "Form 4",
    }));
  } catch (err) {
    console.error("Error in getInsiderTransactions:", err);
    return [];
  }
}

/**
 * Get top insider buyers (all tickers, BUY transactions only)
 */
export async function getTopInsiderBuyers(
  days: number = 30,
  limit: number = 50
): Promise<(InsiderTransaction & { score: number })[]> {
  try {
    // Check if Supabase credentials are available
    if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === "none") {
      console.warn("Supabase service-role key not configured. Insider data unavailable.");
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("insider_transactions")
      .select("*")
      .eq("transaction_type", "BUY")
      .gte("transaction_date", cutoffDateStr)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching top insider buyers:", error);
      return [];
    }

    // Calculate a simple score: weighted by shares + recency
    return (data || []).map((row: any) => {
      const daysSinceTransaction = Math.floor(
        (Date.now() - new Date(row.transaction_date).getTime()) / (1000 * 60 * 60 * 24)
      );
      // Score: more shares = higher, more recent = higher
      const score =
        (row.shares_transacted / 10000) * (1 + Math.max(0, days - daysSinceTransaction) / days);

      return {
        cik: row.cik,
        ticker: row.ticker,
        executiveName: row.executive_name,
        title: row.title || "",
        transactionType: row.transaction_type,
        sharesTransacted: row.shares_transacted,
        transactionPrice: row.transaction_price,
        transactionDate: row.transaction_date,
        filedDate: row.filed_date,
        formType: row.form_type || "Form 4",
        score: parseFloat(score.toFixed(2)),
      };
    });
  } catch (err) {
    console.error("Error in getTopInsiderBuyers:", err);
    return [];
  }
}

/**
 * Get insider transaction summary for a ticker
 */
export async function getInsiderSummary(ticker: string, days: number = 90): Promise<InsiderSummary | null> {
  try {
    if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === "none") {
      return null;
    }

    const transactions = await getInsiderTransactions(ticker, days, 1000);

    if (transactions.length === 0) {
      return {
        ticker,
        totalBuys: 0,
        totalSells: 0,
        netBias: "NEUTRAL",
        lastTransactionDate: null,
        totalTransactions: 0,
      };
    }

    const buys = transactions.filter((t) => t.transactionType === "BUY").length;
    const sells = transactions.filter((t) => t.transactionType === "SELL").length;
    const netBias = buys > sells ? "BUY" : sells > buys ? "SELL" : "NEUTRAL";

    return {
      ticker,
      totalBuys: buys,
      totalSells: sells,
      netBias,
      lastTransactionDate: transactions[0].transactionDate,
      totalTransactions: transactions.length,
    };
  } catch (err) {
    console.error("Error in getInsiderSummary:", err);
    return null;
  }
}

/**
 * Get recent insider activity across all tickers (for homepage widget)
 */
export async function getRecentInsiderActivity(days: number = 7, limit: number = 10): Promise<InsiderTransaction[]> {
  try {
    if (!process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY === "none") {
      return [];
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    const { data, error } = await supabaseAdmin
      .from("insider_transactions")
      .select("*")
      .gte("transaction_date", cutoffDateStr)
      .order("transaction_date", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("Error fetching recent insider activity:", error);
      return [];
    }

    return (data || []).map((row: any) => ({
      cik: row.cik,
      ticker: row.ticker,
      executiveName: row.executive_name,
      title: row.title || "",
      transactionType: row.transaction_type,
      sharesTransacted: row.shares_transacted,
      transactionPrice: row.transaction_price,
      transactionDate: row.transaction_date,
      filedDate: row.filed_date,
      formType: row.form_type || "Form 4",
    }));
  } catch (err) {
    console.error("Error in getRecentInsiderActivity:", err);
    return [];
  }
}
