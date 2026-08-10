import Link from "next/link";
import { Metadata } from "next";
import { readFile } from "fs/promises";
import { join } from "path";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { formatNumber } from "@/lib/formatNumber";

interface TickerData {
  ticker: string;
  price: number;
  change_1d: number;
  technical: {
    rsi?: number;
    momentum?: number;
    trend?: string;
    sma_20?: number;
  };
  ai_summary: {
    homepage_summary: {
      en: string;
    };
  };
}

interface SectorAnalysis {
  generated_at: string;
  total_tickers: number;
  analysis_by_sector: {
    [sector: string]: {
      subsectors: {
        [subsector: string]: TickerData[];
      };
      tickers: string[];
    };
  };
}

function formatPrice(price: number): string {
  if (price === 0 || !price) return "N/A";
  if (price >= 1000000000) return `$${formatNumber(price / 1000000000, 1)}B`;
  if (price >= 1000000) return `$${formatNumber(price / 1000000, 1)}M`;
  if (price >= 1000) return `$${formatNumber(price / 1000, 1)}K`;
  return `$${formatNumber(price, 2)}`;
}

function getChangeColor(change: number | null | undefined) {
  if (!change && change !== 0) return "text-white";
  if (change >= 2) return "text-green-400 font-medium";
  if (change >= 0) return "text-green-300";
  if (change >= -2) return "text-red-300";
  return "text-red-400 font-medium";
}

function getTrendBadge(trend?: string) {
  const colors: Record<string, string> = {
    bullish: "bg-green-900/40 text-green-200 border-green-700/50",
    bearish: "bg-red-900/40 text-red-200 border-red-700/50",
    overbought: "bg-red-900/60 text-red-100 border-red-700/70 font-medium",
    oversold: "bg-green-900/60 text-green-100 border-green-700/70 font-medium",
    neutral: "bg-slate-900/40 text-slate-200 border-slate-700/50",
  };

  return (
    <span className={`text-[10px] px-2 py-1 rounded border inline-block ${colors[trend || "neutral"]}`}>
      {trend?.toUpperCase()}
    </span>
  );
}

async function loadSectorData(): Promise<SectorAnalysis | null> {
  try {
    const filePath = join(process.cwd(), "public", "data", "sector_analysis.json");
    const fileContent = await readFile(filePath, "utf-8");
    return JSON.parse(fileContent);
  } catch (error) {
    console.error("Error loading sector data:", error);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; subsector: string }>;
}): Promise<Metadata> {
  const { slug, subsector } = await params;
  const decodedSector = decodeURIComponent(slug).replace(/-/g, " ");
  const decodedSubsector = decodeURIComponent(subsector).replace(/-/g, " ");

  return {
    title: `${decodedSubsector} - ${decodedSector} Stocks | BOGA AI`,
    description: `Detailed stock analysis for ${decodedSubsector} in the ${decodedSector} sector. View price changes, technical indicators, and market cap.`,
  };
}

