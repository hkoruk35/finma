import type { Metadata } from "next";
import Link from "next/link";
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

async function fetchSSRSnapshot(ticker: string): Promise<SSRSnapshot | null> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://bogastock.com";
    // TR endpoint'i varsayılan olarak Türkçe döner (lang parametresi yok = tr)
    const url = `${base}/api/preorder-analysis?ticker=${encodeURIComponent(ticker.toUpperCase())}`;
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
  const snap = await fetchSSRSnapshot(ticker);
  const companyName = snap?.company ?? t;
  const description = snap?.summary
    ? snap.summary.slice(0, 160)
    : `${t} (${companyName}) için gerçek zamanlı teknik analiz: EMA/RSI/MACD, BOGA Skoru, giriş/stop/hedef seviyeleri.`;

  // 2026-08-24 kullanıcı bildirimi: SSR anlık görüntüsü (fetchSSRSnapshot)
  // alınamadığında sayfa Googlebot'a neredeyse boş ("Loading analysis...")
  // gidiyordu — bu ticker'lar için gerçek deep-analysis içeriği yok demektir.
  // Kullanıcının önerdiği iki temiz seçenekten ikincisi uygulandı: noindex +
  // /graphic/{ticker} canonical'ı (gerçek içeriğin bulunduğu, her ticker'da
  // çalışan sayfa) — böylece binlerce boş sayfa indekslenmez, link değeri de
  // kaybolmaz.
  if (!snap) {
    return {
      title: `${t} Hisse Analizi — BogaStock`,
      description: `${t} için gerçek zamanlı teknik analiz: EMA/RSI/MACD, BOGA Skoru, giriş/stop/hedef seviyeleri.`,
      robots: { index: false, follow: true },
      alternates: { canonical: `https://bogastock.com/global/tr/graphic/${lower}` },
    };
  }

  return {
    title: `${t} Hisse Analizi — ${companyName} | BogaStock`,
    description,
    alternates: {
      canonical: `https://bogastock.com/tr/analiz/${lower}`,
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
      title: `${t} Hisse Analizi — ${companyName} | BogaStock`,
      description,
      url: `https://bogastock.com/tr/analiz/${lower}`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function TrAnalysisPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const t = ticker.toUpperCase();
  const snap = await fetchSSRSnapshot(ticker);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="tr" />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {/* SEO için server-rendered içerik */}
        {snap ? (
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
        ) : (
          // 2026-08-24: bu ticker için SSR snapshot alınamadı (bkz.
          // generateMetadata'daki noindex/canonical notu) — içerik burada
          // değil, /graphic/{ticker}'da; ziyaretçiye (ve JS render eden
          // crawler'lara) net bir yönlendirme.
          <div className="mb-6 text-sm text-white/50">
            {t} için detaylı analiz{" "}
            <Link href={`/global/tr/graphic/${t}`} className="text-[#3b82f6] hover:underline">
              hisse sayfasında
            </Link>
            .
          </div>
        )}
        <TickerDetailPanel ticker={t} locale="tr" fullPage hidePermalink />
      </main>
      <Footer hidePlatform locale="tr" />
    </div>
  );
}
