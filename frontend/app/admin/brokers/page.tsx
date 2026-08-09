"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

const ACCENT = "#58a6ff";
const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 14px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

const CATEGORIES = [
  { value: "stock", label: "Stock Brokers" },
  { value: "fx", label: "FX Brokers" },
  { value: "crypto", label: "Kripto Brokers" },
];

interface Broker {
  id: string;
  category: string;
  name: string;
  website_url: string | null;
  logo_url: string | null;
  description: string | null;
  sort_order: number;
  enabled: boolean;
}

// Brokers sayfasının (app/global/[locale]/brokers) içeriğini yönetir. Logo ve
// açıklama, her broker'ın kendi resmi/izinli kaynağından elle girilmeli —
// üçüncü taraf sitelerden telif hakkı olan içerik kopyalanmamalı.
export default function BrokersAdminPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "stock", name: "", websiteUrl: "", logoUrl: "", description: "", sortOrder: 0 });

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/brokers");
    if (res.ok) setBrokers((await res.json()).brokers ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addBroker = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/brokers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) setError((await res.json()).error || "Ekleme hatası");
    else setForm({ category: "stock", name: "", websiteUrl: "", logoUrl: "", description: "", sortOrder: 0 });
    await load();
    setBusy(false);
  };

  const patchBroker = async (id: string, patch: Partial<Broker>) => {
    await fetch(`/api/admin/brokers?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const deleteBroker = async (id: string) => {
    if (!confirm("Silinsin mi?")) return;
    await fetch(`/api/admin/brokers?id=${id}`, { method: "DELETE" });
    await load();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>Broker Yönetimi</h1>
        <Link href="/admin" style={{ color: ACCENT, fontSize: 12 }}>← Admin</Link>
      </div>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12, fontWeight: "bold" }}>{error}</div>}

      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 16 }}>
        Not: Logo ve tanıtım metnini üçüncü taraf sitelerden (örn. karşılaştırma siteleri) kopyalamayın — telif/marka
        hakkı sorunu doğurur. Logo URL'sini her broker'ın kendi basın kiti/resmi sitesinden, izinli kullanım şartlarıyla girin.
      </div>

      <div style={{ marginBottom: 24, padding: 14, border: "1px solid #30363d", borderRadius: 8, background: "#0d1117" }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 10 }}>Yeni Broker Ekle</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} style={inputStyle}>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input placeholder="Ad" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, width: 160 }} />
          <input placeholder="Website URL" value={form.websiteUrl} onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))} style={{ ...inputStyle, width: 200 }} />
          <input placeholder="Logo URL (opsiyonel)" value={form.logoUrl} onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))} style={{ ...inputStyle, width: 200 }} />
          <input placeholder="Sıra" type="number" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))} style={{ ...inputStyle, width: 60 }} />
        </div>
        <textarea
          placeholder="Açıklama (kendi özgün metnin)"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          style={{ ...inputStyle, width: "100%", height: 50, marginTop: 8, resize: "vertical" }}
        />
        <button style={{ ...btnStyle, marginTop: 8, background: "#22c55e" }} disabled={busy || !form.name.trim()} onClick={addBroker}>
          Ekle
        </button>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.value} style={{ marginBottom: 20, padding: 14, border: "1px solid #30363d", borderRadius: 8, background: "#0d1117" }}>
          <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 10 }}>{cat.label}</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {brokers.filter((b) => b.category === cat.value).map((b) => (
              <div key={b.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: b.enabled ? 1 : 0.5 }}>
                <span style={{ minWidth: 140 }}>{b.name}</span>
                <span style={{ opacity: 0.6, fontSize: 10 }}>{b.website_url}</span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => patchBroker(b.id, { enabled: !b.enabled })} style={{ ...btnStyle, padding: "4px 8px", fontSize: 10, background: b.enabled ? "#22c55e" : "#30363d" }}>
                    {b.enabled ? "Açık" : "Kapalı"}
                  </button>
                  <button onClick={() => deleteBroker(b.id)} style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, padding: "0 4px" }}>✕</button>
                </span>
              </div>
            ))}
            {brokers.filter((b) => b.category === cat.value).length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.5 }}>Bu kategoride henüz broker yok.</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
