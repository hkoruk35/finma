import CampaignBanner from "@/components/CampaignBanner";
import type { Metadata } from "next";

const LOCALES = ['en', 'tr', 'es', 'fr', 'pt', 'id'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s | BogaStock | Analisis Saham dan Pasar Berbasis AI",
      default: "BogaStock | Analisis Saham dan Pasar Berbasis AI",
    },
    description: "Pantau saham AS dan pasar global dengan BogaStock. Analisis saham berbasis AI, grafik, sektor, forex, komoditas, dan kripto dalam satu platform.",
    alternates: {
      languages: {
      en: `https://bogastock.com/global/en`,
      es: `https://bogastock.com/global/es`,
      fr: `https://bogastock.com/global/fr`,
      id: `https://bogastock.com/global/id`,
      pt: `https://bogastock.com/global/pt`,
      tr: `https://bogastock.com/global/tr`,
        "x-default": "https://bogastock.com/global/en",
      },
    },
  };
}

// Completely public layout — no authentication required
export default async function GlobalIdLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="id" />
      {children}
    </>
  );
}
