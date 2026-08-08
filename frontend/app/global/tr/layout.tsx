import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    default: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi"
  },
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin."
};

// Completely public layout — no authentication required
export default async function GlobalTrLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="tr" />
      {children}
    </>
  );
}
