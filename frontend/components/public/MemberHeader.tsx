"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/i18n/copy";
import TrialCountdown from "@/components/global/TrialCountdown";
import TrialPromoPopup from "@/components/global/TrialPromoPopup";

export default function MemberHeader({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  const homeHref = locale === "tr" ? "/global/tr/home" : locale === "es" ? "/global/es/home" : locale === "fr" ? "/global/fr/home" : locale === "pt" ? "/global/pt/home" : "/global/en/home";
  const accountHref = locale === "tr" ? "/global/tr/hesabim" : locale === "es" ? "/global/es/account" : locale === "fr" ? "/global/fr/account" : locale === "pt" ? "/global/pt/account" : "/global/en/account";
  const loginHref = locale === "tr" ? "/global/tr/giris" : locale === "es" ? "/global/es/login" : locale === "fr" ? "/global/fr/login" : locale === "pt" ? "/global/pt/login" : "/global/en/login";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/members/logout", { method: "POST" });
    } finally {
      router.push(loginHref);
    }
  };

  return (
    <>
    <TrialPromoPopup locale={locale} />
    <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/90 backdrop-blur-md sticky top-0 z-50">
      <div className="w-full max-w-[1800px] mx-auto px-3 h-12 flex items-center gap-3">
        <Link href={homeHref} className="flex items-center gap-2 group flex-shrink-0">
          <div className="relative w-8 h-8 group-hover:scale-110 transition-transform flex-shrink-0">
            <Image
              src="/finmawave.png"
              alt="BOGASTOCK"
              width={32}
              height={32}
              priority
              className="object-contain rounded-lg shadow-lg shadow-blue-500/10"
            />
          </div>
          <div className="flex flex-col md:flex-row md:items-baseline">
            <span
              className="text-lg md:text-xl text-white tracking-tighter"
              style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 700 }}
            >
              BOGA<span className="text-[#3b82f6]">STOCK</span>
            </span>
            <span className="hidden md:inline text-[9px] text-[#3b82f6] md:ml-2 font-black uppercase tracking-[0.2em]">
              {locale === "tr" ? "FİNANSAL ANALİZ" : locale === "es" ? "ANÁLISIS FINANCIERO" : locale === "fr" ? "ANALYSE FINANCIÈRE" : locale === "pt" ? "ANÁLISE FINANCEIRA" : "Financial Analysis"}
            </span>
          </div>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Trial countdown — only visible for free-trial members */}
          <TrialCountdown locale={locale} />

          {/* Language Selector — mobilde gizli, hesap sayfasındaki Dil sekmesinden erişilebilir
              (Account/Hesabım > Language sekmesi) — dar ekranda ACCOUNT butonuna yer açmak için */}
          {locale && (
            <div className="hidden sm:flex items-center gap-0.5 bg-[#1e2a3a]/40 rounded-lg p-0.5 mr-2 border border-[#1e2a3a]/60">
              {['EN', 'ES', 'FR', 'PT', 'TR'].map((lang) => {
                const isActive = locale.toUpperCase() === lang;
                const isAvailable = lang === 'EN' || lang === 'TR' || lang === 'ES' || lang === 'FR' || lang === 'PT';
                
                if (!isAvailable) {
                  return (
                    <span
                      key={lang}
                      className="px-2 py-1 text-[10px] font-black uppercase tracking-wider text-[#64748b]/40 cursor-not-allowed select-none"
                      title="Coming Soon"
                    >
                      {lang}
                    </span>
                  );
                }
                
                return (
                  <Link
                    key={lang}
                    href={
                      pathname
                        ? pathname.replace(new RegExp(`^/global/${locale}`), `/global/${lang.toLowerCase()}`)
                        : `/global/${lang.toLowerCase()}/home`
                    }
                    className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                      isActive
                        ? "bg-[#3b82f6] text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                        : "text-[#64748b] hover:text-white hover:bg-white/10"
                    }`}
                  >
                    {lang}
                  </Link>
                );
              })}
            </div>
          )}

          <Link
            href={homeHref}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="hidden sm:inline">{locale === "tr" ? "Anasayfa" : locale === "es" ? "Inicio" : locale === "fr" ? "Accueil" : locale === "pt" ? "Início" : "Home"}</span>
          </Link>
          <Link
            href={locale === "pt" ? "/global/pt/Perguntas_Frequentes" : `/global/${locale}/about`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="hidden sm:inline">{locale === "tr" ? "SSS" : locale === "es" ? "FAQ" : locale === "fr" ? "FAQ" : locale === "pt" ? "FAQ" : "FAQ"}</span>
          </Link>
          <Link
            href={accountHref}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="hidden sm:inline">{locale === "tr" ? "Hesabım" : locale === "es" ? "Cuenta" : locale === "fr" ? "Compte" : locale === "pt" ? "Conta" : "Account"}</span>
          </Link>
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title={locale === "tr" ? "Çıkış Yap" : locale === "es" ? "Cerrar sesión" : locale === "fr" ? "Se déconnecter" : locale === "pt" ? "Sair" : "Log out"}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider text-[#64748b] hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-40"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
            </svg>
            <span className="hidden sm:inline">{loggingOut ? "..." : locale === "tr" ? "Çıkış" : locale === "es" ? "Salir" : locale === "fr" ? "Quitter" : locale === "pt" ? "Sair" : "Log out"}</span>
          </button>
        </div>
      </div>
    </header>
    </>
  );
}
