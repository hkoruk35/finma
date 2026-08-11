"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { appendHashtagsWithinLimit } from "@/lib/x/hashtags";

const ACCENT = "#58a6ff";
const LOCALES = ["en", "es", "fr", "pt", "tr", "id"] as const;
type Locale = (typeof LOCALES)[number];

const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "6px 14px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

interface PoolItem {
  id: string;
  source: "top100" | "swing" | "trend";
  ticker: string;
  company: string | null;
  sector: string | null;
  theme: string | null;
}

interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface RowState {
  status: "idle" | "loading" | "ready" | "error";
  texts?: Record<Locale, string>;
  hashtags?: string;
  market?: {
    bars: OhlcBar[];
    changePct: number;
    rvol: number;
    opportunity: boolean;
    trendLabels: Record<Locale, string>;
    opportunityLabels: Record<Locale, string>;
  } | null;
  locale: Locale;
  imageUrl?: string;
  error?: string;
}

export default function XStudioQueuePage() {
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  const loadPool = useCallback(async () => {
    const res = await fetch("/api/admin/x/pool");
    if (res.ok) setPool((await res.json()).pool ?? []);
  }, []);

  useEffect(() => {
    loadPool();
  }, [loadPool]);

  const rowFor = (id: string): RowState => rows[id] ?? { status: "idle", locale: "en" };

  // Fonksiyonel updater'in kendi `r` parametresini kullanir — dis kapsamdaki
  // `rows`'a (bayat/stale) degil, en guncel state'e gore birlestirir.
  const setRow = (id: string, patch: Partial<RowState>) => {
    setRows((r) => ({ ...r, [id]: { ...(r[id] ?? { status: "idle", locale: "en" }), ...patch } }));
  };

  const prepare = async (item: PoolItem) => {
    setExpanded(item.id);
    setRow(item.id, { status: "loading", error: undefined });
    try {
      const res = await fetch("/api/admin/x/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: "stock", ticker: item.ticker, company: item.company, sector: item.sector, theme: item.theme }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRow(item.id, { status: "error", error: data.error || "Metin üretme hatası" });
        return;
      }
      const locale = rowFor(item.id).locale;
      setRow(item.id, { status: "ready", texts: data.texts, hashtags: data.hashtags, market: data.market ?? null });
      await renderImage(item, { status: "ready", locale, texts: data.texts, hashtags: data.hashtags, market: data.market ?? null });
    } catch (e: any) {
      console.error("[x-studio/queue] prepare failed:", e);
      setRow(item.id, { status: "error", error: e?.message || "Beklenmeyen hata" });
    }
  };

  const renderImage = async (item: PoolItem, row: RowState) => {
    if (!row.texts) return;
    const cardParams = {
      kind: "stock" as const,
      ticker: item.ticker,
      company: item.company ?? undefined,
      sector: item.sector ?? undefined,
      theme: item.theme ?? undefined,
      changePct: row.market?.changePct,
      rvol: row.market?.rvol,
      opportunity: row.market?.opportunity,
      opportunityLabel: row.market?.opportunityLabels?.[row.locale],
      trendLabel: row.market?.trendLabels?.[row.locale],
      bars: row.market?.bars ?? [],
      headline: row.texts[row.locale],
      locale: row.locale,
    };
    try {
      const res = await fetch("/api/admin/x/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cardParams),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      setRow(item.id, { imageUrl: URL.createObjectURL(blob) });
    } catch (e) {
      console.error("[x-studio/queue] image render failed:", e);
    }
  };

  const changeLocale = async (item: PoolItem, locale: Locale) => {
    setRow(item.id, { locale, imageUrl: undefined });
    await renderImage(item, { ...rowFor(item.id), locale });
  };

  // Manuel gonderiler icin premium karakter siniri — otomasyon (cron/x-scheduler)
  // hala varsayilan 280'i kullanir, buraya dokunmuyor.
  const MANUAL_POST_LIMIT = 2500;

  const getFinalText = (item: PoolItem) => {
    const row = rowFor(item.id);
    if (!row.texts) return "";
    return row.hashtags
      ? appendHashtagsWithinLimit(row.texts[row.locale], row.hashtags, MANUAL_POST_LIMIT)
      : row.texts[row.locale];
  };

  const downloadImage = (item: PoolItem) => {
    const row = rowFor(item.id);
    if (!row.imageUrl) return;
    const a = document.createElement("a");
    a.href = row.imageUrl;
    a.download = `${item.ticker}-${row.locale}.png`;
    a.click();
  };

  const copyText = async (item: PoolItem) => {
    await navigator.clipboard.writeText(getFinalText(item));
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>X Studio — Kuyruk Listesi</h1>
        <Link href="/admin/x-studio" style={{ color: ACCENT, fontSize: 12 }}>← Editöre dön</Link>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pool.map((item) => {
          const row = rowFor(item.id);
          const isOpen = expanded === item.id;
          return (
            <div key={item.id} style={{ border: "1px solid #30363d", borderRadius: 6, background: "#0d1117" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 12 }}>
                <div>
                  <span style={{ fontWeight: 700 }}>{item.ticker}</span>{" "}
                  <span style={{ opacity: 0.6, fontSize: 11 }}>({item.source}) {item.sector || item.theme || ""}</span>
                </div>
                <button style={btnStyle} disabled={row.status === "loading"} onClick={() => (isOpen ? setExpanded(null) : prepare(item))}>
                  {isOpen ? "Kapat" : row.status === "ready" ? "Tekrar Aç" : "Hazırla ve Paylaş"}
                </button>
              </div>

              {isOpen && (
                <div style={{ padding: 12, borderTop: "1px solid #30363d" }}>
                  {row.status === "idle" && <div style={{ opacity: 0.6 }}>Henüz hazırlanmadı.</div>}
                  {row.status === "loading" && <div style={{ opacity: 0.7 }}>Hazırlanıyor…</div>}
                  {row.status === "error" && (
                    <div>
                      <div style={{ color: "#f85149", marginBottom: 8 }}>{row.error}</div>
                      <button style={btnStyle} onClick={() => prepare(item)}>Tekrar Dene</button>
                    </div>
                  )}

                  {row.status === "ready" && row.texts && (
                    <>
                      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                        {LOCALES.map((l) => (
                          <button
                            key={l}
                            onClick={() => changeLocale(item, l)}
                            style={{ ...btnStyle, background: row.locale === l ? ACCENT : "#30363d", color: row.locale === l ? "#0d1117" : "#e6edf3" }}
                          >
                            {l.toUpperCase()}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: 240 }}>
                          <div style={{ ...inputStyle, whiteSpace: "pre-wrap", marginBottom: 8 }}>{row.texts[row.locale]}</div>
                          {row.hashtags && (
                            <div style={{ ...inputStyle, opacity: 0.7, marginBottom: 8 }}>
                              Otomatik eklenecek: {row.hashtags}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button style={{ ...btnStyle, background: "#30363d" }} onClick={() => downloadImage(item)}>Görseli İndir</button>
                            <button style={{ ...btnStyle, background: "#30363d" }} onClick={() => copyText(item)}>Metni Kopyala</button>
                          </div>
                          <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                            x.com&apos;da @bogastock hesabınla yeni gönderi aç, indirdiğin görseli ve kopyaladığın metni ekleyip paylaş.
                          </div>
                        </div>
                        {row.imageUrl && (
                          <img src={row.imageUrl} alt="preview" style={{ width: 340, maxWidth: "100%", borderRadius: 8, border: "1px solid #30363d" }} />
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {pool.length === 0 && <div style={{ opacity: 0.6 }}>Kuyruk boş — X Studio&apos;dan &quot;Kuyruğu Doldur&quot; ile içerik ekleyin.</div>}
      </div>
    </div>
  );
}
