"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "ai/react";
import { getSuggestedName } from "@/lib/copilot/persona";

export interface UsageState {
  currentUsage: number;
  dailyLimit: number;
  hasAccess: boolean;
}

export interface ProfileState {
  displayName: string;
  avatarId: string;
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
  const [pageContext, setPageContext] = useState<any>(null);
  const [usage, setUsage] = useState<UsageState | null>(null);
  const [profile, setProfile] = useState<ProfileState>({ displayName: "", avatarId: "aylin" });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const locale = localeFromPathname(pathname);

  // Auto-update context based on route
  useEffect(() => {
    if (!pathname) return;

    if (pathname.includes("/graphic/")) {
      const parts = pathname.split("/");
      const ticker = parts[parts.length - 1].toUpperCase();
      setPageContext({ type: "ticker", value: ticker, page: "graphic" });
    } else if (pathname.includes("/swing")) {
      setPageContext({ type: "page", value: "swing_picks", page: "swing" });
    } else if (pathname.includes("/watchlist")) {
      setPageContext({ type: "page", value: "watchlist", page: "watchlist" });
    } else {
      setPageContext({ type: "page", value: "home", page: "home" });
    }
  }, [pathname]);

  const refreshUsage = useCallback(() => {
    fetch("/api/copilot/usage")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setUsage(d); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/members/me")
      .then((r) => {
        if (!r.ok) throw new Error();
        setIsAuthenticated(true);
        refreshUsage();
        return fetch("/api/copilot/profile");
      })
      .then((r) => (r && r.ok ? r.json() : null))
      .then((d) => {
        if (d) setProfile({ displayName: d.displayName || getSuggestedName(locale), avatarId: d.avatarId || "aylin" });
      })
      .catch(() => setIsAuthenticated(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/copilot/chat",
    body: { pageContext, locale },
    onToolCall({ toolCall }) {
      if (toolCall.toolName === "navigate_to") {
        const { ticker } = toolCall.args as any;
        if (ticker && typeof ticker === "string") {
          router.push(`/global/${locale}/graphic/${ticker.toUpperCase()}`);
        }
      }
    },
    onFinish() {
      refreshUsage();
    },
    onError: (error) => {
      console.error("Copilot AI Error:", error);
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
