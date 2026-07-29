import { NextRequest, NextResponse } from "next/server";
import { fetchLiveMarketNews } from "@/lib/copilot/newsSearch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "New York";
  const lang = searchParams.get("lang") || "tr";

  // Clean location query (extract first name if coordinates)
  let cleanLocation = q.trim();
  if (cleanLocation.includes(",")) {
    // If coordinate, we don't search lat/long directly, fallback to New York or fetch from Weather first
    // Actually, in the frontend, when they query coordinates, weather has already loaded and has location name!
    // But as a fallback, we can use "New York" if it looks like coordinates.
    const isCoords = /^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/.test(cleanLocation);
    if (isCoords) {
      cleanLocation = "New York";
    }
  }

  // Construct query based on language to yield best local results
  let sportsQuery = `${cleanLocation} sports`;
  if (lang === "tr") sportsQuery = `${cleanLocation} spor`;
  else if (lang === "es") sportsQuery = `${cleanLocation} deportes`;
  else if (lang === "fr") sportsQuery = `${cleanLocation} sport`;
  else if (lang === "pt") sportsQuery = `${cleanLocation} esportes`;

  try {
    const articles = await fetchLiveMarketNews(sportsQuery, lang);
    return NextResponse.json({
      provider: "google-news",
      status: "success",
      events: articles, // Kept "events" as the key name to minimize frontend code breakage, but populated with articles
      fetched_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[sports-api] Error fetching sports news:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch sports news" },
      { status: 500 }
    );
  }
}
