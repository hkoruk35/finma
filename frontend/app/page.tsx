import AIContainer from "@/components/AIContainer";
import { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGA AI - AI-Powered US Stock Analysis & Global Trading",
  description: "AI-powered financial market analysis for stocks, commodities, and crypto. Test and development phase with support for over 50 languages.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

export default function HomePage() {
  return <AIContainer lang="en" />;
}
