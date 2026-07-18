"use client";

import React, { useRef, useEffect } from "react";
import { useCopilot } from "@/context/CopilotContext";
import ReactMarkdown from 'react-markdown';
import { StockCard, StockCardProps } from "@/components/copilot/ActionCards";

export default function CopilotDrawer() {
  const { isOpen, setIsOpen, messages, input, handleInputChange, handleSubmit, isLoading, pageContext, append } = useCopilot();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const getWelcomeMessage = () => {
    if (pageContext?.type === "ticker") {
      return `Şu anda ${pageContext.value} grafiğini inceliyorsun. Sana yardımcı olabilirim:\n• Teknik analiz\n• Risk değerlendirmesi\n• Benzer hisseler`;
    }
    return "Bugün Ne Yapmak İstiyorsun?\n• Bir hisseyi analiz et\n• Günün en güçlü adaylarını bul\n• Portföyünü incele";
  };

  const handleQuickAction = (text: string) => {
    append({ role: "user", content: text });
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          <span className="text-lg">💬</span>
          BOGA Copilot
        </button>
      )}

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[#0d1117] border-l border-[#388bfd44] shadow-2xl transition-transform duration-300 sm:w-[450px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm">
              🤖
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">BOGA AI</h3>
              <p className="text-[10px] text-blue-400 font-mono">FINANCIAL COPILOT</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-3">
              <div className="bg-[#1f2937] p-4 rounded-2xl rounded-tl-sm text-sm text-gray-200 border border-white/5 whitespace-pre-wrap">
                {getWelcomeMessage()}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {pageContext?.type === "ticker" ? (
                  <>
                    <button type="button" onClick={() => handleQuickAction("Teknik durumu analiz et")} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">Teknik Analiz</button>
                    <button type="button" onClick={() => handleQuickAction("Destek ve direnç seviyeleri nedir?")} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">Destek / Direnç</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => handleQuickAction("Günün en güçlü hisseleri hangileri?")} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">🚀 Swing Fırsatları</button>
                    <button type="button" onClick={() => handleQuickAction("NVIDIA'nın son durumunu değerlendir")} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">⚡ NVDA Analizi</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col max-w-[90%] ${
                  msg.role === "user" ? "ml-auto" : "mr-auto"
                }`}
              >
                <div
                  className={`p-3 text-sm rounded-2xl prose prose-invert prose-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-[#1f2937] text-gray-200 border border-white/5 rounded-tl-sm"
                  }`}
                >
                  {msg.toolInvocations ? (
                    msg.toolInvocations.map((tool: any, idx: number) => (
                      <div key={idx} className="my-2">
                        {tool.toolName === 'navigate_to' && (
                          <div className="bg-[#0a0e17] p-2 rounded-lg border border-blue-500/20 text-xs font-mono text-blue-400">
                            🔄 {tool.args.ticker} sayfasına yönlendiriliyor...
                          </div>
                        )}
                        {tool.toolName === 'show_stock_card' && (
                          <StockCard data={tool.args as StockCardProps} />
                        )}
                      </div>
                    ))
                  ) : (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div className="flex flex-col max-w-[85%] mr-auto">
              <div className="p-3 text-sm rounded-2xl bg-[#1f2937] text-gray-400 border border-white/5 rounded-tl-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-75"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse delay-150"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 bg-[#0d1117]">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="BOGA AI'a sor..."
              className="w-full bg-[#161b22] border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div className="text-center mt-2 flex justify-between px-2">
            <span className="text-[9px] text-gray-500">BOGA AI yatırım tavsiyesi vermez.</span>
            <span className="text-[9px] text-blue-500/70 font-mono">18 / 20 İstek Kaldı</span>
          </div>
        </form>
      </div>
      
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
