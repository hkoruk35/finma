import { formatNumber } from "@/lib/formatNumber";

// Copilot'un curated havuz-dışı (statik JSON'da bilanço verisi olmayan)
// GERÇEK ABD hisseleri için canlı bilanço/insider/kurumsal/yönetici verisi.
// KEEL gibi bir hisse curated pool'da değilse get_deep_analysis daha önce
// "veri yok" dönüyordu — halbuki site içindeki "Derin Analiz" özelliği
// (/api/deep-analysis) tam olarak bu veriyi Yahoo Finance quoteSummary'den
// ZATEN canlı çekebiliyor. Aynı YF crumb/cookie akışını burada tekrar
// kullanıyoruz (küçük, bilinçli kod tekrarı — o büyük route dosyasını
// server-only copilot koduna bağlamamak için).

const YF_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let _yfCrumb: string | null = null;
let _yfCookie: string | null = null;
let _yfCrumbTs = 0;
const YF_CRUMB_TTL = 50 * 60 * 1000;

async function getYFAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (_yfCrumb && _yfCookie && Date.now() - _yfCrumbTs < YF_CRUMB_TTL) {
    return { crumb: _yfCrumb, cookie: _yfCookie };
  }
  try {
    const homeRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": YF_UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    const raw = homeRes.headers.get("set-cookie") || "";
    const a3 = raw.match(/A3=([^;]+)/)?.[1];
    const a1 = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YF_UA, Accept: "text/plain", Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (crumbRes.ok) {
      const crumb = (await crumbRes.text()).trim();
      if (crumb && crumb.length < 20) {
        _yfCrumb = crumb;
        _yfCookie = cookie;
        _yfCrumbTs = Date.now();
        return { crumb, cookie };
      }
    }
  } catch {}
  return null;
}

export interface LiveFundamentals {
  companyName: string | null;
  sector: string | null;
  industry: string | null;
  peRatio: number | null;
  marketCapUsd: number | null;
  revenueGrowthTtm: number | null;
  quarterlyRevenueGrowthPct: number | null;
  earningsGrowthPct: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  returnOnEquityPct: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  revenuePerShare: number | null;
  dividendYield: number | null;
  institutionalOwnershipPct: number | null;
  insiderOwnershipPct: number | null;
  insiderLast90DaysBuys: number;
  insiderLast90DaysSells: number;
  insiderNetDirection: "net_buying" | "net_selling" | "neutral";
  topExecutives: { name: string; title: string }[];
  analystRecommendation: string | null;
}

export async function getLiveFundamentals(ticker: string): Promise<LiveFundamentals | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  const auth = await getYFAuth();
  const modules =
    "financialData,defaultKeyStatistics,summaryDetail,assetProfile,insiderTransactions,recommendationTrend";
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const headers: Record<string, string> = { "User-Agent": YF_UA, Accept: "application/json" };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=${modules}${crumbParam}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const fd = result.financialData || {};
    const ks = result.defaultKeyStatistics || {};
    const sd = result.summaryDetail || {};
    const ap = result.assetProfile || {};
    const transactions: any[] = result.insiderTransactions?.transactions || [];
    const recTrend = result.recommendationTrend?.trend?.[0];

    const pct = (v: any) => (typeof v?.raw === "number" ? +formatNumber((v.raw * 100), 1) : null);
    const num = (v: any) => (typeof v?.raw === "number" ? v.raw : null);

    const now = Date.now();
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;
    let buys = 0;
    let sells = 0;
    for (const tr of transactions) {
      const ts = (tr?.startDate?.raw ?? 0) * 1000;
      if (!ts || ts < ninetyDaysAgo) continue;
      const txt = (tr?.transactionText || "").toLowerCase();
      if (txt.includes("sale") || txt.includes("sell")) sells++;
      else if (txt.includes("purchase") || txt.includes("buy")) buys++;
    }
    const insiderNetDirection: LiveFundamentals["insiderNetDirection"] =
      buys > sells ? "net_buying" : sells > buys ? "net_selling" : "neutral";

    const topExecutives = (ap.companyOfficers || [])
      .slice(0, 3)
      .map((o: any) => ({ name: o?.name || "", title: o?.title || "" }))
      .filter((o: any) => o.name);

    let analystRecommendation: string | null = null;
    if (recTrend) {
      const { strongBuy = 0, buy = 0, hold = 0, sell = 0, strongSell = 0 } = recTrend;
      const total = strongBuy + buy + hold + sell + strongSell;
      if (total > 0) {
        if (strongBuy + buy > hold + sell + strongSell) analystRecommendation = "buy";
        else if (sell + strongSell > strongBuy + buy + hold) analystRecommendation = "sell";
        else analystRecommendation = "hold";
      }
    }

    const hasAnyData =
      num(fd.grossMargins) != null ||
      num(sd.trailingPE) != null ||
      num(sd.marketCap) != null ||
      num(ks.forwardPE) != null ||
      ap.longName;

    if (!hasAnyData) return null;

    return {
      companyName: ap.longName ?? null,
      sector: ap.sector ?? null,
      industry: ap.industry ?? null,
      peRatio: num(sd.trailingPE) ?? num(ks.forwardPE),
      marketCapUsd: num(sd.marketCap),
      revenueGrowthTtm: pct(fd.revenueGrowth),
      quarterlyRevenueGrowthPct: pct(fd.revenueGrowth),
      earningsGrowthPct: pct(fd.earningsGrowth),
      grossMargin: pct(fd.grossMargins),
      operatingMargin: pct(fd.operatingMargins),
      netMargin: pct(fd.profitMargins),
      returnOnEquityPct: pct(fd.returnOnEquity),
      debtToEquity: num(fd.debtToEquity),
      currentRatio: num(fd.currentRatio),
      revenuePerShare: num(fd.revenuePerShare),
      dividendYield: pct(sd.dividendYield),
      institutionalOwnershipPct: pct(ks.heldPercentInstitutions),
      insiderOwnershipPct: pct(ks.heldPercentInsiders),
      insiderLast90DaysBuys: buys,
      insiderLast90DaysSells: sells,
      insiderNetDirection,
      topExecutives,
      analystRecommendation,
    };
  } catch {
    return null;
  }
}
