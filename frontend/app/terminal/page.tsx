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
      <div className="flex items-center px-4 py-2 bg-[#0a0e17] border-b border-[#1e2a3a] shrink-0">
        <div className="flex items-center gap-2">
          <img src="/finmawave.png" alt="BOGA AI" className="w-8 h-8 rounded-lg" />
          <span className="text-sm font-black text-white tracking-tighter uppercase">BOGA AI — Terminal</span>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <TerminalClient />
      </div>
    </div>
  );
}
