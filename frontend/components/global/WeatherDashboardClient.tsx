"use client";

import { useState, useEffect } from "react";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

interface ForecastDay {
  date: string;
  max_temp_c: number;
  min_temp_c: number;
  max_temp_f: number;
  min_temp_f: number;
  condition: string;
  icon?: string;
}

interface WeatherData {
  status: string;
  location: string;
  current: {
    temperature_c: number;
    temperature_f: number;
    condition: string;
    icon?: string;
    wind_kph: number;
    wind_mph: number;
    humidity: number;
    feelslike_c: number;
    feelslike_f: number;
    pressure_mb: number;
    uv: number;
  };
  forecast?: ForecastDay[];
}

const I18N = {
  tr: {
    title: "Akıllı Hava Durumu Portalı",
    subtitle: "Detaylı bölgesel tahminler, hava analizi ve iklimsel yatırım sorguları.",
    searchCity: "Şehir Ara...",
    useLocation: "Konumumu Kullan",
    details: "Detaylı Ölçümler",
    humidity: "Nem Oranı",
    wind: "Rüzgar Hızı",
    feelsLike: "Hissedilen Sıcaklık",
    pressure: "Atmosfer Basıncı",
    uvIndex: "UV İndeksi",
    forecast: "3 Günlük Hava Tahmini",
    suggestedQueries: "Hava Durumu ve AI Pazar Analizi",
    clickPrompt: "Sohbet Başlatmak İçin Bir Sorguya Tıklayın",
    loading: "Yükleniyor...",
  },
  en: {
    title: "Smart Weather Portal",
    subtitle: "Detailed regional forecasts, climate insights, and weather market queries.",
    searchCity: "Search City...",
    useLocation: "Use My Location",
    details: "Detailed Measurements",
    humidity: "Humidity",
    wind: "Wind Speed",
    feelsLike: "Feels Like",
    pressure: "Pressure",
    uvIndex: "UV Index",
    forecast: "3-Day Forecast",
    suggestedQueries: "Weather & AI Market Analysis",
    clickPrompt: "Click a Query to Start Chat",
    loading: "Loading...",
  },
  es: {
    title: "Portal Meteorológico Inteligente",
    subtitle: "Pronósticos regionales detallados, análisis de clima y consultas de mercado.",
    searchCity: "Buscar Ciudad...",
    useLocation: "Usar mi ubicación",
    details: "Medidas Detalladas",
    humidity: "Humedad",
    wind: "Velocidad del Viento",
    feelsLike: "Sensación Térmica",
    pressure: "Presión",
    uvIndex: "Índice UV",
    forecast: "Pronóstico de 3 Días",
    suggestedQueries: "Clima y Análisis de Mercado IA",
    clickPrompt: "Haga clic en una consulta para iniciar el chat",
    loading: "Cargando...",
  },
  fr: {
    title: "Portail Météo Intelligent",
    subtitle: "Prévisions régionales détaillées, analyses de climat et requêtes de marché.",
    searchCity: "Rechercher...",
    useLocation: "Utiliser ma position",
    details: "Mesures Détaillées",
    humidity: "Humidité",
    wind: "Vitesse du Vent",
    feelsLike: "Température ressentie",
    pressure: "Pression",
    uvIndex: "Indice UV",
    forecast: "Prévisions sur 3 Jours",
    suggestedQueries: "Météo & Analyse de Marché par IA",
    clickPrompt: "Cliquez sur une question pour démarrer le chat",
    loading: "Chargement...",
  },
  pt: {
    title: "Portal de Clima Inteligente",
    subtitle: "Previsões regionais detalhadas, percepções climáticas e consultas de mercado.",
    searchCity: "Buscar Cidade...",
    useLocation: "Usar Minha Localização",
    details: "Medições Detalhadas",
    humidity: "Umidade",
    wind: "Velocidade do Vento",
    feelsLike: "Sensação Térmica",
    pressure: "Pressão Atmosférica",
    uvIndex: "Índice UV",
    forecast: "Previsão de 3 Dias",
    suggestedQueries: "Clima e Análise de Mercado de IA",
    clickPrompt: "Clique em uma pergunta para iniciar o chat",
    loading: "Carregando...",
  },
};

