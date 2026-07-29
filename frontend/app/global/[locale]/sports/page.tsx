import { Metadata } from "next";
import SportsDashboardClient from "@/components/global/SportsDashboardClient";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Spor — BogaSmart",
  en: "Sports — BogaSmart",
  es: "Deportes — BogaSmart",
  fr: "Sports — BogaSmart",
  pt: "Esportes — BogaSmart",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "Takip ettiğiniz spor kulüpleri, güncel haberler ve AI spor analizleri.",
  en: "Your followed sports clubs, live sports news, and AI sports insights.",
  es: "Sus clubes deportivos seguidos, noticias en vivo y análisis de IA.",
  fr: "Vos clubs préférés, actualités en direct et analyses de match par IA.",
  pt: "Seus clubes esportivos seguidos, notícias de esportes ao vivo e análises de IA.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogastock.com/global/${loc}/sports` },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function SportsPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  return <SportsDashboardClient locale={loc} />;
}
