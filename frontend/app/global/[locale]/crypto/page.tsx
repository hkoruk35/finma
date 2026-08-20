import { Metadata } from "next";
import { notFound } from "next/navigation";
import AssetClassPageContent, {
  ASSET_CLASS_PAGE_COPY,
} from "@/components/global/AssetClassPageContent";
import { ASSET_CLASSES, ASSET_CLASS_LOCALES, type AssetClassLocale } from "@/lib/assetClasses";

const ASSET_CLASS = "crypto" as const;

export const revalidate = 60; // enstrüman listesi statik, fiyatlar zaten client-side canlı çekiliyor

type Props = {
  params: Promise<{ locale: string }>;
};

function isLocale(locale: string): locale is AssetClassLocale {
  return (ASSET_CLASS_LOCALES as readonly string[]).includes(locale);
}

export async function generateStaticParams() {
  return ASSET_CLASS_LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};

  const def = ASSET_CLASSES[ASSET_CLASS];
  const name = def.names[locale];
  const pc = ASSET_CLASS_PAGE_COPY[locale];

  const languages: Record<string, string> = {};
  for (const l of ASSET_CLASS_LOCALES) {
    languages[l] = `https://bogastock.com/global/${l}/${ASSET_CLASS}`;
  }

  return {
    title: `${name} — ${pc.metaSuffix}`,
    description: def.descriptions[locale],
    alternates: {
      canonical: `https://bogastock.com/global/${locale}/${ASSET_CLASS}`,
      languages: { ...languages, "x-default": `https://bogastock.com/global/en/${ASSET_CLASS}` },
    },
    openGraph: {
      title: `${name} — ${pc.metaSuffix}`,
      description: def.descriptions[locale],
      url: `https://bogastock.com/global/${locale}/${ASSET_CLASS}`,
    },
  };
}

export default async function CryptoPage({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  return <AssetClassPageContent assetClass={ASSET_CLASS} locale={locale} />;
}
