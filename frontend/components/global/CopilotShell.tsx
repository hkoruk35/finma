"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

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
      {children}
      {isFinancePage && <CopilotDrawer />}
    </CopilotProvider>
  );
}



