import { NextRequest, NextResponse } from "next/server";
import { getListOptions, type ListOptionCategory } from "@/lib/x/listOptions";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const VALID_CATEGORIES = new Set<ListOptionCategory>(["top100", "swing", "watchlist", "sector", "index", "commodity", "fx", "crypto"]);

// X Studio "Listeden Seç" — kategoriye göre canlı fiyat/değişim% ile
// tarama listesi döner, admin buradan tek tek işaretleyip kuyruğa ekler.
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const category = req.nextUrl.searchParams.get("category") as ListOptionCategory | null;
  if (!category || !VALID_CATEGORIES.has(category)) {
    return NextResponse.json({ error: "invalid category" }, { status: 400 });
  }

  try {
    const items = await getListOptions(category);
    return NextResponse.json({ items });
  } catch (e: any) {
    console.error("[x/list-options]", e?.message);
    return NextResponse.json({ error: e?.message || "list fetch failed" }, { status: 500 });
  }
}
