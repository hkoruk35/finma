import type { Metadata } from "next";
import TickerDetailPanel from "@/components/public/TickerDetailPanel";
import Footer from "@/components/Footer";
import MemberHeader from "@/components/public/MemberHeader";

interface SSRSnapshot {
  ticker: string;
  company: string;
  price: number;
  changePct: number;
  summary?: string;
}

// Server-side veri çekme: Google bu içeriği ilk HTML'de görür.
// Lokal self-fetch (Vercel'de aynı origin), 60 sn ISR cache ile çalışır.
async function fetchSSRSnapshot(ticker: string, lang = "en"): Promise<SSRSnapshot | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://bogastock.com";
    const url = `${base}/api/preorder-analysis?ticker=${encodeURIComponent(ticker.toUpperCase())}&lang=${lang}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const d = await res.json();
    if (d.error || !d.ticker) return null;
    return {
      ticker: d.ticker,
      company: d.company ?? ticker.toUpperCase(),
      price: d.price ?? 0,
      changePct: d.changePct ?? 0,
      summary: d.aiCommentary?.summary,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  const lower = ticker.toLowerCase();
  const snap = await fetchSSRSnapshot(ticker, "en");
  const companyName = snap?.company ?? t;
  const description = snap?.summary
    ? snap.summary.slice(0, 160)
    : `Real-time technical analysis for ${t} (${companyName}): EMA/RSI/MACD, BOGA Score, entry/stop/target levels.`;

  return {
    title: `${t} Stock Analysis — ${companyName} | BogaStock`,
    description,
    alternates: {
      canonical: `https://bogastock.com/en/analysis/${lower}`,
      languages: {
        en: `https://bogastock.com/en/analysis/${lower}`,
        tr: `https://bogastock.com/tr/analiz/${lower}`,
        es: `https://bogastock.com/es/analisis/${lower}`,
        pt: `https://bogastock.com/pt/analise/${lower}`,
        fr: `https://bogastock.com/fr/analyse/${lower}`,
        id: `https://bogastock.com/id/analisis/${lower}`,
        "x-default": `https://bogastock.com/en/analysis/${lower}`,
      },
    },
    openGraph: {
      title: `${t} Stock Analysis — ${companyName} | BogaStock`,
      description,
      url: `https://bogastock.com/en/analysis/${lower}`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function EnAnalysisPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  const snap = await fetchSSRSnapshot(ticker, "en");

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="en" />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* SEO için server-rendered içerik — Googlebot ilk HTML'de bunu görür */}
        {snap && (
          <div className="mb-6">
            <h1 className="text-3xl font-medium text-white tracking-tighter">
              {snap.ticker}{" "}
              <span className="text-white/40 text-lg font-medium">{snap.company}</span>
            </h1>
            <p className="text-2xl font-mono font-medium text-white mt-1">
              ${snap.price.toFixed(2)}{" "}
              <span className={snap.changePct >= 0 ? "text-green-400" : "text-red-400"}>
                {snap.changePct >= 0 ? "+" : ""}{snap.changePct.toFixed(2)}%
              </span>
            </p>
            {snap.summary && (
              <p className="mt-3 text-sm text-white/60 max-w-2xl leading-relaxed">
                {snap.summary}
              </p>
            )}
          </div>
        )}
        {/* Interactive panel — canlı veri, charts, Copilot (client side) */}
        <TickerDetailPanel ticker={t} locale="en" fullPage hidePermalink />
      </main>
      <Footer hidePlatform locale="en" />
    </div>
  );
}
