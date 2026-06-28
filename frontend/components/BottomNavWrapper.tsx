"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";
import GlobalBottomNav from "./GlobalBottomNav";

export default function BottomNavWrapper() {
  const pathname = usePathname();
  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const isHomePage = pathname === "/";
  const isPublicSection = isPathOrSubpath("/en") || isPathOrSubpath("/tr");
  const isGlobalSection = isPathOrSubpath("/global");

  if (isHomePage || isPublicSection) return null;

  if (isGlobalSection) return <GlobalBottomNav />;

  return <BottomNav />;
}
