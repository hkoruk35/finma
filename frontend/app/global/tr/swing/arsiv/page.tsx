import { Metadata } from "next";
import Link from "next/link";
import { getSwingArchiveDates, getSwingAllPicks } from "@/lib/data";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import SwingArchiveTracker, { ArchiveDay, ArchivePick } from "@/components/public/SwingArchiveTracker";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Swing Trade Arşivi — BOGA AI",
  description: "Son 10 günlük swing trade adaylarının arşivi.",
  alternates: { canonical: "https://bogastock.com/global/tr/swing/arsiv" },
};

function toArchivePicks(raw: any): ArchivePick[] {
  return (raw?.picks ?? []).map((p: any) => ({
    ticker: p.ticker,
    company: p.company ?? null,
    sector: p.sector ?? null,
    price: p.current_price ?? null,
    change_1d: p.change_1d ?? null,
    rsi: p.rsi ?? null,
    label: p.system_label ?? null,
  }));
}

export default async function TrSwingArchivePage() {
  const dates = (await getSwingArchiveDates()).slice(0, 10);

  const archives: ArchiveDay[] = (
    await Promise.all(
      dates.map(async (date) => {
        const raw = await getSwingAllPicks(date);
        return raw ? { date, picks: toArchivePicks(raw) } : null;
      })
    )
  ).filter((d): d is ArchiveDay => d !== null);

  return (
    <div className="min-h-screen flex flex-col bg-[#000036]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/tr/home" className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <Link href="/global/tr/swing" className="hover:text-[#3b82f6] transition-colors">Günlük Swing Trade Adayları</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Arşiv</span>
        </nav>

        <div className="relative z-10">
          <SwingArchiveTracker archives={archives} locale="tr" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
