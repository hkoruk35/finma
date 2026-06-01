"use client";

import { useEffect, useState } from "react";

interface ThemeCountBadgeProps {
  themeName: string;
  staticCount: number;
}

export default function ThemeCountBadge({ themeName, staticCount }: ThemeCountBadgeProps) {
  const [count, setCount] = useState(staticCount);

  useEffect(() => {
    // localStorage anlık
    try {
      const raw = localStorage.getItem("shared_theme_overrides");
      if (raw) {
        const overrides = JSON.parse(raw);
        const customList = overrides[themeName] || [];
        if (customList.length > 0) setCount(staticCount + customList.length);
      }
    } catch {}
    // API'den taze (sessiz arka plan)
    fetch("/api/store/theme_overrides")
      .then(r => r.json())
      .then(({ value }) => {
        if (!value) return;
        try { localStorage.setItem("shared_theme_overrides", JSON.stringify(value)); } catch {}
        const customList = (value as Record<string, string[]>)[themeName] || [];
        setCount(staticCount + customList.length);
      })
      .catch(() => {});
  }, [themeName, staticCount]);

  return (
    <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-black group-hover:bg-[#3b82f6]/20 group-hover:text-[#3b82f6] transition-colors">
      {count}
    </span>
  );
}
