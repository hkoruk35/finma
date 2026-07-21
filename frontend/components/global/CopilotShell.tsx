"use client";

import React, { ReactNode } from "react";
import { CopilotProvider } from "@/context/CopilotContext";
import CopilotDrawer from "./CopilotDrawer";

export default function CopilotShell({ children }: { children: ReactNode }) {
  return (
    <CopilotProvider>
      {children}
      <CopilotDrawer />
    </CopilotProvider>
  );
}
