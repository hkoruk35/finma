"use client";

/**
 * Merkez sayfaları için canlı fiyat kartları. Veri: /api/admin/spyengine/v2/quotes?symbols=… (20 sn'de bir).
 * Karta tıklayınca `href` açılır (motor sayfası). Veri alınamazsa kart "—" gösterir, uydurma değer yok.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

export interface HubItem {
  symbol: string;
  name: string;
  href?: string;
  /** Kart altı kısa not */
  note?: string;
}

interface Q { symbol: string; price: number | null; changePct: number | null; extended: boolean; error: string | null }

export default function HubQuotes({ items, compact }: { items: HubItem[]; compact?: boolean }) {
  const [q, setQ] = useState<Record<string, Q>>({});
  const key = items.map((i) => i.symbol).join(",");

  useEffect(() => {
    let dead = false;
    const load = async () => {
      try {
        const r = await fetch(`/api/admin/spyengine/v2/quotes?symbols=${encodeURIComponent(key)}`, { credentials: "include", cache: "no-store" });
        if (!r.ok) return;
        const j = await r.json();
        if (dead || !j?.ok) return;
        const m: Record<string, Q> = {};
        for (const x of j.quotes as Q[]) m[x.symbol] = x;
        setQ(m);
      } catch { /* sessiz: kartlar "—" kalır */ }
    };
    void load();
    const t = setInterval(load, 20000);
    return () => { dead = true; clearInterval(t); };
  }, [key]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 138 : 190}px, 1fr))`, gap: 10 }}>
      {items.map((it) => {
        const d = q[it.symbol];
        const pct = d?.changePct ?? null;
        const col = pct == null ? "#8b949e" : pct >= 0 ? "#3fb950" : "#f85149";
        const body = (
          <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: compact ? "9px 11px" : "12px 14px", height: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontWeight: 900, fontSize: compact ? 13 : 15, color: "#e6edf3" }}>{it.symbol}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: col }}>
                {pct == null ? "—" : `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`}
              </span>
            </div>
            <div style={{ fontSize: compact ? 15 : 19, fontWeight: 800, color: "#e6edf3", marginTop: 4 }}>
              {d?.price != null ? `$${d.price.toFixed(2)}` : "—"}
              {d?.extended && <span style={{ fontSize: 9, color: "#e3b341", marginLeft: 5 }}>EXT</span>}
            </div>
            <div style={{ fontSize: 10, color: "#8b949e", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {it.note ?? it.name}
            </div>
          </div>
        );
        return it.href ? (
          <Link key={it.symbol} href={it.href} style={{ textDecoration: "none" }}>{body}</Link>
        ) : (
          <div key={it.symbol}>{body}</div>
        );
      })}
    </div>
  );
}
