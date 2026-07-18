"use client";

import React, { ReactNode } from "react";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";
import MarketMoodBar from "./MarketMoodBar";

export default function CopilotShell({ children }: { children: ReactNode }) {
  return (
    <CopilotProvider>
      <MarketMoodBar />
      {children}
      <CopilotDrawer />
    </CopilotProvider>
  );
}
