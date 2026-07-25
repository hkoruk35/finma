// BOGA Copilot çapraz varlık veri kaynağı — Kripto / Döviz / Emtia (spec böl. 2.1, 3.4-3.6).
// Bu üç varlık sınıfı için sitede hiçbir gerçek fiyat kaynağı yoktu (Copilot
// sadece hisse senedi verisine bağlıydı). Yahoo Finance'in "chart" endpoint'i
// (top100-engine.ts'in kendi hisse verisi için kullandığı AYNI endpoint) tüm
// bu sınıflarda da çalışıyor — sadece doğru ticker sonekiyle (BTC-USD, EURUSD=X,
// GC=F vb.). Google Finance'in genel kullanıma açık bir API'si yok; bu yüzden
// tek gerçek kaynak olarak Yahoo Finance kullanılıyor.

export type CrossAssetClass = "crypto" | "fx_pair" | "commodity";

export interface CrossAssetQuote {
  label: string; // kullanıcıya gösterilecek ad ("Bitcoin", "EUR/USD", "Altın")
  yahooSymbol: string;
  assetClass: CrossAssetClass;
  price: number;
  changePct: number;
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  asOf: string; // ISO timestamp
}

// Terminal sol barındaki varlıklarla birebir — spec böl. 2.1.
const KNOWN_ASSETS: Record<string, { label: string; yahooSymbol: string; assetClass: CrossAssetClass }> = {
  BTC: { label: "Bitcoin", yahooSymbol: "BTC-USD", assetClass: "crypto" },
  BITCOIN: { label: "Bitcoin", yahooSymbol: "BTC-USD", assetClass: "crypto" },
  "BTC-USD": { label: "Bitcoin", yahooSymbol: "BTC-USD", assetClass: "crypto" },
  ETH: { label: "Ethereum", yahooSymbol: "ETH-USD", assetClass: "crypto" },
  ETHEREUM: { label: "Ethereum", yahooSymbol: "ETH-USD", assetClass: "crypto" },
  "ETH-USD": { label: "Ethereum", yahooSymbol: "ETH-USD", assetClass: "crypto" },

  EURUSD: { label: "EUR/USD", yahooSymbol: "EURUSD=X", assetClass: "fx_pair" },
  GBPUSD: { label: "GBP/USD", yahooSymbol: "GBPUSD=X", assetClass: "fx_pair" },
  USDJPY: { label: "USD/JPY", yahooSymbol: "USDJPY=X", assetClass: "fx_pair" },
  USDCHF: { label: "USD/CHF", yahooSymbol: "USDCHF=X", assetClass: "fx_pair" },
  AUDUSD: { label: "AUD/USD", yahooSymbol: "AUDUSD=X", assetClass: "fx_pair" },
  USDCAD: { label: "USD/CAD", yahooSymbol: "USDCAD=X", assetClass: "fx_pair" },

  GOLD: { label: "Altın", yahooSymbol: "GC=F", assetClass: "commodity" },
  XAU: { label: "Altın", yahooSymbol: "GC=F", assetClass: "commodity" },
  SILVER: { label: "Gümüş", yahooSymbol: "SI=F", assetClass: "commodity" },
  XAG: { label: "Gümüş", yahooSymbol: "SI=F", assetClass: "commodity" },
  OIL: { label: "Petrol (WTI)", yahooSymbol: "CL=F", assetClass: "commodity" },
  WTI: { label: "Petrol (WTI)", yahooSymbol: "CL=F", assetClass: "commodity" },
  NATGAS: { label: "Doğal Gaz", yahooSymbol: "NG=F", assetClass: "commodity" },
};

export function resolveCrossAssetSymbol(input: string): { label: string; yahooSymbol: string; assetClass: CrossAssetClass } | null {
  const key = input.trim().toUpperCase().replace(/[\s/]/g, "");
  return KNOWN_ASSETS[key] || null;
}

async function fetchYahooChart(yahooSymbol: string): Promise<any> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return null;
  return res.json();
}

/** BTC/ETH/EURUSD/Gold vb. için gerçek, canlı Yahoo Finance verisi. Uydurma yok —
 *  kaynak erişilemezse null döner, çağıran taraf bunu dürüstçe iletir. */
export async function getCrossAssetQuote(input: string): Promise<CrossAssetQuote | null> {
  const resolved = resolveCrossAssetSymbol(input);
  if (!resolved) return null;

  try {
    const data = await fetchYahooChart(resolved.yahooSymbol);
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta ?? {};
    const closes: number[] = (result.indicators?.quote?.[0]?.close ?? []).filter((v: any) => typeof v === "number");
    const price = meta.regularMarketPrice ?? closes.at(-1);
    const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? closes.at(-2) ?? price;
    if (typeof price !== "number") return null;

    const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return {
      label: resolved.label,
      yahooSymbol: resolved.yahooSymbol,
      assetClass: resolved.assetClass,
      price,
      changePct: Math.round(changePct * 100) / 100,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow ?? null,
      asOf: new Date((meta.regularMarketTime ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
    };
  } catch (err) {
    console.error(`[crossAssetData] ${resolved.yahooSymbol} fetch error:`, err);
    return null;
  }
}