export default async function SubsectorPage({
  params,
}: {
  params: Promise<{ slug: string; subsector: string }>;
}) {
  const { slug, subsector } = await params;
  const sectorData = await loadSectorData();

  // Decode URL params
  const decodedSector = decodeURIComponent(slug).split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
  const decodedSubsector = decodeURIComponent(subsector).split("-").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

  // Find matching sector (case-insensitive)
  const matchingSector = Object.keys(sectorData?.analysis_by_sector || {}).find(
    (s) => s.toLowerCase() === decodedSector.toLowerCase()
  );

  if (!sectorData || !matchingSector) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-medium text-white mb-4">Sector Not Found</h1>
            <p className="text-white mb-8">The sector "{decodedSector}" could not be found.</p>
            <Link href="/" className="text-[#3b82f6] hover:underline font-semibold">
              ← Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // Handle "all" subsector case
  let subsectorData: TickerData[] = [];
  let displaySubsectorName = decodedSubsector;
  let matchingSubsector: string | undefined;

  if (subsector === "all") {
    // Combine all stocks from all subsectors in this sector
    const allSubsectorObjects = sectorData.analysis_by_sector[matchingSector]?.subsectors || {};
    subsectorData = Object.values(allSubsectorObjects).flat();
    displaySubsectorName = `All ${matchingSector}`;
  } else {
    // Find matching subsector with fuzzy matching (normalize spaces/special chars)
    const normalizeForMatching = (str: string) => {
      // Remove special chars and normalize spaces
      let normalized = str.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
      // Also try removing the word "and" since it might be replacing an ampersand
      const withoutAnd = normalized.replace(/\s+and\s+/g, ' ').trim();
      return { normalized, withoutAnd };
    };

    const decodedNorms = normalizeForMatching(decodedSubsector);

    matchingSubsector = Object.keys(sectorData.analysis_by_sector[matchingSector]?.subsectors || {}).find(
      (s) => {
        const dataNorms = normalizeForMatching(s);
        // Try exact match or match without the word "and"
        return decodedNorms.normalized === dataNorms.normalized ||
               decodedNorms.normalized === dataNorms.withoutAnd ||
               decodedNorms.withoutAnd === dataNorms.normalized ||
               decodedNorms.withoutAnd === dataNorms.withoutAnd;
      }
    );

    subsectorData =
      sectorData.analysis_by_sector[matchingSector]?.subsectors[matchingSubsector || ""] || [];
  }

  if (subsectorData.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-medium text-white mb-4">Subsector Not Found</h1>
            <p className="text-white mb-8">
              No stocks found for "{matchingSubsector || decodedSubsector}" in {decodedSector}.
            </p>
            <Link href="/" className="text-[#3b82f6] hover:underline font-semibold">
              ← Back to Home
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {/* Breadcrumb */}
        <div className="mb-8 flex items-center gap-2 text-sm text-white">
          <Link href="/" className="hover:text-white transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link href={`/sector/${slug}`} className="hover:text-white transition-colors">
            {decodedSector}
          </Link>
          <span>/</span>
          <span className="text-white font-semibold">{displaySubsectorName}</span>
        </div>

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-1.5 h-10 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
                {displaySubsectorName}
              </h1>
              <p className="text-xs text-white font-medium tracking-widest uppercase mt-1">
                {decodedSector} · {subsectorData.length} Stocks
              </p>
            </div>
          </div>
        </div>

        {/* Stock Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e2a3a]">
                <th className="text-left px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  Ticker
                </th>
                <th className="text-left px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  Price
                </th>
                <th className="text-right px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  1D %
                </th>
                <th className="text-center px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  RSI
                </th>
                <th className="text-center px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  Momentum
                </th>
                <th className="text-center px-4 py-3 text-xs font-black text-white uppercase tracking-widest">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody>
              {subsectorData.map((stock, idx) => (
                <tr
                  key={stock.ticker}
                  className={`border-b border-[#1e2a3a] hover:bg-[#141924]/50 transition-colors ${
                    idx % 2 === 0 ? "bg-[#0a0e17]/30" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/stock/${stock.ticker}`}
                      className="text-[#3b82f6] hover:text-white font-medium uppercase tracking-wide transition-colors"
                    >
                      {stock.ticker}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white font-semibold">
                    ${formatNumber(stock.price?, 2) || "N/A"}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${getChangeColor(stock.change_1d)}`}>
                    {stock.change_1d !== undefined && stock.change_1d !== null
                      ? `${stock.change_1d > 0 ? "+" : ""}${formatNumber(stock.change_1d, 2)}%`
                      : "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center text-white">
                    {formatNumber(stock.technical?.rsi?, 1) || "N/A"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {stock.technical?.momentum ? (
                      <span
                        className={
                          stock.technical.momentum > 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"
                        }
                      >
                        {stock.technical.momentum > 0 ? "+" : ""}
                        {formatNumber(stock.technical.momentum, 1)}%
                      </span>
                    ) : (
                      <span className="text-white">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {getTrendBadge(stock.technical?.trend)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3 mt-8">
          {subsectorData.map((stock) => (
            <div key={stock.ticker} className="glass-card p-4">
              <div className="flex justify-between items-start mb-2">
                <Link
                  href={`/stock/${stock.ticker}`}
                  className="text-[#3b82f6] hover:text-white font-medium text-lg uppercase transition-colors"
                >
                  {stock.ticker}
                </Link>
                <span className={`font-medium ${getChangeColor(stock.change_1d)}`}>
                  {stock.change_1d !== undefined && stock.change_1d !== null
                    ? `${stock.change_1d > 0 ? "+" : ""}${formatNumber(stock.change_1d, 2)}%`
                    : "N/A"}
                </span>
              </div>
              <p className="text-white font-semibold mb-2">
                ${formatNumber(stock.price?, 2) || "N/A"}
              </p>
              <div className="grid grid-cols-3 gap-2 text-[10px] text-white">
                <div>
                  <p className="uppercase font-medium">RSI</p>
                  <p className="text-white">{formatNumber(stock.technical?.rsi?, 1) || "N/A"}</p>
                </div>
                <div>
                  <p className="uppercase font-medium">Momentum</p>
                  <p className={stock.technical?.momentum && stock.technical.momentum > 0 ? "text-green-400 font-medium" : "text-red-400 font-medium"}>
                    {stock.technical?.momentum
                      ? `${stock.technical.momentum > 0 ? "+" : ""}${formatNumber(stock.technical.momentum, 1)}%`
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="uppercase font-medium">Trend</p>
                  <p className="text-white">{stock.technical?.trend?.toUpperCase() || "N/A"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
