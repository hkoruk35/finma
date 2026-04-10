"use client";

import { useEffect } from "react";

export default function PWAInstaller() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(error => {
        console.log("Service Worker registration failed:", error);
      });
    }

    // Handle install prompt
    let deferredPrompt: any;

    window.addEventListener("beforeinstallprompt", (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
    });

    window.addEventListener("appinstalled", () => {
      console.log("FinMA app installed");
    });
  }, []);

  return null;
}
