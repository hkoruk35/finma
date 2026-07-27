import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 30;

interface InsiderTransaction {
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

interface InsiderResponse {
  ticker: string;
  data: InsiderTransaction[];
  summary: {
    totalBuys: number;
    totalSells: number;
    netBiasDays?: number;
    lastTransaction: string | null;
  };
  updatedAt: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const ticker = params.ticker.toUpperCase();
    const searchParams = request.nextUrl.searchParams;

    // Query parameters
    const days = parseInt(searchParams.get("days") || "90", 10);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const type = searchParams.get("type") || "all"; // all, BUY, SELL

    // Validate
    if (!ticker || ticker.length < 1 || ticker.length > 5) {
      return NextResponse.json(
        { error: "Invalid ticker" },
        { status: 400 }
      );
    }

    if (days < 1 || days > 365) {
      return NextResponse.json(
        { error: "Days must be between 1 and 365" },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseAdmin
      .from("insider_transactions")
      .select("*")
      .eq("ticker", ticker)
      .gte("transaction_date", getDateNDaysAgo(days))
      .order("transaction_date", { ascending: false })
      .limit(limit);

    // Filter by type
    if (type !== "all" && ["BUY", "SELL", "GRANT", "EXERCISE"].includes(type)) {
      query = query.eq("transaction_type", type);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error:", error);
      return NextResponse.json(
        { error: "Failed to fetch insider data" },
        { status: 500 }
      );
    }

    // Transform to response format
    const transactions: InsiderTransaction[] = (data || []).map((row: any) => ({
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

    // Calculate summary
    const buyCount = transactions.filter((t) => t.transactionType === "BUY").length;
    const sellCount = transactions.filter((t) => t.transactionType === "SELL").length;
    const lastTx = transactions.length > 0 ? transactions[0].transactionDate : null;

    const response: InsiderResponse = {
      ticker,
      data: transactions,
      summary: {
        totalBuys: buyCount,
        totalSells: sellCount,
        netBiasDays: days,
        lastTransaction: lastTx,
      },
      updatedAt: new Date().toISOString(),
    };

    // Cache response for 1 hour (insider data doesn't change intraday)
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
    });

    return NextResponse.json(response, { headers });
  } catch (err) {
    console.error("Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper: Get date N days ago
 */
function getDateNDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split("T")[0];
}
