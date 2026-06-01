/**
 * Swing Universe API
 * Returns all tickers from the swing performance system with metadata
 */

import { getSwingPerformance, getSwingAllPicks } from "@/lib/data";
import { MARKET_THEMES } from "@/lib/themeData";

export const revalidate = 3600; // Cache for 1 hour

export async function GET() {
  try {
    const [perfData, picksData] = await Promise.all([
      getSwingPerformance(),
      getSwingAllPicks(),
    ]);

    // Extract tickers from performance history
    const perfTickers = new Set<string>();
    if (perfData?.history) {
      perfData.history.forEach((item: any) => {
        if (item.ticker) perfTickers.add(item.ticker);
      });
    }

    // Extract tickers from picks
    const pickTickers = new Set<string>();
    if (picksData?.picks) {
      picksData.picks.forEach((item: any) => {
        if (item.ticker) pickTickers.add(item.ticker);
      });
    }

    // Get current universe from MARKET_THEMES
    const swingUniverseTheme = MARKET_THEMES.find(
      (t) => t.name === "Swing Performance Universe"
    );
    const currentTickers = new Set(swingUniverseTheme?.tickers ?? []);

    // Find new tickers not in current theme
    const allPerformanceTickers = new Set([...perfTickers, ...pickTickers]);
    const newTickers = Array.from(allPerformanceTickers).filter(
      (t) => !currentTickers.has(t)
    );

    return Response.json(
      {
        success: true,
        timestamp: new Date().toISOString(),
        data: {
          total_in_universe: currentTickers.size,
          total_in_performance: perfTickers.size,
          total_in_picks: pickTickers.size,
          new_tickers_available: newTickers.length,
          new_tickers: newTickers.sort(),
          all_tickers: Array.from(currentTickers).sort(),
          last_performance_update: perfData?.generated_at || perfData?.date,
          last_picks_update: picksData?.generated_at || picksData?.date,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
