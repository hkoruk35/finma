import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { copy, type Locale } from "@/lib/i18n/copy";
import { INDEX_LOCALES } from "@/lib/indices";
import { getBreadcrumbStructuredData } from "@/app/structured-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ locale: string }>;
};

function isLocale(locale: string): locale is Locale {
  return (INDEX_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return INDEX_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = copy[locale].schedule;

  const languages: Record<string, string> = {};
  for (const l of INDEX_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/markets/schedule`;
  }

  return {
    title: `${t.pageTitle} | BOGASTOCK`,
    description: t.pageDescription,
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/markets/schedule`,
      languages,
    },
    openGraph: {
      title: `${t.pageTitle} | BOGASTOCK`,
      description: t.pageDescription,
      url: `https://bogastock.com/global/${locale}/markets/schedule`,
      images: [{ url: "https://bogastock.com/logo/boga_stock_icon.png", width: 1200, height: 630 }],
    },
  };
}

export default async function SchedulePage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return <div>Invalid locale</div>;
  }
  const t = copy[locale].schedule;
  const m = copy[locale].indices;

  const breadcrumbJsonLd = getBreadcrumbStructuredData([
    { name: "BOGASTOCK", url: "https://bogastock.com" },
    { name: m.breadcrumbMarkets, url: `https://bogastock.com/global/${locale}/markets` },
    { name: t.breadcrumb, url: `https://bogastock.com/global/${locale}/markets/schedule` },
  ]);

  const scheduleData = [
    {
      region: m.regionUS,
      indices: "SPX, NDX, DJI, RUT",
      daily: "09:00 AM (PreMarket), 01:00 PM (Midday), 04:30 PM (Closing)",
      weekly: "Sat 10:00 AM - 01:00 PM",
    },
    {
      region: m.regionEurope,
      indices: "DAX, FTSE100, CAC40, IBEX35, STOXX600, FTSEMIB, SMI, AEX",
      daily: "11:35 AM (Closing)",
      weekly: "Sat 02:00 PM - 09:00 PM",
    },
    {
      region: m.regionLatam,
      indices: "BOVESPA, MERVAL",
      daily: "04:05 PM (Closing)",
      weekly: "Sat 10:00 PM / Sun 10:00 AM",
    },
    {
      region: m.regionLatam,
      indices: "IPCMEXICO",
      daily: "05:05 PM (Closing)",
      weekly: "Sat 11:00 PM",
    },
    {
      region: m.regionAsia,
      indices: "NIKKEI225, ASX200",
      daily: "02:05 AM (Closing)",
      weekly: "Sun 11:00 AM / 04:00 PM",
    },
    {
      region: m.regionAsia,
      indices: "KOSPI",
      daily: "02:35 AM (Closing)",
      weekly: "Sun 02:00 PM",
    },
    {
      region: m.regionAsia,
      indices: "SHANGHAI",
      daily: "03:05 AM (Closing)",
      weekly: "Sun 01:00 PM",
    },
    {
      region: m.regionAsia,
      indices: "HANGSENG",
      daily: "04:05 AM (Closing)",
      weekly: "Sun 12:00 PM",
    },
    {
      region: m.regionAsia,
      indices: "NIFTY50",
      daily: "06:05 AM (Closing)",
      weekly: "Sun 03:00 PM",
    },
  ];

  return (
    <div lang={locale} className="min-h-screen flex flex-col bg-[#0a0e17]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 uppercase tracking-widest mb-4">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            BOGASTOCK
          </Link>
          <span className="opacity-30">/</span>
          <Link href={`/global/${locale}/markets`} className="hover:text-white transition-colors">
            {m.breadcrumbMarkets}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{t.breadcrumb}</span>
        </nav>

        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-2">
          {t.pageTitle}
        </h1>
        <p className="text-sm text-slate-400 mb-8 max-w-2xl">{t.pageDescription}</p>

        <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-[#141b2b] text-slate-400 border-b border-[#1e2a3a]/80">
                <tr>
                  <th className="px-6 py-4 font-medium">{t.region}</th>
                  <th className="px-6 py-4 font-medium">{t.indices}</th>
                  <th className="px-6 py-4 font-medium">{t.dailySchedule}</th>
                  <th className="px-6 py-4 font-medium">{t.weeklySchedule}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2a3a]/40">
                {scheduleData.map((row, i) => (
                  <tr key={i} className="hover:bg-[#141b2b]/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{row.region}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[#3b82f6]">{row.indices}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.daily}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{row.weekly}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <Footer locale={locale} />
    </div>
  );
}
