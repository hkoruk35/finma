"use client";

import { useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberSession } from "@/hooks/useMemberSession";

// /global/{locale}/search'in kendi başlığı — bu bileşen SADECE bu tek URL
// şeklinde render olur, bu yüzden MemberHeader.tsx'in genel getLangHref'i
// (path regex + FAQ özel durumu) gerekmiyor, tek satırlık sabit hedef yeterli.
import { usePathname } from "next/navigation";

export default function SearchLandingHeader({ locale, onLogoClick }: { locale: Locale; onLogoClick: () => void }) {
  const { isLoggedIn, authChecked } = useMemberSession();
  const [langOpen, setLangOpen] = useState(false);
  const pathname = usePathname();

  const ASK_LABEL: Record<Locale, string> = { tr: "Sor", en: "Ask", es: "Preguntar", fr: "Demander", pt: "Perguntar", id: "Tanya" };
  const ACCOUNT_LABEL: Record<Locale, string> = { tr: "Hesabım", en: "Account", es: "Cuenta", fr: "Compte", pt: "Conta", id: "Akun" };
  const SIGNIN_LABEL: Record<Locale, string> = { tr: "Giriş Yap", en: "Sign In", es: "Entrar", fr: "Connexion", pt: "Entrar", id: "Masuk" };
  const TODAY_LABEL: Record<Locale, string> = { tr: "Bugün Neler Oluyor", en: "What's Happening Today", es: "¿Qué pasa hoy?", fr: "Aujourd'hui", pt: "O que está acontecendo hoje", id: "Apa yang Terjadi Hari Ini" };
  const SLOGAN = "Ask · Discover · Markets";

  const getLangHref = (targetLocale: string) => {
    if (!pathname) return `/global/${targetLocale.toLowerCase()}/search`;
    const parts = pathname.split("/");
    if (parts.length >= 4 && parts[3] === "today") {
      return `/global/${targetLocale.toLowerCase()}/today`;
    }
    return `/global/${targetLocale.toLowerCase()}/search`;
  };

  const computerHref = `/global/${locale}`;
  const accountHref = locale === "tr" ? "/global/tr/hesabim" : `/global/${locale}/account`;
  const loginHref = locale === "tr" ? "/global/tr/giris" : `/global/${locale}/login`;

  const focusSearchInput = () => {
    document.querySelector<HTMLTextAreaElement>("#search-landing-input")?.focus();
  };

  const tabClass = (active: boolean) =>
    `pb-1 text-sm font-medium transition-colors border-b-2 ${
      active ? "text-[#3b82f6] border-[#3b82f6]" : "text-[#64748b] border-transparent hover:text-white"
    }`;

  return (
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-50" style={{ paddingTop: "env(safe-area-inset-top, 1rem)" }}>
      <div className="w-full max-w-[1800px] mx-auto px-4 h-16 flex items-center gap-3 sm:gap-6">
        <button onClick={onLogoClick} className="flex flex-col items-start flex-shrink-0 focus:outline-none">
          <span className="text-lg tracking-tight font-medium">
            <span className="text-[#3b82f6]">Boga</span><span className="text-white font-medium">Smart</span>
          </span>
          <span className="hidden sm:inline text-[11px] text-[#64748b]">{SLOGAN}</span>
        </button>

        <nav className="flex items-center gap-2 sm:gap-6">
          <Link
            href={`/global/${locale}/today`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30 hover:bg-[#3b82f6] hover:text-white transition-all shadow-[0_0_15px_rgba(59,130,246,0.1)]"
          >
            <span>📅</span>
            <span>{TODAY_LABEL[locale]}</span>
          </Link>
        </nav>

        <div className="flex-1" />

        <div className="relative z-50"> <button onClick={() => setLangOpen(!langOpen)} className="flex items-center gap-1 bg-[#1e2a3a]/40 border border-[#1e2a3a]/60 px-2 py-1 rounded-md text-[10px] font-medium text-white hover:bg-white/5 transition-all"> {locale.toUpperCase()} <svg className={`w-3 h-3 transition-transform ${langOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg> </button> {langOpen && ( <div className="absolute top-full right-0 mt-1 flex flex-col bg-[#0a0e17] border border-[#1e2a3a] rounded-lg shadow-xl p-1 min-w-[60px]"> {(["EN", "ES", "FR", "PT", "ID", "TR"] as const).map((lg) => { const isActive = locale.toUpperCase() === lg; return ( <Link key={lg} href={getLangHref(lg)} onClick={() => setLangOpen(false)} className={`px-2 py-1.5 rounded-md text-[10px] font-medium transition-all ${isActive ? "bg-[#3b82f6] text-white" : "text-[#64748b] hover:text-white hover:bg-white/10"}`} > {lg} </Link> ); })} </div> )} </div>

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




