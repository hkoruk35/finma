"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Genel Bakış" },
  { href: "/admin/trading/swing", label: "📈 Trading" },
  { href: "/admin/analytics/performance", label: "📊 Analytics" },
  { href: "/admin/analytics/visitors", label: "👥 Ziyaretçiler" },
  { href: "/admin/portfolio/tracker", label: "💼 Portfolio" },
  { href: "/admin/education/academy", label: "🎓 Education" },
  { href: "/admin/ai", label: "🤖 AI" },
  { href: "/admin/x-studio", label: "🐦 X Studio" },
  { href: "/admin/account/login", label: "👤 Account" },
  { href: "/admin/archive", label: "📦 Archive" },
  { href: "/admin/pro", label: "⭐ Pro" },
  { href: "/admin/settings/theme", label: "🎨 Themes" },
  { href: "/admin/members", label: "👥 Üyeler" },
  { href: "/admin/messages", label: "💬 Mesajlar" },
  { href: "/admin/plans", label: "📋 Paketler" },
  { href: "/admin/campaigns", label: "📣 Kampanyalar" },
  { href: "/admin/landing", label: "🌐 Landing Pages" },
  { href: "/admin/sitemap", label: "🗺️ Site Haritası" },
  { href: "/admin/top100", label: "🏆 Top100" },
  { href: "/admin/admins", label: "👨‍💼 Adminler" },
];

export default function AdminSidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navList = (onNavigate?: () => void) => (
    <nav style={{ padding: 8, display: "flex", flexDirection: "column", gap: 2 }}>
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
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
  );

  return (
    <>
      {/* Mobil Üst Bar — hamburger menü ile tüm admin menülerine erişim */}
      <div
        style={{ background: "#0d1117", borderBottom: "1px solid #30363d" }}
        className="flex md:hidden items-center justify-between px-4 py-3 sticky top-0 z-40"
      >
        <div>
          <div style={{ color: "#58a6ff", fontWeight: 900, fontSize: 14, fontFamily: "monospace" }}>BOGA AI</div>
          <div style={{ color: "#8b949e", fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>Yönetim Merkezi</div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          aria-label="Menüyü Aç"
          style={{ color: "#8b949e", background: "transparent", border: "1px solid #30363d", borderRadius: 6, padding: "8px 10px" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsMobileOpen(false)} />
          <div
            style={{ background: "#0d1117", borderRight: "1px solid #30363d", width: 240 }}
            className="relative flex flex-col h-full overflow-y-auto"
          >
            <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #30363d" }} className="flex items-center justify-between">
              <div>
                <div style={{ color: "#58a6ff", fontWeight: 900, fontSize: 14, fontFamily: "monospace" }}>BOGA AI</div>
                <div style={{ color: "#8b949e", fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>Yönetim Merkezi</div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                aria-label="Menüyü Kapat"
                style={{ color: "#8b949e", background: "transparent", border: "none" }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {navList(() => setIsMobileOpen(false))}
            {role === "readonly" && (
              <div style={{ marginTop: "auto", padding: 12, fontSize: 10, color: "#e3b341", fontFamily: "monospace" }}>
                Salt okunur erişim
              </div>
            )}
          </div>
        </div>
      )}

      {/* Masaüstü Kenar Çubuğu */}
      <aside
        style={{ background: "#0d1117", borderRight: "1px solid #30363d", width: 200, minHeight: "100vh" }}
        className="hidden md:flex flex-col flex-shrink-0"
      >
        <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid #30363d" }}>
          <div style={{ color: "#58a6ff", fontWeight: 900, fontSize: 14, fontFamily: "monospace" }}>BOGA AI</div>
          <div style={{ color: "#8b949e", fontSize: 10, fontFamily: "monospace", marginTop: 2 }}>Yönetim Merkezi</div>
        </div>
        {navList()}
        {role === "readonly" && (
          <div style={{ marginTop: "auto", padding: 12, fontSize: 10, color: "#e3b341", fontFamily: "monospace" }}>
            Salt okunur erişim
          </div>
        )}
      </aside>
    </>
  );
}
