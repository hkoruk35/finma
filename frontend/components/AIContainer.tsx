"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import MemberHeader from "@/components/public/MemberHeader";
import SearchLandingHeader from "@/components/public/SearchLandingHeader";
import SearchLandingEmptyState from "@/components/public/SearchLandingEmptyState";
import StockReportView from "@/components/StockReportView";

interface Message {
  role: "user" | "assistant";
  text: string;
  source?: "claude" | "gemini";
  followUp?: string[];
  type?: "stock_report";
  ticker?: string;
  stockData?: any;
  masterData?: any;
  autoDeep?: boolean;
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

const TEXTS: Record<string, { tr: string; en: string; es: string; fr: string; pt: string }> = {
  newSearch:      { tr: "+ Yeni Arama",   en: "+ New Search", es: "+ Nueva Búsqueda", fr: "+ Nouvelle Recherche", pt: "+ Nova Busca" },
  computer:       { tr: "Bilgisayar",     en: "Computer", es: "Computadora", fr: "Ordinateur", pt: "Computador" },
  searchChats:    { tr: "Sohbetlerde Ara", en: "Search Chats", es: "Buscar Chats", fr: "Rechercher les Chats", pt: "Pesquisar Chats" },
  recentSearches: { tr: "SON ARAMALAR",   en: "RECENT SEARCHES", es: "BÚSQUEDAS RECIENTES", fr: "RECHERCHES RÉCENTES", pt: "BUSCAS RECENTES" },
  emptyHistory:   { tr: "Arama geçmişi boş.", en: "No search history yet.", es: "Aún no hay historial de búsqueda.", fr: "Aucun historique de recherche pour le momento.", pt: "Ainda não há histórico de busca." },
  placeholder:    { tr: "Sorunuzu yazın veya araştırma yapın...", en: "Ask a question or search...", es: "Haz una pregunta o busca...", fr: "Posez une question ou recherchez...", pt: "Faça uma pergunta ou pesquise..." },
  popularStocks:  { tr: "Popüler Hisse Senetleri", en: "Popular Stocks", es: "Acciones Populares", fr: "Actions Populaires", pt: "Ações Populares" },
  archiveLink:    { tr: "🗂️ Derin Analiz Arşivi", en: "🗂️ Deep Analysis Archive", es: "🗂️ Archivo de Análisis Profundo", fr: "🗂️ Archive d'Analyse Approfondie", pt: "🗂️ Arquivo de Análise Profunda" },
  legalDisclaimerLabel: { tr: "Yasal Uyarı:", en: "Disclaimer:", es: "Aviso Legal:", fr: "Avertissement:", pt: "Aviso Legal:" },
  legalDisclaimerBody:  { tr: "BogaSmart bir yatırım danışmanı değildir. Burası sadece bilgilendirme, eğitim ve teknik analiz sistemidir. Kesinlikle yatırım tavsiyesi vermez ve alım/satım yönlendirmesi yapmaz.", en: "BogaSmart is not an investment advisor. This is an informational, educational, and technical analysis system only. It does not provide investment advice or buy/sell recommendations.", es: "BogaSmart no es un asesor de inversiones. Este es un sistema de información, educación y análisis técnico solamente. No proporciona asesoramiento de inversión ni recomendaciones de compra/venta.", fr: "BogaSmart n'est pas un conseiller en investissement. Ceci est un système informatif, éducatif et d'analyse technique uniquement. Il ne fournit pas de conseils d'investissement ni de recommandations d'achat/vente.", pt: "BogaSmart não é uma consultora de investimentos. Este é apenas um sistema informativo, educacional e de análise técnica. Não fornece aconselhamento de investimento nem recomendações de compra/venda." },
  copyright:      { tr: "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tüm Hakları Saklıdır.", en: "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS All Rights Reserved.", es: "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos los Derechos Reservados.", fr: "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Tous Droits Réservés.", pt: "© Blue One Global Analysis. 2021- 2026 BogaSmart - Powered by AFK DaSYS Todos os Direitos Reservados." },
  navAsk:         { tr: "Sor", en: "Ask", es: "Preguntar", fr: "Demander", pt: "Perguntar" },
  navDiscover:    { tr: "Keşfet", en: "Discover", es: "Descubrir", fr: "Découvrir", pt: "Descobrir" },
  navMoney:       { tr: "Para", en: "Money", es: "Dinero", fr: "Argent", pt: "Dinheiro" },
  navSports:      { tr: "Spor", en: "Sports", es: "Deportes", fr: "Sports", pt: "Esportes" },
  navWeather:     { tr: "Hava", en: "Weather", es: "Clima", fr: "Météo", pt: "Clima" },
  analysisReport: { tr: "BogaSmart ANALİZ RAPORU", en: "BogaSmart ANALYSIS REPORT", es: "INFORME DE ANÁLISIS BogaSmart", fr: "RAPPORT D'ANALYSE BogaSmart", pt: "RELATÓRIO DE ANÁLISE BogaSmart" },
  connectionError:{ tr: "Bağlantı hatası.", en: "Connection error.", es: "Error de conexión.", fr: "Erreur de connexion.", pt: "Erro de conexão." },
  genericError:   { tr: "Hata oluştu.", en: "An error occurred.", es: "Ocurrió un error.", fr: "Une erreur s'est produite.", pt: "Ocorreu um erro." },
  recentTitle:    { tr: "Son Aramalar", en: "Recent Searches", es: "Búsquedas Recientes", fr: "Recherches Récentes", pt: "Buscas Recentes" },
  analyzingTitle: { tr: "BogaSmart tarafından güncel analiz yapılıyor", en: "BogaSmart is performing the latest analysis", es: "BogaSmart está realizando el análisis más reciente", fr: "BogaSmart effectue l'analyse la plus récente", pt: "BogaSmart está realizando a análise mais recente" },
  analyzingBody:  { tr: "Lütfen bekleyin, derin analiz raporu hazırlanıyor...", en: "Please wait, the deep analysis report is being prepared...", es: "Por favor espere, se está preparando el informe de análisis profundo...", fr: "Veuillez patienter, le rapport d'analyse approfondie est en cours de préparation...", pt: "Aguarde, o relatório de análise profunda está sendo preparado..." },
};

export const POPULAR_TICKERS = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "NVDA", name: "Nvidia" },
  { ticker: "GOOGL", name: "Google" },
  { ticker: "MSFT", name: "Microsoft" },
  { ticker: "AMD", name: "AMD" },
  { ticker: "META", name: "Meta" },
  { ticker: "TSLA", name: "Tesla" },
  { ticker: "AMZN", name: "Amazon" },
  { ticker: "NFLX", name: "Netflix" },
  { ticker: "AVGO", name: "Broadcom" },
  { ticker: "LLY", name: "Eli Lilly" },
  { ticker: "PLTR", name: "Palantir" }
];

