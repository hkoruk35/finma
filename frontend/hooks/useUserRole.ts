"use client";

import { useEffect, useState } from "react";

export type UserRole = "admin" | "readonly" | null;

let cachedRole: UserRole = null;
let fetchPromise: Promise<void> | null = null;

export function useUserRole(): UserRole {
  const [role, setRole] = useState<UserRole>(cachedRole);

  useEffect(() => {
    if (cachedRole !== null) {
      setRole(cachedRole);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetch("/api/auth/me")
        .then(r => r.json())
        .then(d => {
          cachedRole = d.role === "readonly" ? "readonly" : "admin";
        })
        .catch(() => {
          cachedRole = "admin";
        });
    }
    fetchPromise.then(() => setRole(cachedRole));
  }, []);

  return role;
}
