import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Market News & AI Analysis Feed — BOGA AI",
  description: "Every AI-generated stock analysis BOGA AI has posted on X (@bogastock), all in one public, continuously updated feed.",
  alternates: {
    canonical: "https://bogastock.com/global/en/news",
    languages: {
      "en-US": "https://bogastock.com/global/en/news",
      "es-ES": "https://bogastock.com/global/es/news",
      "fr-FR": "https://bogastock.com/global/fr/news",
      "pt-PT": "https://bogastock.com/global/pt/news",
      "tr-TR": "https://bogastock.com/global/tr/news",
    },
  },
  openGraph: {
    title: "Market News & AI Analysis Feed — BOGA AI",
    description: "Every AI-generated stock analysis BOGA AI has posted on X (@bogastock), all in one public, continuously updated feed.",
    url: "https://bogastock.com/global/en/news",
  },
};

export default async function EnNewsPage() {
  const posts = await getPublicPosts("en");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={false} globalLocale="en" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">@bogastock on X</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Market News & AI Analysis</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            A public feed of every AI-generated stock analysis BOGA AI has posted in English.
          </p>
        </div>

        <NewsFeed posts={posts} locale="en" />
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
