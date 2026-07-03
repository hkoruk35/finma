import Link from "next/link";
import { SITEMAP_EN, SITEMAP_TR, SITEMAP_ADMIN, SitemapGroup } from "@/lib/admin/sitemap-data";

const ACCENT = "#58a6ff";

function Section({ title, groups }: { title: string; groups: SitemapGroup[] }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ fontSize: 14, fontWeight: 900, color: ACCENT, marginBottom: 10 }}>{title}</h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        {groups.map((g) => (
          <div key={g.group} style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#8b949e", fontWeight: 700, marginBottom: 8 }}>{g.group.toUpperCase()}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {g.entries.map((e) => (
                <Link key={e.path} href={e.path} target="_blank" style={{ fontSize: 12, color: "#e6edf3", textDecoration: "none" }}>
                  <span style={{ color: "#3fb950", marginRight: 6 }}>→</span>
                  {e.label}
                  <span style={{ color: "#8b949e", fontSize: 10, marginLeft: 6 }}>{e.path}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminSitemapPage() {
  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>Site Haritası</h1>
      <Section title="English" groups={SITEMAP_EN} />
      <Section title="Türkçe" groups={SITEMAP_TR} />
      <Section title="Admin" groups={SITEMAP_ADMIN} />
    </div>
  );
}
