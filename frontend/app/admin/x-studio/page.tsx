"use client";

import { useEffect, useState, useCallback } from "react";

const ACCENT = "#58a6ff";
const LOCALES = ["en", "es", "fr", "pt", "tr"] as const;
type Locale = (typeof LOCALES)[number];

const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 16px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

interface PoolItem {
  id: string;
  source: "top100" | "swing" | "trend";
  ticker: string;
  company: string | null;
  sector: string | null;
  theme: string | null;
}

interface PostRow {
  id: string;
  content_type: string;
  ticker: string | null;
  locale: string;
  status: string;
  content_text: string | null;
  tweet_id: string | null;
  created_at: string;
}

interface AutomationSettings {
  enabled: boolean;
  interval_minutes: number;
  ratio_top100: number;
  ratio_swing: number;
  ratio_trend: number;
}

export default function XStudioPage() {
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [selected, setSelected] = useState<PoolItem | null>(null);
  const [texts, setTexts] = useState<Record<Locale, string>>({ en: "", es: "", fr: "", pt: "", tr: "" });
  const [locale, setLocale] = useState<Locale>("en");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"stock" | "promo">("stock");
  const [settings, setSettings] = useState<AutomationSettings | null>(null);

  const loadPool = useCallback(async () => {
    const res = await fetch("/api/admin/x/pool");
    if (res.ok) setPool((await res.json()).pool ?? []);
  }, []);

  const loadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/x/post");
    if (res.ok) setPosts((await res.json()).posts ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/x/settings");
    if (res.ok) setSettings((await res.json()).settings);
  }, []);

  const patchSettings = async (patch: Partial<AutomationSettings>) => {
    const res = await fetch("/api/admin/x/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings((await res.json()).settings);
  };

  useEffect(() => {
    loadPool();
    loadPosts();
    loadSettings();
  }, [loadPool, loadPosts, loadSettings]);

  const fillPool = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) setError((await res.json()).error || "Kuyruk doldurma hatası");
    await loadPool();
    setBusy(false);
  };

  const generateStockText = async (item: PoolItem) => {
    setBusy(true);
    setError("");
    setSelected(item);
    setMode("stock");
    setImageUrl(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "stock", ticker: item.ticker, company: item.company, sector: item.sector, theme: item.theme }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setBusy(false);
  };

  const generatePromoText = async () => {
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("promo");
    setImageUrl(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "promo" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setBusy(false);
  };

  const buildCardParams = () => {
    if (mode === "stock" && selected) {
      return {
        kind: "stock" as const,
        ticker: selected.ticker,
        company: selected.company ?? undefined,
        sector: selected.sector ?? undefined,
        theme: selected.theme ?? undefined,
        points: [1, 2, 1.5, 2.4, 2.1, 2.8, 3.1],
        headline: texts[locale],
        locale,
      };
    }
    return {
      kind: "promo" as const,
      headline: texts[locale],
      subheadline: "bogastock.com",
      locale,
    };
  };

  const previewImage = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildCardParams()),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Görsel üretme hatası");
      setBusy(false);
      return;
    }
    const blob = await res.blob();
    setImageUrl(URL.createObjectURL(blob));
    setBusy(false);
  };

  const publish = async () => {
    if (!texts[locale]) {
      setError("Önce metin üretin.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, contentText: texts[locale], cardParams: buildCardParams() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Paylaşım hatası");
      setBusy(false);
      return;
    }
    setBusy(false);
    setSelected(null);
    setImageUrl(null);
    setTexts({ en: "", es: "", fr: "", pt: "", tr: "" });
    await Promise.all([loadPool(), loadPosts()]);
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT, marginBottom: 16 }}>X Studio — @bogastock</h1>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12 }}>{error}</div>}

      {settings && (
        <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 20, marginBottom: 20, padding: 12 }}>
          <button
            style={{ ...btnStyle, background: settings.enabled ? "#22c55e" : "#30363d", color: settings.enabled ? "#0d1117" : "#e6edf3" }}
            onClick={() => patchSettings({ enabled: !settings.enabled })}
          >
            Otomasyon: {settings.enabled ? "AÇIK" : "KAPALI"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Aralık (dk):
            <input
              type="number"
              min={10}
              max={15}
              value={settings.interval_minutes}
              onChange={(e) => setSettings({ ...settings, interval_minutes: Number(e.target.value) })}
              onBlur={(e) => patchSettings({ interval_minutes: Number(e.target.value) })}
              style={{ ...inputStyle, width: 60 }}
            />
          </label>
          <span style={{ opacity: 0.7 }}>
            Kaynak oranı: Top100 {settings.ratio_top100}% / Swing {settings.ratio_swing}% / Trend {settings.ratio_trend}%
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 24 }}>
        {/* Kuyruk */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, color: ACCENT }}>İçerik Kuyruğu ({pool.length})</h2>
            <button style={btnStyle} disabled={busy} onClick={fillPool}>Kuyruğu Doldur</button>
          </div>
          <button style={{ ...btnStyle, background: "#f59e0b", marginBottom: 12, width: "100%" }} disabled={busy} onClick={generatePromoText}>
            Promo Gönder (Manuel)
          </button>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {pool.map((item) => (
              <div
                key={item.id}
                onClick={() => generateStockText(item)}
                style={{
                  ...inputStyle,
                  cursor: "pointer",
                  border: selected?.id === item.id ? `1px solid ${ACCENT}` : inputStyle.border,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <span>{item.ticker} <span style={{ opacity: 0.6 }}>({item.source})</span></span>
                <span style={{ opacity: 0.6 }}>{item.sector || item.theme || ""}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Editör / Önizleme */}
        <div style={{ flex: 1, minWidth: 360 }}>
          <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>
            {mode === "promo" ? "Promo Gönderisi" : selected ? `${selected.ticker} Gönderisi` : "Bir hisse seçin"}
          </h2>

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => { setLocale(l); setImageUrl(null); }}
                style={{ ...btnStyle, background: locale === l ? ACCENT : "#30363d", color: locale === l ? "#0d1117" : "#e6edf3" }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <textarea
            style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical" }}
            value={texts[locale]}
            maxLength={280}
            onChange={(e) => setTexts((t) => ({ ...t, [locale]: e.target.value }))}
            placeholder="AI metni burada görünecek, düzenlenebilir..."
          />

          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button style={btnStyle} disabled={busy || !texts[locale]} onClick={previewImage}>Görseli Önizle</button>
            <button style={{ ...btnStyle, background: "#22c55e" }} disabled={busy || !texts[locale]} onClick={publish}>Şimdi Paylaş</button>
          </div>

          {imageUrl && (
            <img src={imageUrl} alt="preview" style={{ marginTop: 16, width: "100%", borderRadius: 8, border: "1px solid #30363d" }} />
          )}
        </div>
      </div>

      {/* Geçmiş */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>Son Gönderiler</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between" }}>
              <span>{p.content_type === "promo" ? "PROMO" : p.ticker} [{p.locale}]</span>
              <span style={{ opacity: 0.7 }}>{p.content_text?.slice(0, 60)}</span>
              <span style={{ color: p.status === "posted" ? "#22c55e" : p.status === "failed" ? "#f85149" : "#f59e0b" }}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
