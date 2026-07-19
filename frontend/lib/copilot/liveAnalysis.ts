// Curated havuzda (getStockData) OLMAYAN ticker'lar için canlı BOGA analizi.
// Grafik detay sayfasının kullandığı AYNI motoru (/api/preorder-analysis)
// çağırır — Yahoo'dan çekip BOGA Skoru / konviksiyon / trade plan / Wyckoff
// üretir, calculateTradePlanZones ile swing algoritmasıyla aynı zon mantığını
// kullanır. Böylece MOH gibi gerçek ama havuz-dışı bir hisse de gerçek,
// site-tutarlı veriyle analiz edilir (uydurma yok).

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

export interface LiveAnalysis {
  ticker: string;
  company: string;
  price: number;
  changePct: number;
  rvol: number;
  conviction: number;
  recommendation: { type: string; label: string; reason: string; hold: string };
  tradePlan: {
    entryZone: { low: number; high: number };
    stop: { price: number; pct: number };
    targets: { price: number; rr: number; label: string }[];
    riskReward: number;
    valid: boolean;
  };
  bogaScore: { trend: number; momentum: number; liquidity: number };
  momentum: { macd: number; macdHist: number; adx: number; roc10: number; bbPercent: number };
  context: { weinstein: { stage: number; label: string }; pct52h: number; atrPct: number; stockReturn1y: number };
  wyckoff: { signal: string; phase: string };
  activeSignals: string[];
  warnings: string[];
}

async function fetchLiveAnalysisOnce(t: string, lang: string, timeoutMs: number): Promise<LiveAnalysis | null> {
  const res = await fetch(`${BASE_URL}/api/preorder-analysis?ticker=${encodeURIComponent(t)}&lang=${lang}`, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const d = await res.json();
  if (!d || d.error || typeof d.price !== "number") return null;
  return d as LiveAnalysis;
}

export async function getLiveAnalysis(ticker: string, locale: string = "en"): Promise<LiveAnalysis | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;
  const lang = locale === "en" ? "en" : "tr"; // endpoint sadece en/tr metin ayrımı yapar; sayılar dil-nötr
  // Kendi kendine (self-referential) HTTP çağrısı — geçici zaman aşımı/soğuk
  // başlatma nedeniyle ilk deneme başarısız olursa (boş dönerse ya da hata/
  // timeout fırlatırsa) tek seferlik yeniden dene. Hedef: "hiçbir ticker
  // yanıtsız kalmasın" — AAPL gibi gerçek, likit bir hissede tek bir geçici
  // hata yüzünden "veri bulunamadı" denmemeli.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await fetchLiveAnalysisOnce(t, lang, 10000);
      if (result) return result;
    } catch {
      // devam et, son denemeyse aşağıdaki return null'a düşer
    }
  }
  return null;
}

// Canlı analizi StockCard şekline eşler. Sayılar trade-plan motorundan gelir
// (grafik sayfasıyla birebir aynı), skor = konviksiyon (grafik sayfasının
// bileşik göstergesi).
export function liveToCard(d: LiveAnalysis): {
  ticker: string; companyName: string; trend: "Bullish" | "Bearish" | "Neutral";
  bogaScore: number; riskLevel: string; support: number; resistance: number; target: number;
} | null {
  const stop = d.tradePlan?.stop?.price;
  const targets = d.tradePlan?.targets || [];
  const resistance = targets[0]?.price;
  const target = targets[targets.length - 1]?.price;
  if ([stop, resistance, target].some((v) => typeof v !== "number" || Number.isNaN(v))) return null;

  const stage4 = d.context?.weinstein?.stage === 4;
  const trend: "Bullish" | "Bearish" | "Neutral" = stage4
    ? "Bearish"
    : d.recommendation?.type === "wait"
    ? "Neutral"
    : "Bullish";

  return {
    ticker: d.ticker,
    companyName: d.company || d.ticker,
    trend,
    bogaScore: Math.round(d.conviction),
    riskLevel: "", // çağıran locale'e göre doldurur (deriveRiskLevel)
    support: stop,
    resistance: resistance as number,
    target: target as number,
  };
}
