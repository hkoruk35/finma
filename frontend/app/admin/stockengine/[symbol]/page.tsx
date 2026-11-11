/**
 * Hisse Engine — Takip Sistemi (/admin/stockengine/{SEMBOL}). NVDA/AAPL/TSLA/AMZN/IWM ile aynı tasarım ve motor
 * (TrackerEnginePage · lib/spyengine/tracker.ts); sembol listesi lib/spyengine/engines.ts (HUB_STOCKS).
 * Yönetim: /admin/** proxy.ts tarafından boga_auth ile korunur.
 */

import { notFound } from "next/navigation";
import TrackerEnginePage from "@/components/admin/spyengine/TrackerEnginePage";
import { HUB_STOCKS } from "@/lib/spyengine/engines";

export function generateStaticParams() {
  return HUB_STOCKS.map((symbol) => ({ symbol }));
}

export default async function StockEnginePage({ params }: { params: Promise<{ symbol: string }> }) {
  const sym = (await params).symbol.toUpperCase();
  if (!(HUB_STOCKS as readonly string[]).includes(sym)) notFound();
  return <TrackerEnginePage symbol={sym as (typeof HUB_STOCKS)[number]} />;
}
