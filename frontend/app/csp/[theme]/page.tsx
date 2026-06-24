import { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getHotTheme } from "@/lib/hotThemes2026";
import ThemeDetailClient from "@/components/ThemeDetailClient";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ theme: string }> }): Promise<Metadata> {
  const { theme: slug } = await params;
  const theme = getHotTheme(slug);
  if (!theme) return { title: "Tema Bulunamadı | BOGA AI" };
  return {
    title: `${theme.title} — Tema Takip Sayfası | BOGA AI`,
    description: theme.summary,
  };
}

export default async function HotThemeTrackerPage({ params }: { params: Promise<{ theme: string }> }) {
  const { theme: slug } = await params;
  const theme = getHotTheme(slug);

  if (!theme) {
    return (
      <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
        <Header />
        <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-black text-white uppercase mt-20">Tema Bulunamadı</h1>
          <Link href="/theme" className="text-[#3b82f6] mt-4 inline-block hover:underline">← Temalara Dön</Link>
        </main>
        <Footer />
      </div>
    );
  }

  const tickers = theme.stocks.map((s) => s.ticker);

  return (
    <div className="min-h-screen flex flex-col bg-[#05080f] text-slate-300 font-mono">
      <Header />
      <main className="flex-1 w-full max-w-[1800px] mx-auto px-4 py-6">
        <div className="mb-4">
          <Link href="/theme" className="text-slate-500 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-black uppercase tracking-wider">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Temalara Dön
          </Link>
        </div>

        {/* ── Başlık ── */}
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-[12px] font-black tabular-nums" style={{ color: theme.accent }}>
            {String(theme.number).padStart(2, "0")}
          </span>
          <h1 className="text-lg font-black uppercase tracking-wide text-white">{theme.title}</h1>
        </div>

        {/* ── Canlı Takip Tablosu ── */}
        <ThemeDetailClient themeName={theme.title} initialTickers={tickers} />
      </main>
      <Footer />
    </div>
  );
}
