"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function BottomNavWrapper() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";
  const isAiPage = pathname === "/ai" || pathname.startsWith("/ai/");

  if (isHomePage || isAiPage) return null;

  return <BottomNav />;
}
