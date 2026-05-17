import { Metadata } from "next";
import Header from "@/components/Header";
import TerminalClient from "@/components/TerminalClient";

export const metadata: Metadata = {
  title: "Market Terminal | BOGA AI",
  description:
    "Professional Wall Street-style terminal. Live charts for US equities, sectors, currencies, and commodities with hourly AI signals and multi-screen view.",
  alternates: { canonical: "https://bogastock.com/terminal" },
};

export default function TerminalPage() {
  return (
    <div className="h-screen flex flex-col bg-[#060a12] overflow-hidden">
      <Header />
      <div className="flex-1 overflow-hidden">
        <TerminalClient />
      </div>
    </div>
  );
}
