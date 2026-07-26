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
    entryType: string;
    entryCondition: string;
    stop: { price: number; pct: number };
    stopRationale: string;
    targets: { price: number; rr: number; label: string }[];
    riskReward: number;
    rationale: { ema: string; vwap: string; volume: string; rsi: string };
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
  // /api/preorder-analysis 5 dili destekler (en/es/fr/pt/tr) — bilinmeyen bir
  // locale gelirse tr'ye düşer, ama es/fr/pt'yi artık tr'ye ZORLAMAZ.
  const lang = (["en", "es", "fr", "pt"].includes(locale) ? locale : "tr") as "en" | "es" | "fr" | "pt" | "tr";
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

// Copilot'un "get_trade_plan" aracının veri kaynağı — grafik/analiz sayfasının
// gösterdiği İŞLEM KURGUSU GEREKÇESİ bloğuyla (giriş aralığı, stop, TP1-3,
// EMA/VWAP/hacim/RSI gerekçe metinleri) BİREBİR aynı sayıları döner. Model
// bunun DIŞINDA (örn. get_technical_levels'ın genel destek/direnç'inden) kendi
// giriş tetiği/hedef seviyesi kurgulamamalı — tek kaynak burasıdır.
export interface TradePlanSummary {
  ticker: string;
  currentPrice: number;
  valid: boolean;
  entryLow: number;
  entryHigh: number;
  avgEntry: number;
  entryCondition: string;
  stopPrice: number;
  stopPct: number;
  stopRationale: string;
  targets: { price: number; rr: number; label: string }[];
  riskReward: number;
  rationale: { ema: string; vwap: string; volume: string; rsi: string };
}

export async function getTradePlanSummary(ticker: string, locale: string = "en"): Promise<TradePlanSummary | null> {
  const d = await getLiveAnalysis(ticker, locale);
  const tp = d?.tradePlan;
  if (!d || !tp || typeof tp.entryZone?.low !== "number" || typeof tp.entryZone?.high !== "number") return null;

  return {
    ticker: d.ticker,
    currentPrice: d.price,
    valid: !!tp.valid,
    entryLow: tp.entryZone.low,
    entryHigh: tp.entryZone.high,
    avgEntry: +((tp.entryZone.low + tp.entryZone.high) / 2).toFixed(2),
    entryCondition: tp.entryCondition || "",
    stopPrice: tp.stop?.price,
    stopPct: tp.stop?.pct,
    stopRationale: tp.stopRationale || "",
    targets: tp.targets || [],
    riskReward: tp.riskReward,
    rationale: tp.rationale || { ema: "", vwap: "", volume: "", rsi: "" },
  };
}
