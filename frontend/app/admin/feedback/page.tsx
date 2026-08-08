"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface FeedbackReply {
  id: string;
  sender_type: string;
  message: string;
  created_at: string;
  email_sent: boolean;
}

interface FeedbackItem {
  id: string;
  created_at: string;
  member_id: string | null;
  email: string;
  category: string;
  message: string;
  page_url: string | null;
  page_path: string | null;
  locale: string | null;
  device_type: string | null;
  user_agent: string | null;
  viewport: string | null;
  plan: string | null;
  screenshot_url: string | null;
  status: string;
  priority: string;
  action: string | null;
  action_note: string | null;
  assigned_to: string | null;
  archived_at: string | null;
  feedback_replies: FeedbackReply[];
}

const ACCENT = "#58a6ff";

const STATUS_LABELS: Record<string, string> = {
  new: "Yeni",
  reviewing: "İnceleniyor",
  planned: "Planlandı",
  in_progress: "Devam Ediyor",
  waiting_user: "Kullanıcı Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
  archived: "Arşivlendi",
};
const STATUS_COLORS: Record<string, string> = {
  new: "#e3b341",
  reviewing: "#58a6ff",
  planned: "#a371f7",
  in_progress: "#58a6ff",
  waiting_user: "#e3b341",
  resolved: "#3fb950",
  closed: "#8b949e",
  archived: "#484f58",
};
const PRIORITY_LABELS: Record<string, string> = { low: "Düşük", normal: "Normal", high: "Yüksek", critical: "Kritik" };
const ACTION_LABELS: Record<string, string> = {
  no_action: "Aksiyon Gerekmez",
  investigate: "Araştır",
  fix_bug: "Bug Düzelt",
  improve_ux: "UX İyileştir",
  roadmap: "Yol Haritasına Ekle",
  data_review: "Veri İncele",
  contact_user: "Kullanıcıyla İletişime Geç",
};
const CATEGORY_LABELS: Record<string, string> = {
  bug: "Bug / Teknik Sorun",
  data_error: "Veri Hatası",
  chart_terminal: "Grafik / Terminal",
  stock_analysis: "Hisse Analizi",
  copilot: "BOGA Copilot",
  lists: "Top 100 / Trend Listeleri",
  account_login: "Üyelik / Giriş",
  premium_billing: "Premium / Ödeme",
  mobile: "Mobil Kullanım",
  design_ux: "Tasarım / UX",
  feature_request: "Yeni Özellik Önerisi",
  translation: "Dil / Çeviri",
  other: "Diğer",
};

const inputStyle: React.CSSProperties = {
  background: "#0d1117",
  border: "1px solid #30363d",
  color: "#e6edf3",
  borderRadius: 4,
  padding: "6px 8px",
  fontSize: 11,
  fontFamily: "monospace",
};

