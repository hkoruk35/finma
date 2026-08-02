import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
  const acceptLang = headerList.get("accept-language") || "";

  let locale = "en";
  const lowerLang = acceptLang.toLowerCase();
  if (lowerLang.includes("tr")) locale = "tr";
  else if (lowerLang.includes("pt")) locale = "pt";
  else if (lowerLang.includes("es")) locale = "es";
  else if (lowerLang.includes("fr")) locale = "fr";

  redirect(`/global/${locale}/home`, RedirectType.replace);
}
