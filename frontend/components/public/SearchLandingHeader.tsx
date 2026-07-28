"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

// /global/{locale}/search'in kendi başlığı — bu bileşen SADECE bu tek URL
// şeklinde render olur, bu yüzden MemberHeader.tsx'in genel getLangHref'i
// (path regex + FAQ özel durumu) gerekmiyor, tek satırlık sabit hedef yeterli.
const getLangHref = (targetLocale: string) => `/global/${targetLocale.toLowerCase()}/search`;

const ASK_LABEL: Record<Locale, string> = { tr: "Sor", en: "Ask", es: "Preguntar", fr: "Demander", pt: "Perguntar" };
const ACCOUNT_LABEL: Record<Locale, string> = { tr: "Hesabım", en: "Account", es: "Cuenta", fr: "Compte", pt: "Conta" };
const SIGNIN_LABEL: Record<Locale, string> = { tr: "Giriş Yap", en: "Sign In", es: "Entrar", fr: "Connexion", pt: "Entrar" };
const SLOGAN = "Ask · Discover · Markets";
const COMPUTER_LABEL: Record<Locale, string> = {
  tr: "Bilgisayar", en: "Computer", es: "Computadora", fr: "Ordinateur", pt: "Computador",
};
const SEARCH_CHATS_LABEL: Record<Locale, string> = {
  tr: "Sohbetlerde Ara", en: "Search Chats", es: "Buscar Chats", fr: "Rechercher les Chats", pt: "Pesquisar Chats",
};

export default function SearchLandingHeader({ locale, onLogoClick }: { locale: Locale; onLogoClick: () => void }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);

  const computerHref = `/global/${locale}`;
  const accountHref = locale === "tr" ? "/global/tr/hesabim" : locale === "es" ? "/global/es/account" : locale === "fr" ? "/global/fr/account" : locale === "pt" ? "/global/pt/account" : "/global/en/account";
  const loginHref = locale === "tr" ? "/global/tr/giris" : locale === "es" ? "/global/es/login" : locale === "fr" ? "/global/fr/login" : locale === "pt" ? "/global/pt/login" : "/global/en/login";

  const focusSearchInput = () => {
    document.querySelector<HTMLTextAreaElement>("#search-landing-input")?.focus();
  };

  const tabClass = (active: boolean) =>
    `pb-1 text-sm font-bold transition-colors border-b-2 ${
      active ? "text-[#3b82f6] border-[#3b82f6]" : "text-[#64748b] border-transparent hover:text-white"
    }`;

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-[1800px] mx-auto px-4 h-16 flex items-center gap-6">
        <button onClick={onLogoClick} className="flex flex-col items-start flex-shrink-0 focus:outline-none">
          <span className="text-lg tracking-tight font-medium">
            <span className="text-[#3b82f6]">Boga</span><span className="text-white font-semibold">Smart</span>
          </span>
          <span className="hidden sm:inline text-[11px] text-[#64748b]">{SLOGAN}</span>
        </button>

        <nav className="flex items-center gap-6">
          <span className={tabClass(true)}>Ask BogaSmart</span>
        </nav>

        <div className="flex-1" />

        <div className="hidden sm:flex items-center gap-0.5 bg-[#1e2a3a]/40 rounded-lg p-0.5 border border-[#1e2a3a]/60">
          {(["EN", "ES", "FR", "PT", "TR"] as const).map((lg) => {
            const isActive = locale.toUpperCase() === lg;
            return (
              <Link
                key={lg}
                href={getLangHref(lg)}
                className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                  isActive ? "bg-[#3b82f6] text-white" : "text-[#64748b] hover:text-white hover:bg-white/10"
                }`}
              >
                {lg}
              </Link>
            );
          })}
        </div>

        <button
          onClick={focusSearchInput}
          title={ASK_LABEL[locale]}
          className="w-9 h-9 flex items-center justify-center rounded-full text-[#94a3b8] hover:text-white hover:bg-white/5 transition-all flex-shrink-0"
        >
          <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" /></svg>
        </button>

        {authChecked && (
          <Link
            href={isLoggedIn ? accountHref : loginHref}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all flex-shrink-0"
            title={isLoggedIn ? ACCOUNT_LABEL[locale] : SIGNIN_LABEL[locale]}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        )}
      </div>
    </header>
  );
}
