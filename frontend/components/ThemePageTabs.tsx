"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useMemberPlan } from "@/hooks/useMemberPlan";

const TABS = [
  { id: "hot", label: "🔥 2026 Trendleri", accent: "#e3b341" },
  { id: "sectors", label: "📊 Sektörler", accent: "#22d3ee" },
  { id: "csp", label: "📈 CSP Watchlist", accent: "#10b981" },
] as const;

type TabId = typeof TABS[number]["id"];

interface Props {
  hot: ReactNode;
  sectors: ReactNode;
  csp: ReactNode;
  locale?: string;
}

export default function ThemePageTabs({ hot, sectors, csp, locale = "tr" }: Props) {
  const [active, setActive] = useState<TabId>("hot");
  const sections: Record<TabId, ReactNode> = { hot, sectors, csp };
  const { tier } = useMemberPlan();
  const router = useRouter();
  const registerUrl = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;

  const handleTabClick = (tabId: TabId) => {
    if (tabId === "sectors" && tier === "anonymous") {
      router.push(registerUrl);
      return;
    }
    setActive(tabId);
  };

  return (
    <div>
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className="px-4 py-2 text-[11px] font-medium uppercase whitespace-nowrap rounded-lg border transition-all"
              style={
                isActive
                  ? { borderColor: tab.accent, color: tab.accent, background: `${tab.accent}1a` }
                  : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.4)" }
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Hepsi DOM'da kalır (SEO/internal linking için), görünürlük CSS ile yönetilir */}
      {TABS.map((tab) => (
        <div key={tab.id} className={active === tab.id ? "block" : "hidden"}>
          {sections[tab.id]}
        </div>
      ))}
    </div>
  );
}
