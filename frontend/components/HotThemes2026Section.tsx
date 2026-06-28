"use client";

import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const ADMIN_EMAILS = ["haskor3578@gmail.com", "hulyakoksal89@gmail.com"];
const REMOVED_THEMES_KEY = "removed_hot_themes_2026";

export default function HotThemes2026Section() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [removedSlugs, setRemovedSlugs] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  const visibleThemes = HOT_THEMES_2026.filter((t) => !removedSlugs.has(t.slug));
  const totalStocks = new Set(visibleThemes.flatMap((t) => t.stocks.map((s) => s.ticker))).size;

  useEffect(() => {
    const checkAdmin = async () => {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data } = await supabase.auth.getUser();
        if (data.user && ADMIN_EMAILS.includes(data.user.email || "")) {
          setIsAdmin(true);
        }
      } catch {
        // Not authenticated
      }

      // Load removed themes from localStorage
      try {
        const stored = localStorage.getItem(REMOVED_THEMES_KEY);
        if (stored) {
          setRemovedSlugs(new Set(JSON.parse(stored)));
        }
      } catch {
        // localStorage error
      }

      setMounted(true);
    };
    checkAdmin();
  }, []);

  const removeTheme = (slug: string) => {
    if (!confirm("Bu temayı listeden kaldırmak istediğinizden emin misiniz?")) return;
    const newRemoved = new Set(removedSlugs);
    newRemoved.add(slug);
    setRemovedSlugs(newRemoved);
    try {
      localStorage.setItem(REMOVED_THEMES_KEY, JSON.stringify(Array.from(newRemoved)));
    } catch {
      // localStorage error
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <span className="text-[10px] text-white/40 uppercase tracking-wide">
          {HOT_THEMES_2026.length} tema · {totalStocks} hisse · CES 2026 / Pentagon bütçesi / CHIPS Act katalizörleri
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {visibleThemes.map((theme) => (
          <Link
            key={theme.slug}
            href={`/csp/${theme.slug}`}
            className="group border rounded-xl p-4 transition-all hover:border-opacity-60 flex flex-col"
            style={{ borderColor: `${theme.accent}25`, background: `${theme.accent}06` }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="flex items-baseline gap-2">
                <span className="text-[10px] font-black tabular-nums" style={{ color: theme.accent }}>
                  {String(theme.number).padStart(2, "0")}
                </span>
                <h3 className="text-[12px] font-black uppercase tracking-wide text-white leading-snug">
                  {theme.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full border"
                  style={{ borderColor: theme.accent, color: theme.accent }}
                >
                  {theme.stocks.length}
                </span>
                {isAdmin && mounted && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      removeTheme(theme.slug);
                    }}
                    className="shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded bg-red-950/30 border border-red-700/40 text-red-400 hover:bg-red-950/50 transition-colors"
                  >
                    KALDIR
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 mt-auto mb-3">
              {theme.stocks.map((s) => (
                <span
                  key={s.ticker}
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/30 text-slate-300"
                >
                  {s.ticker}
                </span>
              ))}
            </div>

            <span
              className="text-[10px] font-black uppercase tracking-wider group-hover:underline"
              style={{ color: theme.accent }}
            >
              Takip Sayfasını Aç →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
