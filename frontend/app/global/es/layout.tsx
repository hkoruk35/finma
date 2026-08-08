import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | Análisis de Acciones, Mercados y Finanzas con IA",
    default: "BogaStock | Análisis de Acciones, Mercados y Finanzas con IA"
  },
  description: "Sigue las acciones de EE. UU. y los mercados globales con BogaStock. Analiza acciones, gráficos, sectores, divisas, materias primas y criptomonedas con IA en una sola plataforma."
};

// Completely public layout — no authentication required
export default async function GlobalEsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="es" />
      {children}
    </>
  );
}
