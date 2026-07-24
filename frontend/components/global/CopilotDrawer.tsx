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
import { TASK_LABELS, CopilotTask, TaskType } from "@/lib/copilot/tasksEngine";
import { getUSMarketStatus } from "@/lib/copilot/marketSchedule";

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

  // --- HISTORY & ARCHIVE & TASKS STATES ---
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [archives, setArchives] = useState<ChatArchiveItem[]>([]);
  const [activeTasks, setActiveTasks] = useState<CopilotTask[]>([]);
  const [favoriteSectors, setFavoriteSectors] = useState<string[]>([]);
  const [muteDuration, setMuteDuration] = useState<string>("off");
  const [allowCriticalMute, setAllowCriticalMute] = useState<boolean>(true);

  // --- CONTROLLED BOUNCE & DOT INDICATORS ---
  const [shouldBounce, setShouldBounce] = useState<boolean>(false);
  const [bounceCount, setBounceCount] = useState<number>(0);
  const [dotColor, setDotColor] = useState<"none" | "blue" | "orange" | "red">("blue");

  // --- VISITOR & MEMBER LANGUAGE STATES ---
  const [activeLocale, setActiveLocale] = useState<SupportedLocale>(() => {
    return ["tr", "en", "es", "fr", "pt"].includes(locale) ? (locale as SupportedLocale) : "en";
  });

  const [draftName, setDraftName] = useState(profile.displayName || getSuggestedName(activeLocale));
  const [draftAvatar, setDraftAvatar] = useState(profile.avatarId);

  const [demoStage, setDemoStage] = useState<number>(1);
  const [demoPrimaryInterest, setDemoPrimaryInterest] = useState<string>("trend");
  const [demoTimeHorizon, setDemoTimeHorizon] = useState<string>("few_weeks");
  const [demoMessages, setDemoMessages] = useState<DemoMessage[]>([]);
  const [demoInput, setDemoInput] = useState<string>("");
  const [demoLoading, setDemoLoading] = useState<boolean>(false);
  const [customTaskInput, setCustomTaskInput] = useState<string>("");

  const taskDef = TASK_LABELS[activeLocale] || TASK_LABELS.en;
  const marketStatus = getUSMarketStatus();

  // CONTROLLED BOUNCE LOGIC
  useEffect(() => {
    const hasOpenedBefore = sessionStorage.getItem("copilot_opened_session");
    if (hasOpenedBefore || isOpen) return;

    const timer1 = setTimeout(() => {
      setShouldBounce(true);
      setBounceCount(1);
      const bounceOffTimer = setTimeout(() => setShouldBounce(false), 2000);
      const timer2 = setTimeout(() => {
        setShouldBounce(true);
        setBounceCount(2);
        setTimeout(() => setShouldBounce(false), 2000);
      }, 35000);
      return () => clearTimeout(bounceOffTimer);
    }, 10000);

    return () => clearTimeout(timer1);
  }, [isOpen]);

  const handleTriggerClick = () => {
    sessionStorage.setItem("copilot_opened_session", "true");
    setShouldBounce(false);
    setDotColor("none");
    setIsOpen(true);
  };

  useEffect(() => {
    if (messages.length > 0 || demoMessages.length > 1) {
      setIsTasksOpen(false);
      setIsHistoryOpen(false);
      setIsSettingsOpen(false);
    }
  }, [messages.length, demoMessages.length]);

  useEffect(() => {
    if (isAuthenticated && isOpen) {
      fetch("/api/copilot/history")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.archives) setArchives(d.archives);
        })
        .catch(() => {});

      fetch("/api/copilot/tasks")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.tasks) {
            setActiveTasks(d.tasks);
            if (d.tasks.length > 0) setDotColor("orange");
          }
        })
        .catch(() => {});
    }
  }, [isAuthenticated, isOpen]);

  useEffect(() => {
    if (!isAuthenticated && demoMessages.length === 0) {
      const vText = VISITOR_TEXTS[activeLocale] || VISITOR_TEXTS.en;
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
  }, [isAuthenticated, activeLocale, demoMessages.length]);

  const handleLangChange = (newLang: SupportedLocale) => {
    setActiveLocale(newLang);
    if (!profile.displayName) {
      setDraftName(getSuggestedName(newLang));
    }
    if (!isAuthenticated) {
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
    }
  };

  useEffect(() => {
    setDraftName(profile.displayName || getSuggestedName(activeLocale));
    setDraftAvatar(profile.avatarId);
  }, [profile.displayName, profile.avatarId, activeLocale]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, demoMessages, isLoading, demoLoading]);

  const avatar = getAvatar(profile.avatarId);
  const displayName = profile.displayName || getSuggestedName(activeLocale);

  const memberLang: CopilotLang = (["tr", "en", "es", "fr", "pt"] as const).includes(activeLocale)
    ? (activeLocale as CopilotLang)
    : "tr";
  const dailyGreeting = buildMemberDailyGreeting(displayName, favoriteSectors, 0, memberLang);

  const handleCancelTask = async (taskId: string) => {
    setActiveTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await fetch(`/api/copilot/tasks?id=${taskId}`, { method: "DELETE" });
    } catch {}
  };

  const handleClearAllTasks = async () => {
    const taskIds = activeTasks.map((t) => t.id);
    setActiveTasks([]);
    try {
      await Promise.all(taskIds.map((id) => fetch(`/api/copilot/tasks?id=${id}`, { method: "DELETE" })));
    } catch {}
  };

  const handleAddCustomTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTaskInput.trim()) return;
    const subject = customTaskInput.trim();
    setCustomTaskInput("");

    if (isAuthenticated) {
      try {
        const res = await fetch("/api/copilot/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskType: "company_daily_watch", subject, language: activeLocale }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.task) setActiveTasks((prev) => [data.task, ...prev]);
        }
      } catch {}
    } else {
      setActiveTasks((prev) => [
        {
          id: `task-${Date.now()}`,
          user_id: "demo",
          task_type: "company_daily_watch",
          subject,
          status: "active",
          language: activeLocale,
          schedule: { premarket: "08:45", midday: "12:00", closing: "16:15" },
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    }
  };

  const handleBreakPrompt = () => {
    setIsTasksOpen(false);
    if (isAuthenticated) {
      append({ role: "user", content: "Biraz dinlenmek istiyorum." });
    } else {
      setDemoMessages((prev) => [
        ...prev,
        {
          id: `break-${Date.now()}`,
          role: "assistant",
          content: taskDef.breakPromptMsg,
        },
      ]);
    }
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

  const handleNewChat = () => {
    if (isAuthenticated) {
      if (setMessages) setMessages([]);
    } else {
      const vText = VISITOR_TEXTS[activeLocale] || VISITOR_TEXTS.en;
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
    }
    setIsTasksOpen(false);
    setIsHistoryOpen(false);
    setIsSettingsOpen(false);
  };

  const handleVisitorActionClick = async (btn: { label: string; id: string; action?: string; href?: string }) => {
    if (demoLoading) return;
    if (btn.href) {
      router.push(btn.href);
      if (btn.action === "return_chart") setIsOpen(false);
      return;
    }

    const userMsgText = btn.label;
    const nextUserMsg: DemoMessage = { id: `user-${Date.now()}`, role: "user", content: userMsgText };
    setDemoMessages((prev) => [...prev, nextUserMsg]);

    let nextStage = demoStage;
    let nextInterest = demoPrimaryInterest;
    let nextHorizon = demoTimeHorizon;

    if (btn.action === "stage1_select") { nextInterest = btn.id; setDemoPrimaryInterest(btn.id); nextStage = 2; }
    else if (btn.action === "stage2_select") { nextHorizon = btn.id; setDemoTimeHorizon(btn.id); nextStage = 3; }
    else if (btn.action === "set_followup") { nextStage = 4; }

    setDemoStage(nextStage);
    setDemoLoading(true);

    try {
      const res = await fetch("/api/copilot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locale: activeLocale, stage: nextStage, primaryInterest: nextInterest, timeHorizon: nextHorizon, userMessage: userMsgText,
        }),
      });

      if (!res.ok) throw new Error();
      const data = await res.json();
      setDemoMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: data.reply, buttons: data.buttons, stage: data.stage || nextStage }]);
      if (data.stage) setDemoStage(data.stage);
    } catch {
      setDemoMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: "Piyasa mutfağında kısa bir düzenleme yapıyorum. Lütfen sorunuzu bir kez daha iletin." }]);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleVisitorInputSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoInput.trim() || demoLoading) return;

    const userText = demoInput.trim();
    setDemoInput("");

    const lower = userText.toLowerCase();
    if (lower === "english" || lower === "en") { handleLangChange("en"); return; }
    if (lower === "türkçe" || lower === "tr" || lower === "turkce") { handleLangChange("tr"); return; }
    if (lower === "español" || lower === "es" || lower === "espanol") { handleLangChange("es"); return; }
    if (lower === "français" || lower === "fr" || lower === "francais") { handleLangChange("fr"); return; }
    if (lower === "português" || lower === "pt" || lower === "portugues") { handleLangChange("pt"); return; }

    setDemoMessages((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", content: userText }]);
    setDemoLoading(true);

    try {
      const res = await fetch("/api/copilot/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: activeLocale, stage: demoStage, primaryInterest: demoPrimaryInterest, timeHorizon: demoTimeHorizon, userMessage: userText }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDemoMessages((prev) => [...prev, { id: `assistant-${Date.now()}`, role: "assistant", content: data.reply, buttons: data.buttons, stage: data.stage || demoStage }]);
    } catch {
      setDemoMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: "Piyasa mutfağında kısa bir düzenleme yapıyorum. Lütfen sorunuzu bir kez daha iletin." }]);
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
              onTouchEnd={(e) => handleTriggerClick()}
              className={`flex items-center gap-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-xl shadow-blue-500/40 transition-all hover:scale-105 active:scale-95 touch-manipulation relative motion-reduce:animate-none ${
                shouldBounce ? "animate-bounce" : ""
              }`}
            >
              <span className="text-base sm:text-lg animate-pulse">🤖</span>
              BOGA Copilot
              {dotColor !== "none" && (
                <span className={`absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#0d1117] ${dotColor === "red" ? "bg-red-500 animate-ping" : dotColor === "orange" ? "bg-amber-400" : "bg-blue-400"}`} />
              )}
            </button>
            <div className="text-[9px] md:text-[10px] font-medium text-white/90 bg-[#1a2b4d]/90 px-2.5 py-1 rounded-full pointer-events-none whitespace-nowrap backdrop-blur-md border border-[#3b82f6]/30 shadow-lg select-none">
              {ct("copilotTagline", activeLocale)}
            </div>
          </div>
        </Draggable>
      )}

      {/* Copilot Drawer Panel */}
      <div className={`fixed right-0 top-0 z-[120] flex h-full w-full flex-col bg-[#0d1117] border-l border-[#388bfd44] shadow-2xl transition-transform duration-300 sm:w-[420px] ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-3 relative shrink-0">
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
                    {VISITOR_TEXTS[activeLocale]?.headerBadge || "Hoş Geldiniz ✨"}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewChat}
              title={activeLocale === "tr" ? "Yeni Sohbet Başlat" : "New Chat"}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span className="hidden sm:inline">
                {activeLocale === "tr" ? "Yeni Sohbet" : activeLocale === "es" ? "Nuevo Chat" : activeLocale === "fr" ? "Nouveau Chat" : activeLocale === "pt" ? "Novo Chat" : "New Chat"}
              </span>
            </button>

            <select
              value={activeLocale}
              onChange={(e) => handleLangChange(e.target.value as SupportedLocale)}
              className="bg-[#141924] border border-[#2a384e] text-blue-300 text-xs font-mono font-bold rounded-lg px-2 py-1 focus:outline-none hover:border-blue-500/50 cursor-pointer transition-all shadow-sm"
            >
              <option value="tr">🇹🇷 TR</option>
              <option value="en">🇺🇸 EN</option>
              <option value="es">🇪🇸 ES</option>
              <option value="fr">🇫🇷 FR</option>
              <option value="pt">🇧🇷 PT</option>
            </select>

            {isAuthenticated && (
              <>
                <button
                  onClick={() => { setIsTasksOpen(!isTasksOpen); setIsHistoryOpen(false); setIsSettingsOpen(false); }}
                  title="Akıllı Görevler"
                  className={`rounded-full p-2 transition-colors relative ${isTasksOpen ? "bg-blue-600 text-white" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 11 12 14 22 4" />
                    <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                  </svg>
                  {activeTasks.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-cyan-400 text-[8px] font-black text-black">
                      {activeTasks.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => { setIsHistoryOpen(!isHistoryOpen); setIsTasksOpen(false); setIsSettingsOpen(false); }}
                  title="Sohbet Arşivi & Geçmiş"
                  className={`rounded-full p-2 transition-colors ${isHistoryOpen ? "bg-blue-600 text-white" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </button>

                <button
                  onClick={() => { setIsSettingsOpen(!isSettingsOpen); setIsTasksOpen(false); setIsHistoryOpen(false); }}
                  title={ct("personalize", activeLocale)}
                  className={`rounded-full p-2 transition-colors ${isSettingsOpen ? "bg-blue-600 text-white" : "text-white/50 hover:bg-white/10 hover:text-white"}`}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 003.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </>
            )}

            <button onClick={() => setIsOpen(false)} className="rounded-full p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors">
              ✕
            </button>
          </div>
        </div>

        {/* FLOATING OVERLAY PANEL CONTAINER */}
        {isAuthenticated && (isTasksOpen || isHistoryOpen || isSettingsOpen) && (
          <div className="absolute top-14 left-3 right-3 z-30 bg-[#121722]/98 border border-blue-500/30 rounded-2xl shadow-2xl p-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-white/10">
              <span className="text-xs font-bold text-gray-200 uppercase tracking-wider">
                {isTasksOpen && `⚡ ${taskDef.headerTitle}`}
                {isHistoryOpen && "📜 Sohbet Arşivi & Geçmiş"}
                {isSettingsOpen && ct("personalize", activeLocale)}
              </span>
              <button
                type="button"
                onClick={() => { setIsTasksOpen(false); setIsHistoryOpen(false); setIsSettingsOpen(false); }}
                className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
              >
                ✕
              </button>
            </div>

            {/* Smart Tasks Modal Content with DIRECT TOGGLE (+) and (-) */}
            {isTasksOpen && (
              <div className="space-y-3">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-gray-400 font-mono">Aktif Görevler ({activeTasks.length})</span>
                    {activeTasks.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllTasks}
                        className="text-[9px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 rounded cursor-pointer"
                      >
                        🗑️ Tümünü Temizle
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={handleBreakPrompt} className="text-[10px] font-bold text-amber-300 hover:text-amber-200 border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 rounded">
                      {taskDef.breakBtn}
                    </button>
                    <select
                      value={muteDuration}
                      onChange={(e) => setMuteDuration(e.target.value)}
                      className="bg-[#1a2333] border border-blue-500/30 text-xs text-blue-300 rounded px-1.5 py-0.5 focus:outline-none"
                    >
                      <option value="off">🔕 Bildirimleri Sessize Al</option>
                      <option value="30m">30 Dakika</option>
                      <option value="1h">1 Saat</option>
                      <option value="market_close">Piyasa Kapanışına Kadar</option>
                    </select>
                  </div>
                </div>

                {/* TASK CARDS STANDARD */}
                {activeTasks.length > 0 ? (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeTasks.map((t) => (
                      <div key={t.id} className="bg-[#161b22] border border-blue-500/30 p-2.5 rounded-xl text-xs space-y-1.5">
                        <div className="flex justify-between items-center">
                          <span className="font-extrabold text-white uppercase tracking-wide">
                            {t.subject || t.task_type.replace(/_/g, " ")} · Günlük Takip
                          </span>
                          <span className="text-[9px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded font-mono">
                            Sonraki: {t.schedule?.midday || (marketStatus.isEarlyClose ? "11:15 ET" : "12:00 ET")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                          <button
                            type="button"
                            onClick={() => {
                              setIsTasksOpen(false);
                              append({ role: "user", content: `${t.subject} son durum raporunu göster.` });
                            }}
                            className="text-[10px] font-bold text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 px-2 py-0.5 rounded"
                          >
                            ▶️ Raporu Çalıştır / Aç
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCancelTask(t.id)}
                            className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded border border-red-500/30"
                          >
                            🗑️ Görevi Sil
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">Henüz aktif takibe alınmış bir görev bulunmuyor.</p>
                )}

                {/* CUSTOM TASK INPUT FORM (Siz Yazın - 100% Esnek & Dayatmasız!) */}
                <form onSubmit={handleAddCustomTask} className="pt-3 border-t border-white/10 space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-blue-400 font-mono block">
                    ➕ Kendi Özel Takip Görevinizi Ekleyin
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customTaskInput}
                      onChange={(e) => setCustomTaskInput(e.target.value)}
                      placeholder="Hisse, sektör veya konu yazın (örn: AAPL, Biyoteknoloji, Yarı İletkenler)..."
                      className="flex-1 bg-[#161b22] border border-blue-500/30 focus:border-blue-400 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none transition-colors"
                    />
                    <button
                      type="submit"
                      disabled={!customTaskInput.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs px-3 py-2 rounded-lg transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                    >
                      + Ekle
                    </button>
                  </div>
                </form>

                {/* OPTIONAL BROAD CATEGORY SUGGESTIONS */}
                <div className="pt-2 border-t border-white/5 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 font-mono block">
                    💡 Genel Piyasa Kategorileri (İsteğe Bağlı Hızlı Seçim)
                  </span>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                    {taskDef.quickChoices.map((choice: any, i: number) => {
                      const isAdded = activeTasks.some((t) => t.subject === choice.subject || t.task_type === choice.type);
                      return (
                        <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-[#141924] border border-white/10 text-xs">
                          <span className="font-semibold text-gray-300">{choice.label}</span>
                          {isAdded ? (
                            <button
                              type="button"
                              onClick={() => {
                                const existing = activeTasks.find((t) => t.subject === choice.subject || t.task_type === choice.type);
                                if (existing) handleCancelTask(existing.id);
                              }}
                              className="px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 text-[10px] font-bold transition-all"
                            >
                              ✓ Ekli (Sil)
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                if (isAuthenticated) {
                                  try {
                                    const res = await fetch("/api/copilot/tasks", {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({ taskType: choice.type, subject: choice.subject, language: activeLocale }),
                                    });
                                    if (res.ok) {
                                      const data = await res.json();
                                      if (data?.task) setActiveTasks((prev) => [data.task, ...prev]);
                                    }
                                  } catch {}
                                } else {
                                  setActiveTasks((prev) => [
                                    {
                                      id: `task-${Date.now()}`,
                                      user_id: "demo",
                                      task_type: choice.type,
                                      subject: choice.subject,
                                      status: "active",
                                      language: activeLocale,
                                      schedule: { premarket: "08:45", midday: "12:00", closing: "16:15" },
                                      created_at: new Date().toISOString(),
                                    },
                                    ...prev,
                                  ]);
                                }
                              }}
                              className="px-2 py-0.5 rounded bg-blue-600/30 hover:bg-blue-600/50 border border-blue-500/40 text-blue-300 text-[10px] font-bold transition-all"
                            >
                              + Ekle
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* History Modal Content */}
            {isHistoryOpen && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">Görüntülenen Oturumlar</span>
                  <button type="button" onClick={handleClearHistory} className="text-[10px] font-bold text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-2 py-0.5 rounded cursor-pointer">
                    🗑️ Ekrandan Temizle
                  </button>
                </div>
                {archives.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
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
              </div>
            )}

            {/* Settings Modal Content */}
            {isSettingsOpen && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{ct("assistantName", activeLocale)}</label>
                  <input
                    type="text"
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder={getSuggestedName(activeLocale)}
                    maxLength={30}
                    className="w-full mt-1 bg-[#161b22] border border-white/10 rounded-lg py-2 px-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{ct("chooseAvatar", activeLocale)}</label>
                  <div className="flex gap-2 mt-1.5">
                    {AVATAR_OPTIONS.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setDraftAvatar(a.id)}
                        className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${a.gradient} text-base transition-all ${draftAvatar === a.id ? "ring-2 ring-white ring-offset-2 ring-offset-[#0f1420] scale-110" : "opacity-60 hover:opacity-100"}`}
                      >
                        {a.emoji}
                      </button>
                    ))}
                  </div>
                </div>
                <button type="button" onClick={handleSaveSettings} className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors">
                  {ct("save", activeLocale)}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Messages Body (Generous Vertical Height) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isAuthenticated ? (
            messages.length === 0 ? (
              <div className="flex flex-col gap-3">
                <div className="bg-[#141924] p-4 rounded-2xl border border-[#2a384e] shadow-lg text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                  {dailyGreeting.welcomeMessage}
                </div>

                <div className="grid grid-cols-1 gap-2 pt-1">
                  {dailyGreeting.pills.map((pill, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => append({ role: "user", content: pill.prompt })}
                      className="w-full text-left p-3 rounded-xl bg-[#161b22] hover:bg-blue-600/20 border border-blue-500/30 hover:border-blue-400 text-xs font-bold text-gray-200 hover:text-white transition-all shadow-md flex items-center justify-between group active:scale-[0.98] cursor-pointer"
                    >
                      <span>{pill.label}</span>
                      <span className="text-blue-400 group-hover:translate-x-1 transition-transform font-mono text-sm">→</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col max-w-[92%] ${msg.role === "user" ? "ml-auto" : "mr-auto"}`}>
                  <div className={`p-3.5 text-sm rounded-2xl prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-[#161b22] text-gray-200 border border-[#30363d] rounded-tl-sm shadow-md"}`}>
                    {msg.toolInvocations?.map((toolInv: any, idx: number) => {
                      const result = (toolInv as any).result;
                      if (!result) {
                        return <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-white/10 text-xs text-gray-500 animate-pulse">Piyasanın nabzını ölçüyorum...</div>;
                      }
                      if (toolInv.toolName === "navigate_to") {
                        return (
                          <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-blue-500/20 text-xs font-mono text-blue-400">
                            {result?.success ? ct("navigating", activeLocale, { ticker: result.ticker }) : `⚠️ ${result?.error || ct("navigateFailed", activeLocale)}`}
                          </div>
                        );
                      }
                      if (toolInv.toolName === "get_top_trending_stocks") {
                        const stocks: StockCardProps[] = result?.stocks || [];
                        const tickers: string[] = result?.tickers || [];
                        return (
                          <div key={idx} className="my-3 space-y-3">
                            <div className="text-xs font-extrabold text-cyan-400 font-mono flex items-center gap-1.5">
                              🔥 {result?.categoryName || "BOGASTOCK Trend Hisseleri"}
                            </div>

                            {tickers.length > 0 && (
                              <div className="grid grid-cols-2 gap-2">
                                {tickers.map((t: string, i: number) => (
                                  <button
                                    key={i}
                                    type="button"
                                    onClick={() => append({ role: "user", content: `${t} hissesini detaylı analiz et` })}
                                    className="p-2.5 rounded-xl bg-[#141924] hover:bg-blue-600/25 border border-blue-500/30 hover:border-blue-400 text-left font-mono font-bold text-xs text-blue-400 hover:text-white flex items-center justify-between cursor-pointer transition-all active:scale-[0.98]"
                                  >
                                    <span>${t}</span>
                                    <span className="text-[10px] text-blue-300 font-sans">Analiz Et →</span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {stocks.length > 0 && (
                              <div className="space-y-2 pt-1">
                                {stocks.map((sProps: any, i: number) => (
                                  <StockCard key={i} data={sProps} locale={activeLocale} />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      }
                      if (toolInv.toolName === "show_stock_card") {
                        if (!result?.success) return <div key={idx} className="my-2 bg-[#0a0e17] p-2 rounded-lg border border-yellow-500/20 text-xs text-yellow-400">⚠️ {result?.error || ct("noStockData", activeLocale)}</div>;
                        return <StockCard key={idx} data={result as StockCardProps} locale={activeLocale} />;
                      }
                      if (toolInv.toolName === "search_market_news") {
                        const newsItems = result?.news || [];
                        return (
                          <div key={idx} className="my-2 bg-[#0a0e17] p-3 rounded-xl border border-blue-500/30 text-xs space-y-2">
                            <span className="font-bold text-blue-400 flex items-center gap-1.5">📰 Canlı ABD Piyasası ve Haber Akışı ({result?.query || "Wall Street"})</span>
                            <div className="space-y-1.5">
                              {newsItems.map((n: any, i: number) => (
                                <a key={i} href={n.link} target="_blank" rel="noopener noreferrer" className="block p-1.5 rounded bg-[#141924] hover:bg-blue-600/20 border border-white/5 hover:border-blue-500/40 text-gray-200 hover:text-white transition-all">
                                  <p className="font-semibold leading-snug">{n.title}</p>
                                  <div className="flex justify-between items-center text-[9px] text-gray-500 mt-1 font-mono">
                                    <span>{n.source}</span>
                                    <span>{n.pubDate}</span>
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })}
                    {typeof msg.content === "string" && msg.content && (
                      <ReactMarkdown
                        urlTransform={(url) => url.startsWith("copilot://") || url.startsWith("copilot-topic://") ? url : defaultUrlTransform(url)}
                        components={{
                          a: ({ href, children }) => {
                            if (href?.startsWith("copilot://")) {
                              const ticker = href.replace("copilot://", "").trim().toUpperCase();
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    router.push(`/global/${activeLocale}/graphic/${ticker}`);
                                    setIsOpen(false);
                                  }}
                                  className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 hover:border-blue-500 text-blue-400 hover:text-white rounded text-[11px] font-bold uppercase transition-all cursor-pointer"
                                >
                                  {children}
                                </button>
                              );
                            }
                            if (href?.startsWith("copilot-topic://")) {
                              const topicText = extractPlainText(children);
                              return (
                                <button type="button" onClick={() => topicText && append({ role: "user", content: topicText })} className="block w-full text-left my-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer touch-manipulation active:scale-[0.98]">
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
            demoMessages.map((msg) => (
              <div key={msg.id} className={`flex flex-col max-w-[92%] ${msg.role === "user" ? "ml-auto" : "mr-auto"} space-y-2`}>
                <div className={`p-3.5 text-sm rounded-2xl prose prose-invert prose-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "bg-blue-600 text-white rounded-tr-sm" : "bg-[#161b22] text-gray-200 border border-[#30363d] rounded-tl-sm shadow-md"}`}>
                  <ReactMarkdown
                    urlTransform={(url) => url.startsWith("copilot://") || url.startsWith("copilot-topic://") ? url : defaultUrlTransform(url)}
                    components={{
                      a: ({ href, children }) => {
                        if (href?.startsWith("copilot://")) {
                          const ticker = href.replace("copilot://", "").trim().toUpperCase();
                          return (
                            <button
                              type="button"
                              onClick={() => {
                                router.push(`/global/${activeLocale}/graphic/${ticker}`);
                                setIsOpen(false);
                              }}
                              className="inline-flex items-center px-1.5 py-0.5 mx-0.5 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/40 hover:border-blue-500 text-blue-400 hover:text-white rounded text-[11px] font-bold uppercase transition-all cursor-pointer"
                            >
                              {children}
                            </button>
                          );
                        }
                        if (href?.startsWith("copilot-topic://")) {
                          const topicText = extractPlainText(children);
                          return (
                            <button type="button" onClick={() => topicText && handleVisitorActionClick({ label: topicText, id: topicText })} className="block w-full text-left my-1 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 hover:border-blue-500/60 text-blue-300 hover:text-white rounded-lg text-xs font-semibold transition-all cursor-pointer touch-manipulation active:scale-[0.98]">
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
                </div>

                {msg.buttons && msg.buttons.length > 0 && msg.role === "assistant" && (
                  <div className="grid grid-cols-1 gap-2 pt-1">
                    {msg.buttons.map((btn) => (
                      <button
                        key={btn.id}
                        type="button"
                        onClick={() => handleVisitorActionClick(btn)}
                        disabled={demoLoading}
                        className="w-full text-left p-3 rounded-xl bg-[#161b22] hover:bg-blue-600/25 border border-blue-500/30 hover:border-blue-400 text-xs font-bold text-gray-200 hover:text-white transition-all shadow-md flex items-center justify-between group active:scale-[0.98] cursor-pointer"
                      >
                        <span>{btn.label}</span>
                        <span className="text-blue-400 group-hover:translate-x-1 transition-transform font-mono text-sm">→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {error && (
            <div className="bg-[#141924] border border-blue-500/30 p-4 rounded-2xl text-xs space-y-2 shadow-lg">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <span>☕ Piyasa Masasını Düzenliyorum...</span>
              </div>
              <p className="text-gray-300 leading-relaxed">
                Piyasa mutfağında birkaç rakam birbirine karıştı. Sana eksik bir analiz sunmak yerine tabloyu yeniden düzenliyorum. Lütfen sorunuzu bir kez daha iletin.
              </p>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Footer */}
        <form onSubmit={isAuthenticated ? handleSubmit : handleVisitorInputSubmit} className="border-t border-white/10 p-4 pb-8 sm:pb-4 bg-[#0d1117] shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              value={isAuthenticated ? input : demoInput}
              onChange={isAuthenticated ? handleInputChange : (e) => setDemoInput(e.target.value)}
              placeholder={ct("inputPlaceholder", activeLocale)}
              disabled={inputDisabled}
              className="w-full bg-[#161b22] border border-white/10 rounded-full py-3 pl-4 pr-12 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
            />
            <button type="submit" disabled={isAuthenticated ? (!input.trim() || inputDisabled) : (!demoInput.trim() || demoLoading)} className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white disabled:opacity-50 hover:bg-blue-500 transition-colors touch-manipulation">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            </button>
          </div>
        </form>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/60 z-[115] sm:hidden backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}
    </>
  );
}
