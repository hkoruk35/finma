import { Metadata } from "next";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import { getFutureContent } from "@/lib/futureContent";
import FuturePageContent from "@/components/public/FuturePageContent";

export const metadata: Metadata = {
  title: "Future",
  alternates: { canonical: "https://bogastock.com/global/id/future" }
};

export default function FuturePage() {
  const content = getFutureContent("id");

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="id" />
      <main className="flex-1 w-full">
        <FuturePageContent content={content} />
      </main>
      <Footer hidePlatform={true} locale="id" />
    </div>
  );
}
