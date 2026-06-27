import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import PreOrderClient from "@/components/PreOrderClient";

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return {
    title: `${ticker.toUpperCase()} Pre-Order Analizi — BOGA AI`,
    description: `${ticker.toUpperCase()} pivot, EMA, Wyckoff ve kademeli giriş/çıkış analizi`,
  };
}

export default async function GlobalTrPreOrderTickerPage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <MemberHeader locale="tr" />
      <main className="flex-1 w-full">
        <PreOrderClient ticker={ticker.toUpperCase()} hideAdminActions={true} />
      </main>
      <Footer hidePlatform={true} />
    </div>
  );
}
