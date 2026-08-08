"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TickerDetailPanel from "./TickerDetailPanel";
import PremiumModal from "@/components/global/PremiumModal";
import type { Locale } from "@/lib/i18n/copy";
import { useMemberSession } from "@/hooks/useMemberSession";

const LOGIN_HREF: Record<Locale, string> = {
  en: "/global/en/login",
  tr: "/global/tr/giris",
  es: "/global/es/login",
  fr: "/global/fr/login",
  pt: "/global/pt/login",
};

const LOADING_TEXT: Record<Locale, string> = {
  en: "Loading…",
  tr: "Yükleniyor…",
  es: "Cargando…",
  fr: "Chargement…",
  pt: "Carregando…",
};

const ACCOUNT_HREF: Record<Locale, string> = {
  en: "/global/en/account",
  tr: "/global/tr/hesabim",
  es: "/global/es/account",
  fr: "/global/fr/account",
  pt: "/global/pt/account",
};

export default function HisseDetailGate({ ticker, locale }: { ticker: string; locale: Locale }) {
  const router = useRouter();
  const session = useMemberSession();
  const [isPremium, setIsPremium] = useState(false);
  const loading = !session.authChecked;

  useEffect(() => {
    if (!session.authChecked) return;
    if (!session.isLoggedIn) {
      router.push(LOGIN_HREF[locale]);
      return;
    }
    const plan = session.member?.plan;
    setIsPremium(plan === "premium" || plan === "admin");
  }, [session.authChecked, session.isLoggedIn, session.member, router, locale]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-white/50 text-sm">
        {LOADING_TEXT[locale]}
      </div>
    );
  }

  if (!isPremium) {
    return (
      <PremiumModal
        locale={locale}
        onClose={() => router.push(`${ACCOUNT_HREF[locale]}?tab=subscription`)}
      />
    );
  }

  return <TickerDetailPanel ticker={ticker} locale={locale} fullPage />;
}
