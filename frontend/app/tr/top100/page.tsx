import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Gerçek zamanlı, saatlik güncellenen 100 hisselik takip tablosu — EMA/RSI sinyalleri ile BOGA AI.",
  alternates: { canonical: "https://bogastock.com/tr/top100" },
};

export default function TrTop100Page() {
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Top100Tracker locale="tr" />
    </div>
  );
}
