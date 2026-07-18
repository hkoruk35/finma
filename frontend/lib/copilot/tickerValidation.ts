// navigate_to aracı için hafif "gerçek ticker mı" kontrolü — BOGA'nın kendi
// taradığı/skorladığı dar havuzla (getStockData) SINIRLI DEĞİL. MU gibi
// gerçek ama BOGA'nın aktif swing havuzunda olmayan hisseler için de
// kullanıcı grafiğe gidebilmeli; sadece tamamen uydurma/geçersiz sembolleri
// engellemek yeterli. Aynı Yahoo Finance arama kaynağını kullanır
// (/api/tickers/search route.ts ile aynı yaklaşım).
const YF_HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json" };

export async function isRealTicker(ticker: string): Promise<boolean> {
  const t = ticker.trim().toUpperCase();
  if (!t || t.includes(".")) return false;
  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(t)}&quotesCount=10&newsCount=0`;
    const res = await fetch(url, { headers: YF_HEADERS, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return false;
    const data = await res.json();
    const quotes: any[] = data?.quotes ?? [];
    return quotes.some(
      (q) => (q.quoteType === "EQUITY" || q.quoteType === "ETF") && String(q.symbol).toUpperCase() === t
    );
  } catch {
    return false;
  }
}
