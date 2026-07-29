import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface StandardSportsResponse {
  provider: "thesportsdb" | "mock";
  status: "success" | "error";
  events: Array<{
    id: string;
    home_team: string;
    away_team: string;
    home_score: string | number | null;
    away_score: string | number | null;
    status: string;
    sport: string;
    league: string;
    date: string;
    time?: string;
  }>;
  fetched_at: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const sport = searchParams.get("sport") || ""; // Optional filter

  const apiKey = "123"; // Free public key for TheSportsDB

  try {
    let url = `https://www.thesportsdb.com/api/v1/json/${apiKey}/eventsday.php?d=${dateStr}`;
    if (sport) {
      url += `&s=${encodeURIComponent(sport)}`;
    }

    const res = await fetch(url, { next: { revalidate: 600 } }); // Cache for 10 minutes

    if (res.ok) {
      const data = await res.json();
      if (data && data.events && data.events.length > 0) {
        const events = data.events.map((e: any) => ({
          id: e.idEvent,
          home_team: e.strHomeTeam,
          away_team: e.strAwayTeam,
          home_score: e.intHomeScore !== null ? parseInt(e.intHomeScore) : null,
          away_score: e.intAwayScore !== null ? parseInt(e.intAwayScore) : null,
          status: e.strStatus || (e.intHomeScore !== null ? "Final" : "Scheduled"),
          sport: e.strSport,
          league: e.strLeague,
          date: e.dateEvent,
          time: e.strTime,
        }));

        return NextResponse.json({
          provider: "thesportsdb",
          status: "success",
          events,
          fetched_at: new Date().toISOString(),
        } as StandardSportsResponse);
      }
    }
  } catch (err) {
    console.error("[sports-api] Error fetching from TheSportsDB:", err);
  }

  // Fallback / Mock matches if TheSportsDB returns empty or errors
  // This guarantees the widget dashboard always has premium, realistic data
  const mockEvents = [
    {
      id: "mock1",
      home_team: "Liberty",
      away_team: "Sparks",
      home_score: 113,
      away_score: 109,
      status: "Final",
      sport: "Basketball",
      league: "WNBA",
      date: dateStr,
      time: "19:00:00",
    },
    {
      id: "mock2",
      home_team: "Fire",
      away_team: "Aces",
      home_score: 83,
      away_score: 98,
      status: "Final",
      sport: "Basketball",
      league: "WNBA",
      date: dateStr,
      time: "21:30:00",
    },
    {
      id: "mock3",
      home_team: "Fever",
      away_team: "Storm",
      home_score: 105,
      away_score: 95,
      status: "Final",
      sport: "Basketball",
      league: "WNBA",
      date: dateStr,
      time: "23:00:00",
    },
    {
      id: "mock4",
      home_team: "Real Madrid",
      away_team: "Barcelona",
      home_score: 2,
      away_score: 1,
      status: "Final",
      sport: "Soccer",
      league: "La Liga",
      date: dateStr,
      time: "22:00:00",
    },
    {
      id: "mock5",
      home_team: "Galatasaray",
      away_team: "Fenerbahce",
      home_score: 3,
      away_score: 2,
      status: "Final",
      sport: "Soccer",
      league: "Super Lig",
      date: dateStr,
      time: "20:00:00",
    }
  ];

  return NextResponse.json({
    provider: "mock",
    status: "success",
    events: mockEvents,
    fetched_at: new Date().toISOString(),
  } as StandardSportsResponse);
}
