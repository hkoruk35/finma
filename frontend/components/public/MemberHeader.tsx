"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

import MobileTerminalLink from "@/components/global/MobileTerminalLink";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export default function MemberHeader({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const [isDesktopUserMenuOpen, setIsDesktopUserMenuOpen] = useState(false);
  const [isTerminalHovered, setIsTerminalHovered] = useState(false);
  const [isListsOpen, setIsListsOpen] = useState(false);

  useEffect(() => {
    fetch("/api/members/me")
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then((data) => {
        setIsLoggedIn(true);
        setMember(data.member);
      })
      .catch(() => {
        // Fallback: Supabase browser client ile Google OAuth oturumunu doğrudan kontrol et
        const supabase = createSupabaseBrowserClient();
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setIsLoggedIn(true);
            setMember({
              username:
                user.user_metadata?.full_name ||
                user.user_metadata?.name ||
                user.email?.split("@")[0] ||
                "Üye",
              email: user.email,
              avatar_url:
                user.user_metadata?.avatar_url ||
                user.user_metadata?.picture ||
                null,
              plan: "free",
            });
          } else {
            setIsLoggedIn(false);
            setMember(null);
          }
        });
      })
      .finally(() => setAuthChecked(true));
  }, [pathname, locale]);

  const homeHref = `/global/${locale}/home`;
  const accountHref =
    locale === "tr"
      ? "/global/tr/hesabim"
      : locale === "es"
        ? "/global/es/account"
        : locale === "fr"
          ? "/global/fr/account"
          : locale === "pt"
            ? "/global/pt/account"
            : "/global/en/account";
  const loginHref =
    locale === "tr"
      ? "/global/tr/giris"
      : locale === "es"
        ? "/global/es/login"
        : locale === "fr"
          ? "/global/fr/login"
          : locale === "pt"
            ? "/global/pt/login"
            : "/global/en/login";
  const registerHref =
    locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
  const terminalHref =
    authChecked && !isLoggedIn ? registerHref : `/global/${locale}`;
  const terminalTooltip =
    locale === "tr"
      ? "TERMİNAL sayfasını aç"
      : locale === "es"
        ? "Abrir la página TERMINAL"
        : locale === "fr"
          ? "Ouvrir la page TERMINAL"
          : locale === "pt"
            ? "Abrir a página TERMINAL"
            : "Open the TERMINAL page";

  const listsMenuLabel =
    locale === "tr"
      ? "LİSTELER"
      : locale === "es"
        ? "LISTAS"
        : locale === "fr"
          ? "LISTES"
          : locale === "pt"
            ? "LISTAS"
            : "LISTS";

  const listsItems = [
    {
      id: "top7",
      label:
        locale === "tr"
          ? "TOP 7"
          : locale === "es"
            ? "TOP 7"
            : locale === "fr"
              ? "TOP 7"
              : locale === "pt"
                ? "TOP 7"
                : "TOP 7",
      href: `/global/${locale}/top7`,
    },
    {
      id: "top100",
      label:
        locale === "tr"
          ? "TOP 100"
          : locale === "es"
            ? "TOP 100"
            : locale === "fr"
              ? "TOP 100"
              : locale === "pt"
                ? "TOP 100"
                : "TOP 100",
      href: `/global/${locale}/top100`,
    },
    {
      id: "gainers",
      label:
        locale === "tr"
          ? "ARTANLAR"
          : locale === "es"
            ? "ALZAS"
            : locale === "fr"
              ? "HAUSSES"
              : locale === "pt"
                ? "ALTAS"
                : "GAINERS",
      href: `/global/${locale}/gainers`,
    },
    {
      id: "losers",
      label:
        locale === "tr"
          ? "DÜŞENLER"
          : locale === "es"
            ? "BAJAS"
            : locale === "fr"
              ? "BAISSES"
              : locale === "pt"
                ? "BAIXAS"
                : "LOSERS",
      href: `/global/${locale}/losers`,
    },
    {
      id: "swing",
      label:
        locale === "tr"
          ? "TREND HİSSELERİ"
          : locale === "es"
            ? "EN TENDENCIA"
            : locale === "fr"
              ? "ACTIONS TENDANCE"
              : locale === "pt"
                ? "AÇÕES EM TENDÊNCIA"
                : "TRENDING STOCKS",
      href: `/global/${locale}/swing`,
    },
    {
      id: "themes",
      label:
        locale === "tr"
          ? "TEMA LİSTESİ"
          : locale === "es"
            ? "LISTA DE TEMAS"
            : locale === "fr"
              ? "LISTE DE THÈMES"
              : locale === "pt"
                ? "LISTA DE TEMAS"
                : "THEME LIST",
      href: `/global/${locale}/themes/bellek-ureticiler-ai-depolama`,
    },
    {
      id: "my-watchlist",
      label:
        locale === "tr"
          ? "İZLEME LİSTEM"
          : locale === "es"
            ? "MI LISTA"
            : locale === "fr"
              ? "MA LISTE"
              : locale === "pt"
                ? "MINHA LISTA"
                : "MY WATCHLIST",
      href: `/global/${locale}/my-watchlist`,
    },
  ];

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/members/logout", { method: "POST" });
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      setIsLoggedIn(false);
      setMember(null);
      setIsMobileUserMenuOpen(false);
      router.push(loginHref);
    }
  };

  const getLangHref = (targetLang: string) => {
    if (!pathname) return `/global/${targetLang.toLowerCase()}/home`;
    const targetLoc = targetLang.toLowerCase();

    const isFaqPage =
      pathname.endsWith("/Perguntas_Frequentes") ||
      pathname.endsWith("/sss") ||
      pathname.endsWith("/faq");
    if (isFaqPage) {
      const faqSuffix =
        targetLoc === "pt"
          ? "/Perguntas_Frequentes"
          : targetLoc === "tr"
            ? "/sss"
            : "/faq";
      return `/global/${targetLoc}${faqSuffix}`;
    }

    return pathname.replace(
      new RegExp(`^/global/${locale}`),
      `/global/${targetLoc}`
    );
  };

  const usernameText =
    member?.username ||
    member?.email?.split("@")[0] ||
    (locale === "tr" ? "Hesabım" : "Account");

  return (
    <>
      <header className="border-b border-[#1e2a3a] bg-[#0a0e17]/95 backdrop-blur-md sticky top-0 z-50">
        <div className="w-full max-w-[1800px] mx-auto px-3 h-20 flex items-center justify-between gap-2 relative">
          <Link
            href={`/global/${locale}/home`}
            className="flex items-center gap-2 group flex-shrink-0"
          >
            <Image src="/logo/boga_stock.png" alt="BogaStock" width={195} height={61} className="h-[72px] w-auto" priority />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 max-w-full overflow-visible">
            {/* Mobilde kompakt dil seçici */}
            {locale && (
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileLangOpen((v) => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-medium uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/10 border border-[#1e2a3a]/60"
                  aria-label="Language"
                >
                  🌐 {locale.toUpperCase()}
                </button>
                {isMobileLangOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMobileLangOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#111826] border border-[#1e2a3a] rounded-lg shadow-xl overflow-hidden min-w-[88px]">
                      {["EN", "ES", "FR", "PT", "TR"].map((lang) => {
                        const isActive = locale.toUpperCase() === lang;
                        return (
                          <Link
                            key={lang}
                            href={getLangHref(lang)}
                            onClick={() => setIsMobileLangOpen(false)}
                            className={`block px-3 py-2 text-[11px] font-medium uppercase tracking-wider ${
                              isActive
                                ? "bg-[#3b82f6] text-white"
                                : "text-[#94a3b8] hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {lang}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Language Selector — sm+ ekranda tüm diller tek satırda görünür */}
            {locale && (
              <div className="hidden sm:flex items-center gap-0.5 bg-[#1e2a3a]/40 rounded-lg p-0.5 mr-2 border border-[#1e2a3a]/60">
                {["EN", "ES", "FR", "PT", "TR"].map((lang) => {
                  const isActive = locale.toUpperCase() === lang;
                  return (
                    <Link
                      key={lang}
                      href={getLangHref(lang)}
                      className={`px-2 py-1 rounded-md text-[8px] font-medium uppercase tracking-wider transition-all ${
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

            {/* Terminal Link with Hover Preview */}
            <div
              className="relative shrink-0"
              onMouseEnter={() => setIsTerminalHovered(true)}
              onMouseLeave={() => setIsTerminalHovered(false)}
            >
              <MobileTerminalLink
                locale={locale}
                targetHref={terminalHref}
                title={terminalTooltip}
                className="flex items-center gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white border border-[#3b82f6]/40 transition-all shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
              >
                <svg
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M8 9l3 3-3 3m5 0h3M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"
                  />
                </svg>
                <span className="text-[9px] sm:text-[10px]">TERMINAL</span>
              </MobileTerminalLink>

              {/* Terminal Page Screenshot Preview Card */}
              {isTerminalHovered && (
                <div className="absolute right-0 top-full mt-2 z-[100] w-96 p-2 rounded-xl bg-[#0d131f] border-2 border-[#3b82f6] shadow-[0_12px_45px_rgba(0,0,0,0.95)] backdrop-blur-xl animate-fadeIn pointer-events-none">
                  <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block" />
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block" />
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block" />
                      <span className="text-[11px] font-bold text-white ml-1.5 tracking-wide uppercase">
                        {locale === "tr" ? "Terminal Önizleme" : "Terminal Preview"}
                      </span>
                    </div>
                    <span className="text-[9px] font-mono font-bold text-[#38bdf8] bg-[#38bdf8]/10 px-1.5 py-0.5 rounded border border-[#38bdf8]/30">
                      LIVE UI
                    </span>
                  </div>
                  <div className="relative rounded-lg overflow-hidden border border-[#1e2a3a] aspect-[16/9] bg-[#0a0e17]">
                    <img
                      src="/terminal_preview.jpg"
                      alt="BOGASTOCK Terminal Live Preview"
                      className="w-full h-full object-cover shadow-inner"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e17]/80 via-transparent to-transparent flex items-end p-2.5">
                      <span className="text-[10px] font-extrabold text-white bg-[#3b82f6] px-2 py-1 rounded-md shadow-md">
                        {locale === "tr" ? "Terminale Git ➔" : "Go to Terminal ➔"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop-only Quick Navigation */}
            <Link
              href={homeHref}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>
                {locale === "tr"
                  ? "Anasayfa"
                  : locale === "es"
                    ? "Inicio"
                    : locale === "fr"
                      ? "Accueil"
                      : locale === "pt"
                        ? "Início"
                        : "Home"}
              </span>
            </Link>

            {/* Lists Menu */}
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setIsListsOpen((v) => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
              >
                <svg
                  className="w-4 h-4 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
                <span>{listsMenuLabel}</span>
              </button>

              {isListsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsListsOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-50 w-48 bg-[#111826] border border-[#1e2a3a] rounded-lg shadow-xl overflow-hidden">
                    {listsItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setIsListsOpen(false)}
                        className="block px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-[#1e2a3a]/70 transition-colors border-b border-[#1e2a3a]/40 last:border-b-0"
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </div>

            <Link
              href={
                locale === "pt"
                  ? "/global/pt/Perguntas_Frequentes"
                  : locale === "tr"
                    ? "/global/tr/sss"
                    : `/global/${locale}/faq`
              }
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
            >
              <svg
                className="w-4 h-4 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span>
                {locale === "tr"
                  ? "SSS"
                  : locale === "es"
                    ? "FAQ"
                    : locale === "fr"
                      ? "FAQ"
                      : locale === "pt"
                        ? "FAQ"
                        : "FAQ"}
              </span>
            </Link>

            {authChecked &&
              (isLoggedIn ? (
                <div className="relative shrink-0">
                  {/* Desktop User Dropdown Badge */}
                  <div className="hidden sm:block relative">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsDesktopUserMenuOpen((v) => !v);
                      }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#1e2a3a]/80 hover:bg-[#1e2a3a] border border-[#3b82f6]/50 text-white transition-all shadow-md cursor-pointer"
                    >
                      {member?.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={usernameText}
                          className="w-5 h-5 rounded-full object-cover border border-[#3b82f6]"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[#3b82f6] text-white flex items-center justify-center text-[10px] font-bold">
                          {usernameText.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-xs font-bold max-w-[120px] truncate text-white">
                        {usernameText}
                      </span>
                      {member?.plan === "premium" && (
                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                          PRO
                        </span>
                      )}
                      <span className="text-xs text-[#38bdf8] font-bold ml-0.5">▾</span>
                    </button>

                    {/* Desktop User Dropdown Menu */}
                    {isDesktopUserMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={() => setIsDesktopUserMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 z-50 w-60 bg-[#0d131f] border-2 border-[#3b82f6]/60 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.9)] overflow-hidden p-3 space-y-2.5 backdrop-blur-xl">
                          <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/10 px-1">
                            {member?.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt={usernameText}
                                className="w-8 h-8 rounded-full object-cover border border-[#3b82f6]"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-[#3b82f6] text-white flex items-center justify-center text-xs font-bold shadow-md">
                                {usernameText.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-white truncate">
                                {usernameText}
                              </span>
                              <span className="text-[9px] text-slate-400 truncate">
                                {member?.email || ""}
                              </span>
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <Link
                              href={accountHref}
                              onClick={() => setIsDesktopUserMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-200 hover:bg-[#1e2a3a] hover:text-white transition-all"
                            >
                              <span>👤</span>
                              <span>{locale === "tr" ? "Hesabım" : "Account"}</span>
                            </Link>

                            <button
                              type="button"
                              onClick={handleLogout}
                              disabled={loggingOut}
                              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                            >
                              <span>🚪</span>
                              <span>{loggingOut ? "..." : locale === "tr" ? "Çıkış Yap" : "Log out"}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Mobile Compact User Menu Button */}
                  <div className="sm:hidden">
                    <button
                      type="button"
                      onClick={() => setIsMobileUserMenuOpen((v) => !v)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[#1e2a3a]/80 border border-[#3b82f6]/40 text-white"
                    >
                      {member?.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={usernameText}
                          className="w-4 h-4 rounded-full object-cover border border-[#3b82f6]"
                        />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-[#3b82f6] text-white flex items-center justify-center text-[9px] font-bold">
                          {usernameText.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="text-[10px] font-semibold max-w-[50px] truncate text-slate-100">
                        {usernameText}
                      </span>
                      <span className="text-[8px] text-slate-400">▾</span>
                    </button>

                    {/* Mobile Dropdown Drawer */}
                    {isMobileUserMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs"
                          onClick={() => setIsMobileUserMenuOpen(false)}
                        />
                        <div className="absolute right-0 top-full mt-2 z-50 w-64 bg-[#0f172a] border border-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden p-3 space-y-3">
                          {/* User Header */}
                          <div className="flex items-center gap-2.5 pb-3 border-b border-white/10">
                            {member?.avatar_url ? (
                              <img
                                src={member.avatar_url}
                                alt={usernameText}
                                className="w-9 h-9 rounded-full object-cover border border-[#3b82f6]"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-full bg-[#3b82f6] text-white flex items-center justify-center text-sm font-bold shadow-md">
                                {usernameText.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-xs font-bold text-white truncate">
                                {usernameText}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate">
                                {member?.email || ""}
                              </span>
                              <span className="inline-block mt-1 text-[8px] font-bold text-[#3b82f6] bg-[#3b82f6]/10 px-1.5 py-0.5 rounded border border-[#3b82f6]/30 w-max uppercase">
                                {member?.plan === "premium" ? "PRO ÜYE" : "ÜCRETSİZ PLAN"}
                              </span>
                            </div>
                          </div>

                          {/* Navigation Links with Text & Icons */}
                          <div className="space-y-1">
                            <Link
                              href={terminalHref}
                              onClick={() => setIsMobileUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-[#1e2a3a] hover:text-white transition-all"
                            >
                              <span className="text-sm">💻</span>
                              <span>TERMINAL</span>
                            </Link>

                            <Link
                              href={homeHref}
                              onClick={() => setIsMobileUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-[#1e2a3a] hover:text-white transition-all"
                            >
                              <span className="text-sm">🏠</span>
                              <span>{locale === "tr" ? "Anasayfa" : "Home"}</span>
                            </Link>

                            <Link
                              href={accountHref}
                              onClick={() => setIsMobileUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-[#1e2a3a] hover:text-white transition-all"
                            >
                              <span className="text-sm">👤</span>
                              <span>{locale === "tr" ? "Hesabım" : "Account"}</span>
                            </Link>

                            <Link
                              href={
                                locale === "pt"
                                  ? "/global/pt/Perguntas_Frequentes"
                                  : locale === "tr"
                                    ? "/global/tr/sss"
                                    : `/global/${locale}/faq`
                              }
                              onClick={() => setIsMobileUserMenuOpen(false)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-[#1e2a3a] hover:text-white transition-all"
                            >
                              <span className="text-sm">❓</span>
                              <span>{locale === "tr" ? "SSS (Sıkça Sorulan Sorular)" : "FAQ"}</span>
                            </Link>

                            <button
                              type="button"
                              onClick={handleLogout}
                              disabled={loggingOut}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
                            >
                              <span className="text-sm">🚪</span>
                              <span>{loggingOut ? "..." : locale === "tr" ? "Çıkış Yap" : "Log out"}</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <Link
                  href={loginHref}
                  className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[10px] font-medium uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-all border border-[#3b82f6]/20 ml-1 shrink-0"
                >
                  <svg
                    className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                  <span>
                    {locale === "tr"
                      ? "Giriş Yap"
                      : locale === "es"
                        ? "Entrar"
                        : locale === "fr"
                          ? "Connexion"
                          : locale === "pt"
                            ? "Entrar"
                            : "Sign In"}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </header>
    </>
  );
}
