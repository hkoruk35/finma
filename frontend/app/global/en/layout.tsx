import CampaignBanner from "@/components/CampaignBanner";
import type { Metadata } from "next";

const LOCALES = ['en', 'tr', 'es', 'fr', 'pt', 'id'] as const;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: {
      template: "%s | BogaStock | AI-Powered Stock, Market and Financial Analysis",
      default: "BogaStock | AI-Powered Stock, Market and Financial Analysis",
    },
    description: "Track US stocks and global markets with BogaStock. Review AI-supported stock analysis, charts, sectors, forex, commodities, and crypto markets on a single platform.",
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
export default async function GlobalEnLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CampaignBanner lang="en" />
      {children}
    </>
  );
}
