"use client";

import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-client";

const ADMIN_EMAILS = ["haskor3578@gmail.com", "hulyakoksal89@gmail.com"];

export default function HotThemes2026Section() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [removedSlugs, setRemovedSlugs] = useState<Set<string>>(new Set());

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

        // Fetch removed themes
        const { data: removed } = await supabase.from("removed_hot_themes").select("slug");
        if (removed) {
          setRemovedSlugs(new Set(removed.map((r: any) => r.slug)));
        }
      } catch {
        // Not authenticated or error
      } finally {
        setLoading(false);
      }
    };
    checkAdmin();
  }, []);

  const handleRemove = async (slug: string) => {
    if (!confirm("Bu temayı listeden kaldırmak istediğinizden emin misiniz?")) return;
    try {
      const res = await fetch(`/api/hot-themes/remove`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      if (res.ok) {
        alert("Tema başarıyla kaldırıldı.");
        window.location.reload();
      } else {
        alert("Hata oluştu.");
      }
    } catch (err) {
      alert("İstek başarısız: " + String(err));
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
                {isAdmin && !loading && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleRemove(theme.slug);
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
