import { NextRequest, NextResponse } from "next/server";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lang = searchParams.get("lang") || "tr";
  const query = searchParams.get("q") || "world news today";

  try {
    const news = await fetchLiveMarketNews(query, lang);
    return NextResponse.json(news);
  } catch (err) {
    console.error("[news-api] Error fetching news:", err);
    return NextResponse.json({ error: "Failed to fetch news" }, { status: 500 });
  }
}
