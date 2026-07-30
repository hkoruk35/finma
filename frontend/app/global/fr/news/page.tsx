import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Actualités du Marché & Analyse IA — BOGA AI",
  description: "Chaque analyse boursière générée par IA que BOGA AI a publiée sur X (@bogastock), réunie dans un seul flux public et continu.",
  alternates: {
    canonical: "https://bogastock.com/global/fr/news",
    languages: {
      "en-US": "https://bogastock.com/global/en/news",
      "es-ES": "https://bogastock.com/global/es/news",
      "fr-FR": "https://bogastock.com/global/fr/news",
      "pt-PT": "https://bogastock.com/global/pt/news",
      "tr-TR": "https://bogastock.com/global/tr/news",
    },
  },
  openGraph: {
    title: "Actualités du Marché & Analyse IA — BOGA AI",
    description: "Chaque analyse boursière générée par IA que BOGA AI a publiée sur X (@bogastock), réunie dans un seul flux public et continu.",
    url: "https://bogastock.com/global/fr/news",
  },
};

export default async function FrNewsPage() {
  const posts = await getPublicPosts("fr");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} globalLocale="fr" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">@bogastock sur X</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Actualités & Analyse IA</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Un flux public de chaque analyse boursière générée par IA que BOGA AI a publiée en français.
          </p>
        </div>

        <NewsFeed posts={posts} locale="fr" />
      </main>

      <Footer hidePlatform={true} locale="fr" />
    </div>
  );
}
