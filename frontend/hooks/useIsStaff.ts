"use client";

import { useEffect, useState } from "react";
import { isStaffRole } from "@/lib/staffOnly";

/** Sayfa ömrü boyunca tek istek: boga_auth rolü /api/auth/me'den okunur (cookie httpOnly olabilir). */
let pending: Promise<boolean> | null = null;
function loadIsStaff(): Promise<boolean> {
  if (!pending) {
    pending = fetch("/api/auth/me", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { role: null }))
      .then((j: { role?: string | null }) => isStaffRole(j.role))
      .catch(() => false);
  }
  return pending;
}

/**
 * Yönetim hesabı (admin / readonly / engine) mi? Yüklenene kadar ve hata durumunda `false` —
 * yani yönetim-yalnız öğeler ziyaretçiye hiçbir zaman "yanıp sönmez".
 */
export function useIsStaff(): boolean {
  const [staff, setStaff] = useState(false);
  useEffect(() => {
    let alive = true;
    loadIsStaff().then((v) => { if (alive) setStaff(v); });
    return () => { alive = false; };
  }, []);
  return staff;
}
