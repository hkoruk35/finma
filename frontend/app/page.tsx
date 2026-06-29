import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGA AI - AI-Powered US Stock Analysis & Global Trading",
  description: "AI-powered financial market analysis for stocks, commodities, and crypto. Support for over 50 languages.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

// GEÇİCİ: Ana sayfa direkt Top100'e yönlendiriyor, login şartı kaldırıldı
export default function HomePage() {
  redirect("/global/en/top100");
}
