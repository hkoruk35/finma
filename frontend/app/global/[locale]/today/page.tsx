import { Metadata } from "next";
import TodayDashboardClient from "@/components/global/TodayDashboardClient";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

type Props = {
  params: Promise<{ locale: string }>;
};

const TITLES: Record<Locale, string> = {
  tr: "Bugün Neler Oluyor — BogaSmart",
  en: "What's Happening Today — BogaSmart",
  es: "¿Qué pasa hoy? — BogaSmart",
  fr: "Aujourd'hui — BogaSmart",
  pt: "O que está acontecendo hoje — BogaSmart",
};

const DESCRIPTIONS: Record<Locale, string> = {
  tr: "Piyasa endeksleri, canlı borsa verileri, güncel hava durumu, spor skorları ve öne çıkan dünya haberlerini içeren günlük özet panonuz.",
  en: "Your daily summary dashboard featuring market indices, live stock data, current weather, sports scores, and top global stories.",
  es: "Su panel de resumen diario con índices de mercado, datos de bolsa en vivo, clima actual, puntajes deportivos y noticias globales.",
  fr: "Votre tableau de bord quotidien comprenant les indices boursiers, la météo, les scores sportifs et l'actualité mondiale.",
  pt: "Seu painel de resumo diário com índices de mercado, clima atual, placares esportivos e principais notícias globais.",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) return { title: "Not Found" };
  const loc = locale as Locale;
  return {
    title: TITLES[loc],
    description: DESCRIPTIONS[loc],
    alternates: { canonical: `https://bogasmart.com/global/${loc}/today` },
  };
}

export async function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function TodayPage({ params }: Props) {
  const { locale } = await params;
  if (!LOCALES.includes(locale as Locale)) {
    return <div>Invalid locale</div>;
  }
  const loc = locale as Locale;
  return <TodayDashboardClient locale={loc} />;
}
