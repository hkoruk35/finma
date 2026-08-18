"use client";
import { useEffect, useState } from "react";

export function ClientTime({ timestamp, lang }: { timestamp: string; lang: string }) {
  const [localTime, setLocalTime] = useState("");

  useEffect(() => {
    try {
      if (!timestamp) return;
      const d = new Date(timestamp);
      const formatted = new Intl.DateTimeFormat(lang, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(d);
      setLocalTime(formatted);
    } catch {}
  }, [timestamp, lang]);

  if (!localTime) return <span className="opacity-50">...</span>;
  return <span>{localTime}</span>;
}
