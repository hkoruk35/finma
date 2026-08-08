import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | Analyse des Actions, des Marchés et des Finances par l'IA",
    default: "BogaStock | Analyse des Actions, des Marchés et des Finances par l'IA"
  },
  description: "Suivez les actions américaines et les marchés mondiaux avec BogaStock. Analysez les actions, les graphiques, les secteurs, les devises, les matières premières et les cryptomonnaies avec l'IA sur une seule plateforme."
};

// Completely public layout — no authentication required
export default async function GlobalFrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="fr" />
      {children}
    </>
  );
}
