"use client";

/**
 * SPY Engine — Takip Sistemi (/admin/spyengine/v1). Sayfanın tamamı ortak bileşende:
 * components/admin/spyengine/TrackerEnginePage.tsx (QQQ Engine aynı bileşeni symbol="QQQ" ile kullanır).
 * Yalnızca admin: /admin/** proxy.ts tarafından boga_auth ile korunur.
 */

import TrackerEnginePage from "@/components/admin/spyengine/TrackerEnginePage";

export default function SpyEnginePage() {
  return <TrackerEnginePage symbol="SPY" />;
}
