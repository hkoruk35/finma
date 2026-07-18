"use client";

import React, { useRef, useEffect, useState } from "react";
import { useCopilot } from "@/context/CopilotContext";
import ReactMarkdown from "react-markdown";
import { StockCard, StockCardProps } from "@/components/copilot/ActionCards";
import { AVATAR_OPTIONS, getAvatar, getSuggestedName } from "@/lib/copilot/persona";
import { ct } from "@/lib/copilot/i18n";

// Modelin metin içinde "$TICKER" formatında yazdığı sembolleri tıklanabilir
// markdown linkine çevirir (copilot:// pseudo-protokol) — gerçek bir URL değil,
// ReactMarkdown'ın custom `a` renderer'ı bunu yakalayıp append() tetikler.
function linkifyTickers(text: string): string {
  return text.replace(/\$([A-Z]{1,5})\b/g, (_, ticker) => `[$${ticker}](copilot://${ticker})`);
}

export default function CopilotDrawer() {
  const {
    isOpen, setIsOpen,
    isSettingsOpen, setIsSettingsOpen,
    messages, input, handleInputChange, handleSubmit, isLoading,
    pageContext, locale, append, usage, profile, saveProfile,
    isAuthenticated, error,
  } = useCopilot();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftAvatar, setDraftAvatar] = useState(profile.avatarId);

  useEffect(() => {
    setDraftName(profile.displayName);
    setDraftAvatar(profile.avatarId);
  }, [profile.displayName, profile.avatarId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const avatar = getAvatar(profile.avatarId);
  const displayName = profile.displayName || getSuggestedName(locale);

  const getWelcomeMessage = () => {
    if (pageContext?.type === "ticker") {
      return ct("welcomeTicker", locale, { ticker: pageContext.value });
    }
    return ct("welcomeDefault", locale);
  };

  const handleQuickAction = (text: string) => {
    append({ role: "user", content: text });
  };

  const quotaExhausted = !!usage && usage.hasAccess && usage.currentUsage >= usage.dailyLimit;
  const noAccess = !!usage && !usage.hasAccess;
  const inputDisabled = isLoading || quotaExhausted || noAccess;

  const handleSaveSettings = async () => {
    await saveProfile({ displayName: draftName.trim(), avatarId: draftAvatar });
    setIsSettingsOpen(false);
  };

  // Giriş yapmamış ziyaretçiye Copilot hiç gösterilmez — backend zaten
  // 401 döner, buton görünüp çalışmayan bir özellik sunmaktan kaçınıyoruz.
  if (!isAuthenticated) return null;

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-500/30 transition-transform hover:scale-105 active:scale-95"
        >
          <span className="text-lg">💬</span>
          BOGA Copilot
        </button>
      )}

      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full flex-col bg-[#0d1117] border-l border-[#388bfd44] shadow-2xl transition-transform duration-300 sm:w-[420px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${avatar.gradient} text-base shadow-lg`}>
              {avatar.emoji}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{displayName}</h3>
              <p className="text-[10px] text-blue-400 font-mono">BOGA COPILOT</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              title={ct("personalize", locale)}
              className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Settings panel */}
        {isSettingsOpen && (
          <div className="border-b border-white/10 bg-[#0f1420] p-4 space-y-3">
            <div>
              <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{ct("assistantName", locale)}</label>
              <input
                type="text"
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder={getSuggestedName(locale)}
                maxLength={30}
                className="w-full mt-1 bg-[#161b22] border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{ct("chooseAvatar", locale)}</label>
              <div className="flex gap-2 mt-1.5">
                {AVATAR_OPTIONS.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setDraftAvatar(a.id)}
                    className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${a.gradient} text-base transition-all ${
                      draftAvatar === a.id ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f1420] scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                  >
                    {a.emoji}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleSaveSettings}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors"
            >
              {ct("save", locale)}
            </button>
          </div>
        )}

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
                    <button type="button" onClick={() => handleQuickAction(ct("quickTechnicalMsg", locale))} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">{ct("quickTechnical", locale)}</button>
                    <button type="button" onClick={() => handleQuickAction(ct("quickSupportResistanceMsg", locale))} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">{ct("quickSupportResistance", locale)}</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => handleQuickAction(ct("quickSwingMsg", locale))} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">{ct("quickSwing", locale)}</button>
                    <button type="button" onClick={() => handleQuickAction(ct("quickNvdaMsg", locale))} className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full hover:bg-blue-500/20">{ct("quickNvda", locale)}</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex flex-col max-w-[90%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
                <div
                  className={`p-3 text-sm rounded-2xl prose prose-invert prose-sm ${
                    msg.role === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-[#1f2937] text-gray-200 border border-white/5 rounded-tl-sm"
                  }`}
                >
                  {/* Tool çağrıları ve metin ARTIK BİRLİKTE render edilir — model bir tool
                      çağırıp ardından o veriyi yorumlayan metin yazabilir (örn. get_deep_analysis
                      + PE oranı yorumu); önceden ikisi birbirini dışlıyordu, metin kayboluyordu. */}
                  {msg.toolInvocations?.map((toolInv: any, idx: number) => {
                    const result = toolInv.result;
                    if (!result) {
                      return (
                        <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-white/10 text-xs text-gray-500 animate-pulse">
                          {ct("fetchingData", locale)}
                        </div>
                      );
                    }
                    if (toolInv.toolName === "navigate_to") {
                      return (
                        <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-blue-500/20 text-xs font-mono text-blue-400">
                          {result?.success
                            ? ct("navigating", locale, { ticker: result.ticker })
                            : `⚠️ ${result?.error || ct("navigateFailed", locale)}`}
                        </div>
                      );
                    }
                    if (toolInv.toolName === "show_stock_card") {
                      if (!result?.success) {
                        return (
                          <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-yellow-500/20 text-xs text-yellow-400">
                            ⚠️ {result?.error || ct("noStockData", locale)}
                          </div>
                        );
                      }
                      return <StockCard key={idx} data={result as StockCardProps} locale={locale} />;
                    }
                    if (toolInv.toolName === "get_deep_analysis" && !result?.success) {
                      return (
                        <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-yellow-500/20 text-xs text-yellow-400">
                          ⚠️ {result?.error || ct("noStockData", locale)}
                        </div>
                      );
                    }
                    return null;
                  })}
                  {msg.content && (
                    <ReactMarkdown
                      components={{
                        a: ({ href, children }) => {
                          if (href?.startsWith("copilot://")) {
                            const ticker = href.replace("copilot://", "");
                            return (
                              <button
                                type="button"
                                onClick={() => append({ role: "user", content: `${ticker} hissesini analiz et` })}
                                className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 hover:border-blue-500 text-blue-400 hover:text-white rounded text-[11px] font-bold uppercase transition-all cursor-pointer"
                              >
                                {children}
                              </button>
                            );
                          }
                          return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
                        },
                      }}
                    >
                      {linkifyTickers(msg.content)}
                    </ReactMarkdown>
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
          {quotaExhausted && (
            <div className="bg-[#1f2937] border border-yellow-500/20 rounded-2xl p-3 text-xs text-yellow-300">
              {ct("quotaExhausted", locale, { limit: usage?.dailyLimit ?? "" })}
            </div>
          )}
          {noAccess && (
            <div className="bg-[#1f2937] border border-red-500/20 rounded-2xl p-3 text-xs text-red-300">
              {ct("noAccess", locale)}
            </div>
          )}
          {error && (
            <div className="bg-[#1f2937] border border-red-500/20 rounded-2xl p-3 text-xs text-red-300">
              ⚠️ {ct("genericError", locale)}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form onSubmit={handleSubmit} className="border-t border-white/10 p-4 bg-[#0d1117]">
          <div className="relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder={ct("inputPlaceholder", locale)}
              disabled={inputDisabled}
              className="w-full bg-[#161b22] border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || inputDisabled}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div className="text-center mt-2 flex justify-between px-2">
            <span className="text-[9px] text-gray-500">{ct("disclaimer", locale)}</span>
            {usage && usage.hasAccess && (
              <span className="text-[9px] text-blue-500/70 font-mono">
                {ct("requestsLeft", locale, { n: Math.max(0, usage.dailyLimit - usage.currentUsage), limit: usage.dailyLimit })}
              </span>
            )}
          </div>
        </form>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
