"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Genel Bakış" },
  { href: "/admin/trading/swing", label: "📈 Trading" },
  { href: "/admin/analytics/performance", label: "📊 Analytics" },
  { href: "/admin/portfolio/tracker", label: "💼 Portfolio" },
  { href: "/admin/education/academy", label: "🎓 Education" },
  { href: "/admin/ai", label: "🤖 AI" },
  { href: "/admin/account/login", label: "👤 Account" },
  { href: "/admin/archive", label: "📦 Archive" },
  { href: "/admin/pro", label: "⭐ Pro" },
  { href: "/admin/settings/theme", label: "🎨 Themes" },
  { href: "/admin/members", label: "👥 Üyeler" },
  { href: "/admin/messages", label: "💬 Mesajlar" },
  { href: "/admin/plans", label: "📋 Paketler" },
  { href: "/admin/campaigns", label: "📣 Kampanyalar" },
  { href: "/admin/sitemap", label: "🗺️ Site Haritası" },
  { href: "/admin/top100", label: "🏆 Top100" },
  { href: "/admin/admins", label: "👨‍💼 Adminler" },
];

export default function AdminSidebar({ role }: { role?: string }) {
  const pathname = usePathname();

  return (
    <aside
      style={{ background: "#0d1117", borderRight: "1px solid #30363d", width: 200, minHeight: "100vh" }}
      className="hidden md:flex flex-col flex-shrink-0"
    >
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #30363d" }}>
        <div style={{ color: "#58a6ff", fontWeight: 900, fontSize: 14, fontFamily: "monospace" }}>BOGA AI</div>
        <div style={{ color: "#8b949e", fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>Yönetim Merkezi</div>
      </div>
      <nav style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                padding: "8px 10px",
                borderRadius: 4,
                fontSize: 12,
                fontFamily: "monospace",
                fontWeight: 700,
                color: active ? "#58a6ff" : "#8b949e",
                background: active ? "#58a6ff15" : "transparent",
                textDecoration: "none",
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      {role === "readonly" && (
        <div style={{ marginTop: "auto", padding: 12, fontSize: 10, color: "#e3b341", fontFamily: "monospace" }}>
          Salt okunur erişim
        </div>
      )}
    </aside>
  );
}
