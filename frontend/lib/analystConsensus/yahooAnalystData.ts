// GERÇEK analist verisi: Yahoo Finance quoteSummary (financialData +
// recommendationTrend). lib/copilot/liveFundamentals.ts'teki crumb/cookie
// akışının bilinçli bir tekrarı (o dosya server-only copilot koduna bağımlı,
// burada bağımsız kalması tercih edildi). Kapsam yoksa (küçük/az takip
// edilen ticker) hasCoverage=false döner — HİÇBİR ZAMAN sayı uydurulmaz.

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

export interface AnalystConsensusData {
  hasCoverage: boolean;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
  count: number;
  targetMean: number | null;
  targetLow: number | null;
  targetHigh: number | null;
  targetMedian: number | null;
}

const EMPTY: AnalystConsensusData = {
  hasCoverage: false, strongBuy: 0, buy: 0, hold: 0, sell: 0, strongSell: 0, count: 0,
  targetMean: null, targetLow: null, targetHigh: null, targetMedian: null,
};

export async function getRealAnalystConsensus(yahooSymbol: string): Promise<AnalystConsensusData> {
  const auth = await getYFAuth();
  const modules = "financialData,recommendationTrend";
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const headers: Record<string, string> = { "User-Agent": YF_UA, Accept: "application/json" };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooSymbol)}?modules=${modules}${crumbParam}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return EMPTY;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return EMPTY;

    const fd = result.financialData || {};
    const recTrend = result.recommendationTrend?.trend?.[0];
    const num = (v: any) => (typeof v?.raw === "number" ? v.raw : null);

    if (!recTrend) return EMPTY;
    const strongBuy = recTrend.strongBuy ?? 0;
    const buy = recTrend.buy ?? 0;
    const hold = recTrend.hold ?? 0;
    const sell = recTrend.sell ?? 0;
    const strongSell = recTrend.strongSell ?? 0;
    const count = strongBuy + buy + hold + sell + strongSell;
    if (count === 0) return EMPTY;

    return {
      hasCoverage: true,
      strongBuy, buy, hold, sell, strongSell, count,
      targetMean: num(fd.targetMeanPrice),
      targetLow: num(fd.targetLowPrice),
      targetHigh: num(fd.targetHighPrice),
      targetMedian: num(fd.targetMedianPrice),
    };
  } catch {
    return EMPTY;
  }
}
