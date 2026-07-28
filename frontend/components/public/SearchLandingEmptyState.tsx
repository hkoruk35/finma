"use client";

import { RefObject, KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n/copy";
import SearchLandingCards from "@/components/public/SearchLandingCards";

type L = Record<Locale, string>;

const HEADLINE: L = { tr: "Ne öğrenmek istersiniz?", en: "What do you want to know?", es: "¿Qué quieres saber?", fr: "Que voulez-vous savoir ?", pt: "O que você quer saber?" };
const PLACEHOLDER: L = {
  tr: "Sorularınızı yazın...", en: "Ask your questions...", es: "Escribe tus preguntas...", fr: "Posez vos questions...", pt: "Faça suas perguntas...",
};

interface Props {
  locale: Locale;
  lang: string;
  input: string;
  setInput: (v: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  loading: boolean;
  onSend: (text?: string) => void;
}

export default function SearchLandingEmptyState({ locale, input, setInput, inputRef, loading, onSend }: Props) {
  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="mt-12 md:mt-16 animate-fade-in max-w-6xl mx-auto w-full px-4 space-y-12">
      <h1 className="text-white text-center font-semibold" style={{ fontSize: '32px', fontFamily: 'Inter' }}>{HEADLINE[locale]}</h1>

      {/* Search Input */}
      <div className="flex items-center gap-2 bg-[#111826] border border-[#1e2a3a] rounded-full pl-5 pr-2 py-2 focus-within:border-[#3b82f6]/50 transition-all max-w-2xl mx-auto w-full">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#64748b]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
        </span>
        <textarea
          id="search-landing-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={PLACEHOLDER[locale]}
          rows={1}
          className="flex-1 min-w-0 bg-transparent border-0 outline-none resize-none text-sm py-1.5"
          disabled={loading}
        />
        <button onClick={() => onSend()} disabled={loading || !input.trim()} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-40 disabled:bg-[#1e2a3a] transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>

      {/* Cards */}
      <SearchLandingCards locale={locale} onAsk={onSend} loading={loading} />
    </div>
  );
}
