import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex bg-[#0a0e17] text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#1e2a3a] flex flex-col pt-8">
        <div className="px-6 mb-10 flex items-center gap-2">
           <div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center font-black">F</div>
           <span className="font-bold tracking-tighter">BOGA AI Admin</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { label: "Dashboard", href: "/admin/dashboard", icon: "📊" },
            { label: "Content",   href: "/admin/content",   icon: "📝" },
            { label: "Ad Bans",   href: "/admin/ads",       icon: "💰" },
            { label: "Members",   href: "/admin/members",   icon: "👥" },
            { label: "Messages",  href: "/admin/messages",  icon: "✉️" },
            { label: "Settings",  href: "/admin/settings",  icon: "⚙️" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white hover:bg-[#141924] hover:text-white transition-all group"
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-[#1e2a3a]">
           <Link href="/" className="flex items-center gap-2 text-xs text-[#00d2ff] hover:text-[#3b82f6] transition-colors">
              &larr; View Website
           </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <header className="h-16 border-b border-[#1e2a3a] flex items-center justify-between px-8 bg-[#0d1117]/50 backdrop-blur-md sticky top-0 z-30">
           <h2 className="font-bold text-white">Administration</h2>
           <div className="flex items-center gap-4">
              <span className="text-xs text-[#00d2ff]">Logged in as <b>Admin</b></span>
              <button className="text-xs font-bold text-[#ef4444]">Logout</button>
           </div>
        </header>
        
        <div className="p-8">
           {children}
        </div>
      </main>
    </div>
  );
}