function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**"))
          return <strong key={i} className="text-white font-medium">{formatInline(part.slice(2, -2))}</strong>;
        if (part.startsWith("`") && part.endsWith("`"))
          return <code key={i} className="text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded text-[14px] font-mono">{part.slice(1, -1)}</code>;
        if (part.startsWith("[") && part.endsWith(")")) {
          const match = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
          if (match) {
            const label = match[1];
            const url = match[2];

            if (url === "?q=followup") {
              return (
                <button
                  key={i}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("trigger_text_query", { detail: label }));
                  }}
                  className="inline-flex items-center px-3 py-1.5 mt-2 mr-2 bg-[#1e2a3a]/60 hover:bg-[#3b82f6]/20 border border-[#1e2a3a] hover:border-[#3b82f6]/50 rounded-lg text-[#cbd5e1] hover:text-white text-sm font-medium transition-all shadow-sm group"
                >
                  <span className="text-[#3b82f6] mr-2 opacity-70 group-hover:opacity-100">💡</span>
                  {label}
                </button>
              );
            }

            if (url.toLowerCase().startsWith("/ai?ticker=")) {
              const ticker = url.split("=")[1];
              return (
                <button
                  key={i}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent("trigger_ticker_query", { detail: ticker }));
                  }}
                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-[#3b82f6]/20 hover:bg-[#3b82f6]/40 border border-[#3b82f6]/40 hover:border-[#3b82f6] text-[#3b82f6] hover:text-white rounded text-[11px] font-medium uppercase tracking-wider transition-all cursor-pointer align-baseline"
                >
                  {label}
                </button>
              );
            }
            return (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-[#3b82f6] hover:underline font-medium">
                {label}
              </a>
            );
          }
        }
        return part;
      })}
    </>
  );
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("# "))
          return <h1 key={i} className="text-base font-medium text-white uppercase tracking-wider mt-4 mb-2">{line.slice(2)}</h1>;
        if (line.startsWith("### "))
          return <h3 key={i} className="text-[14px] font-medium text-white uppercase tracking-widest mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-sm font-medium text-[#3b82f6] mt-3 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-medium text-white">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• ") || line.startsWith("* "))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#3b82f6] mt-0.5 shrink-0">•</span>
              <span className="text-[#cbd5e1]">{formatInline(line.slice(2))}</span>
            </div>
          );
        if (/^\d+\.\s/.test(line)) {
          const num = line.match(/^(\d+)\./)?.[1];
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#3b82f6] shrink-0 font-medium">{num}.</span>
              <span className="text-[#cbd5e1]">{formatInline(line.replace(/^\d+\.\s/, ""))}</span>
            </div>
          );
        }
        if (line.trim() === "") return <div key={i} className="h-1" />;
        return <p key={i} className="text-[#cbd5e1]">{formatInline(line)}</p>;
      })}
    </div>
  );
}

