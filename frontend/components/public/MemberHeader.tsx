"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/i18n/copy";

import MobileTerminalLink from "@/components/global/MobileTerminalLink";
import HeaderMegaMenu from "@/components/public/HeaderMegaMenu";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useMemberSession } from "@/hooks/useMemberSession";

export default function MemberHeader({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);
  const session = useMemberSession();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [member, setMember] = useState<any>(null);
  const [isMobileLangOpen, setIsMobileLangOpen] = useState(false);
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const [isDesktopUserMenuOpen, setIsDesktopUserMenuOpen] = useState(false);
  const [isDesktopLangOpen, setIsDesktopLangOpen] = useState(false);
  const [isTerminalHovered, setIsTerminalHovered] = useState(false);

  useEffect(() => {
    if (!session.authChecked) return;
    if (session.isLoggedIn) {
      setIsLoggedIn(true);
      setMember(session.member);
      setAuthChecked(true);
      return;
    }
    // Fallback: /api/members/me 401 dondu — Supabase browser client ile Google OAuth oturumunu doğrudan kontrol et
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
      setAuthChecked(true);
    });
  }, [session.authChecked, session.isLoggedIn, session.member]);

  const homeHref = `/global/${locale}/home`;
  const accountHref = locale === "tr" ? "/global/tr/hesabim" : `/global/${locale}/account`;
  const loginHref = locale === "tr" ? "/global/tr/giris" : `/global/${locale}/login`;
  // Terminal Faz 1'den beri herkese açık (bkz. proxy.ts PUBLIC_SUBPATHS) —
  // giriş durumundan bağımsız olarak her zaman doğrudan Terminal'e gider.
  const terminalHref = `/global/${locale}/terminal`;
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

    const isLoginPage = pathname.endsWith("/giris") || pathname.endsWith("/login");
    if (isLoginPage) {
      return `/global/${targetLoc}/${targetLoc === "tr" ? "giris" : "login"}`;
    }

    const isRegisterPage = pathname.endsWith("/kayit") || pathname.endsWith("/register");
    if (isRegisterPage) {
      return `/global/${targetLoc}/${targetLoc === "tr" ? "kayit" : "register"}`;
    }

    const isAccountPage = pathname.endsWith("/hesabim") || pathname.endsWith("/account");
    if (isAccountPage) {
      return `/global/${targetLoc}/${targetLoc === "tr" ? "hesabim" : "account"}`;
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
        <div className="w-full max-w-[1800px] mx-auto pl-1 pr-2 sm:px-3 h-14 sm:h-20 flex items-center justify-between gap-1 sm:gap-2 relative">
          <Link
            href={`/global/${locale}/home`}
            className="flex items-center gap-2 group flex-shrink-0"
          >
            <Image src="/logo/bogastock01_logo.png" alt="BogaStock" width={430} height={100} className="h-7 sm:h-[58px] w-auto" priority />
          </Link>

          {/* overflow-x-auto KULLANMA: overflow-x tek başına set edilince CSS
              spesifikasyonu geregi overflow-y de zorla 'auto' oluyor, bu da bu
              gruptan açılan absolute-pozisyonlu dropdown'ları (dil menüsü,
              terminal önizleme) header sınırında görünmez/tıklanmaz şekilde
              kesiyordu — mobil "menüler tıklanmıyor" hatasının kök nedeni buydu. */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {/* Mobilde kompakt dil seçici */}
            {locale && (
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileLangOpen((v) => !v)}
                  className="flex items-center gap-0.5 px-1.5 py-1 rounded-md text-[9px] font-medium tracking-wider text-[#64748b] hover:text-white hover:bg-white/10 border border-[#1e2a3a]/60"
                  aria-label="Language"
                >
                  🌐 {locale.toLocaleUpperCase(locale)}
                </button>
                {isMobileLangOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMobileLangOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#111826] border border-[#1e2a3a] rounded-lg shadow-xl overflow-hidden min-w-[88px]">
                      {["EN", "ES", "FR", "PT", "ID", "TR"].map((lang) => {
                        const isActive = locale.toUpperCase() === lang;
                        return (
                          <Link
                            key={lang}
                            href={getLangHref(lang)}
                            onClick={() => setIsMobileLangOpen(false)}
                            className={`block px-3 py-2 text-[11px] font-medium tracking-wider ${
                              isActive
                                ? "bg-[#3b82f6] text-white"
                                : "text-[#94a3b8] hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {lang.toLocaleUpperCase(locale)}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Dil Seçici (Desktop) — üye girişi olmayan/henüz kontrol edilmeyen
                durumda açılır menü olarak gösterilir. Giriş yapmış kullanıcıda
                bu satırdan tamamen kaldırılır, yerine üye menüsünün içine
                taşınır (bkz. Desktop User Dropdown Menu). */}
            {locale && authChecked && !isLoggedIn && (
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setIsDesktopLangOpen((v) => !v); }}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
                >
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.6 9h16.8M3.6 15h16.8M11.5 3a17 17 0 000 18M12.5 3a17 17 0 010 18M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{locale.toLocaleUpperCase(locale)}</span>
                  <span className="text-[9px] text-[#38bdf8]">▾</span>
                </button>
                {isDesktopLangOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsDesktopLangOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#111826] border border-[#1e2a3a] rounded-lg shadow-xl overflow-hidden min-w-[100px]">
                      {["EN", "ES", "FR", "PT", "ID", "TR"].map((lang) => {
                        const isActive = locale.toUpperCase() === lang;
                        return (
                          <Link
                            key={lang}
                            href={getLangHref(lang)}
                            onClick={() => setIsDesktopLangOpen(false)}
                            className={`block px-3 py-2 text-[11px] font-medium tracking-wider ${
                              isActive ? "bg-[#3b82f6] text-white" : "text-[#94a3b8] hover:bg-white/10 hover:text-white"
                            }`}
                          >
                            {lang.toLocaleUpperCase(locale)}
                          </Link>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Terminal Link with Hover Preview — sadece desktop'ta gösterilir, mobilde üye/giriş alanına yer açmak için kaldırıldı */}
            <div
              className="relative shrink-0 hidden sm:block"
              onMouseEnter={() => setIsTerminalHovered(true)}
              onMouseLeave={() => setIsTerminalHovered(false)}
            >
              <MobileTerminalLink
                locale={locale}
                targetHref={terminalHref}
                title={terminalTooltip}
                className="flex items-center gap-1 sm:gap-1.5 px-1.5 py-1 sm:px-2.5 sm:py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white border border-[#3b82f6]/40 transition-all shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
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
                      <span className="text-[11px] font-bold text-white ml-1.5 tracking-wide">
                        {(locale === "tr" ? "Terminal Önizleme" : "Terminal Preview").toLocaleUpperCase(locale)}
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
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium tracking-wider text-[#64748b] hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all"
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
                {(locale === "tr"
                  ? "Anasayfa"
                  : locale === "es"
                    ? "Inicio"
                    : locale === "fr"
                      ? "Accueil"
                      : locale === "pt"
                        ? "Início"
                        : "Home").toLocaleUpperCase(locale)}
              </span>
            </Link>

            {/* Markets / İzleme Listem / News / Analizler / Brokers — masaüstünde
                hover ile açılan mega menü, mobilde tıklamalı akordeon. */}
            <HeaderMegaMenu locale={locale} />

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

                            {/* Dil Seçimi — giriş yapmış kullanıcıda üye menüsünün içine taşındı */}
                            <div className="px-2.5 py-1.5">
                              <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 tracking-wider mb-1.5">
                                <span>🌐</span>
                                <span>{locale === "tr" ? "Dil" : "Language"}</span>
                              </div>
                              <div className="flex items-center gap-1 flex-wrap">
                                {["EN", "ES", "FR", "PT", "ID", "TR"].map((lang) => {
                                  const isActive = locale.toUpperCase() === lang;
                                  return (
                                    <Link
                                      key={lang}
                                      href={getLangHref(lang)}
                                      onClick={() => setIsDesktopUserMenuOpen(false)}
                                      className={`px-2 py-1 rounded-md text-[9px] font-bold tracking-wider transition-all ${
                                        isActive
                                          ? "bg-[#3b82f6] text-white"
                                          : "bg-[#1e2a3a]/60 text-slate-400 hover:text-white hover:bg-[#1e2a3a]"
                                      }`}
                                    >
                                      {lang.toLocaleUpperCase(locale)}
                                    </Link>
                                  );
                                })}
                              </div>
                            </div>

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
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1e2a3a]/80 border border-[#3b82f6]/40 text-white"
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
                      <span className="text-[11px] font-semibold max-w-[110px] truncate text-slate-100">
                        {usernameText}
                      </span>
                      {member?.plan === "premium" && (
                        <span className="text-[7px] font-extrabold px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                          PRO
                        </span>
                      )}
                      <span className="text-[9px] text-slate-400">▾</span>
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium tracking-wider bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6] hover:text-white transition-all border border-[#3b82f6]/20 shrink-0"
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
                    {(locale === "tr"
                      ? "Giriş Yap"
                      : locale === "es"
                        ? "Entrar"
                        : locale === "fr"
                          ? "Connexion"
                          : locale === "pt"
                            ? "Entrar"
                            : "Sign In").toLocaleUpperCase(locale)}
                  </span>
                </Link>
              ))}
          </div>
        </div>
      </header>
    </>
  );
}
