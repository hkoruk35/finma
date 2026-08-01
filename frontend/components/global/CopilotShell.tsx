"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CopilotProvider, useCopilot } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

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

export default function CopilotShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Exclude non-money pages: /search (ask), /discover, /sports, /weather, /today, /admin
  const isExcluded = !!pathname && (
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



