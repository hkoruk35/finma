"use client";

import { useEffect, useState, useCallback } from "react";

interface Campaign {
  id: string;
  country_code: string | null;
  lang: string | null;
  title: string;
  message: string;
  cta_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
}

const ACCENT = "#58a6ff";
const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const EMPTY = { title: "", message: "", country_code: "", lang: "", cta_url: "" };

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/campaigns");
    if (res.ok) setCampaigns((await res.json()).campaigns ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setError("");
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Hata oluştu.");
      return;
    }
    setForm(EMPTY);
    await load();
  };

  const toggleActive = async (c: Campaign) => {
    await fetch("/api/admin/campaigns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, active: !c.active }),
    });
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Kampanya silinsin mi?")) return;
    await fetch(`/api/admin/campaigns?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>Ülke / Dil Kampanyaları</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {campaigns.map((c) => (
          <div key={c.id} style={{ background: "#000036", border: "1px solid #30363d", borderRadius: 6, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <strong style={{ color: ACCENT }}>{c.title}</strong>
                <span style={{ color: "#8b949e", fontSize: 10, marginLeft: 8 }}>
                  {c.country_code || "TÜM ÜLKELER"} / {c.lang || "TÜM DİLLER"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => toggleActive(c)} style={{ background: "transparent", border: "none", color: c.active ? "#3fb950" : "#8b949e", cursor: "pointer", fontFamily: "monospace", fontSize: 11 }}>
                  {c.active ? "● aktif" : "○ pasif"}
                </button>
                <button onClick={() => remove(c.id)} style={{ background: "transparent", border: "1px solid #f8514966", color: "#f85149", borderRadius: 3, padding: "1px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                  SİL
                </button>
              </div>
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "#c9d1d9" }}>{c.message}</div>
          </div>
        ))}
        {campaigns.length === 0 && <div style={{ color: "#8b949e", fontSize: 12 }}>Henüz kampanya yok.</div>}
      </div>

      <div style={{ background: "#000036", border: "1px solid #30363d", borderRadius: 6, padding: 16, maxWidth: 640 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#8b949e" }}>YENİ KAMPANYA</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
          <input style={inputStyle} placeholder="başlık" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <input style={inputStyle} placeholder="cta url (opsiyonel)" value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} />
          <input style={inputStyle} placeholder="ülke kodu (örn. TR, boş=tümü)" value={form.country_code} onChange={(e) => setForm({ ...form, country_code: e.target.value })} />
          <input style={inputStyle} placeholder="dil (en/tr, boş=tümü)" value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })} />
        </div>
        <textarea
          style={{ ...inputStyle, width: "100%", marginTop: 8, minHeight: 60, fontFamily: "monospace" }}
          placeholder="mesaj"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
        <button onClick={create} style={{ ...inputStyle, marginTop: 10, background: ACCENT + "20", color: ACCENT, border: `1px solid ${ACCENT}`, cursor: "pointer", fontWeight: 700 }}>
          OLUŞTUR
        </button>
        {error && <div style={{ color: "#f85149", fontSize: 11, marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}
