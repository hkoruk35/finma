"use client";

import { useMemberSession } from "./useMemberSession";

export type MemberTier = "anonymous" | "free" | "premium" | "admin";

export interface MemberPlanData {
  plan: string | null;
  isPremium: boolean;
  /** 3 katmanlı erişim modeli — bkz. lib/apiAuth.ts:resolveMemberTierFromAccess. */
  tier: MemberTier;
}

function tierFor(plan: string | null, authenticated: boolean): MemberTier {
  if (!authenticated) return "anonymous";
  if (plan === "admin") return "admin";
  if (plan === "premium") return "premium";
  return "free";
}

// Artik kendi fetch'ini atmiyor — useMemberSession() ile AYNI paylasimli/
// onbellekli /api/members/me sonucunu turetilmis bir sekle donusturuyor
// (bkz. 2026-08-08: MemberHeader/GlobalBottomNav/CopilotContext ile birlikte
// sayfa basina TEK auth cagrisina indirgeme).
export function useMemberPlan(): MemberPlanData & { loading: boolean } {
  const session = useMemberSession();
  const plan: string | null = session.isLoggedIn ? (session.member?.plan ?? null) : null;
  const isPremium = plan === "premium" || plan === "admin";

  return {
    plan,
    isPremium,
    tier: tierFor(plan, session.isLoggedIn),
    loading: !session.authChecked,
  };
}
