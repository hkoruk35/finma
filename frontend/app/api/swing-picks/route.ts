import { NextRequest, NextResponse } from "next/server";
import { getSwingPicksBackfilled } from "@/lib/data";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";
import { maskTrendPicks } from "@/lib/pickMasking";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const minParam = req.nextUrl.searchParams.get("min");
  const min = minParam ? parseInt(minParam, 10) : 10;
  const data = await getSwingPicksBackfilled(Number.isFinite(min) && min > 0 ? min : 10);

  // Trend Hisseleri (swing picks) — anonim VE free'de ticker kimliği maskeli
  // ve işlem planı alanları (giriş/hedef/stop) her durumda kapalı, sadece
  // premium/admin ikisini de görür (bkz. Faz 0B, plan "Kararım" #1). Eskiden
  // bu endpoint hiç auth kontrolü yapmıyordu, doğrudan curl ile bypass
  // edilebiliyordu.
  const access = await getMemberAccess();
  const tier = resolveMemberTierFromAccess(access);

  if (Array.isArray(data?.picks)) {
    data.picks = maskTrendPicks(data.picks, tier, { stripTradePlan: true });
  }

  return NextResponse.json(data);
}
