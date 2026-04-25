import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Metadata } from "next";
import HourlyTrackerClient from "./HourlyTrackerClient";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "Hourly Intraday Pulse – BOGA AI",
  description: "Real-time hourly tracking of the 25-stock focus pool. Monitor short-term momentum, entry/exit zones, and active status directives.",
};

export const revalidate = 60; // Revalidate every 60 seconds

export default async function HourlyTrackerPage() {
  // Fetch the data from the local public folder (server-side for initial render)
  let initialData = null;
  try {
    const filePath = path.join(process.cwd(), "public", "data", "boga_hourly_portfolio.json");
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      initialData = JSON.parse(fileContent);
    }
  } catch (error) {
    console.error("Failed to load hourly portfolio JSON:", error);
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
