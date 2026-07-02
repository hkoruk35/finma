"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

interface UnifiedMessage {
  id: string;
  source: "contact" | "member";
  name: string | null;
  email: string;
  subject: string | null;
  body: string;
  created_at: string;
  is_read: boolean;
}

const ACCENT = "#58a6ff";

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState<UnifiedMessage[]>([]);
  const [filterSource, setFilterSource] = useState<"" | "contact" | "member">("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/inbox");
    if (res.ok) setMessages((await res.json()).messages ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markRead = async (m: UnifiedMessage) => {
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, is_read: true } : x)));
    await fetch("/api/admin/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id, source: m.source }),
    });
  };

  const remove = async (m: UnifiedMessage) => {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    await fetch(`/api/admin/inbox?id=${m.id}&source=${m.source}`, { method: "DELETE" });
  };

  const filtered = useMemo(
    () => (filterSource ? messages.filter((m) => m.source === filterSource) : messages),
    [messages, filterSource]
  );

  const unreadCount = messages.filter((m) => !m.is_read).length;

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 8 }}>
        Mesajlar {unreadCount > 0 && <span style={{ color: "#e3b341", fontSize: 13 }}>({unreadCount} okunmamış)</span>}
      </h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {[
          { v: "", label: "Tümü" },
          { v: "contact", label: "Site Formu" },
          { v: "member", label: "Üye Geri Bildirimi" },
        ].map((opt) => (
          <button
            key={opt.v}
            onClick={() => setFilterSource(opt.v as "" | "contact" | "member")}
            style={{
              padding: "4px 12px",
              fontSize: 11,
              fontWeight: 700,
              border: "1px solid",
              borderColor: filterSource === opt.v ? ACCENT : "#30363d",
              background: filterSource === opt.v ? ACCENT + "20" : "transparent",
              color: filterSource === opt.v ? ACCENT : "#8b949e",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {filtered.map((m) => (
          <div
            key={m.id}
            style={{
              background: m.is_read ? "#000036" : "#161b2280",
              border: `1px solid ${m.is_read ? "#30363d" : "#58a6ff66"}`,
              borderRadius: 6,
              padding: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ fontWeight: 900, color: "#e6edf3" }}>{m.name || m.email}</span>
                <span style={{ color: "#8b949e", fontSize: 10, marginLeft: 8 }}>{m.email}</span>
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 9,
                    padding: "1px 6px",
                    borderRadius: 8,
                    background: m.source === "contact" ? "#1c243380" : "#1a3a1a80",
                    color: m.source === "contact" ? "#58a6ff" : "#3fb950",
                  }}
                >
                  {m.source === "contact" ? "SİTE FORMU" : "ÜYE"}
                </span>
              </div>
              <span style={{ color: "#8b949e", fontSize: 10 }}>{new Date(m.created_at).toLocaleString("tr-TR")}</span>
            </div>
            {m.subject && <div style={{ marginTop: 6, fontWeight: 700, fontSize: 12 }}>{m.subject}</div>}
            <div style={{ marginTop: 6, fontSize: 12, color: "#c9d1d9", whiteSpace: "pre-wrap" }}>{m.body}</div>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              {!m.is_read && (
                <button onClick={() => markRead(m)} style={{ background: "transparent", border: "1px solid #3fb95066", color: "#3fb950", borderRadius: 3, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                  OKUNDU İŞARETLE
                </button>
              )}
              <button onClick={() => remove(m)} style={{ background: "transparent", border: "1px solid #f8514966", color: "#f85149", borderRadius: 3, padding: "2px 8px", fontSize: 10, cursor: "pointer", fontFamily: "monospace" }}>
                SİL
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div style={{ color: "#8b949e", fontSize: 12, padding: 20, textAlign: "center" }}>Mesaj yok.</div>}
      </div>
    </div>
  );
}
