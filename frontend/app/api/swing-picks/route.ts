import { NextRequest, NextResponse } from "next/server";
import { getSwingPicksBackfilled, getMasterData } from "@/lib/data";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTrendPicks } from "@/lib/pickMasking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const minParam = req.nextUrl.searchParams.get("min");
  const min = minParam ? parseInt(minParam, 10) : 10;
  const data = await getSwingPicksBackfilled(Number.isFinite(min) && min > 0 ? min : 10);

  const access = await getMemberAccess();
  const tier = resolveMemberTierFromAccess(access);

  if (Array.isArray(data?.picks) && data.picks.length > 0) {
    try {
      const tickers = data.picks.map((p: any) => p.ticker).filter(Boolean);
      if (tickers.length > 0) {
        const masterData: Record<string, any> = (await getMasterData(tickers)) || {};
        data.picks = data.picks.map((p: any) => {
          const md = masterData[p.ticker];
          const price = md?.price?.current ?? md?.current_price ?? p.current_price ?? 0;
          const change_pct = md?.tracker_1h?.change_pct_1d ?? md?.price?.change_pct ?? p.change_1d ?? p.change_pct ?? 0;
          return {
            ...p,
            price,
            change_pct,
            current_price: price,
            change_1d: change_pct,
          };
        });
      }
    } catch {}

    data.picks = maskTrendPicks(data.picks, tier, { stripTradePlan: true });
  }

  return NextResponse.json(data);
}
