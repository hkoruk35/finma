"use client";

import { useEffect, useState } from "react";

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

const EMPTY: MemberPlanData = {
  plan: null,
  isPremium: false,
  tier: "anonymous",
};

let cached: MemberPlanData | null = null;
let fetchPromise: Promise<void> | null = null;

export function useMemberPlan(): MemberPlanData & { loading: boolean } {
  const [data, setData] = useState<MemberPlanData | null>(cached);

  useEffect(() => {
    if (cached) { setData(cached); return; }
    if (!fetchPromise) {
      fetchPromise = fetch("/api/members/me")
        .then((r) => r.json())
        .then((d) => {
          const m = d.member;
          if (!m) { cached = EMPTY; return; }
          const plan: string | null = m.plan ?? null;
          const isPremium = plan === "premium" || plan === "admin";
          cached = { plan, isPremium, tier: tierFor(plan, true) };
        })
        .catch(() => { cached = EMPTY; });
    }
    fetchPromise.then(() => setData(cached));
  }, []);

  return { ...(data ?? EMPTY), loading: !data };
}
