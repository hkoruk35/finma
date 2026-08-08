import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import NewsFeed from "@/components/public/NewsFeed";
import { getPublicPosts } from "@/lib/x/publicPosts";

export const revalidate = 60;

export const metadata: Metadata = {
  metadataBase: new URL("https://bogastock.com"),
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
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
    title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
    description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
    url: "https://bogastock.com/global/en/news",
  },
};

export default async function EnNewsPage() {
  const posts = await getPublicPosts("en");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="en" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">@bogastock on X</p>
          <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight">Current Stock Analysis</h1>
        </div>

        <NewsFeed posts={posts} locale="en" />
      </main>

      <Footer hidePlatform={true} locale="en" />
    </div>
  );
}
