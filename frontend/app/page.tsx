import AIContainer from "@/components/AIContainer";
import { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGA AI - AI-Powered US Stock Analysis & Global Trading",
  description: "AI-powered financial market analysis for stocks, commodities, and crypto. Support for over 50 languages.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const auth = cookieStore.get("boga_auth");

  if (!auth) {
    redirect("/login");
  }

  // Redirect authenticated users to /pro instead of home
  redirect("/pro");
}
