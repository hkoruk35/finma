import { Metadata } from "next";
import Link from "next/link";
import ListsNavigation from "@/components/global/ListsNavigation";
import MoverPageTracker from "@/components/public/MoverPageTracker";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Gainers",
  alternates: { canonical: "https://bogastock.com/global/es/gainers", languages: {
      en: "https://bogastock.com/global/en/gainers",
      es: "https://bogastock.com/global/es/gainers",
      fr: "https://bogastock.com/global/fr/gainers",
      id: "https://bogastock.com/global/id/gainers",
      pt: "https://bogastock.com/global/pt/gainers",
      tr: "https://bogastock.com/global/tr/gainers",
      "x-default": "https://bogastock.com/global/en/gainers",
    } }
};


export default function EsGainersPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale="es" />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-3">
          <Link href="/global/es/home" className="hover:text-[#3b82f6] transition-colors">Panel</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">Mayores Alzas</span>
        </nav>

        <ListsNavigation locale="es" activePath="gainers" />

        <div className="relative z-10">
          <MoverPageTracker mode="gainers" locale="es" />
        </div>
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
