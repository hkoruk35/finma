"use client";

import { useEffect, useState } from "react";

interface ThemeCountBadgeProps {
  themeName: string;
  staticCount: number;
}

export default function ThemeCountBadge({ themeName, staticCount }: ThemeCountBadgeProps) {
  const [count, setCount] = useState(staticCount);

  useEffect(() => {
    // Cache anlık
    try {
      const raw = localStorage.getItem("t_theme_overrides");
      if (raw) {
        const overrides = JSON.parse(raw);
        setCount(staticCount + (overrides[themeName]?.length ?? 0));
      }
    } catch {}
    // API = gerçek kaynak
    fetch("/api/store/theme_overrides")
      .then(r => r.json())
      .then(({ value }) => {
        if (!value) return;
        try { localStorage.setItem("t_theme_overrides", JSON.stringify(value)); } catch {}
        setCount(staticCount + ((value as Record<string, string[]>)[themeName]?.length ?? 0));
      })
      .catch(() => {});
  }, [themeName, staticCount]);

  return (
    <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-medium group-hover:bg-[#3b82f6]/20 group-hover:text-[#3b82f6] transition-colors">
      {count}
    </span>
  );
}
