"use client";

import React, { useRef, useEffect, useState } from "react";
import Draggable from "react-draggable";
import { useRouter } from "next/navigation";
import { useCopilot } from "@/context/CopilotContext";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { StockCard, StockCardProps } from "@/components/copilot/ActionCards";
import { AVATAR_OPTIONS, getAvatar, getSuggestedName } from "@/lib/copilot/persona";
import { ct } from "@/lib/copilot/i18n";
import { VISITOR_TEXTS, SupportedLocale, DemoMessage } from "@/lib/copilot/visitorDemo";
import { buildMemberDailyGreeting, CopilotLang } from "@/lib/copilot/memberPrompts";

function linkifyTickers(text: unknown): string {
  if (typeof text !== "string") return "";
  return text.replace(/\$([A-Z]{1,5})\b/g, (_, ticker) => `[$${ticker}](copilot://${ticker})`);
}

function extractPlainText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractPlainText).join("");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractPlainText(props.children);
  }
  return "";
}

export interface ChatArchiveItem {
  id: string;
  date: string;
  preview: string;
  messageCount: number;
}

export default function CopilotDrawer() {
  const {
    isOpen, setIsOpen,
    isSettingsOpen, setIsSettingsOpen,
    messages, input, handleInputChange, handleSubmit, isLoading,
    pageContext, locale, append, usage, profile, saveProfile,
    isAuthenticated, error, setMessages,
  } = useCopilot();
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [draftName, setDraftName] = useState(profile.displayName);
  const [draftAvatar, setDraftAvatar] = useState(profile.avatarId);

  // --- HISTORY & ARCHIVE STATES ---
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [archives, setArchives] = useState<ChatArchiveItem[]>([]);
  const [favoriteSectors, setFavoriteSectors] = useState<string[]>([]);

  // --- VISITOR DEMO MODE STATES ---
  const [demoLocale, setDemoLocale] = useState<SupportedLocale>(() => {
    return ["tr", "en", "es", "fr", "pt"].includes(locale) ? (locale as SupportedLocale) : "en";
  });
  const [demoStage, setDemoStage] = useState<number>(1);
  const [demoPrimaryInterest, setDemoPrimaryInterest] = useState<string>("trend");
  const [demoTimeHorizon, setDemoTimeHorizon] = useState<string>("few_weeks");
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([]);
  const [demoInput, setDemoInput] = useState<string>("");
  const [demoLoading, setDemoLoading] = useState<boolean>(false);

  // Fetch Archives & Member Personalization Sector context when drawer opens
  useEffect(() => {
    if (isAuthenticated && isOpen) {
      fetch("/api/copilot/history")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.archives) setArchives(d.archives);
        })
        .catch(() => {});
    }
  }, [isAuthenticated, isOpen]);

  // Initialize Visitor Demo Stage 1 message if not initialized
  useEffect(() => {
    if (!isAuthenticated && demoMessages.length === 0) {
      const vText = VISITOR_TEXTS[demoLocale] || VISITOR_TEXTS.en;
      setDemoMessages([
        {
          id: "welcome-stage1",
          role: "assistant",
          content: vText.stage1Message,
          buttons: vText.stage1Buttons.map((b) => ({ label: b.label, id: b.id, action: "stage1_select" })),
          stage: 1,
        },
      ]);
    }
  }, [isAuthenticated, demoLocale, demoMessages.length]);

  // Handle visitor language switch
  const handleVisitorLangChange = (newLang: SupportedLocale) => {
    setDemoLocale(newLang);
    const vText = VISITOR_TEXTS[newLang] || VISITOR_TEXTS.en;
    setDemoStage(1);
    setDemoMessages([
      {
        id: `welcome-${Date.now()}`,
        role: "assistant",
        content: vText.stage1Message,
        buttons: vText.stage1Buttons.map((b) => ({ label: b.label, id: b.id, action: "stage1_select" })),
        stage: 1,
      },
    ]);
  };

  useEffect(() => {
    setDraftName(profile.displayName);
    setDraftAvatar(profile.avatarId);
  }, [profile.displayName, profile.avatarId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, demoMessages, isLoading, demoLoading]);

  const avatar = getAvatar(profile.avatarId);
  const displayName = profile.displayName || getSuggestedName(locale);

  // Generate personalized daily kickoff greeting for member
  const memberLang: CopilotLang = (["tr", "en", "es", "fr", "pt"] as const).includes(locale as any)
    ? (locale as CopilotLang)
    : "tr";
  const dailyGreeting = buildMemberDailyGreeting(displayName, favoriteSectors, 0, memberLang);

  const handleQuickAction = (text: string) => {
    append({ role: "user", content: text });
  };

  const quotaExhausted = !!usage && usage.hasAccess && usage.currentUsage >= usage.dailyLimit;
  const noAccess = !!usage && !usage.hasAccess;
  const inputDisabled = isAuthenticated ? (isLoading || quotaExhausted || noAccess) : demoLoading;

  const handleSaveSettings = async () => {
    await saveProfile({ displayName: draftName.trim(), avatarId: draftAvatar });
    setIsSettingsOpen(false);
  };

  const handleClearHistory = async () => {
    try {
      await fetch("/api/copilot/history", { method: "DELETE" });
      if (setMessages) setMessages([]);
      setArchives([]);
      setIsHistoryOpen(false);
    } catch {}
  };

  const handleTriggerClick = () => {
    setIsOpen(true);
  };

  // --- Visitor Option Button Click Handler ---
  const handleVisitorActionClick = async (btn: { label: string; id: string; action?: string; href?: string }) => {
    if (demoLoading) return;

    if (btn.href) {
      router.push(btn.href);
      if (btn.action === "return_chart") setIsOpen(false);
      return;
    }

    const userMsgText = btn.label;
    const nextUserMsg: DemoMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userMsgText,
    };

    setDemoMessages((prev) => [...prev, nextUserMsg]);

    let nextStage = demoStage;
    let nextInterest = demoPrimaryInterest;
    let nextHorizon = demoTimeHorizon;

    if (btn.action === "stage1_select") {
      nextInterest = btn.id;
      setDemoPrimaryInterest(btn.id);
      nextStage = 2;
    } else if (btn.action === "stage2_select") {
      nextHorizon = btn.id;
      setDemoTimeHorizon(btn.id);
      nextStage = 3;
    } else if (btn.action === "set_followup") {
      nextStage = 4;
    }

    setDemoStage(nextStage);
    setDemoLoading(true);

    try {
      const res = await fetch("/api/copilot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: demoLocale,
          stage: nextStage,
          primaryInterest: nextInterest,
          timeHorizon: nextHorizon,
          userMessage: userMsgText,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      const assistantMsg: DemoMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        buttons: data.buttons,
        stage: data.stage || nextStage,
      };

      setDemoMessages((prev) => [...prev, assistantMsg]);
      if (data.stage) setDemoStage(data.stage);
    } catch {
      const fallbackMsg: DemoMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "İşlem sırasında bir bağlantı hatası oluştu. Lütfen tekrar deneyin.",
      };
      setDemoMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setDemoLoading(false);
    }
  };

  // --- Visitor Free Text Form Submit Handler ---
  const handleVisitorInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoInput.trim() || demoLoading) return;

    const userText = demoInput.trim();
    setDemoInput("");

    const nextUserMsg: DemoMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText,
    };

    setDemoMessages((prev) => [...prev, nextUserMsg]);
    setDemoLoading(true);

    try {
      const res = await fetch("/api/copilot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: demoLocale,
          stage: demoStage,
          primaryInterest: demoPrimaryInterest,
          timeHorizon: demoTimeHorizon,
          userMessage: userText,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();

      const assistantMsg: DemoMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        buttons: data.buttons,
        stage: data.stage || demoStage,
      };

      setDemoMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setDemoMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Bağlantı hatası oluştu. Lütfen tekrar deneyin.",
        },
      ]);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <Draggable nodeRef={triggerRef} bounds="body">
          <div ref={triggerRef} className="fixed bottom-24 right-4 z-[105] flex flex-col items-end gap-1.5 cursor-move group lg:bottom-6 lg:right-6">
            <button
              onClick={handleTriggerClick}
              onTouchEnd={(e) => {
                handleTriggerClick();
              }}
              className="flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-xl shadow-blue-500/40 transition-transform active:scale-95 touch-manipulation"
            >
              <span className="text-base sm:text-lg">🤖</span>
              BOGA Copilot
            </button>
            <div className="text-[9px] md:text-[10px] font-medium text-white/90 bg-[#1a2b4d]/90 px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-md border border-[#3b82f6]/30 shadow-lg select-none">
              {ct("copilotTagline", locale)}
            </div>
          </div>
        </Draggable>
      )}

      {/* Copilot Drawer Panel (both authenticated & visitor) */}
      <div
        className={`fixed right-0 top-0 z-[120] flex h-full w-full flex-col bg-[#0d1117] border-l border-[#388bfd44] shadow-2xl transition-transform duration-300 sm:w-[420px] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${avatar.gradient} text-base shadow-lg`}>
              {avatar.emoji}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white leading-tight">{displayName}</h3>
              <p className="text-[10px] text-blue-400 font-mono flex items-center gap-1.5">
                BOGA COPILOT
                {!isAuthenticated && (
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] px-2 py-0.5 rounded-full font-sans font-bold shadow-sm">
                    {VISITOR_TEXTS[demoLocale]?.headerBadge || "Hoş Geldiniz ✨"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Visitor Language Selector */}
            {!isAuthenticated && (
              <select
                value={demoLocale}
                onChange={(e) => handleVisitorLangChange(e.target.value as SupportedLocale)}
                className="bg-[#141924] border border-[#2a384e] text-blue-300 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none hover:border-blue-500/50 cursor-pointer transition-colors"
              >
                <option value="tr">TR 🇹🇷</option>
                <option value="en">EN 🇺🇸</option>
                <option value="es">ES 🇪🇸</option>
                <option value="fr">FR 🇫🇷</option>
                <option value="pt">PT 🇧🇷</option>
              </select>
            )}

            {isAuthenticated && (
              <>
                <button
                  onClick={() => {
                    setIsHistoryOpen(!isHistoryOpen);
                    setIsSettingsOpen(false);
                  }}
                  title="Sohbet Arşivi & Geçmiş"
                  className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </button>

                <button
                  onClick={() => {
                    setIsSettingsOpen(!isSettingsOpen);
                    setIsHistoryOpen(false);
                  }}
                  title={ct("personalize", locale)}
                  className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </>
            )}

            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* History / Archive Panel for members */}
        {isAuthenticated && isHistoryOpen && (
          <div className="border-b border-white/10 bg-[#0f1420] p-4 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-300 uppercase tracking-wider">📜 Sohbet Arşivi & Geçmiş</span>
              <button
                type="button"
                onClick={handleClearHistory}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded transition-all cursor-pointer"
              >
                🗑️ Ekrandan Temizle
              </button>
            </div>
            {archives.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {archives.map((arc, i) => (
                  <div key={i} className="bg-[#161b22] border border-white/10 p-2.5 rounded-lg text-xs flex flex-col gap-1">
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono">
                      <span>📅 {arc.date}</span>
                      <span className="text-blue-400 font-bold">{arc.messageCount} mesaj</span>
                    </div>
                    <p className="text-gray-200 text-[11px] truncate">{arc.preview}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 italic">Henüz kaydedilmiş sohbet arşivi bulunmuyor.</p>
            )}
            <p className="text-[9px] text-gray-500 italic pt-1">
              * Sohbeti ekrandan silseniz bile BOGA Copilot ilgi alanlarınızı ve sektör tercihlerinizi öğrenmeye devam eder.
            </p>
          </div>
        )}

        {/* Settings panel for members */}
        {isAuthenticated && isSettingsOpen && (
          <div className="border-b border-white/10 bg-[#0f1420] p-4 space-y-3 shrink-0">
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

        {/* Messages Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isAuthenticated ? (
            /* AUTHENTICATED MEMBER MESSAGES */
            messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                {/* Proactive Personalized Daily Kickoff Greeting */}
                <div className="bg-[#141924] p-4 rounded-2xl border border-[#2a384e] shadow-lg text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {dailyGreeting.welcomeMessage}
                </div>
                <div className="flex flex-col gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono">
                    💡 Önerilen Günlük Analiz Başlıkları
                  </span>
                  {dailyGreeting.pills.map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleQuickAction(pill.prompt)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#1e293b] border border-blue-500/30 hover:border-blue-400 hover:bg-blue-600/20 text-blue-300 hover:text-white text-xs font-bold transition-all shadow-sm flex items-center justify-between touch-manipulation active:scale-[0.98]"
                    >
                      <span>{pill.label}</span>
                      <span className="text-xs opacity-60">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col max-w-[92%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
                  <div
                    className={`p-3.5 text-sm rounded-2xl prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm"
                        : "bg-[#161b22] text-gray-200 border border-[#30363d] rounded-tl-sm shadow-md"
                    }`}
                  >
                    {msg.toolInvocations?.map((toolInv: any, idx: number) => {
                      const result = (toolInv as any).result;
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
                    {typeof msg.content === "string" && msg.content && (
                      <ReactMarkdown
                        urlTransform={(url) =>
                          url.startsWith("copilot://") || url.startsWith("copilot-topic://") ? url : defaultUrlTransform(url)
                        }
                        components={{
                          a: ({ href, children }) => {
                            if (href?.startsWith("copilot://")) {
                              const ticker = href.replace("copilot://", "");
                              return (
                                <button
                                  type="button"
                                  onClick={() => append({ role: "user", content: ct("analyzeTickerPrompt", locale, { ticker }) })}
                                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 hover:border-blue-500 text-blue-400 hover:text-white rounded text-[11px] font-bold uppercase transition-all cursor-pointer"
                                >
                                  {children}
                                </button>
                              );
                            }
                            if (href?.startsWith("copilot-topic://")) {
                              const topicText = extractPlainText(children);
                              return (
                                <button
                                  type="button"
                                  onClick={() => topicText && append({ role: "user", content: topicText })}
                                  className="block w-full text-left my-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer touch-manipulation active:scale-[0.98]"
                                >
                                  <span>{children}</span>
                                </button>
                              );
                            }
                            return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{children}</a>;
                          },
                        }}
                      >
                        {linkifyTickers(msg.content)}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))
            )
          ) : (
            /* NON-AUTHENTICATED VISITOR DEMO MESSAGES */
            demoMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col max-w-[92%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
                <div
                  className={`p-3.5 text-sm rounded-2xl prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-[#161b22] text-gray-200 border border-[#30363d] rounded-tl-sm shadow-md"
                  }`}
                >
                  <ReactMarkdown
                    urlTransform={(url) =>
                      url.startsWith("copilot://") ? url : defaultUrlTransform(url)
                    }
                    components={{
                      a: ({ href, children }) => {
                        if (href?.startsWith("copilot://")) {
                          return <span className="text-cyan-400 font-bold">{children}</span>;
                        }
                        return <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">{children}</a>;
                      },
                    }}
                  >
                    {linkifyTickers(msg.content)}
                  </ReactMarkdown>

                  {/* Interactive Action / Stage Option Buttons */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="flex flex-col gap-2 mt-3 pt-2 border-t border-white/10">
                      {msg.buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleVisitorActionClick(btn)}
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-between touch-manipulation active:scale-[0.98] ${
                            btn.action === "offer_signup"
                              ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 hover:brightness-110 font-extrabold text-sm py-3"
                              : btn.action === "offer_details"
                              ? "bg-blue-600/20 text-blue-300 border border-blue-500/40 hover:bg-blue-600/30"
                              : btn.action === "return_chart"
                              ? "bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700"
                              : "bg-[#1f293d] text-cyan-300 border border-[#2d3f5e] hover:bg-cyan-500/20 hover:border-cyan-400"
                          }`}
                        >
                          <span>{btn.label}</span>
                          <span className="text-xs opacity-60">→</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-lg text-xs">
              {error.message || ct("errorGeneric", locale)}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form
          onSubmit={isAuthenticated ? handleSubmit : handleVisitorInputSubmit}
          className="border-t border-white/10 p-4 pb-8 sm:pb-4 bg-[#0d1117] shrink-0"
        >
          <div className="relative flex items-center">
            <input
              type="text"
              value={isAuthenticated ? input : demoInput}
              onChange={isAuthenticated ? handleInputChange : (e) => setDemoInput(e.target.value)}
              placeholder={ct("inputPlaceholder", isAuthenticated ? locale : demoLocale)}
              disabled={inputDisabled}
              className="w-full bg-[#161b22] border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isAuthenticated ? (!input.trim() || inputDisabled) : (!demoInput.trim() || demoLoading)}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-500 transition-colors touch-manipulation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
          <div className="text-center mt-2 flex justify-between px-2">
            <span className="text-[9px] text-gray-500">{ct("disclaimer", isAuthenticated ? locale : demoLocale)}</span>
            {isAuthenticated && usage && usage.hasAccess && (
              <span className="text-[9px] text-blue-500/70 font-mono">
                {ct("requestsLeft", locale, { n: Math.max(0, usage.dailyLimit - usage.currentUsage), limit: usage.dailyLimit })}
              </span>
            )}
          </div>
        </form>
      </div>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-[115] sm:hidden backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