const DYNAMIC_PROMPTS = (city: string) => {
  const cleanCity = city.split(",")[0].trim();
  return {
    tr: [
      `Bugün ${cleanCity} şehrinde şemsiye taşımalı mıyım? Detaylı hava ve giyim analizi yap.`,
      `Önümüzdeki günlerde ${cleanCity} hava durumuna bağlı dış mekan etkinlik tavsiyeleri nelerdir?`,
      "Küresel sıcaklık dalgalarının tarım ve gıda hisseleri üzerindeki etkisi nedir?",
      "Şiddetli fırtına ve kasırgaların sigorta şirketleri üzerindeki mali baskısını analiz et."
    ],
    en: [
      `Should I carry an umbrella in ${cleanCity} today? Give me a clothing guide.`,
      `Outdoor activity recommendations based on the upcoming weather in ${cleanCity}?`,
      "What is the impact of global heatwaves on agricultural and food stock prices?",
      "Analyze the financial burden of severe storms and hurricanes on insurance companies."
    ],
    es: [
      `¿Debería llevar paraguas en ${cleanCity} hoy? Dame una guía meteorológica de vestimenta.`,
      `Recomendaciones de actividades al aire libre basadas en el pronóstico para ${cleanCity}?`,
      "¿Cuál es el impacto de las olas de calor globales en las acciones agrícolas y alimentarias?",
      "Analiza la carga financiera de tormentas severas y huracanes en las compañías de seguros."
    ],
    fr: [
      `Dois-je prendre un parapluie à ${cleanCity} aujourd'hui ? Donne-moi un guide vestimentaire.`,
      `Recommandations d'activités extérieures basées sur la météo à venir à ${cleanCity}?`,
      "Quel est l'impact des vagues de chaleur mondiales sur les actions agricoles et agroalimentaires?",
      "Analyse le coût financier des tempêtes majeures et ouragans pour les assureurs."
    ],
    pt: [
      `Preciso levar guarda-chuva em ${cleanCity} hoje? Dê-me uma sugestão de vestimenta.`,
      `Recomendações de atividades ao ar livre com base no clima futuro em ${cleanCity}?`,
      "Qual é o impacto das ondas de calor globais nas ações de agricultura e alimentação?",
      "Analise o impacto financeiro de tempestades e furacões nas seguradoras."
    ]
  };
};

