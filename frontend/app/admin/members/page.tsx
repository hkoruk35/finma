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

interface MemberStats {
  newToday: number;
  canceledCount: number;
  newThisMonth: number;
  totalActive: number;
  totalMembers: number;
}

interface PlanOption {
  key: string;
  name: string;
}

const ACCENT = "#3b82f6";

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<MemberStats | null>(null);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [filterPlan, setFilterPlan] = useState("");
  const [search, setSearch] = useState("");

  // Modals & States
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Add Form State
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPlan, setAddPlan] = useState("pending");

  // Edit Form State
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [editTrialEndsAt, setEditTrialEndsAt] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/members");
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members ?? []);
      setStats(data.stats ?? null);
    }
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

  const triggerTelegramReport = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/cron/telegram-report", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Telegram raporu başarıyla gönderildi!" });
      } else {
        setMsg({ type: "error", text: data.error || "Rapor gönderilemedi." });
      }
    } catch {
      setMsg({ type: "error", text: "Bağlantı hatası." });
    } finally {
      setLoading(false);
    }
  };

  const changePlanQuick = async (id: string, plan: string) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, plan } : m)));
    await fetch("/api/admin/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, plan }),
    });
    load();
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: addUsername,
          email: addEmail,
          password: addPassword,
          plan: addPlan,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Yeni üye başarıyla oluşturuldu." });
        setShowAddModal(false);
        setAddUsername("");
        setAddEmail("");
        setAddPassword("");
        load();
      } else {
        setMsg({ type: "error", text: data.error || "Hata oluştu." });
      }
    } catch {
      setMsg({ type: "error", text: "Hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (m: Member) => {
    setEditingMember(m);
    setEditUsername(m.username);
    setEditEmail(m.email);
    setEditPlan(m.plan);
    setEditTrialEndsAt(m.trial_ends_at ? m.trial_ends_at.slice(0, 10) : "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    setLoading(true);
    setMsg(null);

    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingMember.id,
          username: editUsername,
          email: editEmail,
          plan: editPlan,
          trial_ends_at: editTrialEndsAt ? new Date(editTrialEndsAt).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setMsg({ type: "success", text: "Üye bilgileri güncellendi." });
        setEditingMember(null);
        load();
      } else {
        setMsg({ type: "error", text: data.error || "Güncelleme hatası." });
      }
    } catch {
      setMsg({ type: "error", text: "Hata oluştu." });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMember = async (m: Member) => {
    if (!window.confirm(`${m.username} (${m.email}) üyesini tamamen silmek istediğinizden emin misiniz?`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/admin/members?id=${m.id}`, { method: "DELETE" });
      if (res.ok) {
        setMsg({ type: "success", text: "Üye silindi." });
        load();
      } else {
        const data = await res.json();
        setMsg({ type: "error", text: data.error || "Silme başarısız." });
      }
    } catch {
      setMsg({ type: "error", text: "Hata oluştu." });
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#ffffff" }}>
          Üyeler <span style={{ color: ACCENT }}>({filtered.length})</span>
        </h1>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={triggerTelegramReport}
            disabled={loading}
            style={{
              background: "#161b22",
              border: "1px solid #3b82f6",
              color: "#3b82f6",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            📲 Telegram Raporu Gönder
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            style={{
              background: "#238636",
              border: "1px solid #2ea043",
              color: "#ffffff",
              padding: "8px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ➕ Yeni Üye Ekle
          </button>
        </div>
      </div>

      {/* Message Banner */}
      {msg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 12,
            background: msg.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            border: msg.type === "success" ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(239,68,68,0.3)",
            color: msg.type === "success" ? "#4ade80" : "#f87171",
          }}
        >
          {msg.text}
        </div>
      )}

      {/* Rapor İstatistik Kartları */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 20 }}>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" }}>Bugün Yeni Üye</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#38bdf8", marginTop: 4 }}>{stats.newToday}</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" }}>İptal Edilen Üye</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#f87171", marginTop: 4 }}>{stats.canceledCount}</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" }}>Bu Ay Yeni Üye</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#4ade80", marginTop: 4 }}>{stats.newThisMonth}</div>
          </div>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", padding: 14, borderRadius: 12 }}>
            <div style={{ fontSize: 10, color: "#8b949e", textTransform: "uppercase" }}>Güncel Aktif Üye</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#a855f7", marginTop: 4 }}>
              {stats.totalActive} <span style={{ fontSize: 12, color: "#8b949e" }}>/ {stats.totalMembers}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          placeholder="email veya kullanıcı adı ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#e6edf3",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
            width: 250,
          }}
        />
        <select
          value={filterPlan}
          onChange={(e) => setFilterPlan(e.target.value)}
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            color: "#e6edf3",
            padding: "8px 12px",
            borderRadius: 6,
            fontSize: 12,
            fontFamily: "monospace",
          }}
        >
          <option value="">Tüm planlar / gruplar</option>
          {plans.map((p) => (
            <option key={p.key} value={p.key}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* Members Table */}
      <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #30363d", textAlign: "left", background: "#161b22" }}>
              <th style={{ padding: "10px 12px", color: ACCENT }}>EMAIL</th>
              <th style={{ padding: "10px 12px", color: ACCENT }}>KULLANICI ADI</th>
              <th style={{ padding: "10px 12px", color: ACCENT }}>GRUP / PLAN</th>
              <th style={{ padding: "10px 12px", color: ACCENT }}>TRIAL BİTİŞ</th>
              <th style={{ padding: "10px 12px", color: ACCENT }}>SON GİRİŞ</th>
              <th style={{ padding: "10px 12px", color ACCENT }}>KAYIT</th>
              <th style={{ padding: "10px 12px", color: ACCENT, textAlign: "right" }}>İŞLEMLER</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.id} style={{ borderBottom: "1px solid #21262d" }}>
                <td style={{ padding: "10px 12px" }}>{m.email}</td>
                <td style={{ padding: "10px 12px", color: "#8b949e" }}>{m.username}</td>
                <td style={{ padding: "10px 12px" }}>
                  <select
                    value={m.plan}
                    onChange={(e) => changePlanQuick(m.id, e.target.value)}
                    style={{
                      background: "#161b22",
                      border: "1px solid #30363d",
                      color: m.plan === "premium" || m.plan === "admin" ? "#4ade80" : "#e6edf3",
                      padding: "4px 8px",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                  >
                    {plans.map((p) => (
                      <option key={p.key} value={p.key}>{p.name}</option>
                    ))}
                    {m.plan && !plans.some((p) => p.key === m.plan) && (
                      <option value={m.plan}>{m.plan}</option>
                    )}
                  </select>
                </td>
                <td style={{ padding: "10px 12px", color: "#8b949e", whiteSpace: "nowrap" }}>
                  {fmt(m.trial_ends_at)}
                </td>
                <td style={{ padding: "10px 12px", color: "#8b949e" }}>{fmt(m.last_login_at)}</td>
                <td style={{ padding: "10px 12px", color: "#8b949e" }}>{fmt(m.created_at)}</td>
                <td style={{ padding: "10px 12px", textAlign: "right" }}>
                  <button
                    onClick={() => handleOpenEdit(m)}
                    style={{
                      background: "transparent",
                      border: "1px solid #30363d",
                      color: "#38bdf8",
                      padding: "4px 8px",
                      borderRadius: 4,
                      marginRight: 6,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    ✏️ Düzenle
                  </button>
                  <button
                    onClick={() => handleDeleteMember(m)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(239,68,68,0.3)",
                      color: "#f87171",
                      padding: "4px 8px",
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 11,
                    }}
                  >
                    🗑️ Sil
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal: Yeni Üye Ekle */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", items: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#ffffff", marginBottom: 16 }}>Yeni Üye Ekle</h2>
            <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Kullanıcı Adı</label>
                <input
                  type="text"
                  required
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>E-mail</label>
                <input
                  type="email"
                  required
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Şifre</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Grup / Plan</label>
                <select
                  value={addPlan}
                  onChange={(e) => setAddPlan(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                >
                  <option value="pending">pending (Ödeme Bekliyor)</option>
                  <option value="premium">premium (Abonelik Aktif)</option>
                  <option value="admin">admin (Yönetici)</option>
                  <option value="canceled">canceled (İptal Edilmiş)</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  style={{ background: "#21262d", border: "1px solid #30363d", color: "#e6edf3", padding: "8px 14px", borderRadius: 6, cursor: "pointer" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: "#238636", border: "1px solid #2ea043", color: "#ffffff", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
                >
                  {loading ? "Kaydediliyor..." : "Kaydet ve Oluştur"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Üye Düzenle */}
      {editingMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", items: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 16, padding: 24, width: "100%", maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#ffffff", marginBottom: 16 }}>Üye Düzenle</h2>
            <form onSubmit={handleSaveEdit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Kullanıcı Adı</label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>E-mail</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Grup / Plan</label>
                <select
                  value={editPlan}
                  onChange={(e) => setEditPlan(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                >
                  <option value="pending">pending</option>
                  <option value="premium">premium</option>
                  <option value="admin">admin</option>
                  <option value="canceled">canceled</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Trial / Üyelik Bitiş Tarihi</label>
                <input
                  type="date"
                  value={editTrialEndsAt}
                  onChange={(e) => setEditTrialEndsAt(e.target.value)}
                  style={{ width: "100%", background: "#161b22", border: "1px solid #30363d", color: "#ffffff", padding: "8px 12px", borderRadius: 6 }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  style={{ background: "#21262d", border: "1px solid #30363d", color: "#e6edf3", padding: "8px 14px", borderRadius: 6, cursor: "pointer" }}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ background: "#3b82f6", border: "1px solid #2563eb", color: "#ffffff", padding: "8px 14px", borderRadius: 6, cursor: "pointer", fontWeight: 700 }}
                >
                  {loading ? "Güncelleniyor..." : "Değişiklikleri Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
