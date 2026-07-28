import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout

const MIN_SHARES_THRESHOLD = 1000;
const EDGAR_BASE = "https://data.sec.gov/submissions";

interface EdgarFiling {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
}

interface CIKCache {
  [ticker: string]: string | undefined;
}

/**
 * Fetch SEC EDGAR insider data daily via cloud cron
 * Triggers: Vercel cron (0 4 * * *) = 04:00 UTC = ~23:00-00:00 ET (market close region)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get("authorization");
    const expectedSecret = `Bearer ${process.env.CRON_SECRET}`;

    if (!cronSecret || cronSecret !== expectedSecret) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await fetchInsiderData();
    return NextResponse.json(result);
  } catch (err) {
    console.error("Cron error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}

async function fetchInsiderData() {
  console.log("[INSIDER CRON] Starting insider data fetch...");

  // Load ticker universe
  const tickers = await loadTickerUniverse();
  console.log(`[INSIDER CRON] Loaded ${tickers.length} tickers`);

  if (tickers.length === 0) {
    return { success: false, message: "No tickers found" };
  }

  // Load CIK cache
  const cikCache = await loadCIKCache();
  console.log(`[INSIDER CRON] CIK cache: ${Object.keys(cikCache).length} entries`);

  let totalStored = 0;
  let totalErrors = 0;
  const errors: string[] = [];

  // Process each ticker
  for (const ticker of tickers) {
    try {
      // Get CIK
      let cik = cikCache[ticker];
      if (!cik) {
        cik = await lookupCIK(ticker);
        if (!cik) {
          console.warn(`[INSIDER CRON] No CIK for ${ticker}, skipping`);
          totalErrors++;
          errors.push(`No CIK: ${ticker}`);
          continue;
        }
        // Update cache
        await cacheCIK(ticker, cik);
        cikCache[ticker] = cik;
      }

      // Fetch Form 4 filings
      const transactions = await fetchForm4Transactions(cik, ticker);
      console.log(`[INSIDER CRON] ${ticker}: ${transactions.length} transactions`);

      // Store in database
      const stored = await storeTransactions(transactions);
      totalStored += stored;
    } catch (err) {
      totalErrors++;
      errors.push(`${ticker}: ${String(err)}`);
      console.error(`[INSIDER CRON] Error for ${ticker}:`, err);
    }
  }

  const summary = {
    success: true,
    processed: tickers.length,
    stored: totalStored,
    errors: totalErrors,
    errorDetails: errors.slice(0, 10), // First 10 errors
  };

  console.log(`[INSIDER CRON] Complete:`, summary);
  return summary;
}

async function loadTickerUniverse(): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("top100_tickers")
      .select("ticker");

    if (error) throw error;
    return (data || []).map((row: any) => row.ticker);
  } catch (err) {
    console.error("[INSIDER CRON] Error loading tickers:", err);
    return [];
  }
}

async function loadCIKCache(): Promise<CIKCache> {
  try {
    const { data, error } = await supabaseAdmin
      .from("cik_ticker_map")
      .select("ticker, cik");

    if (error) throw error;

    const cache: CIKCache = {};
    (data || []).forEach((row: any) => {
      cache[row.ticker] = row.cik;
    });
    return cache;
  } catch (err) {
    console.error("[INSIDER CRON] Error loading CIK cache:", err);
    return {};
  }
}

async function lookupCIK(ticker: string): Promise<string | undefined> {
  try {
    // Search SEC EDGAR for ticker (using company search via JSON API)
    // This is a simple approach: fetch EDGAR company facts to derive CIK
    // More reliable: use SEC EDGAR search API with ticker
    const response = await fetch(
      `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${ticker}&type=&dateb=&owner=exclude&count=1&search_text=&CIK=&myHID=&count=100&output=json`
    );

    if (!response.ok) {
      console.warn(`[INSIDER CRON] SEC lookup failed for ${ticker}: ${response.status}`);
      return undefined;
    }

    const json: any = await response.json();
    if (json.results && json.results[0] && json.results[0].cik_str) {
      const cik = String(json.results[0].cik_str).padStart(10, "0");
      console.log(`[INSIDER CRON] Found CIK for ${ticker}: ${cik}`);
      return cik;
    }

    return undefined;
  } catch (err) {
    console.warn(`[INSIDER CRON] CIK lookup error for ${ticker}:`, err);
    return undefined;
  }
}

async function cacheCIK(ticker: string, cik: string): Promise<void> {
  try {
    await supabaseAdmin.from("cik_ticker_map").upsert({
      ticker,
      cik,
      company_name: null,
      last_edgar_check: new Date().toISOString(),
    });
  } catch (err) {
    console.warn(`[INSIDER CRON] CIK cache update failed for ${ticker}:`, err);
  }
}

async function fetchForm4Transactions(
  cik: string,
  ticker: string
): Promise<any[]> {
  try {
    const cikPadded = cik.padStart(10, "0");
    const url = `${EDGAR_BASE}/CIK${cikPadded}.json`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`EDGAR API error: ${response.status}`);
    }

    const data: any = await response.json();
    const filings = data.filings?.recent?.form || [];

    const form4s: EdgarFiling[] = [];
    for (let i = 0; i < filings.length; i++) {
      if (filings[i] === "4") {
        form4s.push({
          accessionNumber: data.filings.recent.accessionNumber[i],
          filingDate: data.filings.recent.filingDate[i],
          reportDate: data.filings.recent.reportDate[i],
        });
      }
    }

    console.log(`[INSIDER CRON] Found ${form4s.length} Form 4s for CIK ${cikPadded}`);

    // Parse transactions from recent Form 4s (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions: any[] = [];
    for (const filing of form4s.slice(0, 10)) {
      // Last 10 Form 4s
      if (new Date(filing.reportDate) < thirtyDaysAgo) break;

      try {
        const filTx = await parseForm4XML(cikPadded, filing.accessionNumber, ticker);
        transactions.push(...filTx);
      } catch (err) {
        console.warn(
          `[INSIDER CRON] Parse error for ${ticker} ${filing.accessionNumber}:`,
          err
        );
      }
    }

    return transactions;
  } catch (err) {
    console.error(`[INSIDER CRON] Error fetching Form 4s for ${cik}:`, err);
    return [];
  }
}

async function parseForm4XML(
  cik: string,
  accession: string,
  ticker: string
): Promise<any[]> {
  try {
    // Fetch XML document
    const accessionClean = accession.replace(/-/g, "");
    const xmlUrl = `https://www.sec.gov/cgi-bin/viewer?action=view&cik=${cik}&accession_number=${accession}&xbrl_type=v`;

    // Alternative: fetch from EDGAR XBRL data feeds
    // For now, use a simplified approach: fetch filing details via JSON
    // This is less robust but doesn't require XML parsing

    // Simplified: assume we don't have detailed transaction parsing yet
    // Return empty for now — this should be enhanced with full Form 4 XML parsing
    return [];
  } catch (err) {
    console.warn(
      `[INSIDER CRON] XML parse error for ${cik}/${accession}:`,
      err
    );
    return [];
  }
}

async function storeTransactions(transactions: any[]): Promise<number> {
  if (transactions.length === 0) return 0;

  try {
    await supabaseAdmin
      .from("insider_transactions")
      .upsert(transactions);

    return transactions.length;
  } catch (err) {
    console.error(`[INSIDER CRON] Store error:`, err);
    return 0;
  }
}
