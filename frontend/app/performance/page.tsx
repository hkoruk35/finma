import { getMasterData, getSwingPerformance } from "@/lib/data";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TickerTape from "@/components/TickerTape";
import SwingPerformanceDashboard from "@/components/SwingPerformanceDashboard";
import Link from "next/link";
import { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Swing Engine Performance | BOGA AI",
  description: "Detailed performance records for the BOGA AI Swing Engine. Transparent historical trading data.",
  alternates: { canonical: "https://bogastock.com/performance" },
};

export default async function SwingPerformancePage() {
  const [master, performanceData] = await Promise.all([
    getMasterData(),
    getSwingPerformance()
  ]);

  if (!performanceData) {
    return <div className="min-h-screen bg-[#0d1117] text-white p-8">Loading or No Data Available</div>;
  }

  const history: any[] = performanceData.history ?? [];
  const lastUpdated = performanceData.stats?.last_updated;

  return (
    <div className="min-h-screen flex flex-col bg-[#0d1117]">
      <Header />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="flex items-center gap-2 text-sm text-[#00d2ff] mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span>/</span>
          <span className="text-white">System Performance</span>
        </nav>

        {/* Header Section */}
        <header className="mb-10 lg:w-2/3">
          <h1 className="text-2xl md:text-5xl font-extrabold text-white mb-4 whitespace-nowrap">
            Swing Engine Performance
          </h1>
          <p className="text-white text-lg leading-relaxed">
            Transparent and verifiable historical records of our algorithmic high-conviction swing setups. This log displays every signal the model has generated, emphasizing our commitment to real performance.
          </p>
        </header>

        {/* Dashboard Client Component */}
        <SwingPerformanceDashboard initialHistory={history} stats={performanceData.stats} />
      </main>

      <Footer />
    </div>
  );
}
