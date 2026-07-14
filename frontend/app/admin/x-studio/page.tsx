"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { appendHashtagsWithinLimit } from "@/lib/x/hashtags";
import { localizedThemeTitle } from "@/lib/hotThemes2026";
import { nyWallTimeToUtcIso, utcIsoToNyDisplay, nyTodayDateStr, nyMaxDateStr } from "@/lib/x/timezone";
import type { ListType } from "@/lib/x/generateContent";

const LIST_TYPES: { type: ListType; label: string }[] = [
  { type: "swing", label: "Swing Trade" },
  { type: "trend", label: "Trend Hisseleri" },
  { type: "top100", label: "Top 100" },
  { type: "sector_heatmap", label: "Sektör Isı Haritası" },
];

const ACCENT = "#58a6ff";
const LOCALES = ["en", "es", "fr", "pt", "tr"] as const;
type Locale = (typeof LOCALES)[number];

const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 16px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

interface PoolItem {
  id: string;
  source: "top100" | "swing" | "trend" | "manual";
  ticker: string;
  company: string | null;
  sector: string | null;
  theme: string | null;
}

interface PostRow {
  id: string;
  content_type: string;
  ticker: string | null;
  list_type: string | null;
  locale: string;
  status: string;
  content_text: string | null;
  tweet_id: string | null;
  created_at: string;
}

interface ScheduledRow {
  id: string;
  content_type: string;
  ticker: string | null;
  list_type: string | null;
  locale: string;
  content_text: string | null;
  scheduled_at: string;
}

interface AutomationSettings {
  enabled: boolean;
  x_posting_enabled: boolean;
  interval_minutes: number;
  ratio_top100: number;
  ratio_swing: number;
  ratio_trend: number;
}

interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  bars: OhlcBar[];
  changePct: number;
  rvol: number;
  opportunity: boolean;
  trendLabels: Record<Locale, string>;
  opportunityLabels: Record<Locale, string>;
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
  const [mode, setMode] = useState<"stock" | "promo" | "list">("stock");
  const [listType, setListType] = useState<ListType | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ ticker: string; changePct: number }[]>([]);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [hashtags, setHashtags] = useState("");
  const [manualTicker, setManualTicker] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:30");

  const loadPool = useCallback(async () => {
    const res = await fetch("/api/admin/x/pool");
    if (res.ok) setPool((await res.json()).pool ?? []);
  }, []);

  const loadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/x/post");
    if (res.ok) setPosts((await res.json()).posts ?? []);
  }, []);

  const loadScheduled = useCallback(async () => {
    const res = await fetch("/api/admin/x/schedule");
    if (res.ok) setScheduled((await res.json()).scheduled ?? []);
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
    loadScheduled();
    if (!scheduleDate) setScheduleDate(nyTodayDateStr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPool, loadPosts, loadSettings, loadScheduled]);

  const fillPool = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) setError((await res.json()).error || "Kuyruk doldurma hatası");
    await loadPool();
    setBusy(false);
  };

  const clearPool = async () => {
    if (!confirm(`Kuyruktaki ${pool.length} bekleyen içerik silinsin mi?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error || "Kuyruk temizleme hatası");
    await loadPool();
    setBusy(false);
  };

  const deletePoolItem = async (id: string) => {
    setError("");
    const res = await fetch(`/api/admin/x/pool?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "Silme hatası");
      return;
    }
    if (selected?.id === id) {
      setSelected(null);
      setImageUrl(null);
    }
    await loadPool();
  };

  const generateStockText = async (item: PoolItem) => {
    setBusy(true);
    setError("");
    setSelected(item);
    setMode("stock");
    setImageUrl(null);
    setMarket(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "stock", ticker: item.ticker, company: item.company, sector: item.sector, theme: item.theme, customInstruction: customInstruction.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setMarket(data.market ?? null);
    setHashtags(data.hashtags ?? "");
    setBusy(false);
  };

  const generatePromoText = async () => {
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("promo");
    setImageUrl(null);
    setMarket(null);
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
    setHashtags(data.hashtags ?? "");
    setBusy(false);
  };

  const generateListText = async (type: ListType) => {
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("list");
    setImageUrl(null);
    setMarket(null);
    setListType(type);
    const res = await fetch("/api/admin/x/generate-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listType: type }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Liste özeti üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setListItems(data.items ?? []);
    setListTitle(data.listTitle ?? "");
    setHashtags("");
    setBusy(false);
  };

  const buildCardParams = () => {
    if (mode === "list") return null;
    if (mode === "stock" && selected) {
      return {
        kind: "stock" as const,
        ticker: selected.ticker,
        company: selected.company ?? undefined,
        sector: selected.sector ?? undefined,
        theme: localizedThemeTitle(selected.theme, locale),
        changePct: market?.changePct,
        rvol: market?.rvol,
        opportunity: market?.opportunity,
        opportunityLabel: market?.opportunityLabels?.[locale],
        trendLabel: market?.trendLabels?.[locale],
        bars: market?.bars ?? [],
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

  // Manuel gonderiler icin premium karakter siniri (2500) — otomasyon
  // (cron/x-scheduler) hala varsayilan 280'i kullanir, buraya dokunmuyor.
  const MANUAL_POST_LIMIT = 2500;
  const getFinalText = () => (hashtags ? appendHashtagsWithinLimit(texts[locale], hashtags, MANUAL_POST_LIMIT) : texts[locale]);

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${mode === "stock" && selected ? selected.ticker : "promo"}-${locale}.png`;
    a.click();
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(getFinalText());
  };

  const previewImage = async () => {
    const cardParams = buildCardParams();
    if (!cardParams) return; // list gönderilerinde kart görseli yok
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardParams),
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
      body: JSON.stringify(
        mode === "list"
          ? { locale, contentText: getFinalText(), listType }
          : { locale, contentText: getFinalText(), cardParams: buildCardParams() }
      ),
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
    setListType(null);
    setListItems([]);
    setTexts({ en: "", es: "", fr: "", pt: "", tr: "" });
    await Promise.all([loadPool(), loadPosts()]);
  };

  const schedulePost = async () => {
    if (!texts[locale]) {
      setError("Önce metin üretin.");
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      setError("Tarih ve saat seçin.");
      return;
    }
    const scheduledAtUtc = nyWallTimeToUtcIso(scheduleDate, scheduleTime);
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        contentText: getFinalText(),
        contentType: mode,
        ticker: mode === "stock" ? selected?.ticker : undefined,
        sector: mode === "stock" ? selected?.sector : undefined,
        theme: mode === "stock" ? selected?.theme : undefined,
        source: mode === "stock" ? selected?.source : undefined,
        listType: mode === "list" ? listType : undefined,
        scheduledAtUtc,
        customPrompt: customInstruction.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Zamanlama hatası");
      setBusy(false);
      return;
    }
    setBusy(false);
    await loadScheduled();
  };

  const cancelSchedule = async (id: string) => {
    setError("");
    const res = await fetch(`/api/admin/x/schedule?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "İptal hatası");
      return;
    }
    await loadScheduled();
  };

  const processManualTicker = async () => {
    const tickerToProcess = manualTicker.toUpperCase().trim();
    if (!tickerToProcess) {
      setError("Lütfen bir ticker giriniz.");
      return;
    }
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("stock");
    setImageUrl(null);
    setMarket(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "stock", ticker: tickerToProcess, company: null, sector: null, theme: null, customInstruction: customInstruction.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setMarket(data.market ?? null);
    setHashtags(data.hashtags ?? "");
    setSelected({ id: tickerToProcess, source: "manual" as const, ticker: tickerToProcess, company: null, sector: null, theme: null });
    setBusy(false);
  };

  // "Analiz Et"in aksine bu, gönderiyi hemen üretmez — ticker'ı kalıcı kuyruğa
  // (x_content_pool) ekler, böylece otomasyon eklenme sırasına göre işler.
  const addTickerToQueue = async () => {
    const tickerToAdd = manualTicker.toUpperCase().trim();
    if (!tickerToAdd) {
      setError("Lütfen bir ticker giriniz.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: tickerToAdd }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Kuyruğa ekleme hatası");
      setBusy(false);
      return;
    }
    setManualTicker("");
    await loadPool();
    setBusy(false);
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>X Studio — @bogastock</h1>
        <Link href="/admin/x-studio/queue" style={{ color: ACCENT, fontSize: 12 }}>Kuyruk Listesi (Manuel Paylaş) →</Link>
      </div>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12 }}>{error}</div>}

      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
            Manuel Hisse Seçimi (Analytics, Portfolio vb. sayfalardan inceleyip giriniz):
          </label>
          <input
            type="text"
            placeholder="Ticker giriniz (örn: AAPL, MSFT)"
            value={manualTicker}
            onChange={(e) => setManualTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && processManualTicker()}
            style={{
              ...inputStyle,
              width: "100%",
              textTransform: "uppercase",
            }}
          />
        </div>
        <button
          style={{ ...btnStyle, marginTop: 26, background: "#22c55e" }}
          disabled={busy || !manualTicker.trim()}
          onClick={addTickerToQueue}
          title="Ticker'ı kalıcı kuyruğa ekler — otomasyon eklenme sırasına göre işler"
        >
          Kuyruğa Ekle
        </button>
        <button
          style={{ ...btnStyle, marginTop: 26 }}
          disabled={busy || !manualTicker.trim()}
          onClick={processManualTicker}
          title="Kuyruğa eklemeden hemen metin/görsel üretir (tek seferlik önizleme)"
        >
          Analiz Et
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
          AI Talimatı (opsiyonel) — hedefe yönelik bir yönerge girin, AI metni buna göre üretir:
        </label>
        <textarea
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder="örn: Temettü büyümesine odaklan / Kazanç raporundaki öne çıkan noktayı vurgula"
          style={{ ...inputStyle, width: "100%", height: 50, resize: "vertical" }}
        />
      </div>

      {settings && (
        <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 20, marginBottom: 20, padding: 12 }}>
          <button
            style={{ ...btnStyle, background: settings.enabled ? "#22c55e" : "#30363d", color: settings.enabled ? "#0d1117" : "#e6edf3" }}
            onClick={() => patchSettings({ enabled: !settings.enabled })}
          >
            Otomasyon: {settings.enabled ? "AÇIK" : "KAPALI"}
          </button>
          <button
            title="Kapalıyken hiçbir gönderi gerçekten X'e atılmaz — içerik yine üretilip /news akışına düşer."
            style={{ ...btnStyle, background: settings.x_posting_enabled ? "#22c55e" : "#f85149", color: "#0d1117" }}
            onClick={() => patchSettings({ x_posting_enabled: !settings.x_posting_enabled })}
          >
            X Bağlantısı: {settings.x_posting_enabled ? "AÇIK" : "KAPALI"}
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
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnStyle} disabled={busy} onClick={fillPool}>Kuyruğu Doldur</button>
              <button
                style={{ ...btnStyle, background: "#f85149" }}
                disabled={busy || pool.length === 0}
                onClick={clearPool}
              >
                Kuyruğu Temizle
              </button>
            </div>
          </div>
          <button style={{ ...btnStyle, background: "#f59e0b", marginBottom: 12, width: "100%" }} disabled={busy} onClick={generatePromoText}>
            Promo Gönder (Manuel)
          </button>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              Site Bölümleri — ana sayfadaki paylaş butonlu bölümlerin özetini paylaş:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LIST_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  style={{ ...btnStyle, background: listType === type && mode === "list" ? ACCENT : "#30363d", color: listType === type && mode === "list" ? "#0d1117" : "#e6edf3" }}
                  disabled={busy}
                  onClick={() => generateListText(type)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {pool.map((item) => (
              <div
                key={item.id}
                style={{
                  ...inputStyle,
                  border: selected?.id === item.id ? `1px solid ${ACCENT}` : inputStyle.border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  onClick={() => generateStockText(item)}
                  style={{ display: "flex", justifyContent: "space-between", flex: 1, cursor: "pointer" }}
                >
                  <span>{item.ticker} <span style={{ opacity: 0.6 }}>({item.source})</span></span>
                  <span style={{ opacity: 0.6 }}>{item.sector || item.theme || ""}</span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePoolItem(item.id); }}
                  title="Kuyruktan sil"
                  style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, marginLeft: 10, padding: "0 4px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editör / Önizleme */}
        <div style={{ flex: 1, minWidth: 360 }}>
          <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>
            {mode === "promo" ? "Promo Gönderisi" : mode === "list" ? `${listTitle} Özeti` : selected ? `${selected.ticker} Gönderisi` : "Bir hisse seçin"}
          </h2>

          {mode === "list" && listItems.length > 0 && (
            <div style={{ ...inputStyle, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {listItems.map((it) => (
                <span key={it.ticker} style={{ color: it.changePct >= 0 ? "#3fb950" : "#f85149" }}>
                  {it.ticker} {it.changePct >= 0 ? "+" : ""}{it.changePct.toFixed(1)}%
                </span>
              ))}
            </div>
          )}

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
            maxLength={MANUAL_POST_LIMIT}
            onChange={(e) => setTexts((t) => ({ ...t, [locale]: e.target.value }))}
            placeholder="AI metni burada görünecek, düzenlenebilir..."
          />

          {hashtags && (
            <div style={{ ...inputStyle, marginTop: 6, opacity: 0.75, display: "flex", justifyContent: "space-between" }}>
              <span>Paylaşırken otomatik eklenecek: {hashtags}</span>
              <span>{texts[locale] ? appendHashtagsWithinLimit(texts[locale], hashtags, MANUAL_POST_LIMIT).length : 0}/{MANUAL_POST_LIMIT}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {mode !== "list" && (
              <button style={btnStyle} disabled={busy || !texts[locale]} onClick={previewImage}>Görseli Önizle</button>
            )}
            <button style={{ ...btnStyle, background: "#22c55e" }} disabled={busy || !texts[locale]} onClick={publish}>
              {settings && !settings.x_posting_enabled ? "Yayınla (Sadece /news)" : "Şimdi Paylaş (API)"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap", padding: 10, border: "1px dashed #30363d", borderRadius: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Zamanla ({locale.toUpperCase()}, NY saati):</span>
            <input
              type="date"
              value={scheduleDate}
              min={nyTodayDateStr()}
              max={nyMaxDateStr()}
              onChange={(e) => setScheduleDate(e.target.value)}
              style={{ ...inputStyle }}
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              style={{ ...inputStyle }}
            />
            <button style={{ ...btnStyle, background: "#8b5cf6" }} disabled={busy || !texts[locale]} onClick={schedulePost}>
              Zamanla
            </button>
          </div>

          {imageUrl && (
            <>
              <img src={imageUrl} alt="preview" style={{ marginTop: 16, width: "100%", borderRadius: 8, border: "1px solid #30363d" }} />

              <div style={{ marginTop: 12, padding: 12, border: `1px dashed ${ACCENT}`, borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: ACCENT, marginBottom: 8, fontWeight: 700 }}>
                  MANUEL PAYLAŞIM (X API kredisi gerektirmez)
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={{ ...btnStyle, background: "#30363d" }} onClick={downloadImage}>Görseli İndir</button>
                  <button style={{ ...btnStyle, background: "#30363d" }} onClick={copyText}>Metni Kopyala</button>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                  x.com'da @bogastock hesabınla yeni gönderi aç, indirdiğin görseli ve kopyaladığın metni ekleyip paylaş.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zamanlanmış */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>Zamanlanmış Gönderiler ({scheduled.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {scheduled.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>Zamanlanmış gönderi yok.</div>}
          {scheduled.map((s) => (
            <div key={s.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{s.content_type === "promo" ? "PROMO" : s.content_type === "list" ? `LIST:${s.list_type}` : s.ticker} [{s.locale}]</span>
              <span style={{ opacity: 0.7 }}>{s.content_text?.slice(0, 60)}</span>
              <span style={{ color: "#f59e0b" }}>{utcIsoToNyDisplay(s.scheduled_at)}</span>
              <button
                onClick={() => cancelSchedule(s.id)}
                title="İptal et"
                style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, marginLeft: 10, padding: "0 4px" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Geçmiş */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>Son Gönderiler</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between" }}>
              <span>{p.content_type === "promo" ? "PROMO" : p.content_type === "list" ? `LIST:${p.list_type}` : p.ticker} [{p.locale}]</span>
              <span style={{ opacity: 0.7 }}>{p.content_text?.slice(0, 60)}</span>
              <span style={{ color: p.status === "posted" ? "#22c55e" : p.status === "failed" ? "#f85149" : "#f59e0b" }}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
