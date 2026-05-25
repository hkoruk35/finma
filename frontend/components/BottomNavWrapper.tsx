"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

export default function BottomNavWrapper() {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) return null;

  return <BottomNav />;
}
