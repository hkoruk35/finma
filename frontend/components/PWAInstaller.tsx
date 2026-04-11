"use client";

import { useEffect } from "react";

export default function PWAInstaller() {
  useEffect(() => {
    // Register service worker for offline support and PWA installation
    if ("serviceWorker" in navigator && "caches" in window) {
      // Wait for page load before registering
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js", { scope: "/" })
          .then(reg => {
            console.log("✓ Service Worker registered:", reg.scope);
            // Update service worker if new version available
            reg.addEventListener("updatefound", () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener("statechange", () => {
                  if (newWorker.state === "activated") {
                    console.log("✓ Service Worker updated");
                  }
                });
              }
            });
          })
          .catch(error => {
            console.error("✗ Service Worker registration failed:", error);
          });
      });
    } else {
      console.warn("Service Workers not supported on this device");
    }

    // Handle beforeinstallprompt event for app installation
    let deferredPrompt: any;

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log("✓ Install prompt available");

      // Show install button if in app context
      const installBtn = document.getElementById("install-app-btn");
      if (installBtn) {
        installBtn.style.display = "block";
        installBtn.addEventListener("click", () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
              if (choiceResult.outcome === "accepted") {
                console.log("✓ User accepted installation");
              } else {
                console.log("✗ User rejected installation");
              }
              deferredPrompt = null;
            });
          }
        });
      }
    };

    const handleAppInstalled = () => {
      console.log("✓ BOGA app successfully installed!");
      deferredPrompt = null;
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    // Check if running as standalone app
    if ((window.navigator as any).standalone === true) {
      console.log("✓ Running as installed PWA");
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  return null;
}
