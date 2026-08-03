"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMemberPlan } from "@/hooks/useMemberPlan";

export default function SectorsGuard({ locale = "tr" }: { locale?: string }) {
  const { plan, loading } = useMemberPlan();
  const router = useRouter();

  useEffect(() => {
    if (!loading && plan === null) {
      const regUrl = locale === "tr" ? "/global/tr/kayit" : `/global/${locale}/register`;
      router.push(regUrl);
    }
  }, [loading, plan, locale, router]);

  return null;
}
