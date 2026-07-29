import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

interface StandardWeatherResponse {
  provider: "weatherapi" | "wttr.in";
  status: "success" | "error";
  location: string;
  current: {
    temperature_c: number;
    temperature_f: number;
    condition: string;
    humidity: number;
    wind_kph: number;
    wind_mph: number;
    icon?: string;
  };
  forecast: Array<{
    date: string;
    max_temp_c: number;
    min_temp_c: number;
    max_temp_f: number;
    min_temp_f: number;
    condition: string;
    icon?: string;
  }>;
  fetched_at: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "New York"; // Default city changed to New York
  const lang = searchParams.get("lang") || "tr";

  const apiKey = process.env.WEATHER_API_KEY || process.env.NEXT_PUBLIC_WEATHER_API_KEY;

  if (apiKey) {
    try {
      // 3 days forecast from WeatherAPI
      const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(q)}&days=3&aqi=no&alerts=no&lang=${lang}`;
      const res = await fetch(url, { next: { revalidate: 600 } }); // Cache for 10 minutes

      if (res.ok) {
        const data = await res.json();
        const response: StandardWeatherResponse = {
          provider: "weatherapi",
          status: "success",
          location: `${data.location.name}, ${data.location.region || data.location.country}`,
          current: {
            temperature_c: Math.round(data.current.temp_c),
            temperature_f: Math.round(data.current.temp_f),
            condition: data.current.condition.text,
            humidity: data.current.humidity,
            wind_kph: data.current.wind_kph,
            wind_mph: data.current.wind_mph,
            icon: data.current.condition.icon ? `https:${data.current.condition.icon}` : undefined,
          },
          forecast: data.forecast.forecastday.map((f: any) => ({
            date: f.date,
            max_temp_c: Math.round(f.day.maxtemp_c || f.day.maxtempC),
            min_temp_c: Math.round(f.day.mintemp_c || f.day.mintempC),
            max_temp_f: Math.round(f.day.maxtemp_f || f.day.maxtempF || f.day.maxtemp_c * 1.8 + 32),
            min_temp_f: Math.round(f.day.mintemp_f || f.day.mintempF || f.day.mintemp_c * 1.8 + 32),
            condition: f.day.condition.text,
            icon: f.day.condition.icon ? `https:${f.day.condition.icon}` : undefined,
          })),
          fetched_at: new Date().toISOString(),
        };
        return NextResponse.json(response);
      }
    } catch (err) {
      console.error("[weather-api] Error fetching from WeatherAPI:", err);
    }
  }

  // Fallback to wttr.in
  try {
    const city = q === "auto:ip" ? "Istanbul" : q; // Default fallback to Istanbul if auto:ip fails with wttr.in
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { next: { revalidate: 600 } });
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition[0];
      const location = data.nearest_area[0];
      const areaName = location.areaName[0].value;
      const country = location.country[0].value;

      const response: StandardWeatherResponse = {
        provider: "wttr.in",
        status: "success",
        location: `${areaName}, ${country}`,
        current: {
          temperature_c: parseInt(current.temp_C),
          temperature_f: parseInt(current.temp_F || Math.round(parseInt(current.temp_C) * 1.8 + 32).toString()),
          condition: current.lang_tr?.[0]?.value || current.weatherDesc[0].value,
          humidity: parseInt(current.humidity),
          wind_kph: parseInt(current.windspeedKmph),
          wind_mph: parseInt(current.windspeedMiles || Math.round(parseInt(current.windspeedKmph) * 0.621371).toString()),
        },
        forecast: data.weather.map((w: any) => ({
          date: w.date,
          max_temp_c: parseInt(w.maxtempC),
          min_temp_c: parseInt(w.mintempC),
          max_temp_f: parseInt(w.maxtempF || Math.round(parseInt(w.maxtempC) * 1.8 + 32).toString()),
          min_temp_f: parseInt(w.mintempF || Math.round(parseInt(w.mintempC) * 1.8 + 32).toString()),
          condition: w.hourly?.[4]?.lang_tr?.[0]?.value || w.hourly?.[4]?.weatherDesc?.[0]?.value || "Güneşli",
        })),
        fetched_at: new Date().toISOString(),
      };
      return NextResponse.json(response);
    }
  } catch (err) {
    console.error("[weather-api] Fallback wttr.in failed:", err);
  }

  return NextResponse.json(
    { status: "error", message: "Weather data currently unavailable" },
    { status: 502 }
  );
}
