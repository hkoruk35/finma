import { NextRequest, NextResponse } from "next/server";
import { XMLParser } from "fast-xml-parser";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 minutes timeout

const MIN_SHARES_THRESHOLD = 1000;
const EDGAR_BASE = "https://data.sec.gov/submissions";
// SEC EDGAR Fair Access Policy requires a descriptive User-Agent with contact
// info on EVERY request (sec.gov + data.sec.gov) — istekler bu header olmadan
// reddediliyor/anlamsız yanıt dönüyordu, bu yüzden hiç CIK/işlem bulunamıyordu.
const SEC_HEADERS = { "User-Agent": "BogaStock contact@bogastock.com" };

// Form 4 islem kodu -> bizim transaction_type enum'umuz. Yalnizca gercek
// alim/satim/hibe/kullanim niteligindeki kodlari isliyoruz; digerleri (F: vergi
// odemesi icin teslim, G: hediye, C/E/H/O/X gibi turev-spesifik kodlar) atlanir.
const CODE_TO_TYPE: Record<string, "BUY" | "SELL" | "GRANT" | "EXERCISE"> = {
  P: "BUY",
  S: "SELL",
  A: "GRANT",
  M: "EXERCISE",
};

interface SubmissionFiling {
  form: string;
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  primaryDocument: string;
}

interface CIKCache {
  [ticker: string]: string | undefined;
}

interface InsiderRow {
  cik: string;
  ticker: string;
  executive_name: string;
  title: string | null;
  transaction_type: "BUY" | "SELL" | "GRANT" | "EXERCISE";
  shares_transacted: number;
  transaction_price: number | null;
  transaction_date: string;
  filed_date: string;
  form_type: string;
  is_director: boolean;
  is_officer: boolean;
  is_ten_pct_owner: boolean;
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

  const tickers = await loadTickerUniverse();
  console.log(`[INSIDER CRON] Loaded ${tickers.length} tickers`);

  if (tickers.length === 0) {
    return { success: false, message: "No tickers found" };
  }

  const cikCache = await loadCIKCache();
  console.log(`[INSIDER CRON] CIK cache: ${Object.keys(cikCache).length} entries`);

  // Eksik ticker'lar icin SEC'in tum halka acik sirketleri iceren TEK dosyasi
  // (per-ticker sorgudan cok daha guvenilir — browse-edgar arama uc noktasi
  // duzensiz JSON donuyordu).
  const missingTickers = tickers.filter((t) => !cikCache[t]);
  const bulkMap = missingTickers.length > 0 ? await loadBulkTickerCikMap() : new Map<string, string>();

  let totalStored = 0;
  let totalErrors = 0;
  const errors: string[] = [];

