"use client";

import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";

interface Props {
  ticker: string;
}

export function WatchlistButtonWrapper({ ticker }: Props) {
  return <AddToWatchlistButton ticker={ticker} compact />;
}
