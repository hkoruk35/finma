"use client";

import AllListDetailClient from "@/components/AllListDetailClient";

/**
 * Wrapper for AllListDetailClient used in global watchlist pages.
 * Hides tabs and tracker column for a cleaner global experience.
 */
export default function GlobalWatchlistClient() {
  return (
    <div>
      <AllListDetailClient hideTabsAndTracker={true} />
    </div>
  );
}
