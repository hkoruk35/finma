import { Metadata } from "next";
import DiscoverDashboardClient from "@/components/global/DiscoverDashboardClient";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Keşfet — BogaSmart",
  en: "Discover — BogaSmart",
  es: "Descubrir — BogaSmart",
  fr: "Découvrir — BogaSmart",
  pt: "Descobrir — BogaSmart",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "İlgi alanlarınıza göre özelleştirilmiş AI konuları ve güncel arama başlıkları.",
  en: "AI topics and search queries personalized based on your interests.",
  es: "Temas de IA y consultas de búsqueda personalizadas según sus intereses.",
  fr: "Sujets d'IA et requêtes de recherche personnalisés selon vos intérêts.",
  pt: "Temas de IA e consultas de busca personalizadas com base em seus interesses.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogasmart.com/global/${loc}/discover` },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function DiscoverPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  return <DiscoverDashboardClient locale={loc} />;
}
