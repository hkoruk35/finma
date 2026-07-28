"use client";

import { RefObject, KeyboardEvent } from "react";
import type { Locale } from "@/lib/i18n/copy";

type L = Record<Locale, string>;

const HEADLINE: L = { tr: "Ne öğrenmek istersiniz?", en: "What do you want to know?", es: "¿Qué quieres saber?", fr: "Que voulez-vous savoir ?", pt: "O que você quer saber?" };
const PLACEHOLDER: L = {
  tr: "BOGA AI'a sorun...", en: "Ask BOGA AI...", es: "Pregunta a BOGA AI...", fr: "Demandez à BOGA AI...", pt: "Pergunte à BOGA AI...",
};

// Referans (Gemini) tasarımdaki gibi sade metin öneri linkleri — ikon+başlık+
// altyazılı kart değil, tıklanınca doğrudan o soruyu gönderen kısa satırlar.
// /api/ask genel sohbeti artık herkese açık, bu yüzden ticker'a bağlı olmayan
// gerçek sorular kullanıyoruz (bkz. AI_BEHAVIOR — hisse ağırlıklı yapma).
const SUGGESTIONS: L[] = [
  {
    tr: "Yapay zeka ve teknoloji sektöründe öne çıkan hisseler hangileri?", en: "Which stocks are leading in the AI and technology sector?",
    es: "¿Qué acciones lideran el sector de IA y tecnología?", fr: "Quelles actions dominent le secteur de l'IA et de la technologie ?",
    pt: "Quais ações lideram o setor de IA e tecnologia?",
  },
  {
    tr: "Bu hafta küresel ekonomiyi ve piyasaları neler etkiliyor?", en: "What's driving the global economy and markets this week?",
    es: "¿Qué está impulsando la economía global y los mercados esta semana?", fr: "Qu'est-ce qui influence l'économie mondiale et les marchés cette semaine ?",
    pt: "O que está impulsionando a economia global e os mercados esta semana?",
  },
  {
    tr: "En yüksek BOGA skoruna sahip hisseler hangileri?", en: "Which stocks currently have the highest BOGA score?",
    es: "¿Qué acciones tienen actualmente la puntuación BOGA más alta?", fr: "Quelles actions ont actuellement le score BOGA le plus élevé ?",
    pt: "Quais ações têm atualmente a maior pontuação BOGA?",
  },
];

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
    <div className="mt-24 md:mt-32 animate-fade-in max-w-2xl mx-auto w-full px-4">
      <h1 className="text-3xl md:text-4xl font-medium text-white text-center mb-8">{HEADLINE[locale]}</h1>

      <div className="flex items-center gap-2 bg-[#111826] border border-[#1e2a3a] rounded-full pl-5 pr-2 py-2 focus-within:border-[#3b82f6]/50 transition-all">
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#64748b]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
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
        />
        <span className="shrink-0 w-5 h-5 flex items-center justify-center text-[#64748b]">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" /></svg>
        </span>
        <button onClick={() => onSend()} disabled={loading || !input.trim()} className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-[#1d4ed8] text-white hover:bg-[#2563eb] disabled:opacity-40 disabled:bg-[#1e2a3a] transition-all">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </button>
      </div>

      <div className="mt-6 space-y-1">
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onSend(s[locale])}
            className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm text-[#94a3b8] hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="text-[#475569] shrink-0">↪</span>
            <span className="truncate">{s[locale]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
