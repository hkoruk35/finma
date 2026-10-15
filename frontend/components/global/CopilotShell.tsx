"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { CopilotProvider, useCopilot } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";
import { COPILOT_ADMIN_ONLY, COPILOT_DISABLED } from "@/lib/siteMode";
import { isCopilotRole } from "@/lib/copilot/adminPersona";

function CopilotShellInner({ children, isFinancePage }: { children: ReactNode; isFinancePage: boolean }) {
  const { isOpen } = useCopilot();
  const shrink = isFinancePage && isOpen;

  return (
    <>
      <div
        style={{
          transform: shrink ? "scale(0.96)" : "scale(1)",
          transformOrigin: "center",
          borderRadius: shrink ? "1rem" : "0",
          overflow: shrink ? "hidden" : "visible",
          boxShadow: shrink ? "0 25px 50px -12px rgba(0,0,0,0.5)" : "none",
          transition: "transform 300ms ease-out, border-radius 300ms ease-out, box-shadow 300ms ease-out",
        }}
      >
        {children}
      </div>
      {isFinancePage && <CopilotDrawer />}
    </>
  );
}

/** Sayfa ömrü boyunca tek istek: yönetim hesabı (boga_auth: admin / readonly / engine) mı? Cookie httpOnly → /api/auth/me */
let adminPending: Promise<boolean> | null = null;
function loadIsAdmin(): Promise<boolean> {
  if (!adminPending) {
    adminPending = fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((j: { role?: string | null }) => isCopilotRole(j.role))
      .catch(() => false);
  }
  return adminPending;
}

export default function CopilotShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!COPILOT_ADMIN_ONLY) return;
    let alive = true;
    loadIsAdmin().then((v) => { if (alive) setIsAdmin(v); });
    return () => { alive = false; };
  }, []);

  // 2026-10-15: Copilot yalnız yönetim hesaplarına (admin / readonly / engine) açık, SPY odaklı. Değilse Provider/Drawer hiç mount edilmez.
  const enabled = COPILOT_ADMIN_ONLY ? isAdmin : !COPILOT_DISABLED;
  if (!enabled) return <>{children}</>;

  // Finans dışı sayfalar ve SPY/QQQ Engine dışındaki yönetim sayfaları hariç
  const isEnginePage = !!pathname && (pathname.startsWith("/admin/spyengine") || pathname.startsWith("/admin/qqqengine"));
  const isExcluded = !!pathname && !isEnginePage && (
    pathname.includes("/search") ||
    pathname.includes("/discover") ||
    pathname.includes("/sports") ||
    pathname.includes("/weather") ||
    pathname.includes("/today") ||
    pathname.startsWith("/admin")
  );

  const isFinancePage = !isExcluded;

  return (
    <CopilotProvider>
      <CopilotShellInner isFinancePage={isFinancePage}>{children}</CopilotShellInner>
    </CopilotProvider>
  );
}
