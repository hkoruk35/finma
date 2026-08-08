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

function resolvePreferredLocale(acceptLangHeader: string | null): string {
  if (!acceptLangHeader) return "en";
  const supported = ["tr", "en", "es", "fr", "pt"];
  const langs = acceptLangHeader
    .split(",")
    .map((item) => {
      const [lang, qVal] = item.trim().split(";q=");
      const q = qVal ? parseFloat(qVal) : 1.0;
      const code = lang.split("-")[0].toLowerCase();
      return { code, q: isNaN(q) ? 1.0 : q };
    })
    .sort((a, b) => b.q - a.q);

  for (const l of langs) {
    if (supported.includes(l.code)) return l.code;
  }
  return "en";
}

export default async function HomePage() {
  const headerList = await headers();
  const acceptLang = headerList.get("accept-language");
  const locale = resolvePreferredLocale(acceptLang);

  redirect(`/global/${locale}/home`, RedirectType.replace);
}
