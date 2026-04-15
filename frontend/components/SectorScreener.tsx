"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface SectorData {
  [sector: string]: {
    subsectors: {
      [subsector: string]: Array<{
        ticker: string;
        price: number;
        change_1d: number;
        technical: {
          rsi?: number;
          momentum?: number;
          trend?: string;
          sma_20?: number;
        };
      }>;
    };
  };
}

export default function SectorScreener() {
  const router = useRouter();
  const [sectorData, setSectorData] = useState<SectorData | null>(null);
  const [selectedSector, setSelectedSector] = useState<string>("");
  const [selectedSubsector, setSelectedSubsector] = useState<string>("");
  const [sectors, setSectors] = useState<string[]>([]);
  const [subsectors, setSubsectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Load sector_analysis.json
  useEffect(() => {
    const loadSectorData = async () => {
      try {
        const response = await fetch("/data/sector_analysis.json", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load sector analysis");

        const data = await response.json();
        const analysisData = data.analysis_by_sector as SectorData;

        setSectorData(analysisData);
        const sectorList = Object.keys(analysisData).sort();
        setSectors(sectorList);

        // Auto-select first sector
        if (sectorList.length > 0) {
          setSelectedSector(sectorList[0]);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading sector data:", error);
        setLoading(false);
      }
    };

    loadSectorData();
  }, []);

  // Update subsectors when sector changes
  useEffect(() => {
    if (selectedSector && sectorData) {
      const subsectorList = Object.keys(sectorData[selectedSector]?.subsectors || {}).sort();
      setSubsectors(subsectorList);

      // Auto-select "All Subsectors" when sector changes
      setSelectedSubsector("all");
    }
  }, [selectedSector, sectorData]);

  const handleViewStocks = () => {
    if (selectedSector && selectedSubsector) {
      const sectorSlug = selectedSector.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "and");
      const subsectorSlug = selectedSubsector.toLowerCase().replace(/\s+/g, "-").replace(/[&]/g, "and");
      router.push(`/sector/${sectorSlug}/${subsectorSlug}`);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 text-center">
        <p className="text-[#94a3b8]">Loading sector data...</p>
      </div>
    );
  }

  // Show error if no sectors loaded
  if (sectors.length === 0) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-1.5 h-8 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
          <div>
            <h3 className="text-xl font-black text-white tracking-tighter uppercase">
              Smart Sector Screener
            </h3>
            <p className="text-xs text-[#94a3b8] font-bold tracking-widest uppercase mt-0.5">
              Filter by Sector & Subsector
            </p>
          </div>
        </div>
        <div className="text-center py-8">
          <p className="text-[#94a3b8] mb-2">No sector data available</p>
          <p className="text-sm text-[#64748b]">Please check back soon</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-1.5 h-8 bg-[#3b82f6] rounded-full shadow-[0_0_12px_#3b82f6]"></div>
        <div>
          <h3 className="text-xl font-black text-white tracking-tighter uppercase">
            Smart Sector Screener
          </h3>
          <p className="text-xs text-[#94a3b8] font-bold tracking-widest uppercase mt-0.5">
            Filter by Sector & Subsector
          </p>
        </div>
      </div>

      {/* Filters Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Sector Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">
            Sector ({sectors.length})
          </label>
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="w-full px-4 py-3 bg-[#0a0e17] border border-[#1e2a3a] rounded-lg text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
          >
            <option value="">Select a sector</option>
            {sectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>
        </div>

        {/* Subsector Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#94a3b8] uppercase tracking-widest">
            Subsector / Category
          </label>
          <select
            value={selectedSubsector}
            onChange={(e) => setSelectedSubsector(e.target.value)}
            className="w-full px-4 py-3 bg-[#0a0e17] border border-[#1e2a3a] rounded-lg text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all"
            disabled={subsectors.length === 0}
          >
            <option value="all">All Subsectors</option>
            {subsectors.map((subsector) => (
              <option key={subsector} value={subsector}>
                {subsector}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Info Text */}
      {selectedSector && sectorData && (
        <div className="text-xs text-[#64748b] bg-[#0a0e17] px-3 py-2 rounded border border-[#1e2a3a]">
          📊{" "}
          {selectedSubsector === "all" ? (
            <>
              {Object.values(sectorData[selectedSector]?.subsectors || {}).reduce(
                (total, arr) => total + arr.length,
                0
              )}{" "}
              stocks in <span className="text-[#94a3b8] font-semibold">All {selectedSector}</span>
            </>
          ) : (
            <>
              {sectorData[selectedSector]?.subsectors[selectedSubsector]?.length || 0} stocks in{" "}
              <span className="text-[#94a3b8] font-semibold">{selectedSubsector}</span>
            </>
          )}
        </div>
      )}

      {/* View Stocks Button */}
      <button
        onClick={handleViewStocks}
        disabled={!selectedSector || !selectedSubsector}
        className="w-full px-6 py-3 bg-[#3b82f6] hover:bg-[#2563eb] disabled:bg-[#1e3a8a] disabled:opacity-50 text-white font-black uppercase tracking-widest rounded-lg transition-all shadow-lg hover:shadow-[0_0_20px_#3b82f6]/50 disabled:shadow-none"
      >
        View Stocks →
      </button>
    </div>
  );
}
