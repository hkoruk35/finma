import { Metadata, ResolvingMetadata } from "next";
import Link from "next/link";
import { getHotTheme, HOT_THEMES_2026, localizedThemeTitle } from "@/lib/hotThemes2026";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import ListsNavigation from "@/components/global/ListsNavigation";
import ThemeSwingTracker from "@/components/public/ThemeSwingTracker";
import type { Locale } from "@/lib/i18n/copy";

export const revalidate = 300;

type Props = {
  params: Promise<{ locale: string; theme: string }>;
};

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;

const THEME_DESCRIPTIONS: Record<string, Record<string, string>> = {
  "memory-producers-ai-storage": {
    tr: "AI ve veri merkezi boom'unun kilit altyapısı. HBM, NAND, bağlantı çipleri ve üretim ekipmanı liderleri.",
    en: "Critical infrastructure for AI and data center boom. Leaders in HBM, NAND, interconnect chips, and manufacturing equipment.",
    es: "Infraestructura crítica para el auge de IA y centros de datos.",
    fr: "Infrastructure critique pour le boom de l'IA et des centres de données.",
    pt: "Infraestrutura crítica para o boom de IA e data center.",
  },
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { locale, theme } = await params;
  const hotTheme = getHotTheme(theme);

  if (!hotTheme || !LOCALES.includes(locale as Locale)) {
    return { title: "Theme Not Found" };
  }

  const themeTitle = localizedThemeTitle(hotTheme.title, locale) || hotTheme.title;
  const canonical = `https://bogastock.com/global/${locale}/themes/${theme}`;

  return {
    title: `${themeTitle} | BOGA AI`,
    description: THEME_DESCRIPTIONS[theme]?.[locale as Locale] || "Theme stocks analysis",
    alternates: { canonical },
  };
}

export async function generateStaticParams() {
  const params: { locale: string; theme: string }[] = [];
  LOCALES.forEach((locale) => {
    HOT_THEMES_2026.forEach((theme) => {
      params.push({ locale, theme: theme.slug });
    });
  });
  return params;
}

export default async function ThemePage({ params }: Props) {
  const { locale, theme } = await params;

  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }

  const hotTheme = getHotTheme(theme);
  if (!hotTheme) {
    return <div>Theme not found</div>;
  }

  const themeTitle = localizedThemeTitle(hotTheme.title, locale) || hotTheme.title;
  const themeDescription = THEME_DESCRIPTIONS[theme]?.[locale as Locale] || "";
  const breadcrumbHome = locale === "tr" ? "Gösterge Paneli" : locale === "en" ? "Dashboard" : "Panel";

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale as Locale} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            {breadcrumbHome}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{themeTitle}</span>
        </nav>

        <ListsNavigation locale={locale as Locale} activePath="watchlist" />

        <div className="mb-4">
          <h2 className="text-xl font-bold text-white mb-1">{themeTitle}</h2>
          <p className="text-slate-400 text-xs">{themeDescription}</p>
        </div>

        <ThemeSwingTracker locale={locale as Locale} themeSlug={theme} stocks={hotTheme.stocks} />
      </main>

      <Footer hidePlatform={true} locale={locale as Locale} />
    </div>
  );
}
