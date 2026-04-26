import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Metadata } from "next";
import HourlyTrackerClient from "./HourlyTrackerClient";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "Hourly Intraday Pulse – BOGA AI",
  description: "Real-time hourly status of last 30 days swing picks. Entry/exit signals updated every hour during market hours.",
};

export const revalidate = 60;

export default async function HourlyTrackerPage() {
  let initialData = null;
  try {
    const filePath = path.join(process.cwd(), "public", "intraday_signals.json");
    if (fs.existsSync(filePath)) {
      initialData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (error) {
    console.error("Failed to load intraday_signals.json:", error);
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        <HourlyTrackerClient initialData={initialData} />
      </main>
      <Footer />
    </div>
  );
}
