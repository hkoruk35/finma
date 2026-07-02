"use client";

import { useEffect, useState, useCallback } from "react";

interface AdminRow {
  id: string;
  email: string;
  role: "admin" | "readonly";
  created_at: string;
}

const ACCENT = "#58a6ff";
const inputStyle = {
  background: "#161b22",
  border: "1px solid #30363d",
  color: "#e6edf3",
  padding: "6px 10px",
  borderRadius: 4,
  fontSize: 12,
  fontFamily: "monospace",
};

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "readonly">("admin");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/admins");
    if (res.ok) setAdmins((await res.json()).admins ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addAdmin = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Hata oluştu.");
        return;
      }
      setEmail("");
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const removeAdmin = async (targetEmail: string) => {
    if (!confirm(`${targetEmail} silinsin mi?`)) return;
    const res = await fetch(`/api/admin/admins?email=${encodeURIComponent(targetEmail)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Hata oluştu.");
      return;
    }
    await load();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>Admin Yönetimi</h1>

      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 6, padding: 16, marginBottom: 20, maxWidth: 520 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: "#8b949e" }}>YENİ ADMIN EKLE</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input style={{ ...inputStyle, flex: 1, minWidth: 160 }} placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input style={{ ...inputStyle, flex: 1, minWidth: 140 }} placeholder="şifre (min 8)" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as "admin" | "readonly")}>
            <option value="admin">admin</option>
            <option value="readonly">readonly</option>
          </select>
          <button
            onClick={addAdmin}
            disabled={busy || !email || !password}
            style={{ ...inputStyle, background: ACCENT + "20", color: ACCENT, border: `1px solid ${ACCENT}`, cursor: "pointer", fontWeight: 700 }}
          >
            EKLE
          </button>
        </div>
        {error && <div style={{ color: "#f85149", fontSize: 11, marginTop: 8 }}>{error}</div>}
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%", maxWidth: 640 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d", textAlign: "left" }}>
            <th style={{ padding: "6px 10px", color: ACCENT }}>EMAIL</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>ROL</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>EKLENME</th>
            <th style={{ padding: "6px 10px" }} />
          </tr>
        </thead>
        <tbody>
          {admins.map((a) => (
            <tr key={a.id} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={{ padding: "6px 10px" }}>{a.email}</td>
              <td style={{ padding: "6px 10px", color: a.role === "admin" ? "#3fb950" : "#e3b341" }}>{a.role}</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{new Date(a.created_at).toLocaleDateString("tr-TR")}</td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>
                <button onClick={() => removeAdmin(a.email)} style={{ background: "transparent", border: "1px solid #f8514966", color: "#f85149", borderRadius: 3, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                  SİL
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
