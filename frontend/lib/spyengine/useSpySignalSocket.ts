"use client";

/**
 * WebSocket client for the standalone `spy_signal_engine/` service
 * (repo root, Python/FastAPI — see tasks/active/014-spy-signal-engine-realtime.md).
 *
 * Connects to wss://<host>/admin/spyengine/live/ws, an nginx-only route
 * that sits OUTSIDE Next.js/proxy.ts entirely — nginx cannot check the
 * boga_auth cookie here. Auth is instead a shared secret: this hook first
 * calls the boga_auth-protected `/api/admin/spyengine/live-token` route to
 * fetch SPY_ENGINE_SECRET, then opens the socket as `.../ws?token=<secret>`.
 * The FastAPI app rejects the handshake (close code 4401) without a valid
 * token — see spy_signal_engine/app.py and nginx_snippet.conf.
 *
 * Auto-reconnects with exponential backoff capped at ~10s (re-fetches the
 * token each attempt in case it rotates). On mount the caller is expected
 * to separately GET /api/admin/spyengine/live-history for the initial
 * table — this hook only carries the live push stream.
 */
import { useEffect, useRef, useState } from "react";

export type SpySignalDecision = "CALL SETUP" | "PUT SETUP" | "NO TRADE";
export type SpyMarketStatus = "open" | "closed" | "pre" | "post";

export interface SpySignalMessage {
  symbol?: string;
  time_utc?: string;
  decision: SpySignalDecision | string;
  trend?: "UP" | "DOWN" | "FLAT";
  rsi_prev?: number | null;
  rsi_now?: number | null;
  macd_dir?: string | null;
  vol_ratio_pct?: number | null;
  vwap?: number | null;
  above_vwap?: boolean | null;
  candle_shape?: string | null;
  support?: number | null;
  resistance?: number | null;
  trigger_1m?: string | null;
  last_close?: number | null;
  entry_zone?: string | null;
  market_status?: SpyMarketStatus | string;
  reason?: string;
}

export type SocketStatus = "connecting" | "connected" | "disconnected";

const MAX_BACKOFF_MS = 10_000;
const BASE_BACKOFF_MS = 1_000;

function liveWsUrl(token: string): string | null {
  if (typeof window === "undefined") return null;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/admin/spyengine/live/ws?token=${encodeURIComponent(token)}`;
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/admin/spyengine/live-token", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.token === "string" ? json.token : null;
  } catch {
    return null;
  }
}

export function useSpySignalSocket() {
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [lastMessage, setLastMessage] = useState<SpySignalMessage | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedByUsRef = useRef(false);

  useEffect(() => {
    closedByUsRef.current = false;

    const scheduleReconnect = () => {
      if (closedByUsRef.current) return;
      setStatus("disconnected");
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      const delay = Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      timerRef.current = setTimeout(connect, delay);
    };

    const connect = async () => {
      setStatus("connecting");
      const token = await fetchToken();
      if (closedByUsRef.current) return;
      if (!token) {
        // No valid session/token yet — back off and retry rather than
        // opening a socket the server will just reject.
        scheduleReconnect();
        return;
      }
      const url = liveWsUrl(token);
      if (!url) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        attemptRef.current = 0;
        setStatus("connected");
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as SpySignalMessage;
          setLastMessage(parsed);
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = scheduleReconnect;
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // no-op — onclose handles reconnect scheduling
        }
      };
    };

    connect();

    return () => {
      closedByUsRef.current = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, []);

  return { status, lastMessage };
}
