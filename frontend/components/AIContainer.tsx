"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Header from "@/components/Header";
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
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

const POPULAR_TICKERS = [
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

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return <code key={i} className="text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    return part;
  });
}

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 leading-relaxed text-sm">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("### "))
          return <h3 key={i} className="text-xs font-black text-white uppercase tracking-widest mt-3 mb-1">{line.slice(4)}</h3>;
        if (line.startsWith("## "))
          return <h2 key={i} className="text-sm font-black text-[#3b82f6] mt-3 mb-1">{line.slice(3)}</h2>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-bold text-white">{line.slice(2, -2)}</p>;
        if (line.startsWith("- ") || line.startsWith("• "))
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
              <span className="text-[#3b82f6] shrink-0 font-bold">{num}.</span>
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

export default function AIContainer({ lang = "tr" }: { lang?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
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
    const stored = localStorage.getItem("boga-search-history");
    if (stored) setSearchHistory(JSON.parse(stored));
  }, []);

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

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    // Tek arama limiti kontrolü (Sadece giriş yapmamış misafirler için)
    if (typeof window !== "undefined") {
      const isLoggedIn = document.cookie.includes("boga_auth");
      if (!isLoggedIn) {
        const currentCount = parseInt(sessionStorage.getItem("boga_free_search_count") || "0");
        if (currentCount >= 1) {
          window.location.href = "/login";
          return;
        }
        sessionStorage.setItem("boga_free_search_count", "1");
      }
    }

    saveToHistory(msg);
    setInput("");
    setSidebarOpen(false);

    const newMessages: Message[] = [...messages, { role: "user", text: msg }];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
          lang: lang
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
          text: data.text ?? "Hata oluştu.",
          source: data.source,
          followUp: data.followUp || [],
          type: data.type,
          ticker: data.ticker,
          stockData: data.stockData,
          masterData: data.masterData,
        },
      ]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: "Bağlantı hatası." }]);
    } finally {
      setLoading(false);
    }
  };

  // Trigger AI Stock Analysis automatically if ticker is passed in URL query
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tickerParam = params.get("ticker");
      if (tickerParam && tickerParam.trim()) {
        send(tickerParam.trim().toUpperCase());
        // Clean URL parameter without page reload
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const newSession = () => {
    setMessages([]);
    setInput("");
    setSidebarOpen(false);
  };

  return (
    <div className="h-screen bg-[#080c14] text-white flex overflow-hidden">
      {/* SIDEBAR */}
      <div className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 absolute md:relative w-52 h-screen bg-[#0a0e17] border-r border-[#1e2a3a] flex flex-col transition-transform duration-300 z-40`}>
        <button onClick={newSession} className="m-3 px-3 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-xs font-black uppercase tracking-widest transition-colors">+ Yeni Oturum</button>
        
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-4">
          <div>
            <div className="text-[10px] font-black text-[#64748b] uppercase tracking-widest mb-3 flex items-center gap-1.5 px-2">
              <span>🕒</span> SON ARAMALAR
            </div>
            
            <div className="space-y-1">
              {searchHistory.length > 0 ? (
                searchHistory.slice(0, 15).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => send(item.query)}
                    className="w-full text-left text-xs px-3 py-2 rounded-lg hover:bg-[#1e2a3a] hover:text-[#3b82f6] transition-all text-slate-400 hover:text-white truncate font-medium flex items-center gap-2 border border-transparent hover:border-[#1e2a3a]/40"
                  >
                    <span className="text-[10px] text-slate-600">▪</span>
                    <span className="truncate">{item.query}</span>
                  </button>
                ))
              ) : (
                <div className="text-[10px] text-slate-500 italic px-2 py-4">
                  Arama geçmişi boş.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Header hideMenus={true} />
        <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 space-y-4 px-4 py-4 scrollbar-thin scrollbar-thumb-[#1e2a3a]">
          {messages.length === 0 && (
            <div className="space-y-8 mt-12 animate-fade-in max-w-2xl mx-auto w-full">
              <div className="text-center space-y-2">
                <div className="inline-flex items-center gap-3">
                  <BotIcon size="w-10 h-10" />
                  <h1 className="text-3xl font-black tracking-tighter text-white uppercase italic">
                    BOGA <span className="text-[#3b82f6]">FINANCE</span> AI
                  </h1>
                </div>
                <p className="text-[#64748b] text-xs font-bold uppercase tracking-[0.2em]">
                  ABD Borsaları Hisse Senetleri Analiz
                </p>
              </div>

              <div className="relative group">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Hisse senetleri hakkında sor..."
                  rows={1}
                  className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-[#3b82f6] transition-all resize-none pr-14 group-hover:border-[#3b82f6]/40 shadow-2xl shadow-blue-500/5"
                />
                <button onClick={() => send()} disabled={loading || !input.trim()} className="absolute right-3 top-3 p-2 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                </button>
              </div>

              {/* Popüler Hisse Senetleri */}
              <div className="space-y-4 pt-2">
                <div className="text-[10px] font-black text-[#475569] uppercase tracking-widest text-center">Popüler Hisse Senetleri</div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {POPULAR_TICKERS.map((item) => (
                    <button
                      key={item.ticker}
                      onClick={() => send(item.ticker)}
                      className="flex flex-col items-center justify-center p-3 rounded-xl border border-[#1e2a3a] bg-[#0a0e17]/60 hover:bg-[#0d1117] hover:border-[#3b82f6]/50 hover:shadow-lg hover:shadow-blue-500/5 transition-all text-center group"
                    >
                      <span className="text-xs font-black text-white tracking-wider group-hover:text-[#3b82f6] transition-colors">{item.ticker}</span>
                      <span className="text-[9px] text-[#64748b] font-bold mt-0.5 truncate max-w-full">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            if (m.role === "assistant" && m.type === "stock_report" && m.stockData) {
              return (
                <div key={i} className="flex flex-col gap-3 max-w-4xl mx-auto w-full animate-fade-in my-6">
                  <div className="flex gap-3 items-center">
                    <BotIcon />
                    <span className="text-xs font-black uppercase text-[#3b82f6] tracking-widest">BOGA AI ANALİZ RAPORU</span>
                  </div>
                  <StockReportView ticker={m.ticker!} stockData={m.stockData} masterData={m.masterData} />
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
        </div>

        <div className="px-4 py-4 shrink-0 border-t border-[#1e2a3a] bg-[#0a0e17]/80 backdrop-blur-md">
          <div className="max-w-4xl mx-auto w-full">
            {messages.length > 0 && (
              <div className="relative group mb-3">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey}
                  placeholder="Hisse senetleri hakkında sor..."
                  rows={1}
                  className="w-full bg-[#0d1117] border border-[#1e2a3a] rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-[#3b82f6] transition-all resize-none pr-14 group-hover:border-[#3b82f6]/40"
                  disabled={loading}
                />
                <button onClick={() => send()} disabled={!input.trim() || loading} className="absolute right-3 top-3 p-2 rounded-xl bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" /></svg>
                </button>
              </div>
            )}
            <div className="text-center space-y-1.5">
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed max-w-2xl mx-auto">
                ⚠️ <strong>Yasal Uyarı:</strong> BOGA Finance AI bir yatırım danışmanı değildir. Burası sadece bilgilendirme, eğitim ve teknik analiz sistemidir. Kesinlikle yatırım tavsiyesi vermez ve alım/satım yönlendirmesi yapmaz.
              </p>
              <p className="text-[9px] text-[#475569] font-bold tracking-widest uppercase">© 2026 BOGA AI - Blue One Global Analysis. Developed by AFK DaSYS.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
