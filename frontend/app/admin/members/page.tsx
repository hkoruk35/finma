"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface Member {
  id: string;
  username: string;
  email: string;
  plan: string;
  trial_ends_at: string | null;
  last_login_at: string | null;
  created_at: string;
}

interface PlanOption {
  key: string;
  name: string;
}

const ACCENT = "#58a6ff";

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [filterPlan, setFilterPlan] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/members");
    if (res.ok) setMembers((await res.json()).members ?? []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/plans")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.plans?.length) {
          setPlans(d.plans.map((p: { key: string; name: string }) => ({ key: p.key, name: p.name })));
        }
      })
      .catch(() => {});
  }, [load]);

  const changePlan = async (id: string, plan: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, plan } : m)));
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, plan }),
    });
  };

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (filterPlan && m.plan !== filterPlan) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.email.toLowerCase().includes(q) && !m.username.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [members, filterPlan, search]);

  const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>Üyeler ({filtered.length})</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <input
          placeholder="email veya kullanıcı adı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace", width: 220 }}
        />
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          style={{ background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" }}
        >
          <option value="">Tüm planlar / gruplar</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
      </div>

      <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #30363d", textAlign: "left" }}>
            <th style={{ padding: "6px 10px", color: ACCENT }}>EMAIL</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>KULLANICI ADI</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>GRUP / PLAN</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>TRIAL BİTİŞ</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>SON GİRİŞ</th>
            <th style={{ padding: "6px 10px", color: ACCENT }}>KAYIT</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((m) => (
            <tr key={m.id} style={{ borderBottom: "1px solid #21262d" }}>
              <td style={{ padding: "6px 10px" }}>{m.email}</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{m.username}</td>
              <td style={{ padding: "6px 10px" }}>
                <select
                  value={m.plan}
                  onChange={(e) => changePlan(m.id, e.target.value)}
                  style={{ background: "#161b22", border: "1px solid #30363d", color: "#3fb950", padding: "2px 6px", borderRadius: 3, fontSize: 11, fontFamily: "monospace" }}
                >
                  {plans.map((p) => (
                    <option key={p.key} value={p.key}>{p.name}</option>
                  ))}
                  {m.plan && !plans.some((p) => p.key === m.plan) && (
                    <option value={m.plan}>{m.plan}</option>
                  )}
                </select>
              </td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{fmt(m.trial_ends_at)}</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{fmt(m.last_login_at)}</td>
              <td style={{ padding: "6px 10px", color: "#8b949e" }}>{fmt(m.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
