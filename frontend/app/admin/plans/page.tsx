"use client";

import { useEffect, useState, useCallback } from "react";

interface Plan {
  key: string;
  name: string;
  trial_days: number;
  price_usd: number;
  intro_price_usd: number | null;
  intro_months: number | null;
  active: boolean;
  sort_order: number;
}

const ACCENT = "#58a6ff";
const EMPTY: Plan = { key: "", name: "", trial_days: 7, price_usd: 0, intro_price_usd: null, intro_months: null, active: true, sort_order: 0 };
const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [form, setForm] = useState<Plan>(EMPTY);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/plans");
    if (res.ok) setPlans((await res.json()).plans ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setError("");
    const res = await fetch("/api/admin/plans", {
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

  const remove = async (key: string) => {
    if (!confirm(`"${key}" paketi silinsin mi?`)) return;
    await fetch(`/api/admin/plans?key=${key}`, { method: "DELETE" });
    await load();
  };

  const toggleActive = async (p: Plan) => {
    await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...p, active: !p.active }),
    });
    await load();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>Paketler / Fiyatlandırma</h1>

      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 760, marginBottom: 24 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d", textAlign: "left" }}>
            <th style={{ padding: "6px 10px", color: ACCENT }}>KEY</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>AD</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>TRIAL</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>FİYAT</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>İLK DÖNEM</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>AKTİF</th>
            <th style={{ padding: "6px 10px" }} />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.key} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={{ padding: "6px 10px" }}>{p.key}</td>
              <td style={{ padding: "6px 10px" }}>{p.name}</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{p.trial_days} gün</td>
              <td style={{ padding: "6px 10px" }}>${p.price_usd}/ay</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>
                {p.intro_price_usd != null ? `$${p.intro_price_usd} x ${p.intro_months} ay` : "—"}
              </td>
              <td style={{ padding: "6px 10px" }}>
                <button onClick={() => toggleActive(p)} style={{ background: "transparent", border: "none", color: p.active ? "#3fb950" : "#8b949e", cursor: "pointer", fontFamily: "monospace" }}>
                  {p.active ? "● aktif" : "○ pasif"}
                </button>
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>
                <button onClick={() => remove(p.key)} style={{ background: "transparent", border: "1px solid #f8514966", color: "#f85149", borderRadius: 3, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                  SİL
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 16, maxWidth: 640 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#8b949e" }}>YENİ / GÜNCELLE</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
          <input style={inputStyle} placeholder="key (örn. pro)" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} />
          <input style={inputStyle} placeholder="ad" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={inputStyle} type="number" placeholder="trial gün" value={form.trial_days} onChange={(e) => setForm({ ...form, trial_days: Number(e.target.value) })} />
          <input style={inputStyle} type="number" placeholder="aylık fiyat $" value={form.price_usd} onChange={(e) => setForm({ ...form, price_usd: Number(e.target.value) })} />
          <input style={inputStyle} type="number" placeholder="ilk dönem fiyatı $ (opsiyonel)" value={form.intro_price_usd ?? ""} onChange={(e) => setForm({ ...form, intro_price_usd: e.target.value ? Number(e.target.value) : null })} />
          <input style={inputStyle} type="number" placeholder="ilk dönem ay sayısı" value={form.intro_months ?? ""} onChange={(e) => setForm({ ...form, intro_months: e.target.value ? Number(e.target.value) : null })} />
        </div>
        <button onClick={save} style={{ ...inputStyle, marginTop: 10, background: ACCENT + "20", color: ACCENT, border: `1px solid ${ACCENT}`, cursor: "pointer", fontWeight: 700 }}>
          KAYDET
        </button>
        {error && <div style={{ color: "#f85149", fontSize: 11, marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}
