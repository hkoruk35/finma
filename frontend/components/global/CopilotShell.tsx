"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

export default function CopilotShell({ children }: { children: ReactNode }) {
  const [isSearchLanding, setIsSearchLanding] = useState(false);

  useEffect(() => {
    const isSearchPath = typeof window !== "undefined" && /\/global\/[a-z]+\/search$/.test(window.location.pathname);
    setIsSearchLanding(isSearchPath);
  }, []);

  return (
    <CopilotProvider>
      {children}
      {!isSearchLanding && <CopilotDrawer />}
    </CopilotProvider>
  );
}
