import { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AcademyArticleClient from "@/components/AcademyArticleClient";

export const metadata: Metadata = {
  title: "BogaStock | Yapay Zekâ Destekli Hisse, Borsa ve Piyasa Analizi",
  description: "ABD hisseleri ve küresel piyasaları BogaStock ile takip edin. Yapay zekâ destekli hisse analizleri, grafikler, sektörler, döviz, emtia ve kripto piyasalarını tek platformda inceleyin.",
};

export default function Page() {
  const enContent = {
    h1: "Swing Picks Explained",
    intro: "Every morning BOGA AI selects 5 swing trade candidates from 7,000+ stocks.",
    sections: [
      { h2: "The Three Zones", body: "Buy Zone, Stop Zone, Profit Zone—each precisely calculated" },
      { h2: "AI Score", body: "85-100: Exceptional. 70-84: Strong. <70: Not selected" },
      { h2: "Sector Context", body: "Diversify picks across sectors to reduce correlated risk" },
    ],
    cta_text: "See today's picks",
    cta_btn: "View Picks",
  };

  const content = {
    en: enContent,
    es: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    pt: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    fr: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    tr: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
    id: { h1: "", intro: "", sections: [], cta_text: "", cta_btn: "" },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <AcademyArticleClient articleKey="swing-picks" content={content} breadcrumb={{ label: "Swing Picks", href: "/academy/swing-picks-explained" }} relatedArticles={[]} />
      </main>
      <Footer />
    </div>
  );
}
