import CampaignBanner from "@/components/CampaignBanner";

import { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    template: "%s | BogaStock | AI-Powered Stock, Market and Financial Analysis",
    default: "BogaStock | AI-Powered Stock, Market and Financial Analysis"
  },
  description: "Track US stocks and global markets with BogaStock. Review AI-supported stock analysis, charts, sectors, forex, commodities, and crypto markets on a single platform."
};

// Completely public layout — no authentication required
export default async function GlobalEnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="en" />
      {children}
    </>
  );
}
