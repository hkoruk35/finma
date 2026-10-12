"use client";

import type { ReactNode } from "react";
import { useIsStaff } from "@/hooks/useIsStaff";

/** İçeriği yalnızca yönetim hesaplarına gösterir (ziyaretçide hiç render edilmez). */
export default function StaffOnly({ children }: { children: ReactNode }) {
  return useIsStaff() ? <>{children}</> : null;
}
