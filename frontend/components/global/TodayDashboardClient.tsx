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
    sports: "Spor Haberleri",
    seeMore: "Daha Fazla Göster",
    topStories: "Öne Çıkan Gelişmeler",
    newLook: "Yeni Görünüm",
    searchCity: "Şehir Ara...",
    airQuality: "Hava Kalitesi",
    humidity: "Nem",
    wind: "Rüzgar",
    loading: "Yükleniyor...",
    noEvents: "Bugün için spor haberi bulunamadı.",
    noNews: "Güncel haber bulunamadı.",
    today: "Bugün Neler Oluyor",
    economy: "Ekonomi Haberleri",
  },
  en: {
    goodMorning: "Good morning",
    goodAfternoon: "Good afternoon",
    goodEvening: "Good evening",
    refresh: "Refresh",
    widgets: "Widgets",
    seeMarket: "See market",
    seeFullForecast: "Weather Details",
    sports: "Sports News",
    seeMore: "See more",
    topStories: "Top Stories",
    newLook: "New Look",
    searchCity: "Search city...",
    airQuality: "Air Quality",
    humidity: "Humidity",
    wind: "Wind",
    loading: "Loading...",
    noEvents: "No sports news found for today.",
    noNews: "No news found.",
    today: "What's Happening Today",
    economy: "Financial News",
  },
  es: {
    goodMorning: "Buenos días",
    goodAfternoon: "Buenas tardes",
    goodEvening: "Buenas noches",
    refresh: "Actualizar",
    widgets: "Widgets",
    seeMarket: "Ver mercados",
    seeFullForecast: "Pronóstico completo",
    sports: "Noticias Deportivas",
    seeMore: "Ver más",
    topStories: "Noticias principales",
    newLook: "Nuevo diseño",
    searchCity: "Buscar ciudad...",
    airQuality: "Calidad del aire",
    humidity: "Humedad",
    wind: "Viento",
    loading: "Cargando...",
    noEvents: "No se encontraron noticias deportivas hoy.",
    noNews: "No se encontraron noticias.",
    today: "¿Qué pasa hoy?",
    economy: "Noticias Económicas",
  },
  fr: {
    goodMorning: "Bon matin",
    goodAfternoon: "Bon après-midi",
    goodEvening: "Bonsoir",
    refresh: "Actualiser",
    widgets: "Widgets",
    seeMarket: "Voir les marchés",
    seeFullForecast: "Prévisions complètes",
    sports: "Actualités Sportives",
    seeMore: "Voir plus",
    topStories: "À la une",
    newLook: "Nouveau look",
    searchCity: "Rechercher...",
    airQuality: "Qualité de l'air",
    humidity: "Humidité",
    wind: "Vent",
    loading: "Chargement...",
    noEvents: "Aucune actualité sportive aujourd'hui.",
    noNews: "Aucune actualité trouvée.",
    today: "Aujourd'hui",
    economy: "Actualités Économiques",
  },
  pt: {
    goodMorning: "Bom dia",
    goodAfternoon: "Boa tarde",
    goodEvening: "Boa noite",
    refresh: "Atualizar",
    widgets: "Widgets",
    seeMarket: "Ver mercados",
    seeFullForecast: "Previsão completa",
    sports: "Notícias Esportivas",
    seeMore: "Ver mais",
    topStories: "Principais notícias",
    newLook: "Novo visual",
    searchCity: "Buscar cidade...",
    airQuality: "Qualidade do ar",
    humidity: "Umidade",
    wind: "Vento",
    loading: "Carregando...",
    noEvents: "Nenhuma notícia esportiva encontrada hoje.",
    noNews: "Nenhuma notícia encontrada.",
    today: "O que está acontecendo hoje",
    economy: "Notícias Econômicas",
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

  // States
  const [markets, setMarkets] = useState<MarketIndex[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [sports, setSports] = useState<NewsItem[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [economyNews, setEconomyNews] = useState<NewsItem[]>([]);

  // Search & Loading
  const [cityQuery, setCityQuery] = useState("");
  const [weatherCity, setWeatherCity] = useState("New York");
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [loadingSports, setLoadingSports] = useState(true);
  const [loadingNews, setLoadingNews] = useState(true);
  const [loadingEconomyNews, setLoadingEconomyNews] = useState(true);

  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          setWeatherCity(`${lat.toFixed(4)},${lon.toFixed(4)}`);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert(
            locale === "tr"
              ? "Konum bilgisi alınamadı. Lütfen tarayıcınızın konum iznini kontrol edin veya HTTPS bağlantısı kullandığınızdan emin olun."
              : "Could not retrieve location. Please check browser permissions or ensure you are using a secure (HTTPS) connection."
          );
        }
      );
    } else {
      alert(
        locale === "tr"
          ? "Tarayıcınız konum servislerini desteklemiyor."
          : "Your browser does not support geolocation services."
      );
    }
  };

  // Time & Greeting logic
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" };
      setDateStr(now.toLocaleDateString(locale === "tr" ? "tr-TR" : locale === "en" ? "en-US" : locale === "es" ? "es-ES" : locale === "fr" ? "fr-FR" : "pt-PT", options));

      const hrs = now.getHours();
      if (hrs < 12) setGreeting(t.goodMorning);
      else if (hrs < 17) setGreeting(t.goodAfternoon);
      else setGreeting(t.goodEvening);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, [locale, t]);

  // Load static or general news/markets on mount/locale change
  useEffect(() => {
    setLoadingMarkets(true);
    fetch("/api/copilot/markets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMarkets(data);
      })
      .catch((err) => console.error("Markets error:", err))
      .finally(() => setLoadingMarkets(false));

    setLoadingNews(true);
    fetch(`/api/copilot/news?lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNews(data);
      })
      .catch((err) => console.error("News error:", err))
      .finally(() => setLoadingNews(false));

    setLoadingEconomyNews(true);
    fetch(`/api/copilot/news?q=economy&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEconomyNews(data);
      })
      .catch((err) => console.error("Economy news error:", err))
      .finally(() => setLoadingEconomyNews(false));
  }, [locale]);

  // Load weather when weatherCity or locale changes
  useEffect(() => {
    setLoadingWeather(true);
    fetch(`/api/copilot/weather?q=${encodeURIComponent(weatherCity)}&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success") setWeather(data);
      })
      .catch((err) => console.error("Weather error:", err))
      .finally(() => setLoadingWeather(false));
  }, [weatherCity, locale]);

  // Load sports news when weather resolves a location, or falls back to weatherCity
  useEffect(() => {
    const resolvedCity = weather ? weather.location.split(",")[0].trim() : weatherCity;
    const isCoords = /^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/.test(resolvedCity);
    const searchQuery = isCoords ? "New York" : resolvedCity;

    setLoadingSports(true);
    fetch(`/api/copilot/sports?q=${encodeURIComponent(searchQuery)}&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success" && Array.isArray(data.events)) {
          setSports(data.events);
        }
      })
      .catch((err) => console.error("Sports error:", err))
      .finally(() => setLoadingSports(false));
  }, [weather, weatherCity, locale]);

  const handleCitySearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityQuery.trim()) {
      setWeatherCity(cityQuery.trim());
      setCityQuery("");
    }
  };

  const handleRefresh = () => {
    // Force reload weatherCity triggers weather and sports effects
    setWeatherCity((prev) => prev);

    // Explicitly refetch general news, markets and economy news
    setLoadingMarkets(true);
    fetch("/api/copilot/markets")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMarkets(data);
      })
      .catch((err) => console.error("Markets error:", err))
      .finally(() => setLoadingMarkets(false));

    setLoadingNews(true);
    fetch(`/api/copilot/news?lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setNews(data);
      })
      .catch((err) => console.error("News error:", err))
      .finally(() => setLoadingNews(false));

    setLoadingEconomyNews(true);
    fetch(`/api/copilot/news?q=economy&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEconomyNews(data);
      })
      .catch((err) => console.error("Economy news error:", err))
      .finally(() => setLoadingEconomyNews(false));
  };

  const isImperial = locale === "en" || 
    (weather?.location && 
      (weather.location.toLowerCase().includes("usa") || 
       weather.location.toLowerCase().includes("united states") || 
       weather.location.toLowerCase().includes("united kingdom") || 
       weather.location.toLowerCase().includes("uk") || 
       weather.location.toLowerCase().includes("new york") || 
       weather.location.toLowerCase().includes("london") ||
       weather.location.toLowerCase().includes("gb")));

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-8">
      {/* Header */}
      <SearchLandingHeader locale={locale} onLogoClick={() => window.location.href = `/global/${locale}/search`} />

      {/* Main Container */}
      <main className="max-w-[1600px] mx-auto px-3 md:px-6 mt-3">
        
        {/* Top Control Bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-[#1e2a3a]/40 pb-1.5 mb-3">
          <div>
            <h1 className="text-lg md:text-xl font-medium text-white flex items-center gap-2">
              <span className="text-slate-300">{dateStr}</span>
              <span className="text-[#1e2a3a]/60">|</span>
              <span className="text-[#3b82f6]">{greeting}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e2a3a]/40 hover:bg-[#1e2a3a]/80 border border-[#1e2a3a]/60 text-[13px] font-medium text-slate-200 transition-all"
            >
              <svg className={`w-3.5 h-3.5 ${loadingMarkets || loadingWeather || loadingSports || loadingNews ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H18.2" />
              </svg>
              {t.refresh}
            </button>
          </div>
        </div>

        {/* Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          
          {/* LEFT SIDEBAR: Markets, Weather, Sports (5 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* 1. WEATHER WIDGET */}
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
              
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>🌤️</span> WEATHER
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleUseLocation}
                    type="button"
                    title={locale === "tr" ? "Konumumu Kullan" : "Use My Location"}
                    className="p-1 rounded-md bg-[#141b2b] border border-[#1e2a3a]/80 hover:border-[#3b82f6]/60 text-slate-400 hover:text-white transition-all flex items-center justify-center"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                  </button>

                  <form onSubmit={handleCitySearch} className="relative flex items-center">
                    <input
                      type="text"
                      value={cityQuery}
                      onChange={(e) => setCityQuery(e.target.value)}
                      placeholder={t.searchCity}
                      className="w-24 sm:w-28 bg-[#141b2b] text-[13px] px-2 py-1 rounded-md border border-[#1e2a3a]/80 focus:border-[#3b82f6]/60 focus:outline-none text-slate-100 placeholder-slate-500 transition-all"
                    />
                    <button type="submit" className="absolute right-2 text-slate-500 hover:text-white">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
                    </button>
                  </form>
                </div>
              </div>

              {loadingWeather ? (
                <div className="py-6 text-center text-[13px] text-slate-500">{t.loading}</div>
              ) : weather ? (
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium text-white leading-tight truncate max-w-[150px]">
                        {weather.location.split(",")[0]}
                      </h3>
                      <p className="text-[13px] text-slate-400 mt-0.5">{weather.current.condition}</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {weather.current.icon && (
                        <img src={weather.current.icon} alt="Weather" className="w-8 h-8 object-contain" />
                      )}
                      <span className="text-2xl md:text-3xl font-medium text-white tracking-tighter">
                        {isImperial ? weather.current.temperature_f : weather.current.temperature_c}°
                      </span>
                    </div>
                  </div>

                  {/* Weather Info Row */}
                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-[#1e2a3a]/40 text-[13px] text-slate-400">
                    <div>{t.humidity}: <span className="text-white font-medium">{weather.current.humidity}%</span></div>
                    <div>{t.wind}: <span className="text-white font-medium">{isImperial ? `${weather.current.wind_mph} mph` : `${weather.current.wind_kph} km/h`}</span></div>
                  </div>

                  {/* 3 Day Forecast */}
                  {weather.forecast && weather.forecast.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-[#1e2a3a]/40 space-y-1.5">
                      {weather.forecast.map((f, i) => {
                        const dayName = new Date(f.date).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { weekday: "short" });
                        return (
                          <div key={i} className="flex justify-between items-center text-[13px]">
                            <span className="w-12 text-slate-400 font-medium capitalize">{dayName}</span>
                            <div className="flex items-center gap-1.5 flex-1 px-3">
                              {f.icon && <img src={f.icon} alt="" className="w-4 h-4 object-contain" />}
                              <span className="text-[13px] text-slate-400 truncate max-w-[120px]">{f.condition}</span>
                            </div>
                            <span className="text-white font-medium text-[13px]">
                              {isImperial ? f.max_temp_f : f.max_temp_c}° <span className="text-slate-500 font-normal text-[13px]">/ {isImperial ? f.min_temp_f : f.min_temp_c}°</span>
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
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>📈</span> MARKETS
                </span>
                <Link
                  href={`/global/${locale}/home`}
                  className="text-[#3b82f6] text-[13px] font-medium hover:underline"
                >
                  {t.seeMarket} →
                </Link>
              </div>

              {loadingMarkets ? (
                <div className="py-6 text-center text-[13px] text-slate-500">{t.loading}</div>
              ) : (
                <div className="space-y-2">
                  {markets.map((index) => {
                    const isPositive = index.changePct >= 0;
                    return (
                      <div key={index.ticker} className="flex items-center justify-between gap-2 border-b border-[#1e2a3a]/20 pb-1.5 last:border-0 last:pb-0">
                        <div>
                          <p className="text-[13px] font-medium text-white">{index.name}</p>
                          <p className="text-[13px] text-[#64748b] font-normal">{index.ticker}</p>
                        </div>

                        {/* Sparkline Graph */}
                        <div className="hidden sm:block">
                          <Sparkline data={index.sparkline} positive={isPositive} />
                        </div>

                        <div className="text-right">
                          <p className="text-[13px] font-medium text-white">${index.price.toLocaleString()}</p>
                          <span
                            className={`inline-block px-1.5 py-0.5 rounded text-[13px] font-medium mt-0.5 ${
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
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md relative overflow-hidden shadow-xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[13px] font-medium text-[#64748b] uppercase tracking-widest flex items-center gap-1.5">
                  <span>🏀</span> {t.sports}
                </span>
              </div>

              {loadingSports ? (
                <div className="py-6 text-center text-xs text-slate-500">{t.loading}</div>
              ) : sports.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500">{t.noEvents}</div>
              ) : (
                <div className="space-y-2.5">
                  {sports.map((item, idx) => (
                    <a
                      key={idx}
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block bg-[#141b2b]/40 rounded-lg p-2.5 border border-[#1e2a3a]/40 hover:border-[#3b82f6]/40 transition-all group"
                    >
                      <div className="flex justify-between items-center text-[13px] text-[#64748b] font-medium mb-1">
                        <span className="text-[#3b82f6] uppercase tracking-wider">{item.source}</span>
                        <span>{new Date(item.pubDate).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <h4 className="text-[13px] font-normal text-slate-200 group-hover:text-[#3b82f6] transition-colors leading-snug line-clamp-2">
                        {item.title}
                      </h4>
                    </a>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* COLUMN 2: General News (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* News Section Header */}
            <div className="flex items-center gap-2 border-b border-[#1e2a3a]/40 pb-1.5">
              <span className="text-base font-medium text-white tracking-tight">{t.topStories}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>

            {loadingNews ? (
              <div className="py-24 text-center text-slate-500 text-sm font-medium">{t.loading}</div>
            ) : news.length === 0 ? (
              <div className="py-24 text-center text-slate-500 text-sm">{t.noNews}</div>
            ) : (
              <div className="space-y-4">
                
                {/* Hero News Card */}
                {news.slice(0, 1).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl overflow-hidden backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300"
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between text-[13px] text-[#64748b] font-medium mb-2">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{new Date(item.pubDate).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <h2 className="text-lg md:text-xl font-medium text-white group-hover:text-[#3b82f6] transition-colors leading-tight">
                        {item.title}
                      </h2>
                    </div>

                    <div className="bg-[#141b2b]/30 p-3 border-t border-[#1e2a3a]/40 flex justify-between items-center text-[13px] text-slate-400 group-hover:text-white transition-colors">
                      <span>{t.seeMore} →</span>
                      <span className="text-[13px] text-slate-500">Reuters / Wall Street / Bloomberg</span>
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
                    className="block group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[13px] text-[#64748b] font-medium mb-2">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{new Date(item.pubDate).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <h3 className="text-[14px] font-normal text-slate-200 group-hover:text-[#3b82f6] transition-colors leading-snug line-clamp-3">
                        {item.title}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-[#1e2a3a]/20 flex items-center text-[13px] text-slate-500 group-hover:text-slate-300 transition-colors">
                      <span>{t.seeMore} →</span>
                    </div>
                  </a>
                ))}

              </div>
            )}

          </div>

          {/* COLUMN 3: Economy News (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            
            {/* Economy Section Header */}
            <div className="flex items-center gap-2 border-b border-[#1e2a3a]/40 pb-1.5">
              <span className="text-base font-medium text-white tracking-tight">{t.economy || "Ekonomi Haberleri"}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            {loadingEconomyNews ? (
              <div className="py-24 text-center text-slate-500 text-sm font-medium">{t.loading}</div>
            ) : economyNews.length === 0 ? (
              <div className="py-24 text-center text-slate-500 text-sm">{t.noNews}</div>
            ) : (
              <div className="space-y-4">
                {economyNews.map((item, idx) => (
                  <a
                    key={idx}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-3.5 backdrop-blur-md shadow-xl flex flex-col justify-between hover:border-[#3b82f6]/40 transition-all duration-300"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[13px] text-[#64748b] font-medium mb-2">
                        <span className="text-[#3b82f6] uppercase tracking-widest">{item.source}</span>
                        <span>{new Date(item.pubDate).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { month: "short", day: "numeric" })}</span>
                      </div>
                      <h3 className="text-[14px] font-normal text-slate-200 group-hover:text-[#3b82f6] transition-colors leading-snug line-clamp-3">
                        {item.title}
                      </h3>
                    </div>

                    <div className="mt-2.5 pt-1.5 border-t border-[#1e2a3a]/20 flex items-center text-[13px] text-slate-500 group-hover:text-slate-300 transition-colors">
                      <span>{t.seeMore} →</span>
                    </div>
                  </a>
                ))}
              </div>
            )}

          </div>

        </div>

        {/* Standard Footer Copyright */}
        <div className="text-center mt-12 pt-4 border-t border-[#1e2a3a]/40 opacity-60">
          <p className="text-slate-500/60" style={{ fontSize: "11px", fontFamily: "Inter", fontWeight: 400 }}>
            {locale === "tr" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tüm Hakları Saklıdır." :
             locale === "en" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS All Rights Reserved." :
             locale === "es" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos los Derechos Reservados." :
             locale === "fr" ? "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tous Droits Réservés." :
             "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos os Direitos Reservados."}
          </p>
        </div>
      </main>
    </div>
  );
}

