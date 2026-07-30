import Link from "next/link";

interface CSPNavItem {
  label: string;
  href: string;
  color: string;
}

const CSP_NAV_ITEMS: CSPNavItem[] = [
  { label: "Active Watchlist", href: "/csp/active", color: "text-[#10b981]" },
  { label: "Portföy", href: "/csp/portfolio", color: "text-[#f97316]" },
  { label: "Swing", href: "/csp/swing", color: "text-[#6b7280]" },
  { label: "Daily", href: "/csp/daily", color: "text-[#f59e0b]" },
  { label: "Long-Term", href: "/csp/long_term", color: "text-[#14b8a6]" },
];

export default function CSPNavigation({ active }: { active?: string }) {
  return (
    <div className="mb-6 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {CSP_NAV_ITEMS.map((item) => {
        const isActive = active === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2 text-sm font-medium uppercase whitespace-nowrap rounded-lg transition-all border ${
              isActive
                ? `${item.color} bg-white/5 border-current`
                : "text-white/40 border-white/10 hover:text-white/70"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
