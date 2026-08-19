import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { getFutureContent } from "@/lib/futureContent";
import FuturePageContent from "@/components/public/FuturePageContent";

export const metadata: Metadata = {
  title: "Future",
  alternates: { canonical: "https://bogastock.com/global/pt/future", languages: {
      en: "https://bogastock.com/global/en/future",
      es: "https://bogastock.com/global/es/future",
      fr: "https://bogastock.com/global/fr/future",
      id: "https://bogastock.com/global/id/future",
      pt: "https://bogastock.com/global/pt/future",
      tr: "https://bogastock.com/global/tr/future",
      "x-default": "https://bogastock.com/global/en/future",
    } }
};

export default function FuturePage() {
  const content = getFutureContent("pt");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="pt" />
      <main className="flex-1 w-full">
        <FuturePageContent content={content} />
      </main>
      <Footer hidePlatform={true} locale="pt" />
    </div>
  );
}
