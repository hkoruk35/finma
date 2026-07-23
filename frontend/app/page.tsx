import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BOGASTOCK | Advanced Interactive Chart Analysis for Stocks, Gold, FX & Crypto",
  description: "BOGASTOCK Terminal | Advanced Interactive Chart Analysis for Stocks, Gold, FX & Crypto.",
  alternates: {
    canonical: "https://bogastock.com",
  },
};

export default async function HomePage() {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent") || "";
  const acceptLang = headerList.get("accept-language") || "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(userAgent);

  let locale = "en";
  const lowerLang = acceptLang.toLowerCase();
  if (lowerLang.includes("tr")) locale = "tr";
  else if (lowerLang.includes("pt")) locale = "pt";
  else if (lowerLang.includes("es")) locale = "es";
  else if (lowerLang.includes("fr")) locale = "fr";

  if (isMobile) {
    redirect(`/global/${locale}/home`);
  } else {
    redirect(`/global/${locale}`);
  }
}
