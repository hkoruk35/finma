"use client";

import { useEffect } from "react";

// First-Party Traffic Audit — client-side verification events. Mounted once
// in the root layout (does not remount on client-side route changes), so
// page_loaded/active_*/interaction fire once per real document load, matching
// the server-side landing_request captured in proxy.ts for the same request.
// signup_started is fired from RegisterForm.tsx via the same sendTrackEvent
// helper; signup_completed is written server-side only (see
// /api/members/register), never from the client.

function sendTrackEvent(eventName: string) {
  try {
    const payload = JSON.stringify({ event_name: eventName, pathname: window.location.pathname });
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/track/event", blob);
    } else {
      fetch("/api/track/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true }).catch(() => {});
    }
  } catch {
    // Tracking hatasi asla siteyi etkilememeli.
  }
}

const SENT_FLAG_KEY = "boga_audit_sent_v1";

function alreadySent(eventName: string): boolean {
  try {
    const raw = sessionStorage.getItem(SENT_FLAG_KEY);
    const sent: string[] = raw ? JSON.parse(raw) : [];
    return sent.includes(eventName);
  } catch {
    return false;
  }
}

function markSent(eventName: string) {
  try {
    const raw = sessionStorage.getItem(SENT_FLAG_KEY);
    const sent: string[] = raw ? JSON.parse(raw) : [];
    if (!sent.includes(eventName)) {
      sent.push(eventName);
      sessionStorage.setItem(SENT_FLAG_KEY, JSON.stringify(sent));
    }
  } catch {
    // sessionStorage yoksa (gizli mod vb.) sadece bu sekme icinde tekrar denenir — sunucudaki
    // unique index nihai koruma.
  }
}

function fireOnce(eventName: string) {
  if (alreadySent(eventName)) return;
  markSent(eventName);
  sendTrackEvent(eventName);
}

export default function TrafficAuditTracker() {
  useEffect(() => {
    fireOnce("page_loaded");

    // Gorunur-kalma suresini biriktiren sayac — tab arka plandayken ILERLEMEZ.
    let visibleSeconds = 0;
    const sent = { s5: false, s15: false, s30: false };
    const tick = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      visibleSeconds += 1;
      if (!sent.s5 && visibleSeconds >= 5) { sent.s5 = true; fireOnce("active_5s"); }
      if (!sent.s15 && visibleSeconds >= 15) { sent.s15 = true; fireOnce("active_15s"); }
      if (!sent.s30 && visibleSeconds >= 30) { sent.s30 = true; fireOnce("active_30s"); clearInterval(tick); }
    }, 1000);

    // Gercek etkilesim: click/tap, klavye, veya anlamli scroll (>=50px).
    // mousemove KASITLI OLARAK dinlenmiyor.
    let interactionSent = false;
    let lastScrollY = window.scrollY;
    const onInteract = () => {
      if (interactionSent) return;
      interactionSent = true;
      fireOnce("user_interaction");
      cleanupInteraction();
    };
    const onScroll = () => {
      if (Math.abs(window.scrollY - lastScrollY) >= 50) onInteract();
      lastScrollY = window.scrollY;
    };
    const cleanupInteraction = () => {
      window.removeEventListener("click", onInteract);
      window.removeEventListener("keydown", onInteract);
      window.removeEventListener("touchstart", onInteract);
      window.removeEventListener("scroll", onScroll);
    };
    window.addEventListener("click", onInteract);
    window.addEventListener("keydown", onInteract);
    window.addEventListener("touchstart", onInteract, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      clearInterval(tick);
      cleanupInteraction();
    };
  }, []);

  return null;
}

export { sendTrackEvent };
