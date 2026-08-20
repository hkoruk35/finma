"use client";

import type { Locale } from "@/lib/i18n/copy";
import { useMemberPlan } from "@/hooks/useMemberPlan";

interface Props {
  locale: Locale;
  className?: string;
  children: React.ReactNode;
}

// Premium Club sayfasindaki CTA butonlari icin ortak yonlendirme mantigi —
// PremiumModal.tsx ile ayni kural: giris yapmamis kullanici kayit sayfasina,
// giris yapmis (ama henuz premium olmayan) kullanici hesap/abonelik sekmesine gider.
export default function PremiumClubCTA({ locale, className, children }: Props) {
  const { plan } = useMemberPlan();
  const isLoggedIn = plan !== null;

  const registerHref = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
  const accountHref = locale === "tr" ? "/global/tr/hesabim?tab=subscription" : `/global/${locale}/account?tab=subscription`;
  const href = isLoggedIn ? accountHref : registerHref;

  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
