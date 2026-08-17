import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/v4/snapshot";
import { AssetClass, ASSET_MAP } from "@/lib/v4/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolParam = (searchParams.get("symbol") || "SPX").toUpperCase();
    
    if (symbolParam === "ALL") {
      const results: Record<string, any> = {};
      const promises = Object.keys(ASSET_MAP).map(async (key) => {
        const asset = key as AssetClass;
        try {
          const snapshot = await getSnapshot(asset);
          results[asset] = snapshot;
        } catch (e) {
          results[asset] = { ok: false, error: String(e) };
        }
      });
      await Promise.all(promises);
      return NextResponse.json({ ok: true, results });
    }

    let asset: AssetClass = "SPX";
    if (symbolParam in ASSET_MAP) {
      asset = symbolParam as AssetClass;
    }

    const snapshot = await getSnapshot(asset);
    return NextResponse.json(snapshot);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
