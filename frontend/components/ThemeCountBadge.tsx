"use client";

import { useEffect, useState } from "react";

interface ThemeCountBadgeProps {
  themeName: string;
  staticCount: number;
}

export default function ThemeCountBadge({ themeName, staticCount }: ThemeCountBadgeProps) {
  const [count, setCount] = useState(staticCount);

  useEffect(() => {
    try {
      const overridesStr = localStorage.getItem("theme_overrides");
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        const customList = overrides[themeName] || [];
        if (customList.length > 0) {
          // Merge lists and determine unique count
          setCount(staticCount + customList.length);
        }
      }
    } catch {}
  }, [themeName, staticCount]);

  return (
    <span className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded font-black group-hover:bg-[#3b82f6]/20 group-hover:text-[#3b82f6] transition-colors">
      {count}
    </span>
  );
}
