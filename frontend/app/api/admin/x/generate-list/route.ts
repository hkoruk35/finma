import { NextRequest, NextResponse } from "next/server";
import { getTopSwingByVolume, getTopTrendByVolume, getTopTop100ByVolume } from "@/lib/homeFeed";
import { getAllTickers } from "@/lib/data";
import { SECTOR_ORDER, groupBySector } from "@/lib/sectorHeatMap";
import { generateLocalizedTexts, type ListType } from "@/lib/x/generateContent";

export const runtime = "nodejs";
export const maxDuration = 30;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const LIST_TITLES: Record<ListType, string> = {
  swing: "Swing Trade",
  trend: "Trend Stocks",
  top100: "Top 100",
  sector_heatmap: "Sector Heat Map",
};

const LIST_PATH: Record<ListType, string> = {
  swing: "swing",
  trend: "trend",
  top100: "top100",
  sector_heatmap: "home",
};

// Ana sayfadaki paylaş butonlarıyla aynı bölümlerin (Swing/Trend/Top100/Sektör
// Isı Haritası) o anki en hareketli hisselerini çekip kısa bir özet metin
// üretir — x-studio'dan "site bölümü" olarak paylaşılabilsin diye.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const listType = body.listType as ListType;
  if (!["swing", "trend", "top100", "sector_heatmap"].includes(listType)) {
    return NextResponse.json({ error: "invalid listType" }, { status: 400 });
  }

  let items: { ticker: string; changePct: number }[] = [];

  if (listType === "swing") {
    items = (await getTopSwingByVolume(5)).map((s) => ({ ticker: s.ticker, changePct: s.change_pct }));
  } else if (listType === "trend") {
    items = (await getTopTrendByVolume(5)).map((s) => ({ ticker: s.ticker, changePct: s.change_pct }));
  } else if (listType === "top100") {
    items = (await getTopTop100ByVolume(5)).map((s) => ({ ticker: s.ticker, changePct: s.change_pct }));
  } else {
    const allTickers = await getAllTickers();
    const groups = groupBySector(allTickers);

    let topSector = SECTOR_ORDER[0];
    let topAvg = 0;
    let found = false;
    for (const s of SECTOR_ORDER) {
      const g = groups[s];
      if (!g || g.length === 0) continue;
      const avg = g.reduce((a, t) => a + t.change_pct, 0) / g.length;
      if (!found || Math.abs(avg) > Math.abs(topAvg)) {
        topAvg = avg;
        topSector = s;
        found = true;
      }
    }

    items = [...(groups[topSector] ?? [])]
      .sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct))
      .slice(0, 5)
      .map((t) => ({ ticker: t.ticker, changePct: t.change_pct }));
  }

  if (items.length === 0) {
    return NextResponse.json({ error: "No live data available for this list right now" }, { status: 404 });
  }

  const texts = await generateLocalizedTexts({
    contentType: "list",
    listType,
    listTitle: LIST_TITLES[listType],
    items,
    pageUrl: `https://bogastock.com/global/en/${LIST_PATH[listType]}`,
  });

  return NextResponse.json({ texts, items, listTitle: LIST_TITLES[listType] });
}
