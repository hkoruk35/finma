"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Message {
  role: "user" | "assistant";
  text: string;
  source?: "claude" | "gemini";
  followUp?: string[];
}

interface SearchHistory {
  query: string;
  timestamp: number;
}

const SLASH_COMMANDS = [
  { cmd: "Magnificent 7", desc: "AAPL, NVDA, MSFT, AMZN, GOOGL, META, TSLA Analizi", example: "/swing" },
  { cmd: "Sector Analysis", desc: "Sektörlerin genel durumu ve para akışı", example: "/analiz" },
  { cmd: "TOP5", desc: "Günün en iyi 5 swing trade hisse seçimi", example: "/top5" },
];

const TRENDING_SEARCHES = [
  "NVDA technical analysis",
  "EMA200 strategy",
  "Magnificent 7 overview",
  "Gold price analysis",
  "Options Greeks explained",
  "SPY support levels",
  "Sector Rotation today",
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  </div>
);

export default function AIContainer({ lang = "tr" }: { lang?: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistory[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load search history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("boga-search-history");
    if (stored) setSearchHistory(JSON.parse(stored));
  }, []);

  // Save to search history
  const saveToHistory = (query: string) => {
    const updated = [{ query, timestamp: Date.now() }, ...searchHistory].slice(0, 10);
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

  const handleInputChange = (val: string) => {
    setInput(val);
    setShowCommands(val.startsWith("/") && val.length <= 10);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    saveToHistory(msg);
    setInput("");
    setShowCommands(false);
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
          const limitMsg = lang === "tr" 
            ? "Limitiniz doldu, daha sonra tekrar deneyiniz." 
            : "Token limit exceeded, please try again later.";
          
          setMessages([
            ...newMessages,
            { role: "assistant", text: limitMsg }
          ]);
          return;
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          text: data.text ?? "Unable to generate response.",
          source: data.source,
          followUp: data.followUp || [],
        },
      ]);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          text: "Bağlantı hatası. Lütfen tekrar deneyin.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

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
    scrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <div className="h-screen bg-[#080c14] text-white flex overflow-hidden">
      {/* SIDEBAR */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 absolute md:relative w-64 h-screen bg-[#0a0e17] border-r border-[#1e2a3a] flex flex-col transition-transform duration-300 z-40`}
      >
        <button
          onClick={newSession}
          className="m-4 px-4 py-2 bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg text-xs font-black uppercase tracking-widest transition-colors"
        >
          + Yeni Oturum
        </button>

        <div className="flex-1 overflow-y-auto px-3">
          <div className="text-[10px] font-black text-[#64748b] uppercase tracking-widest mb-2 mt-2">Hisse Senedi</div>
          <div className="space-y-1">
            {searchHistory.length > 0 ? (
              searchHistory.map((item, i) => (
                <button
                  key={i}
                  onClick={() => send(item.query)}
                  className="w-full text-left text-xs p-2 rounded hover:bg-[#1e2a3a] transition-colors text-[#cbd5e1] truncate"
                >
                  {item.query.slice(0, 30)}
                </button>
              ))
            ) : (
              <div className="p-2 text-[10px] text-[#475569] italic">Son arama yok</div>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <Header />

        <div className="flex-1 flex flex-col min-h-0 max-w-4xl w-full mx-auto px-4 pt-4 pb-4">
          <div className="mb-4 text-center shrink-0">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 mb-1">
                <BotIcon size="w-8 h-8" />
                <h1 className="text-2xl font-black tracking-tight text-white">BOGA AI</h1>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-full">BETA</span>
              </div>
              <p className="text-[#3b82f6] text-[10px] font-black uppercase tracking-[0.2em] mb-0.5">Test ve Geliştirme Aşaması</p>
              <p className="text-[#64748b] text-[10px] font-black uppercase tracking-[0.2em]">50'den fazla dil desteği</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto min-h-0 space-y-4 pr-1 pb-2 scrollbar-thin scrollbar-thumb-[#1e2a3a]">
            {messages.length === 0 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {SLASH_COMMANDS.map((c) => (
                    <button
                      key={c.cmd}
                      onClick={() => send(c.example)}
                      className="text-left p-4 rounded-2xl border border-[#1e2a3a] bg-[#0d1117] hover:border-[#3b82f6]/40 transition-all group"
                    >
                      <div className="text-xs font-black text-[#3b82f6] uppercase tracking-widest mb-1 group-hover:text-[#60a5fa]">{c.cmd}</div>
                      <div className="text-[11px] text-[#64748b] mb-2">{c.desc}</div>
                      <div className="text-[10px] text-[#475569] font-mono p-1 bg-[#0a0e17] rounded inline-block">{c.example}</div>
                    </button>
                  ))}
                </div>
                
                <div className="space-y-3">
                  <div className="text-[10px] font-black text-[#64748b] uppercase tracking-widest">Popüler Aramalar</div>
                  <div className="flex flex-wrap gap-2">
                    {TRENDING_SEARCHES.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-xs px-3 py-1.5 rounded-full border border-[#1e2a3a] text-[#94a3b8] hover:border-[#3b82f6]/40 hover:text-white transition-all bg-[#0d1117]"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start animate-fade-in"}`}>
                {m.role === "assistant" && <BotIcon />}
                <div className={`max-w-[90%] md:max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-[#1d4ed8] text-white shadow-lg shadow-blue-500/10" : "bg-[#0d1117] border border-[#1e2a3a]"}`}>
                  {m.role === "assistant" ? (
                    <>
                      <MarkdownText text={m.text} />
                      <div className="mt-4 pt-3 border-t border-[#1e2a3a] flex flex-wrap gap-2 text-[9px] text-[#475569] font-black uppercase tracking-widest">
                        <span>English</span> <span>/</span> <span>Español</span> <span>/</span> <span>Português</span> <span>/</span> 
                        <span>Français</span> <span>/</span> <span>Русский</span> <span>/</span> <span>العربية</span> <span>+50 dilde destek</span>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm">{m.text}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 justify-start animate-pulse">
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

          <div className="shrink-0 pt-3">
            <div className="flex gap-2 items-end bg-[#0d1117] border border-[#1e2a3a] rounded-2xl px-4 py-3 focus-within:border-[#3b82f6]/50 transition-all shadow-xl">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Hisse senetleri hakkında sor..."
                rows={1}
                className="flex-1 bg-transparent text-sm text-white placeholder-[#475569] resize-none outline-none max-h-32 min-h-[20px] py-1"
                disabled={loading}
              />
              <button
                onClick={() => send()}
                disabled={!input.trim() || loading}
                className="w-9 h-9 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-50 disabled:bg-[#1e2a3a] flex items-center justify-center shrink-0 transition-all shadow-lg shadow-blue-500/20"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            
            <div className="mt-4 pb-2 text-center">
              <p className="text-[10px] text-[#334155] mb-1 italic">Finansal piyasa analiz asistanı • Alım/satım tavsiyesi değildir</p>
              <p className="text-[9px] text-[#475569] font-bold tracking-widest uppercase">
                © 2026 BOGA AI - Blue One Global Analysis. Developed by AFK DaSYS.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
