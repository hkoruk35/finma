"use client";

/**
 * QQQ Engine — Takip Sistemi (/admin/qqqengine/v1). SPY Engine ile birebir aynı tasarım ve motor kuralları
 * (components/admin/spyengine/TrackerEnginePage.tsx · lib/spyengine/tracker.ts); veri QQQ'dan.
 * Eski QQQ karar merdiveni sayfası git geçmişinde (bu dosyanın önceki sürümü); karar günlüğü uçları
 * (/api/admin/qqqengine/v2/decisions, /techs) yerinde duruyor.
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur.
 */

import TrackerEnginePage from "@/components/admin/spyengine/TrackerEnginePage";

export default function QqqEnginePage() {
  return <TrackerEnginePage symbol="QQQ" />;
}
