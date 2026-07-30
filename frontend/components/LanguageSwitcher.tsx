"use client";

import { useState, useEffect, useRef } from "react";
import { LOCALES, Locale } from "@/lib/academy-i18n";

interface Props {
  currentLocale: Locale;
  onChange: (locale: Locale) => void;
}

export default function LanguageSwitcher({ currentLocale, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === currentLocale)!;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        id="language-switcher-btn"
        aria-label="Select language"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141924] border border-[#1e2a3a] hover:border-[#3b82f6]/40 transition-all text-sm font-medium text-white"
      >
        <span className="text-base">{current.flag}</span>
        <span>{current.label}</span>
        <svg
          className={`w-4 h-4 text-[#00d2ff] transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-xl border border-[#1e2a3a] bg-[#0f1520] shadow-2xl overflow-hidden animate-fade-in">
          {LOCALES.map((locale) => (
            <button
              key={locale.code}
              id={`lang-${locale.code}`}
              onClick={() => { onChange(locale.code); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors
                ${locale.code === currentLocale
                  ? "bg-[#3b82f6]/10 text-[#3b82f6] font-medium"
                  : "text-white hover:bg-[#141924] hover:text-white"
                }`}
            >
              <span className="text-base">{locale.flag}</span>
              <span>{locale.label}</span>
              {locale.code === currentLocale && (
                <svg className="w-3.5 h-3.5 ml-auto text-[#3b82f6]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
