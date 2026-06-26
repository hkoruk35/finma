"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function BottomNavWrapper() {
  const pathname = usePathname();
  const isPathOrSubpath = (base: string) => pathname === base || pathname.startsWith(`${base}/`);
  const isHomePage = pathname === "/";
  const isPublicSection = isPathOrSubpath("/en") || isPathOrSubpath("/tr");

  if (isHomePage || isPublicSection) return null;

  return <BottomNav />;
}
