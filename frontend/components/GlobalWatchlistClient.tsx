"use client";

import { Suspense } from "react";
import AllListDetailClient from "@/components/AllListDetailClient";

/**
 * Wrapper for AllListDetailClient used in global watchlist pages.
 * Hides tabs and tracker column for a cleaner global experience.
 */
export default function GlobalWatchlistClient() {
  return (
    <div>
      <Suspense fallback={null}>
        <AllListDetailClient hideTabsAndTracker={true} />
      </Suspense>
    </div>
  );
}