export default function AdminFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [actionNoteDraft, setActionNoteDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/feedback");
    if (res.ok) setItems((await res.json()).feedback ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(() => items.find((i) => i.id === selectedId) || null, [items, selectedId]);

  useEffect(() => {
    setActionNoteDraft(selected?.action_note || "");
    setReplyDraft("");
  }, [selectedId]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const i of items) {
      if (i.archived_at) continue;
      c[i.status] = (c[i.status] || 0) + 1;
    }
    return c;
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (showArchived) return !!i.archived_at;
      if (i.archived_at) return false;
      if (filterStatus) return i.status === filterStatus;
      return true;
    });
  }, [items, filterStatus, showArchived]);

  const patch = async (id: string, body: Record<string, any>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      if (res.ok) await load();
    } finally {
      setSaving(false);
    }
  };

  const sendReply = async () => {
    if (!selected || !replyDraft.trim()) return;
    await patch(selected.id, { reply: replyDraft.trim() });
    setReplyDraft("");
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3", display: "flex", gap: 16, minHeight: "100vh" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 12 }}>Geri Bildirim</h1>

        <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
          {[
            { v: "", label: `Tümü (${Object.values(counts).reduce((a, b) => a + b, 0)})` },
            ...Object.keys(STATUS_LABELS)
              .filter((s) => s !== "archived")
              .map((s) => ({ v: s, label: `${STATUS_LABELS[s]} (${counts[s] || 0})` })),
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => { setFilterStatus(opt.v); setShowArchived(false); }}
              style={{
                padding: "4px 10px",
                fontSize: 10,
                fontWeight: 700,
                border: "1px solid",
                borderColor: !showArchived && filterStatus === opt.v ? ACCENT : "#30363d",
                background: !showArchived && filterStatus === opt.v ? ACCENT + "20" : "transparent",
                color: !showArchived && filterStatus === opt.v ? ACCENT : "#8b949e",
                borderRadius: 4,
                cursor: "pointer",
                fontFamily: "monospace",
              }}
            >
              {opt.label}
            </button>
          ))}
          <button
            onClick={() => setShowArchived(true)}
            style={{
              padding: "4px 10px",
              fontSize: 10,
              fontWeight: 700,
              border: "1px solid",
              borderColor: showArchived ? ACCENT : "#30363d",
              background: showArchived ? ACCENT + "20" : "transparent",
              color: showArchived ? ACCENT : "#8b949e",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            📦 Arşiv
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((i) => (
            <div
              key={i.id}
              onClick={() => setSelectedId(i.id)}
              style={{
                background: selectedId === i.id ? "#161b22" : "#0d1117",
                border: `1px solid ${selectedId === i.id ? ACCENT : "#30363d"}`,
                borderRadius: 6,
                padding: 10,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: STATUS_COLORS[i.status] + "20", color: STATUS_COLORS[i.status] }}>
                    {STATUS_LABELS[i.status] || i.status}
                  </span>
                  <span style={{ fontSize: 9, color: "#8b949e" }}>{CATEGORY_LABELS[i.category] || i.category}</span>
                  {i.priority !== "normal" && (
                    <span style={{ fontSize: 9, color: i.priority === "critical" ? "#f85149" : i.priority === "high" ? "#e3b341" : "#8b949e" }}>
                      {PRIORITY_LABELS[i.priority]}
                    </span>
                  )}
                </div>
                <span style={{ color: "#8b949e", fontSize: 9 }}>{new Date(i.created_at).toLocaleString("tr-TR")}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#c9d1d9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {i.message}
              </div>
              <div style={{ marginTop: 2, fontSize: 9, color: "#8b949e" }}>{i.email} {i.page_path ? `· ${i.page_path}` : ""}</div>
            </div>
          ))}
          {filtered.length === 0 && <div style={{ color: "#8b949e", fontSize: 12, padding: 20, textAlign: "center" }}>Kayıt yok.</div>}
        </div>
      </div>

      {selected && (
        <div style={{ width: 380, flexShrink: 0, background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 16, height: "fit-content", position: "sticky", top: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 12 }}>
            <span style={{ fontSize: 9, color: "#8b949e" }}>#{selected.id.slice(0, 8).toUpperCase()}</span>
            <button onClick={() => setSelectedId(null)} style={{ background: "transparent", border: "none", color: "#8b949e", cursor: "pointer", fontSize: 14 }}>✕</button>
          </div>

          <div style={{ fontSize: 12, color: "#c9d1d9", whiteSpace: "pre-wrap", marginBottom: 10, lineHeight: 1.5 }}>{selected.message}</div>

          {selected.screenshot_url && (
            <a href={selected.screenshot_url} target="_blank" rel="noopener noreferrer">
              <img src={selected.screenshot_url} alt="screenshot" style={{ width: "100%", borderRadius: 6, border: "1px solid #30363d", marginBottom: 10 }} />
            </a>
          )}

          <div style={{ fontSize: 10, color: "#8b949e", display: "flex", flexDirection: "column", gap: 3, marginBottom: 12, borderTop: "1px solid #21262d", paddingTop: 10 }}>
            <div>📧 {selected.email}{selected.member_id ? " (üye)" : " (misafir)"}</div>
            <div>📄 {selected.page_url || "—"}</div>
            <div>🌐 {selected.locale || "—"} · {selected.device_type || "—"} · {selected.viewport || "—"}</div>
            <div>🪪 plan: {selected.plan || "—"}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, borderTop: "1px solid #21262d", paddingTop: 10 }}>
            <div>
              <label style={{ fontSize: 9, color: "#8b949e", display: "block", marginBottom: 4 }}>DURUM</label>
              <select value={selected.status} onChange={(e) => patch(selected.id, { status: e.target.value })} disabled={saving} style={{ ...inputStyle, width: "100%" }}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#8b949e", display: "block", marginBottom: 4 }}>ÖNCELİK</label>
              <select value={selected.priority} onChange={(e) => patch(selected.id, { priority: e.target.value })} disabled={saving} style={{ ...inputStyle, width: "100%" }}>
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#8b949e", display: "block", marginBottom: 4 }}>AKSİYON</label>
              <select value={selected.action || ""} onChange={(e) => patch(selected.id, { action: e.target.value })} disabled={saving} style={{ ...inputStyle, width: "100%" }}>
                <option value="">—</option>
                {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 9, color: "#8b949e", display: "block", marginBottom: 4 }}>AKSİYON NOTU</label>
              <textarea
                value={actionNoteDraft}
                onChange={(e) => setActionNoteDraft(e.target.value)}
                onBlur={() => { if (actionNoteDraft !== (selected.action_note || "")) patch(selected.id, { action_note: actionNoteDraft }); }}
                style={{ ...inputStyle, width: "100%", minHeight: 50, resize: "vertical" }}
                placeholder="ör. Top100 mobil header spacing düzeltilecek."
              />
            </div>

            {!selected.archived_at && (
              <button
                onClick={() => patch(selected.id, { archived: true, status: "archived" })}
                disabled={saving}
                style={{ padding: "6px 10px", fontSize: 10, fontWeight: 700, border: "1px solid #f8514966", color: "#f85149", background: "transparent", borderRadius: 4, cursor: "pointer", fontFamily: "monospace" }}
              >
                📦 Arşivle
              </button>
            )}
          </div>

          <div style={{ borderTop: "1px solid #21262d", marginTop: 14, paddingTop: 10 }}>
            <label style={{ fontSize: 9, color: "#8b949e", display: "block", marginBottom: 6 }}>CEVAPLAR ({selected.feedback_replies?.length || 0})</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 160, overflowY: "auto", marginBottom: 8 }}>
              {(selected.feedback_replies || []).map((r) => (
                <div key={r.id} style={{ background: "#161b22", border: "1px solid #21262d", borderRadius: 4, padding: 8, fontSize: 11 }}>
                  <div style={{ color: "#8b949e", fontSize: 9, marginBottom: 3 }}>{new Date(r.created_at).toLocaleString("tr-TR")} — admin{r.email_sent ? " · e-posta gönderildi" : ""}</div>
                  <div style={{ color: "#c9d1d9", whiteSpace: "pre-wrap" }}>{r.message}</div>
                </div>
              ))}
              {(!selected.feedback_replies || selected.feedback_replies.length === 0) && (
                <div style={{ fontSize: 10, color: "#8b949e", fontStyle: "italic" }}>Henüz cevap yok.</div>
              )}
            </div>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Kullanıcıya cevap yaz... (v1: e-posta gönderilmiyor, sadece kayıt altına alınır)"
              style={{ ...inputStyle, width: "100%", minHeight: 60, resize: "vertical", marginBottom: 6 }}
            />
            <button
              onClick={sendReply}
              disabled={saving || !replyDraft.trim()}
              style={{ padding: "6px 12px", fontSize: 10, fontWeight: 700, border: "1px solid " + ACCENT + "66", color: ACCENT, background: "transparent", borderRadius: 4, cursor: replyDraft.trim() ? "pointer" : "default", fontFamily: "monospace", opacity: replyDraft.trim() ? 1 : 0.5 }}
            >
              Cevabı Kaydet
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
