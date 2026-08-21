import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import LiveAssetTable from "@/components/global/LiveAssetTable";
import { localeUpperCase } from "@/lib/localeCase";
import {
  ASSET_CLASSES,
  ASSET_CLASS_SLUGS,
  type AssetClassLocale,
  type AssetClassSlug,
} from "@/lib/assetClasses";

export interface AssetClassPageCopy {
  breadcrumbHome: string;
  liveBadge: string;
  otherMarkets: string;
  metaSuffix: string;
}

export const ASSET_CLASS_PAGE_COPY: Record<AssetClassLocale, AssetClassPageCopy> = {
  en: {
    breadcrumbHome: "Dashboard",
    liveBadge: "LIVE · UPDATES 24/7",
    otherMarkets: "Explore other markets",
    metaSuffix: "Live Prices & Charts | BogaStock",
  },
  tr: {
    breadcrumbHome: "Gösterge Paneli",
    liveBadge: "CANLI · 7/24 GÜNCELLENİR",
    otherMarkets: "Diğer piyasalara göz at",
    metaSuffix: "Canlı Fiyatlar ve Grafikler | BogaStock",
  },
  es: {
    breadcrumbHome: "Panel",
    liveBadge: "EN VIVO · SE ACTUALIZA 24/7",
    otherMarkets: "Explora otros mercados",
    metaSuffix: "Precios y Gráficos en Vivo | BogaStock",
  },
  fr: {
    breadcrumbHome: "Tableau de Bord",
    liveBadge: "EN DIRECT · MISE À JOUR 24/7",
    otherMarkets: "Explorer d'autres marchés",
    metaSuffix: "Prix et Graphiques en Direct | BogaStock",
  },
  pt: {
    breadcrumbHome: "Painel",
    liveBadge: "AO VIVO · ATUALIZA 24/7",
    otherMarkets: "Explore outros mercados",
    metaSuffix: "Preços e Gráficos ao Vivo | BogaStock",
  },
  id: {
    breadcrumbHome: "Dashboard",
    liveBadge: "LANGSUNG · DIPERBARUI 24/7",
    otherMarkets: "Jelajahi pasar lainnya",
    metaSuffix: "Harga & Grafik Langsung | BogaStock",
  },
};

interface Props {
  assetClass: AssetClassSlug;
  locale: AssetClassLocale;
}

// Forex/Commodities/Crypto/Futures sayfalarının ortak govdesi. Her varlik
// sinifi artik kendi statik route klasorune sahip (app/global/[locale]/forex,
// .../commodities, .../crypto, .../futures) — cunku [locale] altinda zaten
// [indexSlug] adinda ayri bir dinamik segment var ve Next.js ayni seviyede
// iki farkli dinamik segment adina izin vermiyor. Bu bilesen o 4 sayfa
// arasinda kod tekrarini onlemek icin paylasilan govdeyi tutuyor.
export default function AssetClassPageContent({ assetClass, locale }: Props) {
  const def = ASSET_CLASSES[assetClass];
  const pc = ASSET_CLASS_PAGE_COPY[locale];
  const otherClasses = ASSET_CLASS_SLUGS.filter((s) => s !== assetClass);

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale} />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-6">
        <nav className="flex items-center gap-2 text-[10px] font-medium text-slate-500 tracking-widest mb-4">
          <Link href={`/global/${locale}/home`} className="hover:text-[#3b82f6] transition-colors">
            {localeUpperCase(pc.breadcrumbHome, locale)}
          </Link>
          <span className="opacity-30">/</span>
          <span className="text-white">{localeUpperCase(def.names[locale], locale)}</span>
        </nav>

        <div className="inline-flex items-center gap-2 bg-[#22c55e]/10 border border-[#22c55e]/30 rounded-full px-3 py-1 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse" />
          <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#22c55e]">{pc.liveBadge}</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-semibold text-white tracking-tight mb-2">{def.names[locale]}</h1>
        <p className="text-sm text-slate-400 mb-6 max-w-2xl">{def.descriptions[locale]}</p>

        <LiveAssetTable instruments={def.instruments} locale={locale} />

        <div className="mt-8">
          <h2 className="text-[10px] font-bold tracking-wider text-white/40 mb-2">{localeUpperCase(pc.otherMarkets, locale)}</h2>
          <div className="flex flex-wrap gap-2">
            {otherClasses.map((slug) => (
              <Link
                key={slug}
                href={`/global/${locale}/${slug}`}
                className="px-3 py-1.5 rounded-lg bg-[#0d1117] border border-[#1e2a3a] text-xs font-medium text-slate-300 hover:border-[#3b82f6]/50 hover:text-white transition-all"
              >
                {ASSET_CLASSES[slug].names[locale]}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer hidePlatform locale={locale} />
    </div>
  );
}
