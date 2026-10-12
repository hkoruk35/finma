import Link from "next/link";
import { HOT_THEMES_2026 } from "@/lib/hotThemes2026";

/**
 * Sitedeki "Piyasalar" menüsünün yönetim karşılığı: ziyaretçiden gizlenen (lib/staffOnly.ts) liste, trend,
 * performans ve araç sayfalarına tek yerden erişim. Rotalar dosya sisteminden doğrulandı (diller arası farklar:
 * swing arşivi tr/id'de "arsiv", diğerlerinde "archive"; Eğitim Rehberi yalnız tr).
 */

const LOCALES = ["tr", "en", "es", "fr", "pt", "id"] as const;
type L = (typeof LOCALES)[number];

interface Item { label: string; hint?: string; href: (l: L) => string | null }

const themeSlug = HOT_THEMES_2026[0].slug;

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: "Piyasalar menüsü",
    items: [
      { label: "Top 7", href: (l) => `/global/${l}/top7` },
      { label: "Top 100", href: (l) => `/global/${l}/top100` },
      { label: "Yükselenler", href: (l) => `/global/${l}/gainers` },
      { label: "Düşenler", href: (l) => `/global/${l}/losers` },
      { label: "Trend Hisseleri", href: (l) => `/global/${l}/swing` },
      { label: "Temalar", hint: "ilk tema; diğerleri sayfa içindeki listeden", href: (l) => `/global/${l}/themes/${themeSlug}` },
    ],
  },
  {
    title: "Trend & performans",
    items: [
      { label: "Trend Arşivi", href: (l) => `/global/${l}/swing/${l === "tr" || l === "id" ? "arsiv" : "archive"}` },
      { label: "Performans", href: (l) => `/global/${l}/performance` },
      { label: "Swing Performansı", href: (l) => `/global/${l}/swingperformance` },
      { label: "Günün Trend Hisseleri", href: (l) => `/global/${l}/dailyone` },
    ],
  },
  {
    title: "Araçlar",
    items: [
      { label: "Terminal", href: (l) => `/global/${l}/terminal` },
      { label: "Eğitim Rehberi", hint: "yalnız Türkçe", href: (l) => (l === "tr" ? `/global/tr/egitim` : null) },
    ],
  },
];

export default function AdminPiyasalarPage() {
  return (
    <div style={{ padding: 20, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 18, fontWeight: 900, color: "#58a6ff", marginBottom: 4 }}>📑 Piyasalar (Site Menüsü)</h1>
      <p style={{ fontSize: 12, color: "#8b949e", marginBottom: 20, maxWidth: 720 }}>
        Bu sayfalar ziyaretçilere kapalıdır; yalnızca yönetim hesapları (2 admin + Furkan) açabilir. Her dil için bağlantılar aşağıdadır.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        {SECTIONS.map((s) => (
          <section key={s.title} style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 14 }}>
            <h2 style={{ fontSize: 12, fontWeight: 900, color: "#8b949e", letterSpacing: 1, marginBottom: 10 }}>{s.title.toUpperCase()}</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {s.items.map((it) => (
                <div key={it.label}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>
                    {it.label}
                    {it.hint && <span style={{ fontSize: 10, fontWeight: 400, color: "#8b949e", marginLeft: 8 }}>{it.hint}</span>}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {LOCALES.map((l) => {
                      const href = it.href(l);
                      return href ? (
                        <Link
                          key={l}
                          href={href}
                          target="_blank"
                          style={{ fontSize: 11, fontWeight: 700, color: "#58a6ff", border: "1px solid #30363d", borderRadius: 4, padding: "3px 9px", textDecoration: "none", background: "#111827" }}
                        >
                          {l.toUpperCase()} ↗
                        </Link>
                      ) : null;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
