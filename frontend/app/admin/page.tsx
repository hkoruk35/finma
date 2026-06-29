"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Stats {
  members: number | null;
  unreadMessages: number | null;
  activeCampaigns: number | null;
  newToday: number | null;
}

const CARD = { background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 16 };

async function safeCount(url: string, pick: (d: any) => number): Promise<number | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return pick(data);
  } catch {
    return null;
  }
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({ members: null, unreadMessages: null, activeCampaigns: null, newToday: null });

  useEffect(() => {
    (async () => {
      const [members, unreadMessages, activeCampaigns] = await Promise.all([
        safeCount("/api/admin/members", (d) => (d.members ?? []).length),
        safeCount("/api/admin/inbox", (d) => (d.messages ?? []).filter((m: any) => !m.is_read).length),
        safeCount("/api/admin/campaigns", (d) => (d.campaigns ?? []).filter((c: any) => c.active).length),
      ]);
      const newToday = await safeCount("/api/admin/members", (d) => {
        const today = new Date().toISOString().slice(0, 10);
        return (d.members ?? []).filter((m: any) => (m.created_at ?? "").slice(0, 10) === today).length;
      });
      setStats({ members, unreadMessages, activeCampaigns, newToday });
    })();
  }, []);

  const cards = [
    { label: "Toplam Üye", value: stats.members, href: "/admin/members" },
    { label: "Bugün Yeni Kayıt", value: stats.newToday, href: "/admin/members" },
    { label: "Okunmamış Mesaj", value: stats.unreadMessages, href: "/admin/messages" },
    { label: "Aktif Kampanya", value: stats.activeCampaigns, href: "/admin/campaigns" },
  ];

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: "#58a6ff", marginBottom: 20 }}>Yönetim Merkezi</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div style={CARD}>
              <div style={{ fontSize: 11, color: "#8b949e" }}>{c.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#e6edf3", marginTop: 6 }}>
                {c.value === null ? "—" : c.value}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
