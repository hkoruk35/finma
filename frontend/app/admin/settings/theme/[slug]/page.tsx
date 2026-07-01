import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { MARKET_THEMES } from "@/lib/themeData";
import { getSwingPicks, getOptionsData } from "@/lib/data";
import ThemeDetailClient from "@/components/ThemeDetailClient";

export const revalidate = 60;

function slugify(text: string) {
  return text.toString().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  let title = "Market Theme";
  if (slug === "boga-swing") title = "BOGA Swing Picks";
  else if (slug === "boga-options") title = "BOGA Options Picks";
  else {
    const theme = MARKET_THEMES.find(t => slugify(t.name) === slug);
    if (theme) title = theme.name;
  }
  return { title: `${title} | BOGA AI` };
}

export default async function ThemeDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let themeName = "";
  let tickers: string[] = [];

  if (slug === "boga-swing") {
    themeName = "BOGA Swing Picks";
    const swingData = await getSwingPicks();
    if (swingData && swingData.picks) {
      tickers = swingData.picks.map((p: any) => p.ticker);
    }
  } else if (slug === "boga-options") {
    themeName = "BOGA Options Picks";
    const optData = await getOptionsData("latest");
    if (optData && optData.picks) {
      tickers = optData.picks.map((p: any) => p.ticker);
    }
  } else {
    const theme = MARKET_THEMES.find(t => slugify(t.name) === slug);
    if (theme) {
      themeName = theme.name;
      tickers = theme.tickers;
    }
  }

  if (!themeName) {
    return (
      <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
        <Header />
        <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-black text-white uppercase mt-20">Theme Not Found</h1>
          <Link href="/admin/settings/theme" className="text-[#3b82f6] mt-4 inline-block hover:underline">← Back to Themes</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/admin/settings/theme" className="text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Themes
          </Link>
        </div>

        <ThemeDetailClient themeName={themeName} initialTickers={tickers} />
      </main>
      <Footer />
    </div>
  );
}
