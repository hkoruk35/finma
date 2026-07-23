"use client";

import { useEffect } from "react";

export default function PWAInstaller() {
  useEffect(() => {
    // Unregister any legacy service workers and clear browser cache
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    }

    if ("caches" in window) {
      caches.keys().then((keys) => {
        for (let key of keys) {
          caches.delete(key);
        }
      });
    }
  }, []);

  return null;
}
