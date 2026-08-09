"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const ACCENT = "#58a6ff";
const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 14px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

interface ToggleRow {
  key: string;
  enabled: boolean;
  label_override: string | null;
}

const KEY_INFO: Record<string, { title: string; description: string }> = {
  markets: { title: "Markets", description: "Endeksler / Stocks (Top 7, Top 100...) / Döviz / Emtia / Kripto / Vadeliler alt menüsü" },
  watchlist: { title: "İzleme Listem", description: "Doğrudan bağlantı, alt menüsü yok" },
  news: { title: "News", description: "Hisse Analizleri / Bilançolar / Bilanço Takvimi / Insider Bilgileri alt menüsü" },
  analysis: { title: "Analizler", description: "Markets / Sektör Analizleri / Sektör Isı Haritası / Stock Analizleri / Döviz / Emtia / Kripto / Vadeliler analizleri" },
  brokers: { title: "Brokers", description: "Stock Brokers / FX Brokers / Kripto Brokers alt menüsü" },
};

// Header'daki (MemberHeader.tsx) mega menünün üst seviye öğelerini
// açık/kapalı yapmak ve etiketini değiştirmek için — menü ağacının kendisi
// (alt öğeler, rotalar) kodda sabit kalır, bkz. app/api/menu-toggles.
export default function MenuYonetimiPage() {
  const [toggles, setToggles] = useState<ToggleRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/menu-toggles");
    if (res.ok) setToggles((await res.json()).toggles ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patch = async (key: string, patchBody: { enabled?: boolean; labelOverride?: string | null }) => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/menu-toggles", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, ...patchBody }),
    });
    if (!res.ok) setError((await res.json()).error || "Güncelleme hatası");
    await load();
    setBusy(false);
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>Menü Yönetimi — Header</h1>
        <Link href="/admin" style={{ color: ACCENT, fontSize: 12 }}>← Admin</Link>
      </div>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12, fontWeight: "bold" }}>{error}</div>}

      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 16 }}>
        Bu ayarlar header'daki mega menünün üst seviye başlıklarını gösterir/gizler ve etiketini değiştirir (tüm diller için).
        Alt menü öğeleri ve rotalar kod içinde sabittir.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {toggles.map((t) => {
          const info = KEY_INFO[t.key] || { title: t.key, description: "" };
          return (
            <div key={t.key} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 200 }}>
                <div style={{ fontWeight: 700 }}>{info.title}</div>
                <div style={{ opacity: 0.6, fontSize: 10 }}>{info.description}</div>
              </div>
              <input
                type="text"
                placeholder="Etiket override (boş = varsayılan)"
                defaultValue={t.label_override ?? ""}
                onBlur={(e) => patch(t.key, { labelOverride: e.target.value.trim() || null })}
                style={{ ...inputStyle, minWidth: 200 }}
              />
              <button
                disabled={busy}
                onClick={() => patch(t.key, { enabled: !t.enabled })}
                style={{ ...btnStyle, background: t.enabled ? "#22c55e" : "#30363d", color: t.enabled ? "#0d1117" : "#e6edf3" }}
              >
                {t.enabled ? "Açık" : "Kapalı"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
