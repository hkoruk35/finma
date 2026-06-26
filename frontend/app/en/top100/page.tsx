import { Metadata } from "next";
import Top100Tracker from "@/components/public/Top100Tracker";

export const metadata: Metadata = {
  title: "BOGA AI Top 100 Tracker",
  description: "Real-time, hourly-refreshed tracking of 100 stocks with EMA/RSI signals — BOGA AI.",
  alternates: { canonical: "https://bogastock.com/en/top100" },
};

export default function EnTop100Page() {
  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <Top100Tracker locale="en" />
    </div>
  );
}