const BotIcon = ({ size = "w-7 h-7" }: { size?: string }) => (
  <div className={`${size} rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20`}>
    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  </div>
);

export default function AIContainer({ lang = "tr", locale, variant = "classic" }: { lang?: string; locale?: "tr" | "en" | "es" | "fr" | "pt"; variant?: "classic" | "landing" }) {
  const pathname = usePathname();
  const t = (key: keyof typeof TEXTS) => TEXTS[key][(lang === "en" ? "en" : lang === "es" ? "es" : lang === "fr" ? "fr" : lang === "pt" ? "pt" : "tr")];
  // When `locale` is set, this is a /global/{locale}/ai page: confine the user to the
  // /global member area (no Screener/Terminal/Option links, no root logout) and always
  // jump straight to Deep Analysis instead of the standard report.
  const isGlobal = !!locale;
  const homeHref = locale === "es" ? "/global/es/home" : locale === "en" ? "/global/en/home" : locale === "fr" ? "/global/fr/home" : locale === "pt" ? "/global/pt/home" : "/global/tr/home";
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Shown instead of the empty landing page while a ticker passed via URL
  // (e.g. an "Analiz" button on Home/Performance) is being fetched.
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoTicker, setAutoTicker] = useState("");
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bogaPicks, setBogaPicks] = useState<{ breakout: string[]; momentum: string[]; value: string[]; reversal: string[]; date: string }>({ breakout: [], momentum: [], value: [], reversal: [], date: "" });
  const [activeCategory, setActiveCategory] = useState<"breakout" | "momentum" | "value" | "reversal">("breakout");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/picks").then(r => r.json()).then(d => { if (d.breakout) setBogaPicks(d); }).catch(() => {});
  }, []);

  useEffect(() => {
    const storedHistory = localStorage.getItem("boga-search-history");
    if (storedHistory) setSearchHistory(JSON.parse(storedHistory));

    const storedChat = localStorage.getItem("boga-chat-messages");
    if (storedChat) {
      try {
        setMessages(JSON.parse(storedChat));
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("boga-chat-messages", JSON.stringify(messages));
    } else {
      localStorage.removeItem("boga-chat-messages");
    }
  }, [messages]);

  const saveToHistory = (query: string) => {
    if (!query.trim()) return;
    // Keep unique and newest first
    const filtered = searchHistory.filter(h => h.query.toLowerCase() !== query.toLowerCase());
    const updated = [{ query, timestamp: Date.now() }, ...filtered].slice(0, 15);
    setSearchHistory(updated);
    localStorage.setItem("boga-search-history", JSON.stringify(updated));
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0 || loading) scrollToBottom();
  }, [messages, loading]);

  const send = async (text?: string, autoDeep?: boolean) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    // Inside /global pages every ticker search jumps straight to Deep Analysis —
    // the user should never see the intermediate standard report.
    const effectiveAutoDeep = isGlobal || !!autoDeep;



    saveToHistory(msg);
    setInput("");
    setSidebarOpen(false);

    const newMessages: Message[] = [...messages, { role: "user", text: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ask-copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.map((m) => ({ role: m.role, content: m.text })),
          locale: lang
        }),
      });

      if (res.status === 429) {
          const limitMsg = lang === "tr" ? "Limit doldu." : "Limit exceeded.";
          setMessages([...newMessages, { role: "assistant", text: limitMsg }]);
          return;
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          text: data.text ?? t("genericError"),
          source: data.source,
          followUp: data.followUp || [],
          type: data.type,
          ticker: data.ticker,
          stockData: data.stockData,
          masterData: data.masterData,
          autoDeep: effectiveAutoDeep && data.type === "stock_report",
        },
      ]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: t("connectionError") }]);
    } finally {
      setLoading(false);
      setAutoLoading(false);
    }
  };

  // Trigger AI Stock Analysis automatically if ticker is passed in URL query.
  // ?deep=1 (set by global page "Analiz" buttons) opens Deep Analysis directly instead
  // of the standard report. Show a dedicated loading screen instead of the empty
  // landing page while this initial fetch is in flight.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tickerParam = params.get("ticker");
      const qParam = params.get("q");
      const deepParam = params.get("deep") === "1";
      if (tickerParam && tickerParam.trim()) {
        const upper = tickerParam.trim().toUpperCase();
        setAutoTicker(upper);
        setAutoLoading(true);
        send(upper, deepParam);
        // Clean URL parameter without page reload
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (qParam && qParam.trim()) {
        send(qParam.trim());
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  // Listen for global query reset event
  useEffect(() => {
    const handleReset = () => newSession();
    window.addEventListener("start_new_query", handleReset);
    return () => window.removeEventListener("start_new_query", handleReset);
  }, []);

  // Keep a ref to the latest send function to avoid stale closures in event listeners
  const sendRef = useRef(send);
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  // Listen for custom inline ticker click event
  useEffect(() => {
    const handleTickerClick = (e: Event) => {
      const ticker = (e as CustomEvent).detail;
      if (ticker) {
        sendRef.current(ticker.toUpperCase());
      }
    };
    window.addEventListener("trigger_ticker_query", handleTickerClick);
    return () => window.removeEventListener("trigger_ticker_query", handleTickerClick);
  }, []);

  // Listen for text query from follow-up links
  useEffect(() => {
    const handleTextQuery = (e: Event) => {
      const query = (e as CustomEvent).detail;
      if (query) {
        sendRef.current(query);
      }
    };
    window.addEventListener("trigger_text_query", handleTextQuery);
    return () => window.removeEventListener("trigger_text_query", handleTextQuery);
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const newSession = () => {
    setMessages([]);
    localStorage.removeItem("boga-chat-messages");
    if (window.innerWidth < 768) setSidebarOpen(false);
  };

  return (
    <div className="h-[100dvh] md:h-screen w-full max-w-full bg-[#080c14] text-white flex overflow-hidden relative">
      {/* SIDEBAR BACKDROP ON MOBILE */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="md:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-30 transition-all duration-300 animate-fade-in"
        />
      )}

      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 absolute md:relative w-56 h-[100dvh] md:h-screen bg-[#0a0e17] border-r border-[#1e2a3a] flex flex-col transition-transform duration-300 z-40`}>
        <div className="flex items-center justify-between p-3 border-b border-[#1e2a3a]/40 md:border-b-0">
          <button onClick={newSession} className="flex-1 px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-[14px] font-medium uppercase tracking-widest transition-colors">{t("newSearch")}</button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden ml-2 p-2 rounded-lg border border-[#1e2a3a] hover:bg-[#1e2a3a] text-[#E8E8E8] hover:text-white transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          <div>
            <div className="text-[14px] font-medium text-[#E8E8E8] uppercase tracking-widest mb-3 flex items-center gap-1.5 px-2">
              <span>📺</span> {
                locale === "tr" ? "KANALLAR" :
                locale === "es" ? "CANALES" :
                locale === "fr" ? "CHAÎNES" :
                locale === "pt" ? "CANAIS" :
                "CHANNELS"
              }
            </div>
            <div className="space-y-1">
              {/* Ask */}
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  newSession();
                  window.location.href = `/global/${locale}/search`;
                }}
                className={`w-full text-left text-[14px] px-3 py-2 rounded-lg transition-all truncate font-medium flex items-center gap-2 border border-transparent ${
                  pathname?.endsWith("/search") ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20" : "text-[#E8E8E8] hover:text-white hover:bg-[#1e2a3a] hover:border-[#1e2a3a]/40"
                }`}
              >
                <span className="text-[14px]">💬</span>
                <span>{t("navAsk")}</span>
              </button>

              {/* Discover */}
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  window.location.href = `/global/${locale}/discover`;
                }}
                className={`w-full text-left text-[14px] px-3 py-2 rounded-lg transition-all truncate font-medium flex items-center gap-2 border border-transparent ${
                  pathname?.endsWith("/discover") ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20" : "text-[#E8E8E8] hover:text-white hover:bg-[#1e2a3a] hover:border-[#1e2a3a]/40"
                }`}
              >
                <span className="text-[14px]">🧭</span>
                <span>{t("navDiscover")}</span>
              </button>

              {/* Money */}
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  window.location.href = `https://bogastock.com/global/en/home`;
                }}
                className="w-full text-left text-[14px] px-3 py-2 rounded-lg text-[#E8E8E8] hover:text-white hover:bg-[#1e2a3a] hover:border-[#1e2a3a]/40 transition-all truncate font-medium flex items-center gap-2 border border-transparent"
              >
                <span className="text-[14px]">📈</span>
                <span>{t("navMoney")}</span>
              </button>

              {/* Sports */}
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  window.location.href = `/global/${locale}/sports`;
                }}
                className={`w-full text-left text-[14px] px-3 py-2 rounded-lg transition-all truncate font-medium flex items-center gap-2 border border-transparent ${
                  pathname?.endsWith("/sports") ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20" : "text-[#E8E8E8] hover:text-white hover:bg-[#1e2a3a] hover:border-[#1e2a3a]/40"
                }`}
              >
                <span className="text-[14px]">🏀</span>
                <span>{t("navSports")}</span>
              </button>

              {/* Weather */}
              <button
                onClick={() => {
                  setSidebarOpen(false);
                  window.location.href = `/global/${locale}/weather`;
                }}
                className={`w-full text-left text-[14px] px-3 py-2 rounded-lg transition-all truncate font-medium flex items-center gap-2 border border-transparent ${
                  pathname?.endsWith("/weather") ? "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20" : "text-[#E8E8E8] hover:text-white hover:bg-[#1e2a3a] hover:border-[#1e2a3a]/40"
                }`}
              >
                <span className="text-[14px]">🌤️</span>
                <span>{t("navWeather")}</span>
              </button>
            </div>
          </div>

          <div>
            <div className="text-[14px] font-medium text-[#E8E8E8] uppercase tracking-widest mb-3 flex items-center gap-1.5 px-2">
              <span>🕒</span> {t("recentSearches")}
            </div>

            <div className="space-y-1">
              {searchHistory.length > 0 ? (
                searchHistory.slice(0, 15).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => send(item.query)}
                    className="w-full text-left text-[14px] px-3 py-2 rounded-lg hover:bg-[#1e2a3a] hover:text-[#3b82f6] transition-all text-[#E8E8E8] hover:text-white truncate font-medium flex items-center gap-2 border border-transparent hover:border-[#1e2a3a]/40"
                  >
                    <span className="text-[14px] text-slate-600">▪</span>
                    <span className="truncate">{item.query}</span>
                  </button>
                ))
              ) : (
                <div className="text-[14px] text-slate-500 italic px-2 py-4">
                  {t("emptyHistory")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {variant === "landing" ? (
          <SearchLandingHeader locale={locale!} onLogoClick={newSession} />
        ) : isGlobal ? (
          <MemberHeader locale={locale!} />
        ) : (
          <Header hideMenus={false} onLogoClick={newSession} onNewQueryClick={messages.length > 0 ? newSession : undefined} />
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 space-y-4 px-4 py-4 scrollbar-thin scrollbar-thumb-[#1e2a3a]">
          {autoLoading && (
            <div className="flex flex-col items-center justify-center gap-4 mt-32 animate-fade-in text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#06b6d4] flex items-center justify-center animate-pulse">
                <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
              </div>
              <div>
                <p className="text-white font-medium text-sm md:text-base uppercase tracking-widest">
                  {autoTicker ? `${autoTicker} — ${t("analyzingTitle")}` : t("analyzingTitle")}
                </p>
                <p className="text-[#06b6d4] text-[14px] mt-1.5 font-medium">{t("analyzingBody")}</p>
              </div>
              <div className="flex gap-1.5">{[0, 150, 300].map(d => <span key={d} className="w-2 h-2 rounded-full bg-[#3b82f6] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
            </div>
          )}
          {!autoLoading && messages.length === 0 && (
            variant === "landing" ? (
              <SearchLandingEmptyState
                locale={locale!}
                lang={lang}
                input={input}
                setInput={setInput}
                inputRef={inputRef}
                loading={loading}
                onSend={send}
              />
            ) : (
            <div className="space-y-8 mt-24 animate-fade-in max-w-2xl mx-auto w-full">
              <div className="relative group">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={t("placeholder")}
                  rows={1}
                  className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-2xl pl-5 pr-16 py-4 text-[13px] md:text-sm focus:outline-none focus:border-[#3b82f6] transition-all resize-none group-hover:border-[#3b82f6]/40 shadow-2xl shadow-blue-500/5"
                />
                <button onClick={() => send()} disabled={loading || !input.trim()} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>

              {/* Popüler Hisse Senetleri */}
              <div className="space-y-4 pt-2">
                <div className="text-[14px] font-medium text-[#475569] uppercase tracking-widest text-center">{t("popularStocks")}</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {POPULAR_TICKERS.map((item) => (
                    <button
                      key={item.ticker}
                      onClick={() => send(item.ticker)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#1e2a3a] bg-[#0a0e17]/60 hover:bg-[#0d1117] hover:border-[#3b82f6]/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-center group"
                    >
                      <span className="text-[14px] font-medium text-white tracking-wider group-hover:text-[#3b82f6] transition-colors">{item.ticker}</span>
                      <span className="text-[9px] text-[#E8E8E8] font-medium mt-0.5 truncate max-w-full">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Arşiv linki */}
              <div className="text-center pt-4">
                <a href="/admin/ai/archive" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[#1e3a5f]/60 bg-[#0d1321]/60 text-[#06b6d4] hover:border-[#06b6d4]/40 hover:bg-[#06b6d4]/10 transition-all text-[11px] font-medium uppercase tracking-widest">
                  {t("archiveLink")}
                </a>
              </div>

              {/* Yasal Uyari & Telif kaldirildi */}
            </div>
            )
          )}

          {messages.map((m, i) => {
            if (m.role === "assistant" && m.type === "stock_report" && m.stockData) {
              return (
                <div key={i} className="flex flex-col gap-3 max-w-4xl mx-auto w-full animate-fade-in my-6">
                  <div className="flex gap-3 items-center">
                    <BotIcon />
                    <span className="text-[14px] font-medium uppercase text-[#3b82f6] tracking-widest">{t("analysisReport")}</span>
                  </div>
                  <StockReportView ticker={m.ticker!} stockData={m.stockData} masterData={m.masterData} lang={lang === "en" ? "en" : "tr"} autoOpenDeepAnalysis={m.autoDeep} homeHref={isGlobal ? homeHref : undefined} />
                </div>
              );
            }
            return (
              <div key={i} className={`flex gap-3 max-w-4xl mx-auto w-full ${m.role === "user" ? "justify-end" : "justify-start animate-fade-in"}`}>
                {m.role === "assistant" && <BotIcon />}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-[#1d4ed8] text-white shadow-lg shadow-blue-500/10" : "bg-[#0d1117] border border-[#1e2a3a]"}`}>
                  {m.role === "assistant" ? (
                    <div className="space-y-3">
                      <MarkdownText text={m.text} />
                    </div>
                  ) : (
                    <p className="text-sm">{m.text}</p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex gap-3 justify-start animate-pulse max-w-4xl mx-auto w-full">
              <BotIcon />
              <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          {/* Yasal Uyari & Telif kaldirildi */}
        </div>

        <div className="px-4 py-1.5 md:py-2 shrink-0 border-t border-[#1e2a3a]/40 bg-[#080c14]/90">
          <div className="max-w-4xl mx-auto w-full">
            {messages.length > 0 && (
              <div className="relative group">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder={t("placeholder")}
                  rows={1}
                  className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-2xl pl-5 pr-16 py-4 text-[13px] md:text-sm focus:outline-none focus:border-[#3b82f6] transition-all resize-none group-hover:border-[#3b82f6]/40"
                  disabled={loading}
                />
                <button onClick={() => send()} disabled={!input.trim() || loading} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
            <div className="text-center mt-1 mb-0.5 opacity-60">
              <p className="text-[#475569]" style={{ fontSize: "9px", fontFamily: "Inter", fontWeight: 400 }}>{t("copyright")}</p>
            </div>
          </div>
        </div>
      </div>
      {/* FLOATING ACTION BUTTON FOR MOBILE SIDEBAR */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="md:hidden fixed bottom-6 right-6 z-50 p-4 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#1d4ed8] text-white shadow-2xl shadow-blue-500/35 hover:scale-105 active:scale-95 transition-all flex items-center justify-center border border-white/10"
        title={t("recentTitle")}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          )}
        </svg>
      </button>
    </div>
  );
}