  for (const ticker of tickers) {
    try {
      let cik = cikCache[ticker];
      if (!cik) {
        cik = bulkMap.get(ticker.toUpperCase());
        if (!cik) {
          totalErrors++;
          errors.push(`No CIK: ${ticker}`);
          continue;
        }
        await cacheCIK(ticker, cik);
        cikCache[ticker] = cik;
      }

      const transactions = await fetchForm4Transactions(cik, ticker);
      console.log(`[INSIDER CRON] ${ticker}: ${transactions.length} transactions`);

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
    errorDetails: errors.slice(0, 10),
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

// https://www.sec.gov/files/company_tickers.json — SEC'in resmi ticker->CIK
// dizini (tum halka acik sirketler, tek istekte). Anahtarlari sirali index
// olan bir obje donuyor: { "0": {cik_str, ticker, title}, "1": {...}, ... }
async function loadBulkTickerCikMap(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: SEC_HEADERS });
    if (!res.ok) {
      console.error(`[INSIDER CRON] company_tickers.json fetch failed: ${res.status}`);
      return map;
    }
    const json: Record<string, { cik_str: number; ticker: string; title: string }> = await res.json();
    for (const entry of Object.values(json)) {
      if (entry?.ticker && entry.cik_str) {
        map.set(entry.ticker.toUpperCase(), String(entry.cik_str).padStart(10, "0"));
      }
    }
    console.log(`[INSIDER CRON] Bulk CIK map loaded: ${map.size} companies`);
  } catch (err) {
    console.error("[INSIDER CRON] Bulk CIK map fetch error:", err);
  }
  return map;
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

async function fetchForm4Transactions(cik: string, ticker: string): Promise<InsiderRow[]> {
  try {
    const cikPadded = cik.padStart(10, "0");
    const url = `${EDGAR_BASE}/CIK${cikPadded}.json`;

    const response = await fetch(url, { headers: SEC_HEADERS });
    if (!response.ok) {
      throw new Error(`EDGAR API error: ${response.status}`);
    }

    const data: any = await response.json();
    const recent = data.filings?.recent;
    if (!recent?.form) return [];

    const filings: SubmissionFiling[] = [];
    for (let i = 0; i < recent.form.length; i++) {
      if (recent.form[i] === "4") {
        filings.push({
          form: recent.form[i],
          accessionNumber: recent.accessionNumber[i],
          filingDate: recent.filingDate[i],
          reportDate: recent.reportDate[i],
          primaryDocument: recent.primaryDocument[i],
        });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const transactions: InsiderRow[] = [];
    for (const filing of filings) {
      if (new Date(filing.filingDate) < thirtyDaysAgo) break; // filings zaten filingDate'e gore azalan sirali
      try {
        const filTx = await parseForm4XML(cikPadded, filing, ticker);
        transactions.push(...filTx);
      } catch (err) {
        console.warn(`[INSIDER CRON] Parse error for ${ticker} ${filing.accessionNumber}:`, err);
      }
    }

    return transactions;
  } catch (err) {
    console.error(`[INSIDER CRON] Error fetching Form 4s for ${cik}:`, err);
    return [];
  }
}

const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });

// Bir dizi/tekil degeri her zaman diziye normalize eder — fast-xml-parser tek
// eleman oldugunda obje, birden fazla oldugunda dizi donuyor.
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(node: any): string | undefined {
  if (node === undefined || node === null) return undefined;
  if (typeof node === "object") return node.value !== undefined ? String(node.value) : undefined;
  return String(node);
}

function numOf(node: any): number | undefined {
  const t = textOf(node);
  if (t === undefined || t === "") return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

// Gercek Form 4 XML gövdesini indirip ayristirir — reportingOwner (isim,
// unvan, director/officer/10% owner rolleri) + nonDerivativeTable icindeki
// islemler (kod, adet, fiyat, tarih). Turev (opsiyon vb.) islemleri simdilik
// kapsam disi — nonDerivativeTable, gercek hisse alim/satimlarini icerir.
async function parseForm4XML(cikPadded: string, filing: SubmissionFiling, ticker: string): Promise<InsiderRow[]> {
  if (!filing.primaryDocument) return [];

  const cikNum = String(Number(cikPadded));
  const accessionNoDashes = filing.accessionNumber.replace(/-/g, "");
  const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${accessionNoDashes}/${filing.primaryDocument}`;

  const res = await fetch(xmlUrl, { headers: SEC_HEADERS });
  if (!res.ok) {
    console.warn(`[INSIDER CRON] Form 4 doc fetch failed (${res.status}): ${xmlUrl}`);
    return [];
  }
  const xmlText = await res.text();
  if (!xmlText.trim().startsWith("<?xml") && !xmlText.includes("<ownershipDocument")) {
    // primaryDocument bazen .htm oluyor (nadir/eski filing'ler) — XML degil, atla.
    return [];
  }

  const doc = xmlParser.parse(xmlText)?.ownershipDocument;
  if (!doc) return [];

  const owner = asArray(doc.reportingOwner)[0];
  const executiveName = textOf(owner?.reportingOwnerId?.rptOwnerName) || "Unknown";
  const relationship = owner?.reportingOwnerRelationship;
  const isDirector = textOf(relationship?.isDirector) === "1" || textOf(relationship?.isDirector) === "true";
  const isOfficer = textOf(relationship?.isOfficer) === "1" || textOf(relationship?.isOfficer) === "true";
  const isTenPctOwner = textOf(relationship?.isTenPercentOwner) === "1" || textOf(relationship?.isTenPercentOwner) === "true";
  const title = textOf(relationship?.officerTitle) || null;

  const rows: InsiderRow[] = [];
  const nonDerivative = asArray(doc.nonDerivativeTable?.nonDerivativeTransaction);

  for (const tx of nonDerivative) {
    const code = textOf(tx?.transactionCoding?.transactionCode);
    const type = code ? CODE_TO_TYPE[code] : undefined;
    if (!type) continue; // F/G/C/vb. — bizim kapsamimizda degil

    const shares = numOf(tx?.transactionAmounts?.transactionShares);
    if (!shares || shares < MIN_SHARES_THRESHOLD) continue;

    const price = numOf(tx?.transactionAmounts?.transactionPricePerShare);
    const transactionDate = textOf(tx?.transactionDate);
    if (!transactionDate) continue;

    rows.push({
      cik: cikPadded,
      ticker,
      executive_name: executiveName,
      title,
      transaction_type: type,
      shares_transacted: Math.round(shares),
      transaction_price: price ?? null,
      transaction_date: transactionDate,
      filed_date: filing.filingDate,
      form_type: "Form 4",
      is_director: isDirector,
      is_officer: isOfficer,
      is_ten_pct_owner: isTenPctOwner,
    });
  }

  return rows;
}

async function storeTransactions(transactions: InsiderRow[]): Promise<number> {
  if (transactions.length === 0) return 0;

  try {
    const { error } = await supabaseAdmin
      .from("insider_transactions")
      .upsert(transactions, {
        onConflict: "cik,ticker,transaction_date,executive_name,transaction_type,shares_transacted",
        ignoreDuplicates: true,
      });
    if (error) throw error;
    return transactions.length;
  } catch (err) {
    console.error(`[INSIDER CRON] Store error:`, err);
    return 0;
  }
}
