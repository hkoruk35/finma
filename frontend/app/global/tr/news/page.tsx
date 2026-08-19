import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "News",
  alternates: { canonical: "https://bogastock.com/global/tr/news", languages: {
      en: "https://bogastock.com/global/en/news",
      es: "https://bogastock.com/global/es/news",
      fr: "https://bogastock.com/global/fr/news",
      id: "https://bogastock.com/global/id/news",
      pt: "https://bogastock.com/global/pt/news",
      tr: "https://bogastock.com/global/tr/news",
      "x-default": "https://bogastock.com/global/en/news",
    } }
};


export default async function TrNewsPage() {
  const posts = await getPublicPosts("tr");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">X'te @bogastock</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Güncel Hisse Analizleri</h1>
        </div>

        <NewsFeed posts={posts} locale="tr" />
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
