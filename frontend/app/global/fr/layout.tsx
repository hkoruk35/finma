import CampaignBanner from "@/components/CampaignBanner";
import type { Metadata } from "next";

const LOCALES = ['en', 'tr', 'es', 'fr', 'pt', 'id'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s | BogaStock | Analyse des Actions et Marchés par IA",
      default: "BogaStock | Analyse des Actions et Marchés par IA",
    },
    description: "Suivez les actions américaines et les marchés mondiaux avec BogaStock. Analyses d'actions par IA, graphiques, secteurs, devises, matières premières et crypto sur une seule plateforme.",
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
export default async function GlobalFrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="fr" />
      {children}
    </>
  );
}
