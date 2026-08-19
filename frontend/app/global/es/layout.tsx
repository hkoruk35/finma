import CampaignBanner from "@/components/CampaignBanner";
import type { Metadata } from "next";

const LOCALES = ['en', 'tr', 'es', 'fr', 'pt', 'id'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s | BogaStock | Análisis de Acciones y Mercados con IA",
      default: "BogaStock | Análisis de Acciones y Mercados con IA",
    },
    description: "Sigue las acciones de EE.UU. y los mercados globales con BogaStock. Analiza acciones con IA, gráficos, sectores, divisas, materias primas y criptos en una sola plataforma.",
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
export default async function GlobalEsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="es" />
      {children}
    </>
  );
}
