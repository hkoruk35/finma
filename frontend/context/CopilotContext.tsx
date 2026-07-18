"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useChat } from "ai/react";

export interface CopilotContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: any[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  isLoading: boolean;
  pageContext: any;
  setPageContext: (context: any) => void;
  append: (message: any) => Promise<string | null | undefined>;
}

const CopilotContext = createContext<CopilotContextType | undefined>(undefined);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pageContext, setPageContext] = useState<any>(null);
  const pathname = usePathname();
  const router = useRouter();

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

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } = useChat({
    api: "/api/copilot/chat",
    body: { pageContext },
    onToolCall({ toolCall }) {
      if (toolCall.toolName === 'navigate_to') {
        const { ticker } = toolCall.args as any;
        if (ticker && typeof ticker === 'string') {
          // Keep chat open and navigate
          router.push(`/global/tr/graphic/${ticker.toUpperCase()}`);
        }
      }
    },
    onError: (error) => {
      console.error("Copilot AI Error:", error);
    }
  });

  return (
    <CopilotContext.Provider
      value={{
        isOpen,
        setIsOpen,
        messages,
        input,
        handleInputChange,
        handleSubmit,
        isLoading,
        pageContext,
        setPageContext,
        append
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
