"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";

interface Message {
  role: "user" | "assistant";
  text: string;
  source?: "claude" | "gemini";
}

const SLASH_COMMANDS = [
  { cmd: "/swing", desc: "Swing trade analysis", example: "/swing NVDA" },
  { cmd: "/top5", desc: "Top-5 picks", example: "/top5" },
  { cmd: "/analiz", desc: "Deep analysis", example: "/analiz TSLA" },
];

function MarkdownText({ text }: { text: string }) {
  return (
    <div className="space-y-1 leading-relaxed text-sm">
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## "))
          return <h2 key={i} className="text-sm font-medium text-[#3b82f6] mt-2">{line.slice(3)}</h2>;
        if (line.startsWith("**") && line.endsWith("**"))
          return <p key={i} className="font-medium text-white">{line.slice(2, -2)}</p>;
        if (line.startsWith("- "))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-[#3b82f6]">•</span>
              <span className="text-[#cbd5e1]">{line.slice(2)}</span>
            </div>
          );
        if (line.trim() === "") return <div key={i} className="h-0.5" />;
        return <p key={i} className="text-[#cbd5e1] text-xs">{line}</p>;
      })}
    </div>
  );
}

export default function AIWidget() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  const send = async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    setInput("");

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
      setMessages([
        ...newMessages,
        { role: "assistant", text: data.text ?? "Error", source: data.source },
      ]);
    } catch {
      setMessages([...newMessages, { role: "assistant", text: "Connection error" }]);
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
    <div className="glass-card border-t-2 border-t-[#3b82f6] overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-[#0d1117] to-[#1a1f2e] border-b border-[#1e2a3a]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-[#1d4ed8] to-[#3b82f6] flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest">BOGA AI</h3>
          <span className="text-[9px] font-black text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded">BETA</span>
        </div>
        <p className="text-[11px] text-[#64748b]">Ask about stocks, analysis, strategies</p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="h-64 overflow-y-auto p-4 space-y-3 bg-[#0a0e17]">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-[11px] text-[#64748b]">Ask a question about stocks or trading</p>
            <div className="mt-3 grid grid-cols-3 gap-1">
              {SLASH_COMMANDS.map((c) => (
                <button
                  key={c.cmd}
                  onClick={() => {
                    setInput(c.example);
                  }}
                  className="text-[9px] px-1.5 py-1 rounded border border-[#1e2a3a] text-[#64748b] hover:text-white hover:border-[#3b82f6]/40 transition-colors truncate"
                  title={c.desc}
                >
                  {c.cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                m.role === "user"
                  ? "bg-[#1d4ed8] text-white rounded-tr-none text-xs"
                  : "bg-[#1e2a3a] border border-[#2a3a4a] rounded-tl-none text-[11px]"
              }`}
            >
              {m.role === "assistant" ? <MarkdownText text={m.text} /> : <p>{m.text}</p>}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2 justify-start">
            <div className="bg-[#1e2a3a] border border-[#2a3a4a] rounded-lg rounded-tl-none px-3 py-2">
              <div className="flex gap-1 items-center h-4">
                <span className="w-1 h-1 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1 h-1 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1 h-1 bg-[#3b82f6] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-[#1e2a3a] bg-[#0a0e17] flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about stocks..."
          rows={1}
          className="flex-1 bg-[#1e2a3a] text-xs text-white placeholder-[#475569] rounded-lg px-3 py-2 outline-none border border-[#1e2a3a] focus:border-[#3b82f6]/50 resize-none max-h-20"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="w-8 h-8 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] disabled:opacity-30 flex items-center justify-center shrink-0 transition-all"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
