import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | Análise de Ações, Mercados e Finanças com IA",
    default: "BogaStock | Análise de Ações, Mercados e Finanças com IA"
  },
  description: "Acompanhe as ações dos EUA e os mercados globais com o BogaStock. Analise ações, gráficos, setores, câmbio, commodities e criptomoedas com IA em uma única plataforma."
};

// Completely public layout — no authentication required
export default async function GlobalPtLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="pt" />
      {children}
    </>
  );
}
