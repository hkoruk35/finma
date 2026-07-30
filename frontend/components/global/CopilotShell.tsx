"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

export default function CopilotShell({ children }: { children: ReactNode }) {
  const [isMoneySection, setIsMoneySection] = useState(false);

  useEffect(() => {
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    const isMoney = /\/(performance|swing|swingperformance|top100|watchlist|insider|my-watchlist|stock)\b/i.test(path);
    setIsMoneySection(isMoney);
  }, []);

  return (
    <CopilotProvider>
      {children}
      {isMoneySection && <CopilotDrawer />}
    </CopilotProvider>
  );
}

