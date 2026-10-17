"use client";

/**
 * TSLA Engine — Takip Sistemi (/admin/tslaengine/v1). SPY/QQQ Engine ile birebir aynı tasarım ve motor
 * (components/admin/spyengine/TrackerEnginePage.tsx · lib/spyengine/tracker.ts); TSLA'a özel ayar lib/spyengine/engines.ts'te.
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur.
 */

import TrackerEnginePage from "@/components/admin/spyengine/TrackerEnginePage";

export default function TslaEnginePage() {
  return <TrackerEnginePage symbol="TSLA" />;
}
