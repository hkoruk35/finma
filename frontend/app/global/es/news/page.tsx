import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Noticias del Mercado y Análisis IA — BOGA AI",
  description: "Cada análisis bursátil generado por IA que BOGA AI ha publicado en X (@bogastock), todo en un solo feed público y actualizado.",
  alternates: {
    canonical: "https://bogastock.com/global/es/news",
    languages: {
      "en-US": "https://bogastock.com/global/en/news",
      "es-ES": "https://bogastock.com/global/es/news",
      "fr-FR": "https://bogastock.com/global/fr/news",
      "pt-PT": "https://bogastock.com/global/pt/news",
      "tr-TR": "https://bogastock.com/global/tr/news",
    },
  },
  openGraph: {
    title: "Noticias del Mercado y Análisis IA — BOGA AI",
    description: "Cada análisis bursátil generado por IA que BOGA AI ha publicado en X (@bogastock), todo en un solo feed público y actualizado.",
    url: "https://bogastock.com/global/es/news",
  },
};

export default async function EsNewsPage() {
  const posts = await getPublicPosts("es");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} globalLocale="es" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">@bogastock en X</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Noticias y Análisis IA</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Un feed público de todo análisis bursátil generado por IA que BOGA AI ha publicado en español.
          </p>
        </div>

        <NewsFeed posts={posts} locale="es" />
      </main>

      <Footer hidePlatform={true} locale="es" />
    </div>
  );
}
