import { NextResponse } from "next/server";
import { getWatchlistPicks } from "@/lib/data";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTrendPicks } from "@/lib/pickMasking";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getWatchlistPicks();

  // Trend Adayı havuzu — anonim VE free'de ticker kimliği maskeli, sadece
  // premium/admin gerçek listeyi görür (bkz. Faz 0B, plan "Kararım" #1:
  // Trend Hisseleri ile aynı premium kapı). Eskiden bu endpoint hiç auth
  // kontrolü yapmıyordu, doğrudan curl ile bypass edilebiliyordu. Bu havuzun
  // kendi şeklinde (watchlist_picks.json) işlem planı alanı yok, sadece
  // kimlik maskelenir.
  const access = await getMemberAccess();
  const tier = resolveMemberTierFromAccess(access);

  if (Array.isArray(data?.picks)) {
    data.picks = maskTrendPicks(data.picks, tier, { stripTradePlan: false });
  }

  return NextResponse.json(data);
}
