const YF_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Default peer lists by Yahoo Finance industry string
const INDUSTRY_PEERS: Record<string, string[]> = {
  "Wireless Telecom":                ["T", "VZ", "TMUS", "LUMN"],
  "Telecom Services":                ["T", "VZ", "TMUS"],
  "Communication Equipment":         ["CSCO", "JNPR", "CIEN", "NTGR"],
  "Technology":                      ["MSFT", "AAPL", "GOOGL", "META"],
  "Semiconductors":                  ["NVDA", "AMD", "INTC", "AVGO", "QCOM"],
  "Software—Application":            ["MSFT", "CRM", "NOW", "ADBE"],
  "Software—Infrastructure":         ["MSFT", "ORCL", "IBM", "VMW"],
  "Internet Content & Information":  ["GOOGL", "META", "SNAP", "PINS"],
  "Biotechnology":                   ["MRNA", "REGN", "BIIB", "VRTX"],
  "Drug Manufacturers—General":      ["JNJ", "PFE", "MRK", "ABBV"],
  "Medical Devices":                 ["MDT", "ABT", "SYK", "BSX"],
  "Energy":                          ["XOM", "CVX", "COP", "SLB"],
  "Oil & Gas Integrated":            ["XOM", "CVX", "BP", "SHEL"],
  "Financial Services":              ["GS", "MS", "JPM", "BAC"],
  "Banks—Regional":                  ["USB", "PNC", "CFG", "FITB"],
  "Consumer Cyclical":               ["AMZN", "HD", "NKE", "TGT"],
  "Consumer Defensive":              ["PG", "KO", "PEP", "WMT"],
  "Industrials":                     ["GE", "HON", "MMM", "CAT"],
  "Real Estate":                     ["AMT", "PLD", "EQIX", "SPG"],
  "Utilities—Regulated Electric":    ["NEE", "DUK", "SO", "AEP"],
  "default":                         ["SPY", "QQQ"],
};

interface PeerMetric {
  symbol: string;
  trailingPE: number | null;
  priceToBook: number | null;
  forwardPE:   number | null;
}

async function fetchPeersBatch(symbols: string[]): Promise<PeerMetric[]> {
  if (!symbols.length) return [];
  try {
    const url =
      `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${symbols.join(",")}&fields=symbol,trailingPE,forwardPE,priceToBook`;
    const res = await fetch(url, {
      headers: { "User-Agent": YF_UA, "Accept": "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const results: any[] = data?.quoteResponse?.result ?? [];
    return results.map((r: any) => ({
      symbol:      r.symbol ?? "",
      trailingPE:  typeof r.trailingPE  === "number" && isFinite(r.trailingPE)  && r.trailingPE  > 0 ? r.trailingPE  : null,
      forwardPE:   typeof r.forwardPE   === "number" && isFinite(r.forwardPE)   && r.forwardPE   > 0 ? r.forwardPE   : null,
      priceToBook: typeof r.priceToBook === "number" && isFinite(r.priceToBook) && r.priceToBook > 0 ? r.priceToBook : null,
    }));
  } catch {
    return [];
  }
}

function median(values: (number | null)[]): number | null {
  const clean = values.filter((v): v is number => v !== null && isFinite(v) && v > 0);
  if (!clean.length) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? +((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2)
    : +sorted[mid].toFixed(2);
}

export interface CompsInput {
  ticker: string;
  currentPrice: number;
  peers?: string[];
  industry?: string;
}

export interface CompsOutput {
  ticker: string;
  currentPrice: number;
  peerList: string[];
  validPeerCount: number;
  targetMetrics: {
    trailingPE:  number | null;
    forwardPE:   number | null;
    priceToBook: number | null;
  };
  peerMedians: {
    trailingPE:  number | null;
    forwardPE:   number | null;
    priceToBook: number | null;
  };
  impliedPriceFromPE: number | null;
  peDiscount: number | null;
  verdict: "CHEAP" | "FAIR" | "EXPENSIVE" | "INSUFFICIENT_DATA";
  note: string;
}

export async function calcComps(params: CompsInput, yfData: any): Promise<CompsOutput> {
  const ks = yfData?.defaultKeyStatistics ?? {};
  const sd = yfData?.summaryDetail        ?? {};
  const ap = yfData?.assetProfile         ?? {};

  const industry = params.industry ?? ap.industry ?? "default";
  const peerList = (params.peers?.length ? params.peers : INDUSTRY_PEERS[industry] ?? INDUSTRY_PEERS["default"])
    .filter(p => p.toUpperCase() !== params.ticker.toUpperCase())
    .slice(0, 6); // max 6 peers for API efficiency

  // Target ticker metrics
  const targetPE   = sd.trailingPE?.raw  ?? ks.trailingPE?.raw ?? null;
  const targetFwPE = sd.forwardPE?.raw   ?? ks.forwardPE?.raw  ?? null;
  const targetPB   = ks.priceToBook?.raw ?? null;

  // Fetch all peer metrics in a single batch call
  const peerData = await fetchPeersBatch(peerList);
  const validPeers = peerData.filter(p => p.trailingPE !== null || p.forwardPE !== null);

  const medPE   = median(peerData.map(p => p.trailingPE));
  const medFwPE = median(peerData.map(p => p.forwardPE));
  const medPB   = median(peerData.map(p => p.priceToBook));

  // Implied price: if we apply peer median P/E to target's earnings
  let impliedPriceFromPE: number | null = null;
  if (medPE !== null && targetPE !== null && targetPE > 0) {
    const epsImplied = params.currentPrice / targetPE;
    impliedPriceFromPE = +(medPE * epsImplied).toFixed(2);
  }

  // PE discount/premium vs peers (positive = premium, negative = discount)
  let peDiscount: number | null = null;
  if (targetPE !== null && medPE !== null && medPE > 0) {
    peDiscount = +((targetPE - medPE) / medPE).toFixed(4);
  }

  const verdict: CompsOutput["verdict"] =
    peDiscount === null
      ? "INSUFFICIENT_DATA"
      : peDiscount < -0.20
        ? "CHEAP"
        : peDiscount > 0.25
          ? "EXPENSIVE"
          : "FAIR";

  const verdictNote =
    verdict === "CHEAP"             ? `Sektör medyanına göre ${Math.abs(peDiscount! * 100).toFixed(0)}% iskontolu`
    : verdict === "EXPENSIVE"       ? `Sektör medyanına göre ${(peDiscount! * 100).toFixed(0)}% primli`
    : verdict === "FAIR"            ? `Sektör medyanıyla yakın seviyelerde işlem görüyor`
    : `Yetersiz peer verisi (${validPeers.length}/${peerList.length} peer)`;

  return {
    ticker:           params.ticker,
    currentPrice:     params.currentPrice,
    peerList,
    validPeerCount:   validPeers.length,
    targetMetrics: {
      trailingPE:  targetPE   !== null ? +targetPE.toFixed(2)   : null,
      forwardPE:   targetFwPE !== null ? +targetFwPE.toFixed(2) : null,
      priceToBook: targetPB   !== null ? +targetPB.toFixed(2)   : null,
    },
    peerMedians: {
      trailingPE:  medPE,
      forwardPE:   medFwPE,
      priceToBook: medPB,
    },
    impliedPriceFromPE,
    peDiscount,
    verdict,
    note: verdictNote,
  };
}
