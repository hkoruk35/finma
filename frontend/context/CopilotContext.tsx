"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { getSuggestedName } from "@/lib/copilot/persona";
import { resolveRouteKey, buildRoute, RouteKey } from "@/lib/copilot/routes";
import { buildPageContext, CopilotPageContext } from "@/lib/copilot/pageContextSchema";

const LIST_CATEGORY_TO_ROUTE_KEY: Record<string, RouteKey> = {
  trend_stocks: "trend_list",
  trend_candidate_watchlist: "trend_candidate_watchlist",
  boga_ai_watchlist: "trend_candidate_watchlist",
  top_7: "top7",
  top_100: "top100",
  user_watchlist: "my_watchlist",
};

export interface UsageState {
  currentUsage: number;
  dailyLimit: number;
  hasAccess: boolean;
}

export interface ProfileState {
  displayName: string;
  avatarId: string;
}

export interface MemberState {
  username: string | null;
  email: string | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
}

export interface CopilotContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  messages: any[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  pageContext: any;
  locale: string;
  append: (message: any) => Promise<string | null | undefined>;
  usage: UsageState | null;
  profile: ProfileState;
  saveProfile: (next: ProfileState) => Promise<void>;
  isAuthenticated: boolean;
  member: MemberState | null;
  accessMode: "visitor" | "member" | "expired_member";
  error: Error | undefined;
  setMessages: (messages: any[]) => void;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

function localeFromPathname(pathname: string | null): string {
  if (!pathname) return "en";
  const parts = pathname.split("/");
  // /global/{locale}/...
  if (parts[1] === "global" && ["tr", "en", "es", "fr", "pt"].includes(parts[2])) {
    return parts[2];
  }
  return "en";
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [pageContext, setPageContext] = useState<CopilotPageContext | null>(null);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [profile, setProfile] = useState<ProfileState>({ displayName: "", avatarId: "aylin" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [member, setMember] = useState<MemberState | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  const locale = localeFromPathname(pathname);

  // Auto-update context based on route — Page Context Service (spec böl. 6).
  // Route registry sayesinde locale'e özel slug'lar (tr: "sss", en: "faq" vb.)
  // ve varlık sınıfı çıkarımı doğru şekilde çözülür.
  useEffect(() => {
    if (!pathname) return;
    const { key, ticker, themeSlug } = resolveRouteKey(pathname);
    setPageContext(buildPageContext(key, ticker, locale, themeSlug));
  }, [pathname, locale]);

  useEffect(() => {
    console.log("[Copilot] Locale from pathname:", locale, "pathname:", pathname);
  }, [locale, pathname]);

  const refreshUsage = useCallback(() => {
    fetch("/api/copilot/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUsage(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/members/me")
      .then(async (r) => {
        if (!r.ok) throw new Error();
        const d = await r.json().catch(() => null);
        const m = d?.member;
        if (m) {
          setMember({
            username: m.username || null,
            email: m.email || null,
            subscriptionStatus: m.subscription_status || null,
            currentPeriodEnd: m.current_period_end || null,
            cancelAtPeriodEnd: m.cancel_at_period_end ?? null,
          });
        }
        setIsAuthenticated(true);
        refreshUsage();
        fetch(`/api/copilot/history?locale=${locale}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            // Sadece kullanıcı henüz bu sekmede mesaj göndermemişse geri yükle —
            // aktif bir sohbetin üzerine yazma riskini önler.
            if (d?.messages?.length > 0) {
              setMessages((prev) => (prev.length === 0 ? d.messages : prev));
            }
          })
          .catch(() => {});
        return fetch("/api/copilot/profile");
      })
      .then((r) => (r && r.ok ? r.json() : null))
      .then((d) => {
        if (d) setProfile({ displayName: d.displayName || getSuggestedName(locale), avatarId: d.avatarId || "aylin" });
      })
      .catch(() => setIsAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aktif ücretli plan mı, süresi dolmuş (daha önce ücretliydi) mi, yoksa hiç
  // üye değil mi — spec böl. 1.1-1.3'teki üç erişim modu. Nihai yetki kontrolü
  // her zaman sunucuda (getMemberAccess/plan) yapılır; bu sadece UI/prompt tonu içindir.
  const accessMode: "visitor" | "member" | "expired_member" = !isAuthenticated
    ? "visitor"
    : member?.subscriptionStatus && !["active", "trialing"].includes(member.subscriptionStatus)
      ? "expired_member"
      : "member";

  const saveProfile = useCallback(async (next: ProfileState) => {
    setProfile(next);
    try {
      await fetch("/api/copilot/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: next.displayName, avatarId: next.avatarId }),
      });
    } catch {}
  }, []);

  const { messages, setMessages, input, handleInputChange, handleSubmit, isLoading, append, error } = useChat({
    api: "/api/copilot/chat",
    body: { pageContext, locale },
    onResponse: (response) => {
      console.log("[CopilotContext] Chat response received", { locale, status: response.status });
    },
    onError: (err) => {
      console.error("[CopilotContext] Chat error", { locale, error: err });
    },
    onToolCall({ toolCall }) {
      if (toolCall.toolName === "navigate_to") {
        const { ticker } = toolCall.args as any;
        if (ticker && typeof ticker === "string") {
          router.push(buildRoute("graphic", locale, ticker));
        }
      }
      // Kullanıcı bir liste sorduğunda (ör. "trend listesini göster"), sadece
      // metin/buton beklemek yerine ilgili site sayfasını arka planda hemen
      // açar — Copilot paneli açık kalırken sayfa "eş zamanlı" güncellenir.
      if (toolCall.toolName === "get_top_trending_stocks") {
        const { category } = (toolCall.args as any) || {};
        const routeKey = LIST_CATEGORY_TO_ROUTE_KEY[category] || "trend_list";
        router.push(buildRoute(routeKey, locale));
      }
      if (toolCall.toolName === "get_theme_stocks") {
        const { themeSlug } = (toolCall.args as any) || {};
        if (themeSlug && typeof themeSlug === "string") {
          router.push(buildRoute("themes", locale, themeSlug));
        }
      }
    },
    onFinish() {
      refreshUsage();
    },
  });

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        isSettingsOpen,
        setIsSettingsOpen,
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        pageContext,
        locale,
        append,
        usage,
        profile,
        saveProfile,
        isAuthenticated,
        member,
        accessMode,
        error,
        setMessages,
      }}
    >
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const context = useContext(CopilotContext);
  if (context === undefined) {
    throw new Error("useCopilot must be used within a CopilotProvider");
  }
  return context;
}
