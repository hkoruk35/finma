import { Metadata } from "next";
import WeatherDashboardClient from "@/components/global/WeatherDashboardClient";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Hava Durumu — BogaSmart",
  en: "Weather — BogaSmart",
  es: "Clima — BogaSmart",
  fr: "Météo — BogaSmart",
  pt: "Clima — BogaSmart",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "Bölgesel hava durumu detayları, 3 günlük tahminler ve klimatolojik piyasa analizleri.",
  en: "Detailed regional weather reports, 3-day forecasts, and climate-driven market analysis.",
  es: "Detalles del clima regional, pronósticos de 3 días y análisis de mercado.",
  fr: "Rapports météo régionaux, prévisions sur 3 jours et analyses climatologiques du marché.",
  pt: "Relatórios de clima regional, previsões de 3 dias e análises de mercado associadas ao clima.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogastock.com/global/${loc}/weather` },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function WeatherPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  return <WeatherDashboardClient locale={loc} />;
}
