import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | Analisis Saham, Pasar, dan Keuangan Bertenaga AI",
    default: "BogaStock | Analisis Saham, Pasar, dan Keuangan Bertenaga AI"
  },
  description: "Pantau saham AS dan pasar global bersama BogaStock. Telusuri analisis saham berbasis AI, grafik, sektor, valuta asing, komoditas, dan pasar kripto dalam satu platform."
};

// Completely public layout — no authentication required
export default async function GlobalIdLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="id" />
      {children}
    </>
  );
}
