import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "Piyasa Haberleri & AI Analiz Akışı — BOGA AI",
  description: "BOGA AI'nin X'te (@bogastock) paylaştığı tüm AI destekli hisse analizleri, dile bakılmaksızın tek bir herkese açık akışta.",
  alternates: {
    canonical: "https://bogastock.com/global/tr/news",
    languages: {
      "en-US": "https://bogastock.com/global/en/news",
      "es-ES": "https://bogastock.com/global/es/news",
      "fr-FR": "https://bogastock.com/global/fr/news",
      "pt-PT": "https://bogastock.com/global/pt/news",
      "tr-TR": "https://bogastock.com/global/tr/news",
    },
  },
  openGraph: {
    title: "Piyasa Haberleri & AI Analiz Akışı — BOGA AI",
    description: "BOGA AI'nin X'te (@bogastock) paylaştığı tüm AI destekli hisse analizleri, dile bakılmaksızın tek bir herkese açık akışta.",
    url: "https://bogastock.com/global/tr/news",
  },
};

export default async function TrNewsPage() {
  const posts = await getPublicPosts();

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header hideMenus={true} globalLocale="tr" />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-bold text-[#3b82f6] uppercase tracking-[0.3em] mb-4">X'te @bogastock</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Piyasa Haberleri & AI Analiz</h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            BOGA AI'nin paylaştığı tüm AI destekli hisse analizlerinin, dil ayrımı olmaksızın yer aldığı herkese açık akış.
          </p>
        </div>

        <NewsFeed posts={posts} locale="tr" />
      </main>

      <Footer hidePlatform={true} locale="tr" />
    </div>
  );
}
