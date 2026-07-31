"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

export default function CopilotShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Exclude non-finance pages like /weather, /sports, or /admin routes
  const isExcluded = !!pathname && (
    pathname.includes("/weather") ||
    pathname.includes("/sports") ||
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


