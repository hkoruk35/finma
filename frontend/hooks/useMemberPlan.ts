"use client";

import { useEffect, useState } from "react";

export interface MemberPlanData {
  plan: string | null;
  trial_ends_at: string | null;
  isFreeTrial: boolean;
  isPremium: boolean;
  /** Seconds remaining in trial; 0 if not in trial or expired */
  trialSecondsLeft: number;
}

const EMPTY: MemberPlanData = {
  plan: null,
  trial_ends_at: null,
  isFreeTrial: false,
  isPremium: false,
  trialSecondsLeft: 0,
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
          const trial_ends_at: string | null = m.trial_ends_at ?? null;
          const trialExpiry = trial_ends_at ? new Date(trial_ends_at).getTime() : 0;
          const trialSecondsLeft = Math.max(0, Math.floor((trialExpiry - Date.now()) / 1000));
          const isPremium = plan === "premium" || plan === "admin";
          const isFreeTrial = plan === "free_trial" || (!isPremium && trialSecondsLeft > 0);
          cached = { plan, trial_ends_at, isFreeTrial, isPremium, trialSecondsLeft };
        })
        .catch(() => { cached = EMPTY; });
    }
    fetchPromise.then(() => setData(cached));
  }, []);

  return { ...(data ?? EMPTY), loading: !data };
}
