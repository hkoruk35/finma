import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed } from "@/lib/apiAuth";
import { getSnapshot } from "@/lib/v4/snapshot";
import { AssetClass, ASSET_MAP, AssetSnapshot } from "@/lib/v4/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

type AssetResult = AssetSnapshot | { ok: false; error: string };

export async function GET(request: NextRequest) {
  if (!isStaffAuthed(request)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  try {
    const { searchParams } = new URL(request.url);
    const symbolParam = (searchParams.get("symbol") || "SPX").toUpperCase();

    if (symbolParam === "ALL") {
      const results: Record<string, AssetResult> = {};
      const promises = Object.keys(ASSET_MAP).map(async (key) => {
        const asset = key as AssetClass;
        try {
          const snapshot = await getSnapshot(asset);
          results[asset] = snapshot;
        } catch (e) {
          results[asset] = { ok: false, error: e instanceof Error ? e.message : String(e) };
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