export default function WeatherDashboardClient({ locale }: { locale: Locale }) {
  const t = I18N[locale];
  const [weatherCity, setWeatherCity] = useState("New York");
  const [cityInput, setCityInput] = useState("");
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  // Load favorite city from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("boga-weather-city");
    if (stored) {
      setWeatherCity(stored);
    }
  }, []);

  // Fetch weather data
  useEffect(() => {
    setLoading(true);
    fetch(`/api/copilot/weather?q=${encodeURIComponent(weatherCity)}&lang=${locale}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && data.status === "success") {
          setWeather(data);
        }
      })
      .catch((err) => console.error("Weather page fetch error:", err))
      .finally(() => setLoading(false));
  }, [weatherCity, locale]);

  const handleCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cityInput.trim()) {
      const city = cityInput.trim();
      setWeatherCity(city);
      setCityInput("");
      localStorage.setItem("boga-weather-city", city);
    }
  };

  const handleUseLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          const coords = `${lat.toFixed(4)},${lon.toFixed(4)}`;
          setWeatherCity(coords);
          localStorage.setItem("boga-weather-city", coords);
        },
        (error) => {
          console.error("Location error:", error);
          alert(
            locale === "tr"
              ? "Konum bilgisi alınamadı. İzinleri kontrol edin."
              : "Could not retrieve location. Check permissions."
          );
        }
      );
    }
  };

  const isImperial = locale === "en" || 
    (weather?.location && 
      (weather.location.toLowerCase().includes("usa") || 
       weather.location.toLowerCase().includes("united states") || 
       weather.location.toLowerCase().includes("united kingdom") || 
       weather.location.toLowerCase().includes("new york") || 
       weather.location.toLowerCase().includes("london")));

  const resolvedCityName = weather ? weather.location.split(",")[0].trim() : weatherCity;
  const prompts = DYNAMIC_PROMPTS(resolvedCityName)[locale];

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100 font-sans pb-12">
      <SearchLandingHeader locale={locale} onLogoClick={() => window.location.href = `/global/${locale}/search`} />
      
      <main className="max-w-[1200px] mx-auto px-4 md:px-6 mt-6">
        {/* Banner */}
        <div className="bg-gradient-to-r from-blue-900/25 to-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-2xl p-6 mb-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">{t.title}</h1>
              <p className="text-[14px] text-slate-400 mt-1 max-w-2xl">{t.subtitle}</p>
            </div>

            {/* City Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleUseLocation}
                title={t.useLocation}
                className="p-2 rounded-lg bg-[#141b2b] border border-[#1e2a3a]/80 hover:border-blue-500/40 text-slate-400 hover:text-white transition-all flex items-center justify-center shrink-0"
              >
                <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              </button>

              <form onSubmit={handleCitySubmit} className="relative flex items-center">
                <input
                  type="text"
                  value={cityInput}
                  onChange={(e) => setCityInput(e.target.value)}
                  placeholder={t.searchCity}
                  className="bg-[#141b2b] text-[13px] px-3 py-2 pr-8 rounded-lg border border-[#1e2a3a]/80 focus:border-[#3b82f6]/60 focus:outline-none text-slate-100 placeholder-slate-500 transition-all w-36 sm:w-44"
                />
                <button type="submit" className="absolute right-2.5 text-slate-500 hover:text-white">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left panel: Weather Dashboard */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-5 shadow-xl backdrop-blur-md relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl" />

              {loading ? (
                <div className="py-12 text-center text-[13px] text-slate-500">{t.loading}</div>
              ) : weather ? (
                <div className="space-y-4">
                  {/* Current Temp */}
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-lg font-semibold text-white truncate max-w-[200px]">{weather.location}</h2>
                      <p className="text-[13px] text-slate-400 capitalize mt-0.5">{weather.current.condition}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      {weather.current.icon && (
                        <img src={weather.current.icon} alt="" className="w-12 h-12 object-contain" />
                      )}
                      <span className="text-3xl md:text-4xl font-extrabold text-white tracking-tighter">
                        {isImperial ? weather.current.temperature_f : weather.current.temperature_c}°
                      </span>
                    </div>
                  </div>

                  {/* Weather details list */}
                  <div className="border-t border-[#1e2a3a]/40 pt-4 space-y-2 text-[13px] text-slate-400">
                    <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{t.details}</div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>{t.feelsLike}: <span className="text-white font-medium">{isImperial ? weather.current.feelslike_f : weather.current.feelslike_c}°</span></div>
                      <div>{t.humidity}: <span className="text-white font-medium">{weather.current.humidity}%</span></div>
                      <div>{t.wind}: <span className="text-white font-medium">{isImperial ? `${weather.current.wind_mph} mph` : `${weather.current.wind_kph} km/h`}</span></div>
                      <div>{t.pressure}: <span className="text-white font-medium">{weather.current.pressure_mb} mb</span></div>
                    </div>
                  </div>

                  {/* Forecast list */}
                  {weather.forecast && weather.forecast.length > 0 && (
                    <div className="border-t border-[#1e2a3a]/40 pt-4 space-y-2.5">
                      <div className="text-xs font-semibold text-[#64748b] uppercase tracking-widest">{t.forecast}</div>
                      {weather.forecast.map((f, i) => {
                        const dayName = new Date(f.date).toLocaleDateString(locale === "tr" ? "tr-TR" : "en-US", { weekday: "long" });
                        return (
                          <div key={i} className="flex justify-between items-center text-[13px]">
                            <span className="w-20 text-slate-400 font-medium capitalize">{dayName}</span>
                            <div className="flex items-center gap-1.5 flex-1 px-3">
                              {f.icon && <img src={f.icon} alt="" className="w-5 h-5 object-contain" />}
                              <span className="text-slate-400 truncate max-w-[120px]">{f.condition}</span>
                            </div>
                            <span className="text-white font-medium">
                              {isImperial ? f.max_temp_f : f.max_temp_c}° <span className="text-slate-500 font-normal">/ {isImperial ? f.min_temp_f : f.min_temp_c}°</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right panel: Climate Queries */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="text-[13px] font-semibold text-[#64748b] uppercase tracking-widest flex items-center gap-1.5 border-b border-[#1e2a3a]/40 pb-2">
              <span>💡</span> {t.suggestedQueries}
            </h2>
            <p className="text-[11px] text-slate-500">{t.clickPrompt}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prompts.map((prompt, idx) => (
                <Link
                  key={idx}
                  href={`/global/${locale}/search?q=${encodeURIComponent(prompt)}`}
                  className="block text-left bg-[#0b101b]/70 hover:bg-[#141b2b] border border-[#1e2a3a]/60 hover:border-blue-500/40 rounded-xl p-4 shadow-md hover:shadow-lg transition-all duration-300 group cursor-pointer"
                >
                  <p className="text-[13px] font-normal text-slate-200 group-hover:text-blue-400 transition-colors leading-relaxed">
                    {prompt}
                  </p>
                  <span className="inline-block text-[11px] text-blue-500/60 group-hover:text-blue-400 transition-colors mt-3">
                    Ask AI & Analyze →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Standard Footer Copyright */}
        <div className="text-center mt-12 pt-4 border-t border-[#1e2a3a]/40 opacity-60">
          <p className="text-[11px] text-[#475569] font-normal tracking-widest uppercase">
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
