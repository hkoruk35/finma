import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Notícias do Mercado e Análise IA — BOGA AI",
  description: "Cada análise de ações gerada por IA que a BOGA AI publicou no X (@bogastock), tudo em um único feed público e atualizado.",
  alternates: {
    canonical: "https://bogastock.com/global/pt/news",
    languages: {
      "en-US": "https://bogastock.com/global/en/news",
      "es-ES": "https://bogastock.com/global/es/news",
      "fr-FR": "https://bogastock.com/global/fr/news",
      "pt-PT": "https://bogastock.com/global/pt/news",
      "tr-TR": "https://bogastock.com/global/tr/news",
    },
  },
  openGraph: {
    title: "Notícias do Mercado e Análise IA — BOGA AI",
    description: "Cada análise de ações gerada por IA que a BOGA AI publicou no X (@bogastock), tudo em um único feed público e atualizado.",
    url: "https://bogastock.com/global/pt/news",
  },
};

export default async function PtNewsPage() {
  const posts = await getPublicPosts("pt");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">@bogastock no X</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Notícias e Análise IA</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Um feed público de toda análise de ações gerada por IA que a BOGA AI publicou em português.
          </p>
        </div>

        <NewsFeed posts={posts} locale="pt" />
      </main>

      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
