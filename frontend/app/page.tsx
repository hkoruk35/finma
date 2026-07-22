import { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGASTOCK | Advanced Interactive Chart Analysis for Stocks, Gold, FX & Crypto",
  description: "BOGASTOCK Terminal | Advanced Interactive Chart Analysis for Stocks, Gold, FX & Crypto.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

export default function HomePage() {
  redirect("/global/en");
}
