"use client";

// Thin client wrapper so we can use AddToCartButton inside a server-rendered table
import AddToCartButton from "@/components/AddToCartButton";

interface Props {
  pick: {
    ticker: string;
    company: string;
    sector?: string;
    current_price: number;
    buy_zone: { low: number; high: number };
    profit_zone: { low: number; high: number };
    stop_zone: { low: number; high: number };
    holding_period?: string;
    score: number;
  };
}

export default function CartButtonWrapper({ pick }: Props) {
  return <AddToCartButton pick={pick} compact />;
}
