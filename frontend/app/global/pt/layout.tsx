import CampaignBanner from "@/components/CampaignBanner";
import type { Metadata } from "next";

const LOCALES = ['en', 'tr', 'es', 'fr', 'pt', 'id'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s | BogaStock | Análise de Ações e Mercados com IA",
      default: "BogaStock | Análise de Ações e Mercados com IA",
    },
    description: "Acompanhe ações dos EUA e mercados globais com o BogaStock. Analise ações com IA, gráficos, setores, câmbio, commodities e criptomoedas em uma única plataforma.",
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
export default async function GlobalPtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="pt" />
      {children}
    </>
  );
}
