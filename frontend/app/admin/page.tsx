"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import HubQuotes from "@/components/admin/hub/HubQuotes";

interface Stats {
  members: number | null;
  unreadMessages: number | null;
  activeCampaigns: number | null;
  newToday: number | null;
}

const CARD = { background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 14 };

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

/** Dört ana bölüm — her biri merkez sayfasına gider, kart içinde canlı özet fiyatlar */
const SECTIONS = [
  {
    href: "/admin/merkez/endeks", icon: "⚡", title: "Endeks", sub: "SPY · QQQ · IWM gün içi motorları", accent: "#d29922",
    items: [
      { symbol: "SPY", name: "S&P 500", href: "/admin/spyengine/v1" },
      { symbol: "QQQ", name: "Nasdaq 100", href: "/admin/qqqengine/v1" },
      { symbol: "IWM", name: "Russell 2000", href: "/admin/iwmengine/v1" },
    ],
  },
  {
    href: "/admin/merkez/kaldiracli", icon: "🚀", title: "Kaldıraçlı ETF", sub: "UPRO / SPXU — SPY sinyalli 3x", accent: "#a371f7",
    items: [
      { symbol: "UPRO", name: "3x Long", note: "SPY yükselişinde al" },
      { symbol: "SPXU", name: "3x Short", note: "SPY düşüşünde al" },
    ],
  },
  {
    href: "/admin/merkez/hisse-swing", icon: "📈", title: "Hisse Swing", sub: "Engine hisseleri + Trend Hisseleri", accent: "#3fb950",
    items: [
      { symbol: "NVDA", name: "NVIDIA", href: "/admin/nvdaengine/v1" },
      { symbol: "TSLA", name: "Tesla", href: "/admin/tslaengine/v1" },
      { symbol: "AAPL", name: "Apple", href: "/admin/aaplengine/v1" },
    ],
  },
  {
    href: "/admin/merkez/hisse-opsiyon", icon: "🎯", title: "Hisse Opsiyon", sub: "Haftalık vade · ATM/ITM1 · delta 0,55–0,70", accent: "#58a6ff",
    items: [
      { symbol: "AMD", name: "AMD", href: "/admin/stockengine/AMD" },
      { symbol: "META", name: "Meta", href: "/admin/stockengine/META" },
      { symbol: "PLTR", name: "Palantir", href: "/admin/stockengine/PLTR" },
    ],
  },
];

const QUICK = [
  { href: "/admin/trading/swing", label: "📈 Swing listesi" },
  { href: "/admin/trading/options", label: "🎯 Opsiyon tarayıcı" },
  { href: "/admin/supertrade/v4", label: "🦅 SuperTrade V4" },
  { href: "/admin/analytics/performance", label: "📊 Performans" },
  { href: "/admin/portfolio/tracker", label: "💼 Portföy" },
  { href: "/admin/ai", label: "🤖 AI" },
  { href: "/admin/top100", label: "🏆 Top100" },
  { href: "/admin/analytics/visitors", label: "👥 Ziyaretçiler" },
];

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
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3", maxWidth: 1280 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: "#58a6ff" }}>Yönetim Merkezi</h1>
      <p style={{ fontSize: 12, color: "#8b949e", marginTop: 4 }}>Ana bölümler · canlı özet · hızlı erişim</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, marginTop: 18 }}>
        {SECTIONS.map((s) => (
          <div key={s.href} style={{ ...CARD, borderTop: `3px solid ${s.accent}`, padding: 16 }}>
            <Link href={s.href} style={{ textDecoration: "none", display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#e6edf3" }}>{s.icon} {s.title}</div>
                <span style={{ fontSize: 11, fontWeight: 800, color: s.accent }}>Merkezi aç →</span>
              </div>
              <div style={{ fontSize: 11, color: "#8b949e", margin: "4px 0 12px" }}>{s.sub}</div>
            </Link>
            <HubQuotes items={s.items} compact />
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: 12, fontWeight: 900, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5, margin: "26px 0 10px" }}>Hızlı erişim</h2>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} style={{ ...CARD, padding: "8px 12px", fontSize: 12, fontWeight: 800, color: "#e6edf3", textDecoration: "none" }}>
            {q.label}
          </Link>
        ))}
      </div>

      <h2 style={{ fontSize: 12, fontWeight: 900, color: "#8b949e", textTransform: "uppercase", letterSpacing: 0.5, margin: "26px 0 10px" }}>Site yönetimi</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div style={CARD}>
              <div style={{ fontSize: 11, color: "#8b949e" }}>{c.label}</div>
              <div style={{ fontSize: 26, fontWeight: 900, color: "#e6edf3", marginTop: 6 }}>
                {c.value === null ? "—" : c.value}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
