"use client";

/** Merkez sayfaları ortak çerçevesi: başlık + 4 merkez arası geçiş şeridi. */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HUB_PAGES } from "@/lib/adminHub";

export function HubSection({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ fontSize: 13, fontWeight: 900, color: "#e6edf3", letterSpacing: 0.4, textTransform: "uppercase" }}>{title}</h2>
          {hint && <div style={{ fontSize: 11, color: "#8b949e", marginTop: 2 }}>{hint}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function HubLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ fontSize: 11, fontWeight: 800, color: "#58a6ff", textDecoration: "none", border: "1px solid #30363d", borderRadius: 6, padding: "5px 10px", background: "#0d1117" }}>
      {children} →
    </Link>
  );
}

export default function HubShell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  const path = usePathname();
  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3", maxWidth: 1280 }}>
      <Link href="/admin" style={{ fontSize: 11, color: "#8b949e", textDecoration: "none" }}>← Genel Bakış</Link>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: "#58a6ff", marginTop: 6 }}>{title}</h1>
      <p style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>{subtitle}</p>
      <nav style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 14 }} aria-label="Merkezler">
        {HUB_PAGES.map((h) => {
          const on = path === h.href;
          return (
            <Link key={h.href} href={h.href} style={{
              padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 800, textDecoration: "none",
              border: `1px solid ${on ? "#58a6ff" : "#30363d"}`, background: on ? "#58a6ff20" : "#0d1117", color: on ? "#58a6ff" : "#8b949e",
            }}>{h.icon} {h.label}</Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
