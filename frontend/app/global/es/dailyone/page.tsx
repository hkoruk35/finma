"use client";

import { Suspense } from "react";
import DailyOneDetailContent from "@/components/public/DailyOneDetailContent";

export default function DailyOnePage() {
  return (
    <Suspense fallback={null}>
      <DailyOneDetailContent locale="es" />
    </Suspense>
  );
}
