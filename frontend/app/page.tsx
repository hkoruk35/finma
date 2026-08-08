import { Metadata } from "next";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
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
