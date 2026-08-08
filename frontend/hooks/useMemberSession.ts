"use client";

import { useEffect, useState } from "react";

// MemberHeader/GlobalBottomNav/SearchLandingHeader/HisseDetailGate hepsi
// kendi basina fetch("/api/members/me") atiyordu — her sayfa yuklemesinde
// 3-4 kez ayni auth kontrolu tekrarlaniyordu (bkz. network trace'lerdeki
// tekrar eden 401'ler). useMemberPlan.ts'teki singleton-cache deseni
// buraya da uygulanip TUM tuketiciler TEK bir fetch'i paylasiyor.
export interface MemberSessionData {
  member: any | null;
  isLoggedIn: boolean;
}

const EMPTY: MemberSessionData = { member: null, isLoggedIn: false };

let cached: MemberSessionData | null = null;
let fetchPromise: Promise<void> | null = null;

export function useMemberSession(): MemberSessionData & { authChecked: boolean } {
  const [data, setData] = useState<MemberSessionData | null>(cached);

  useEffect(() => {
    if (cached) {
      setData(cached);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetch("/api/members/me")
        .then((res) => (res.ok ? res.json() : Promise.reject()))
        .then((d) => {
          cached = { member: d.member ?? null, isLoggedIn: true };
        })
        .catch(() => {
          cached = EMPTY;
        });
    }
    fetchPromise.then(() => setData(cached));
  }, []);

  return { ...(data ?? EMPTY), authChecked: !!data };
}
