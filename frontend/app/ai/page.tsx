"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

interface Message {
  role: "user" | "assistant";
  text: string;
}

const SLASH_COMMANDS = [
  { cmd: "/swing", desc: "Swing trade analysis for a ticker", example: "/swing AAPL" },
  { cmd: "/top5", desc: "What makes a top-5 swing pick", example: "/top5" },
  { cmd: "/analiz", desc: "Deep-dive technical analysis", example: "/analiz TSLA" },
];

const SUGGESTIONS = [
  "/swing NVDA",
  "/top5",
  "/analiz META",
  "What is the EMA200 breakout strategy?",
  "Explain options premium decay (theta)",
];

function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1.5 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <h3 key={i} className="text-sm font-black text-white uppercase tracking-widest mt-3 mb-1">{line.slice(4)}</h3>;
        }
        if (line.startsWith("## ")) {
          return <h2 key={i} className="text-base font-black text-[#3b82f6] mt-3 mb-1">{line.slice(3)}</h2>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-bold text-white">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#3b82f6] mt-0.5 shrink-0">•</span>
              <span className="text-[#cbd5e1]">{formatInline(line.slice(2))}</span>
            </div>
          );
        }
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

function formatInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={i} className="text-[#f59e0b] bg-[#f59e0b]/10 px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    }
    return part;
  });
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleInputChange = (val: string) => {
    setInput(val);
    setShowCommands(val.startsWith("/") && val.length <= 10);
  };

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setShowCommands(false);

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
        }),
      });
      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", text: data.text ?? data.error ?? "Error." }]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: "Connection error. Please try again." }]);
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

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col">
      <Header />

      <main className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 pt-8 pb-4">
        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">BOGA AI</h1>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded-full">BETA</span>
          </div>
          <p className="text-[#64748b] text-sm">Ask anything about stocks, swing trades, and options strategies.</p>
        </div>

        {/* Chat area */}
        <div className="flex-1 space-y-6 mb-6 min-h-0">
          {messages.length === 0 && (
            <div className="space-y-6">
              {/* Slash command pills */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SLASH_COMMANDS.map((c) => (
                  <button
                    key={c.cmd}
                    onClick={() => send(c.example)}
                    className="text-left p-4 rounded-2xl border border-[#1e2a3a] bg-[#0d1117] hover:border-[#3b82f6]/40 hover:bg-[#0d1117] transition-all group"
                  >
                    <div className="text-xs font-black text-[#3b82f6] uppercase tracking-widest mb-1 group-hover:text-[#60a5fa]">{c.cmd}</div>
                    <div className="text-[11px] text-[#64748b]">{c.desc}</div>
                    <div className="text-[10px] text-[#475569] mt-2 font-mono">{c.example}</div>
                  </button>
                ))}
              </div>

              {/* Suggestion chips */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
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
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] flex items-center justify-center shrink-0 mt-0.5 shadow-lg shadow-blue-500/20">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === "user"
                    ? "bg-[#1d4ed8] text-white rounded-tr-sm"
                    : "bg-[#0d1117] border border-[#1e2a3a] rounded-tl-sm"
                }`}
              >
                {m.role === "assistant" ? <MarkdownText text={m.text} /> : <p>{m.text}</p>}
              </div>
              {m.role === "user" && (
                <div className="w-7 h-7 rounded-lg bg-[#1e2a3a] flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-3.5 h-3.5 text-[#64748b]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div className="bg-[#0d1117] border border-[#1e2a3a] rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1.5 items-center h-5">
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="sticky bottom-4">
          {showCommands && (
            <div className="mb-2 bg-[#0d1117] border border-[#1e2a3a] rounded-xl overflow-hidden shadow-xl">
              {SLASH_COMMANDS.filter((c) => c.cmd.startsWith(input)).map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => { setInput(c.example + " "); setShowCommands(false); inputRef.current?.focus(); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#1e2a3a] transition-colors text-left"
                >
                  <span className="text-xs font-black text-[#3b82f6] font-mono w-20">{c.cmd}</span>
                  <span className="text-xs text-[#64748b]">{c.desc}</span>
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end bg-[#0d1117] border border-[#1e2a3a] rounded-2xl px-4 py-3 focus-within:border-[#3b82f6]/50 transition-colors shadow-2xl shadow-black/40">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about stocks, type /swing, /top5, /analiz..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-white placeholder-[#475569] resize-none outline-none leading-relaxed max-h-32"
              style={{ minHeight: "24px" }}
              disabled={loading}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="w-8 h-8 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 shadow-lg shadow-blue-500/20"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-center text-[10px] text-[#334155] mt-2">BOGA AI may make mistakes. Verify before trading.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
