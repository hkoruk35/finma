"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";

const LOCALES = ["tr", "en", "es", "fr", "pt"] as const;
type Locale = (typeof LOCALES)[number];

interface MarketIndex {
  name: string;
  ticker: string;
  price: number;
  changePct: number;
  sparkline: number[];
}

interface WeatherData {
  provider: string;
  status: string;
  location: string;
  current: {
    temperature_c: number;
    condition: string;
    humidity: number;
    wind_kph: number;
    icon?: string;
  };
  forecast: Array<{
    date: string;
    max_temp_c: number;
    min_temp_c: number;
    condition: string;
    icon?: string;
  }>;
}

interface SportsEvent {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  sport: string;
  league: string;
  date: string;
  time?: string;
}

interface NewsItem {
  title: string;
  source: string;
  pubDate: string;
  link: string;
}

const I18N = {
  tr: {
    goodMorning: "Günaydın",
    goodAfternoon: "Tünaydın",
    goodEvening: "İyi Akşamlar",
    refresh: "Yenile",
    widgets: "Araçlar",
    seeMarket: "Piyasaları Gör",
    seeFullForecast: "Hava Durumu Detayı",
    sports: "Spor Skorları",
    seeMore: "Daha Fazla Göster",
    topStories: "Öne Çıkan Gelişmeler",
    newLook: "Yeni Görünüm",
    searchCity: "Şehir Ara...",
    airQuality: "Hava Kalitesi",
    humidity: "Nem",
    wind: "Rüzgar",
    loading: "Yükleniyor...",
    noEvents: "Bugün için spor müsabakası bulunamadı.",
    noNews: "Güncel haber bulunamadı.",
    today: "Bugün Neler Oluyor",
  },
  en: {
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    refresh: "Refresh",
    widgets: "Widgets",
    seeMarket: "See market",
    seeFullForecast: "Weather Details",
    sports: "Sports Scores",
    seeMore: "See more",
    topStories: "Top Stories",
    newLook: "New Look",
    searchCity: "Search city...",
    airQuality: "Air Quality",
    humidity: "Humidity",
    wind: "Wind",
    loading: "Loading...",
    noEvents: "No sports events found for today.",
    noNews: "No news found.",
    today: "What's Happening Today",
  },
  es: {
    goodMorning: "Buenos días",
    goodAfternoon: "Buenas tardes",
    goodEvening: "Buenas noches",
    refresh: "Actualizar",
    widgets: "Widgets",
    seeMarket: "Ver mercados",
    seeFullForecast: "Pronóstico completo",
    sports: "Marcadores",
    seeMore: "Ver más",
    topStories: "Noticias principales",
    newLook: "Nuevo diseño",
    searchCity: "Buscar ciudad...",
    airQuality: "Calidad del aire",
    humidity: "Humedad",
    wind: "Viento",
    loading: "Cargando...",
    noEvents: "No se encontraron eventos deportivos hoy.",
    noNews: "No se encontraron noticias.",
    today: "¿Qué pasa hoy?",
  },
  fr: {
    goodMorning: "Bon matin",
    goodAfternoon: "Bon après-midi",
    goodEvening: "Bonsoir",
    refresh: "Actualiser",
    widgets: "Widgets",
    seeMarket: "Voir les marchés",
    seeFullForecast: "Prévisions complètes",
    sports: "Scores Sportifs",
    seeMore: "Voir plus",
    topStories: "À la une",
    newLook: "Nouveau look",
    searchCity: "Rechercher...",
    airQuality: "Qualité de l'air",
    humidity: "Humidité",
    wind: "Vent",
    loading: "Chargement...",
    noEvents: "Aucun événement sportif aujourd'hui.",
    noNews: "Aucune actualité trouvée.",
    today: "Aujourd'hui",
  },
  pt: {
    goodMorning: "Bom dia",
    goodAfternoon: "Boa tarde",
    goodEvening: "Boa noite",
    refresh: "Atualizar",
    widgets: "Widgets",
    seeMarket: "Ver mercados",
    seeFullForecast: "Previsão completa",
    sports: "Placares Esportivos",
    seeMore: "Ver mais",
    topStories: "Principais notícias",
    newLook: "Novo visual",
    searchCity: "Buscar cidade...",
    airQuality: "Qualidade do ar",
    humidity: "Umidade",
    wind: "Vento",
    loading: "Carregando...",
    noEvents: "Nenhum evento esportivo hoje.",
    noNews: "Nenhuma notícia encontrada.",
    today: "O que está acontecendo hoje",
  }
};

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const width = 64;
  const height = 20;
  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const color = positive ? "#10b981" : "#ef4444";

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" points={points} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function TodayDashboardClient({ locale }: { locale: Locale }) {
  const t = I18N[locale];

  const [dateStr, setDateStr] = useState("");
  const [greeting, setGreeting] = useState("");
  const [isNewLook, setIsNewLook] = useState(true);

  // States
  const [markets, setMarkets] = useState<MarketIndex[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [sports, setSports] = useState<SportsEvent[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  // Search & Loading
  const [cityQuery, setCityQuery] = useState("");
  const [weatherCity, setWeatherCity] = useState("auto:ip");
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingSports, setLoadingSports] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);

  // Time & Greeting logic
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      
      // Formatting Date localized
      const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
      setDateStr(now.toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "en" ? "en-US" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "pt-PT", options));

      // Greeting
      const hrs = now.getHours();
      if (hrs < 12) setGreeting(t.goodMorning);
      else if (hrs < 17) setGreeting(t.goodAfternoon);
      else setGreeting(t.goodEvening);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [locale, t]);

  const loadData = () => {
    // 1. Markets
    setLoadingMarkets(true);
    fetch("/api/copilot/markets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMarkets(data);
      })
      .catch((err) => console.error("Markets error:", err))
      .finally(() => setLoadingMarkets(false));

    // 2. Weather
    setLoadingWeather(true);
    fetch(`/api/copilot/weather?q=${encodeURIComponent(weatherCity)}&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success") setWeather(data);
      })
      .catch((err) => console.error("Weather error:", err))
      .finally(() => setLoadingWeather(false));

    // 3. Sports
    setLoadingSports(true);
    fetch(`/api/copilot/sports`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success" && Array.isArray(data.events)) {
          setSports(data.events);
        }
      })
      .catch((err) => console.error("Sports error:", err))
      .finally(() => setLoadingSports(false));

    // 4. News
    setLoadingNews(true);
    fetch(`/api/copilot/news?lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNews(data);
      })
      .catch((err) => console.error("News error:", err))
      .finally(() => setLoadingNews(false));
  };

  useEffect(() => {
    loadData();
  }, [weatherCity, locale]);

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityQuery.trim()) {
      setWeatherCity(cityQuery.trim());
      setCityQuery("");
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-16">
      {/* Header */}
      <SearchLandingHeader locale={locale} onLogoClick={() => window.location.href = `/global/${locale}/search`} />

      {/* Main Container */}
      <main className="max-w-[1600px] mx-auto px-4 md:px-8 mt-6">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#1e2a3a]/40 pb-6 mb-6">
          <div>
            <p className="text-[#3b82f6] text-xs font-black uppercase tracking-widest">{dateStr}</p>
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mt-1">
              {greeting}
            </h1>
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1e2a3a]/40 hover:bg-[#1e2a3a]/80 border border-[#1e2a3a]/60 text-xs font-bold text-slate-200 transition-all"
            >
              <svg className={`w-3.5 h-3.5 ${loadingMarkets || loadingWeather || loadingSports || loadingNews ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
              {t.refresh}
            </button>

            {/* Look Toggle */}
            <div className="flex items-center gap-2 bg-[#1e2a3a]/25 px-3 py-1.5 rounded-xl border border-[#1e2a3a]/40">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{t.newLook}</span>
              <button
                onClick={() => setIsNewLook(!isNewLook)}
                className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                  isNewLook ? "bg-[#3b82f6]" : "bg-[#1e2a3a]"
                }`}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full bg-white transition-transform duration-200 ${
                    isNewLook ? "translate-x-3.5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT SIDEBAR: Markets, Weather, Sports (5 cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. WEATHER WIDGET */}
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>🌤️</span> WEATHER
                </span>

                <form onSubmit={handleCitySearch} className="relative flex items-center">
                  <input
                    type="text"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    placeholder={t.searchCity}
                    className="w-32 bg-[#141b2b] text-[10px] px-2.5 py-1.5 rounded-lg border border-[#1e2a3a]/80 focus:border-[#3b82f6]/60 focus:outline-none text-slate-100 placeholder-slate-500 transition-all"
                  />
                  <button type="submit" className="absolute right-2 text-slate-500 hover:text-white">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
                  </button>
                </form>
              </div>

              {loadingWeather ? (
                <div className="py-8 text-center text-xs text-slate-500">{t.loading}</div>
              ) : weather ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white leading-tight truncate max-w-[180px]">
                        {weather.location.split(",")[0]}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">{weather.current.condition}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {weather.current.icon && (
                        <img src={weather.current.icon} alt="Weather" className="w-10 h-10 object-contain" />
                      )}
                      <span className="text-3xl md:text-4xl font-extrabold text-white tracking-tighter">
                        {weather.current.temperature_c}°
                      </span>
                    </div>
                  </div>

                  {/* Weather Info Row */}
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-[#1e2a3a]/40 text-[10px] text-slate-400">
                    <div>{t.humidity}: <span className="text-white font-bold">{weather.current.humidity}%</span></div>
                    <div>{t.wind}: <span className="text-white font-bold">{weather.current.wind_kph} km/h</span></div>
                  </div>

                  {/* 3 Day Forecast */}
                  {weather.forecast && weather.forecast.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-[#1e2a3a]/40 space-y-2">
                      {weather.forecast.map((f, i) => {
                        const dayName = new Date(f.date).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short" });
                        return (
                          <div key={i} className="flex justify-between items-center text-xs">
                            <span className="w-12 text-slate-400 font-bold capitalize">{dayName}</span>
                            <div className="flex items-center gap-2 flex-1 px-4">
                              {f.icon && <img src={f.icon} alt="" className="w-5 h-5 object-contain" />}
                              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">{f.condition}</span>
                            </div>
                            <span className="text-white font-bold">
                              {f.max_temp_c}° <span className="text-slate-500 font-normal text-[10px]">/ {f.min_temp_c}°</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* 2. MARKETS WIDGET */}
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>📈</span> MARKETS
                </span>
                <Link
                  href={`/global/${locale}/home`}
                  className="text-[#3b82f6] text-[10px] font-bold hover:underline"
                >
                  {t.seeMarket} →
                </Link>
              </div>

              {loadingMarkets ? (
                <div className="py-8 text-center text-xs text-slate-500">{t.loading}</div>
              ) : (
                <div className="space-y-3.5">
                  {markets.map((index) => {
                    const isPositive = index.changePct >= 0;
                    return (
                      <div key={index.ticker} className="flex items-center justify-between gap-2 border-b border-[#1e2a3a]/20 pb-3 last:border-0 last:pb-0">
                        <div>
                          <p className="text-xs font-black text-white">{index.name}</p>
                          <p className="text-[9px] text-[#64748b] font-bold">{index.ticker}</p>
                        </div>

                        {/* Sparkline Graph */}
                        <div className="hidden sm:block">
                          <Sparkline data={index.sparkline} positive={isPositive} />
                        </div>

                        <div className="text-right">
                          <p className="text-xs font-black text-white">${index.price.toLocaleString()}</p>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-black mt-0.5 ${
                              isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                            }`}
                          >
                            {isPositive ? "+" : ""}
                            {index.changePct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. SPORTS WIDGET */}
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>🏀</span> {t.sports}
                </span>
              </div>

              {loadingSports ? (
                <div className="py-8 text-center text-xs text-slate-500">{t.loading}</div>
              ) : sports.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">{t.noEvents}</div>
              ) : (
                <div className="space-y-4">
                  {sports.map((event) => {
                    const isHomeWinner = event.home_score !== null && event.away_score !== null && event.home_score > event.away_score;
                    const isAwayWinner = event.home_score !== null && event.away_score !== null && event.away_score > event.home_score;
                    return (
                      <div key={event.id} className="bg-[#141b2b]/40 rounded-xl p-3 border border-[#1e2a3a]/40">
                        <div className="flex justify-between items-center text-[9px] text-[#64748b] font-bold mb-2">
                          <span className="uppercase tracking-wider">{event.sport} - {event.league}</span>
                          <span className={`px-1.5 py-0.5 rounded bg-[#1e2a3a] text-slate-300`}>{event.status}</span>
                        </div>

                        <div className="space-y-2">
                          {/* Home Team */}
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${isHomeWinner ? "text-white" : "text-slate-400"}`}>
                              {event.home_team}
                            </span>
                            <span className={`text-xs font-black ${isHomeWinner ? "text-[#3b82f6]" : "text-slate-400"}`}>
                              {event.home_score !== null ? event.home_score : "-"}
                            </span>
                          </div>

                          {/* Away Team */}
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${isAwayWinner ? "text-white" : "text-slate-400"}`}>
                              {event.away_team}
                            </span>
                            <span className={`text-xs font-black ${isAwayWinner ? "text-[#3b82f6]" : "text-slate-400"}`}>
                              {event.away_score !== null ? event.away_score : "-"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT MAIN AREA: Top Stories / News Feed (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* News Section Header */}
            <div className="flex items-center gap-2 border-b border-[#1e2a3a]/40 pb-3">
              <span className="text-lg font-extrabold text-white tracking-tight">{t.topStories}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>

            {loadingNews ? (
              <div className="py-32 text-center text-slate-500 text-sm font-medium">{t.loading}</div>
            ) : news.length === 0 ? (
              <div className="py-32 text-center text-slate-500 text-sm">{t.noNews}</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Hero News Card (Span 2 on MD/LG if it's the first news) */}
                {news.slice(0, 1).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="md:col-span-2 group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl overflow-hidden backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300"
                  >
                    <div className="p-6">
                      <div className="flex items-center justify-between text-[10px] text-[#64748b] font-bold mb-3">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{item.pubDate}</span>
                      </div>
                      <h2 className="text-xl md:text-2xl font-black text-white group-hover:text-[#3b82f6] transition-colors leading-tight">
                        {item.title}
                      </h2>
                    </div>

                    <div className="bg-[#141b2b]/30 p-4 border-t border-[#1e2a3a]/40 flex justify-between items-center text-xs text-slate-400 group-hover:text-white transition-colors">
                      <span>{t.seeMore} →</span>
                      <span className="text-[10px] text-slate-500">Reuters / Wall Street / Bloomberg</span>
                    </div>
                  </a>
                ))}

                {/* Sub News Cards */}
                {news.slice(1).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[9px] text-[#64748b] font-bold mb-3">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{item.pubDate}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-100 group-hover:text-[#3b82f6] transition-colors leading-snug line-clamp-3">
                        {item.title}
                      </h3>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1e2a3a]/20 flex items-center text-[10px] text-slate-500 group-hover:text-slate-300 transition-colors">
                      <span>{t.seeMore} →</span>
                    </div>
                  </a>
                ))}

              </div>
            )}

          </div>

        </div>

      </main>
    </div>
  );
}
