"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useUserRole } from "@/hooks/useUserRole";

const TradingViewChart = dynamic(() => import("@/components/TradingViewChart"), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

interface SRLevel {
  price: number;
  type: "resistance" | "support";
  source: string;
  strength: number;
}

interface Analysis {
  ticker: string;
  company: string;
  exchange: string;
  price: number;
  prevClose: number;
  changePct: number;
  volume: number;
  avgVol30: number;
  rvol: number;
  generatedAt: string;
  context: {
    hi52: number; lo52: number; pct52h: number;
    atr: number; atrPct: number;
    weinstein: { stage: number; label: string };
    stockReturn1y: number;
    vcpDetected: boolean;
  };
  timeframes: {
    d1: {
      ema9: number; ema20: number; ema50: number; ema200: number;
      rsi: number; pattern: string; rvol: number;
      pivots: { p: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
      pivotsWeekly: { p: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
      swingHigh: number; swingLow: number;
    };
    h1: {
      ema9: number; ema20: number; ema50: number;
      rsi: number; pattern: string; rvol: number;
      pivots: { p: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
      swingHigh: number; swingLow: number;
    };
    m15: {
      ema9: number; ema20: number;
      pattern: string; vwap: number;
      pivots: { p: number; r1: number; s1: number };
      swingHigh: number; swingLow: number;
    };
  };
  wyckoff: {
    score: number; accumDays: number; distribDays: number;
    noSupplyDays: number; noDemandDays: number;
    phase: string; signal: string; effortVsResult: string;
  };
  srLevels: SRLevel[];
  conviction: number;
  recommendation: { type: string; label: string; reason: string; hold: string };
  tradePlan: {
    stagedEntry: { pct: number; price: number; label: string; trigger: string }[];
    stagedExit:  { pct: number; price: number; label: string; rr: number }[];
    stop: { price: number; pct: number };
    rr1: number; rr2: number;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (n: number) => isFinite(n) ? n.toFixed(2) : "—";
const fmt1 = (n: number) => isFinite(n) ? n.toFixed(1) : "—";

function fmtVol(v: number) {
  if (!v) return "—";
  return v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(1) + "K" : String(v);
}

function pctColor(p: number) {
  return p > 0 ? "#3fb950" : p < 0 ? "#f85149" : "#8b949e";
}

function emaVsPrice(price: number, ema: number) {
  if (!ema) return { color: "#8b949e", label: "—" };
  const diff = ((price - ema) / ema) * 100;
  const color = diff > 0.5 ? "#3fb950" : diff < -0.5 ? "#f85149" : "#e3b341";
  const arrow = diff > 0.5 ? "↑" : diff < -0.5 ? "↓" : "~";
  return { color, label: `${arrow} ${Math.abs(diff).toFixed(1)}%` };
}

function convictionColor(n: number) {
  if (n >= 75) return "#3fb950";
  if (n >= 55) return "#e3b341";
  return "#f85149";
}

function strengthDots(n: number) {
  return "●".repeat(Math.min(n, 4)) + "○".repeat(Math.max(0, 4 - n));
}

// ── Store helpers ─────────────────────────────────────────────────────────────

async function loadStore(key: string) {
  try {
    const res = await fetch(`/api/store/${key}`);
    const { value } = await res.json();
    return value ?? {};
  } catch { return {}; }
}

async function saveStore(key: string, value: unknown) {
  await fetch(`/api/store/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

// ── Styled sub-components ────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value, color = "#e6edf3", sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color, fontFamily: "monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#8b949e" }}>{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PreOrderClient({ ticker, hideAdminActions = false }: { ticker: string; hideAdminActions?: boolean }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [chartInterval, setChartInterval] = useState<"15" | "60" | "D" | "W">("D");
  const role = useUserRole();
  const isReadonly = role === "readonly";
  const [saving, setSaving]     = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);
  const [toast, setToast]       = useState<string | null>(null);

  // Fetch analysis
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/preorder-analysis?ticker=${ticker}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setAnalysis(data);
        setLoading(false);
      })
      .catch(() => { setError("Analiz alınamadı"); setLoading(false); });
  }, [ticker]);

  // Load current saved status
  useEffect(() => {
    loadStore("preorder_analyses").then((store: Record<string, any>) => {
      if (store[ticker]) setSavedStatus(store[ticker].status ?? "saved");
    });
  }, [ticker]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = useCallback(async () => {
    if (!analysis) return;
    setSaving("save");
    const store = await loadStore("preorder_analyses") as Record<string, any>;
    store[ticker] = {
      ticker,
      company: analysis.company,
      conviction: analysis.conviction,
      recommendation: analysis.recommendation,
      price: analysis.price,
      savedAt: new Date().toISOString(),
      status: "saved",
      analysis,
    };
    await saveStore("preorder_analyses", store);
    setSavedStatus("saved");
    setSaving(null);
    showToast("Analiz kaydedildi ✓");
  }, [analysis, ticker]);

  const handleApprove = useCallback(async (type: "swing" | "longterm") => {
    if (!analysis) return;
    setSaving(type);
    const store = await loadStore("preorder_analyses") as Record<string, any>;
    store[ticker] = {
      ...(store[ticker] ?? {}),
      ticker,
      company: analysis.company,
      conviction: analysis.conviction,
      recommendation: analysis.recommendation,
      price: analysis.price,
      savedAt: store[ticker]?.savedAt ?? new Date().toISOString(),
      status: type === "swing" ? "approved_swing" : "approved_longterm",
      approvedType: type,
      approvedAt: new Date().toISOString(),
      approvedPrice: analysis.price,
      analysis,
    };
    await saveStore("preorder_analyses", store);
    setSavedStatus(type === "swing" ? "approved_swing" : "approved_longterm");
    setSaving(null);
    showToast(`${type === "swing" ? "Swing" : "Long Term"} olarak onaylandı ✓`);
  }, [analysis, ticker]);

  // ── Loading / Error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "#8b949e" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #30363d", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <div style={{ fontSize: 13 }}>{ticker} analiz ediliyor…</div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ fontSize: 32 }}>⚠️</div>
        <div style={{ color: "#f85149", fontSize: 14 }}>{error || "Veri alınamadı"}</div>
        <Link href="/admin/portfolio/tracker" style={{ color: "#3b82f6", fontSize: 12 }}>← Tracker'a Dön</Link>
      </div>
    );
  }

  const a = analysis;
  const { timeframes: tf, wyckoff: wy, tradePlan: tp, context: ctx } = a;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px 60px", color: "#e6edf3" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 70, right: 20, zIndex: 1000,
          background: "#1a3a1a", border: "1px solid #3fb950", color: "#3fb950",
          padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Link href="/admin/portfolio/tracker" style={{ color: "#8b949e", fontSize: 11, textDecoration: "none" }}>← Tracker</Link>
            <span style={{ color: "#30363d" }}>/</span>
            <span style={{ fontSize: 24, fontWeight: 900, fontFamily: "monospace", letterSpacing: "0.05em" }}>{a.ticker}</span>
            <span style={{ fontSize: 14, color: "#8b949e", fontWeight: 400 }}>{a.company}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace" }}>${fmt2(a.price)}</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: pctColor(a.changePct) }}>
              {a.changePct >= 0 ? "+" : ""}{fmt2(a.changePct)}%
            </span>
            <span style={{ fontSize: 12, color: "#8b949e" }}>HACİM: {fmtVol(a.volume)} | RVOL: {fmt2(a.rvol)}x</span>
            <span style={{ fontSize: 11, color: "#8b949e", background: "#161b22", border: "1px solid #30363d", padding: "2px 8px", borderRadius: 4 }}>
              {a.exchange}
            </span>
          </div>
        </div>

        {/* Action buttons */}
        {!hideAdminActions && (
          <>
            {!isReadonly && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
                <button
                  onClick={handleSave}
                  disabled={saving !== null}
                  style={{
                    padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: savedStatus ? "#1c2a1c" : "#161b22",
                    border: `1px solid ${savedStatus ? "#3fb950" : "#30363d"}`,
                    color: savedStatus ? "#3fb950" : "#8b949e",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving === "save" ? "Kaydediliyor…" : savedStatus ? "✓ Kaydedildi" : "Kaydet"}
                </button>
                <button
                  onClick={() => handleApprove("swing")}
                  disabled={saving !== null}
                  style={{
                    padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: savedStatus === "approved_swing" ? "#1c2a1c" : "#0d2a0d",
                    border: `1px solid ${savedStatus === "approved_swing" ? "#3fb950" : "#3fb95066"}`,
                    color: "#3fb950",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving === "swing" ? "…" : savedStatus === "approved_swing" ? "✓ SWING ONAYLANDI" : "Swing Onayla"}
                </button>
                <button
                  onClick={() => handleApprove("longterm")}
                  disabled={saving !== null}
                  style={{
                    padding: "8px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                    background: savedStatus === "approved_longterm" ? "#0d1a2e" : "#0d1a2e",
                    border: `1px solid ${savedStatus === "approved_longterm" ? "#3b82f6" : "#3b82f666"}`,
                    color: "#3b82f6",
                    opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving === "longterm" ? "…" : savedStatus === "approved_longterm" ? "✓ LONG TERM ONAYLANDI" : "Long Term Onayla"}
                </button>
              </div>
            )}
            {isReadonly && (
              <div style={{ fontSize: 11, color: "#8b949e", border: "1px solid #30363d", borderRadius: 6, padding: "8px 14px" }}>
                Salt okunur erişim — analiz görüntülenebilir
              </div>
            )}
          </>
        )}
      </div>

      {/* Context row */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
        gap: 12, marginBottom: 20,
        background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "12px 16px",
      }}>
        <Stat label="Weinstein" value={`Stage ${ctx.weinstein.stage}`} color={ctx.weinstein.stage === 2 ? "#3fb950" : ctx.weinstein.stage === 4 ? "#f85149" : "#e3b341"} sub={ctx.weinstein.label} />
        <Stat label="52H'dan Fark" value={`${fmt1(ctx.pct52h)}%`} color={pctColor(ctx.pct52h)} sub={`H: $${fmt2(ctx.hi52)}`} />
        <Stat label="ATR (1G)" value={`$${fmt2(ctx.atr)}`} color="#c9d1d9" sub={`${fmt1(ctx.atrPct)}% fiyatın`} />
        <Stat label="1Y Getiri" value={`${ctx.stockReturn1y >= 0 ? "+" : ""}${fmt1(ctx.stockReturn1y)}%`} color={pctColor(ctx.stockReturn1y)} />
        <Stat label="Ort. Hacim (30G)" value={fmtVol(a.avgVol30)} color="#8b949e" />
        <Stat label="VCP" value={ctx.vcpDetected ? "Tespit Edildi" : "Yok"} color={ctx.vcpDetected ? "#e3b341" : "#8b949e"} />
        <Stat label="Wyckoff" value={wy.signal} color={wy.score > 65 ? "#3fb950" : wy.score > 45 ? "#e3b341" : "#f85149"} />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em" }}>Analiz Zamanı</div>
          <div style={{ fontSize: 11, color: "#8b949e", fontFamily: "monospace" }}>
            {new Date(a.generatedAt).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
      </div>

      {/* Main 2-column grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 16, alignItems: "start" }}>

        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* TradingView Chart */}
          <div style={{ background: "#161b22", border: "1px solid #30363d", borderRadius: 8, overflow: "hidden" }}>
            {/* Interval tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #30363d" }}>
              {(["15", "60", "D", "W"] as const).map(iv => (
                <button
                  key={iv}
                  onClick={() => setChartInterval(iv)}
                  style={{
                    padding: "8px 18px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                    border: "none", borderRight: "1px solid #30363d",
                    background: chartInterval === iv ? "#3b82f620" : "transparent",
                    color: chartInterval === iv ? "#3b82f6" : "#8b949e",
                    transition: "all 0.15s",
                  }}
                >
                  {iv === "15" ? "15M" : iv === "60" ? "1S" : iv === "D" ? "1G" : "1H"}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <span style={{ padding: "8px 12px", fontSize: 10, color: "#8b949e", alignSelf: "center" }}>
                {a.ticker} · {a.company}
              </span>
            </div>
            <TradingViewChart
              key={`${a.ticker}-${chartInterval}`}
              ticker={a.ticker}
              exchange={a.exchange}
              interval={chartInterval}
            />
          </div>

          {/* Multi-TF EMA Panel */}
          <Panel title="Çok Zaman Dilimi EMA Analizi">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              {/* 15M */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8b949e", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #30363d" }}>15 Dakika</div>
                {[
                  { label: "EMA9",    val: tf.m15.ema9 },
                  { label: "EMA20",   val: tf.m15.ema20 },
                  { label: "VWAP",    val: tf.m15.vwap },
                ].map(({ label, val }) => {
                  const { color, label: lbl } = emaVsPrice(a.price, val);
                  return (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #21262d" }}>
                      <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#c9d1d9" }}>${fmt2(val)}</span>
                        <span style={{ fontSize: 10, color, marginLeft: 6 }}>{lbl}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, fontSize: 10, color: "#8b949e" }}>Patern: <span style={{ color: "#c9d1d9" }}>{tf.m15.pattern}</span></div>
                <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>Pivot P: <span style={{ color: "#c9d1d9", fontFamily: "monospace" }}>${fmt2(tf.m15.pivots.p)}</span></div>
                <div style={{ fontSize: 10, color: "#8b949e" }}>R1/S1: <span style={{ color: "#f85149", fontFamily: "monospace" }}>${fmt2(tf.m15.pivots.r1)}</span> / <span style={{ color: "#3fb950", fontFamily: "monospace" }}>${fmt2(tf.m15.pivots.s1)}</span></div>
              </div>

              {/* 1H */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8b949e", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #30363d" }}>1 Saat</div>
                {[
                  { label: "EMA9",  val: tf.h1.ema9 },
                  { label: "EMA20", val: tf.h1.ema20 },
                  { label: "EMA50", val: tf.h1.ema50 },
                ].map(({ label, val }) => {
                  const { color, label: lbl } = emaVsPrice(a.price, val);
                  return (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #21262d" }}>
                      <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#c9d1d9" }}>${fmt2(val)}</span>
                        <span style={{ fontSize: 10, color, marginLeft: 6 }}>{lbl}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, fontSize: 10, color: "#8b949e" }}>RSI: <span style={{ color: tf.h1.rsi >= 70 ? "#f85149" : tf.h1.rsi >= 50 ? "#3fb950" : "#e3b341", fontWeight: 700 }}>{fmt1(tf.h1.rsi)}</span></div>
                <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>Pivot R1/S1: <span style={{ color: "#f85149", fontFamily: "monospace" }}>${fmt2(tf.h1.pivots.r1)}</span> / <span style={{ color: "#3fb950", fontFamily: "monospace" }}>${fmt2(tf.h1.pivots.s1)}</span></div>
              </div>

              {/* 1D */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#8b949e", marginBottom: 8, paddingBottom: 6, borderBottom: "1px solid #30363d" }}>1 Gün</div>
                {[
                  { label: "EMA9",   val: tf.d1.ema9 },
                  { label: "EMA20",  val: tf.d1.ema20 },
                  { label: "EMA50",  val: tf.d1.ema50 },
                  { label: "EMA200", val: tf.d1.ema200 },
                ].map(({ label, val }) => {
                  const { color, label: lbl } = emaVsPrice(a.price, val);
                  return (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #21262d" }}>
                      <span style={{ fontSize: 11, color: "#8b949e" }}>{label}</span>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: 11, fontFamily: "monospace", color: "#c9d1d9" }}>${fmt2(val)}</span>
                        <span style={{ fontSize: 10, color, marginLeft: 6 }}>{lbl}</span>
                      </div>
                    </div>
                  );
                })}
                <div style={{ marginTop: 8, fontSize: 10, color: "#8b949e" }}>RSI: <span style={{ color: tf.d1.rsi >= 70 ? "#f85149" : tf.d1.rsi >= 50 ? "#3fb950" : "#e3b341", fontWeight: 700 }}>{fmt1(tf.d1.rsi)}</span></div>
                <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>Patern: <span style={{ color: "#c9d1d9" }}>{tf.d1.pattern}</span></div>
                <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>Pivot R1/S1: <span style={{ color: "#f85149", fontFamily: "monospace" }}>${fmt2(tf.d1.pivots.r1)}</span> / <span style={{ color: "#3fb950", fontFamily: "monospace" }}>${fmt2(tf.d1.pivots.s1)}</span></div>
              </div>
            </div>
          </Panel>

          {/* Wyckoff Panel */}
          <Panel title="Wyckoff Fiyat–Hacim Analizi">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Wyckoff Fazı</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: wy.score > 65 ? "#3fb950" : wy.score > 45 ? "#e3b341" : "#f85149" }}>
                    {wy.phase}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Effort vs Result</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: wy.effortVsResult === "Pozitif" ? "#3fb950" : wy.effortVsResult === "Nötr" ? "#e3b341" : "#f85149" }}>
                    {wy.effortVsResult}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: "#8b949e", marginBottom: 4 }}>Wyckoff Skoru</div>
                <div style={{ background: "#000036", borderRadius: 4, height: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 4, transition: "width 0.5s",
                    width: `${wy.score}%`,
                    background: wy.score > 65 ? "#3fb950" : wy.score > 45 ? "#e3b341" : "#f85149",
                  }} />
                </div>
                <div style={{ fontSize: 11, color: "#8b949e", marginTop: 4, textAlign: "right" }}>{wy.score}/100</div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "Birikim Günü", val: wy.accumDays, color: "#3fb950" },
                  { label: "Dağıtım Günü", val: wy.distribDays, color: "#f85149" },
                  { label: "No Supply", val: wy.noSupplyDays, color: "#3fb950" },
                  { label: "No Demand", val: wy.noDemandDays, color: "#e3b341" },
                ].map(({ label, val, color }) => (
                  <div key={label} style={{ background: "#000036", borderRadius: 6, padding: "8px 10px" }}>
                    <div style={{ fontSize: 9, color: "#8b949e", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color, fontFamily: "monospace" }}>{val}</div>
                    <div style={{ fontSize: 9, color: "#8b949e" }}>son 10 bar</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Conviction Score */}
          <div style={{ background: "#161b22", border: `2px solid ${convictionColor(a.conviction)}33`, borderRadius: 10, padding: "16px" }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
              Konviksiyon Skoru
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 52, fontWeight: 900, color: convictionColor(a.conviction), fontFamily: "monospace", lineHeight: 1 }}>
                {a.conviction}
              </div>
              <div style={{ fontSize: 18, color: "#8b949e", marginBottom: 4, fontFamily: "monospace" }}>/100</div>
            </div>
            <div style={{ background: "#000036", borderRadius: 6, height: 10, overflow: "hidden", marginBottom: 8 }}>
              <div style={{
                height: "100%", borderRadius: 6, transition: "width 0.8s",
                width: `${a.conviction}%`,
                background: `linear-gradient(90deg, ${convictionColor(a.conviction)}88, ${convictionColor(a.conviction)})`,
              }} />
            </div>
            <div style={{ fontSize: 11, color: "#8b949e" }}>
              {a.conviction >= 75 ? "Yüksek konviksiyon — güçlü sinyal" : a.conviction >= 55 ? "Orta konviksiyon — dikkatli değerlendir" : "Düşük konviksiyon — bekle"}
            </div>
          </div>

          {/* Recommendation */}
          <div style={{
            background: a.recommendation.type === "longterm" ? "#0d1a2e" : a.recommendation.type === "swing" ? "#0d1f0d" : a.recommendation.type === "both" ? "#1a1a0d" : "#1a1a1a",
            border: `1px solid ${a.recommendation.type === "longterm" ? "#3b82f6" : a.recommendation.type === "swing" ? "#3fb950" : a.recommendation.type === "both" ? "#e3b341" : "#30363d"}`,
            borderRadius: 10, padding: "16px",
          }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
              Öneri
            </div>
            <div style={{
              fontSize: 22, fontWeight: 900,
              color: a.recommendation.type === "longterm" ? "#3b82f6" : a.recommendation.type === "swing" ? "#3fb950" : a.recommendation.type === "both" ? "#e3b341" : "#8b949e",
            }}>
              {a.recommendation.label}
            </div>
            <div style={{ fontSize: 11, color: "#c9d1d9", margin: "8px 0" }}>{a.recommendation.reason}</div>
            <div style={{ fontSize: 10, color: "#8b949e" }}>Tutma Süresi: <span style={{ color: "#c9d1d9" }}>{a.recommendation.hold}</span></div>
          </div>

          {/* S/R Table */}
          <Panel title="Destek / Direnç Seviyeleri">
            <div style={{ maxHeight: 300, overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <tbody>
                  {a.srLevels.map((level, i) => {
                    const proximity = Math.abs((level.price - a.price) / a.price) * 100;
                    const isNear = proximity < 2;
                    return (
                      <tr key={i} style={{
                        background: isNear ? (level.type === "resistance" ? "#2a0d0d" : "#0d2a0d") : "transparent",
                        borderBottom: "1px solid #21262d",
                      }}>
                        <td style={{ padding: "4px 6px", textAlign: "left", fontFamily: "monospace", fontWeight: 700, color: level.type === "resistance" ? "#f85149" : "#3fb950" }}>
                          ${fmt2(level.price)}
                        </td>
                        <td style={{ padding: "4px 4px", color: "#8b949e", fontSize: 9 }}>
                          {strengthDots(level.strength)}
                        </td>
                        <td style={{ padding: "4px 4px", color: "#8b949e", fontSize: 9, maxWidth: 100 }}>
                          {level.source}
                        </td>
                        <td style={{ padding: "4px 4px", textAlign: "right", color: "#8b949e", fontSize: 9 }}>
                          {proximity.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 10, color: "#8b949e" }}>
              <span style={{ color: "#f85149" }}>● Direnç</span>
              <span style={{ color: "#3fb950" }}>● Destek</span>
              <span>●●●● = Güçlü</span>
            </div>
          </Panel>

          {/* Stop price quick view */}
          <div style={{ background: "#1a0d0d", border: "1px solid #f8514933", borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, color: "#f85149", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Stop Loss</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 20, fontWeight: 900, fontFamily: "monospace", color: "#f85149" }}>${fmt2(tp.stop.price)}</span>
              <span style={{ fontSize: 13, color: "#f85149", fontWeight: 700 }}>{fmt1(tp.stop.pct)}%</span>
            </div>
            <div style={{ fontSize: 10, color: "#8b949e", marginTop: 4 }}>
              R/R: {fmt1(tp.rr1)}:1 → {fmt1(tp.rr2)}:1
            </div>
          </div>
        </div>
      </div>

      {/* Trade Plan — full width below */}
      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

        {/* Staged Entry */}
        <Panel title="Kademeli Giriş Planı">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Tranche</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Miktar</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Fiyat</th>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Tetikleyici</th>
              </tr>
            </thead>
            <tbody>
              {tp.stagedEntry.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "7px 8px", color: "#e6edf3", fontWeight: 600 }}>{e.label}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: "#3fb950", fontWeight: 700 }}>{e.pct}%</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: "#e6edf3", fontWeight: 700 }}>${fmt2(e.price)}</td>
                  <td style={{ padding: "7px 8px", color: "#8b949e", fontSize: 11 }}>{e.trigger}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        {/* Staged Exit */}
        <Panel title="Kademeli Çıkış Planı">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #30363d" }}>
                <th style={{ textAlign: "left", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Hedef</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Çıkış %</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>Fiyat</th>
                <th style={{ textAlign: "right", padding: "4px 8px", fontWeight: 700, color: "#8b949e", fontSize: 10 }}>R/R</th>
              </tr>
            </thead>
            <tbody>
              {tp.stagedExit.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #21262d" }}>
                  <td style={{ padding: "7px 8px", color: "#e6edf3", fontWeight: 600 }}>{e.label}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: "#f85149", fontWeight: 700 }}>{e.pct}%</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: "#3fb950", fontWeight: 700 }}>${fmt2(e.price)}</td>
                  <td style={{ padding: "7px 8px", textAlign: "right", fontFamily: "monospace", color: e.rr >= 2 ? "#3fb950" : e.rr >= 1 ? "#e3b341" : "#f85149", fontWeight: 700 }}>{e.rr}:1</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: "8px 10px", background: "#000036", borderRadius: 6, fontSize: 11, color: "#8b949e" }}>
            Stop: <span style={{ color: "#f85149", fontFamily: "monospace" }}>${fmt2(tp.stop.price)}</span>
            {" "}({fmt1(tp.stop.pct)}%) &nbsp;|&nbsp; Ortalama R/R: <span style={{ color: "#e3b341", fontWeight: 700 }}>{fmt1((tp.rr1 + tp.rr2) / 2)}:1</span>
          </div>
        </Panel>
      </div>

      {/* Bottom nav links */}
      {!hideAdminActions && (
        <div style={{ marginTop: 24, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/admin/trading/preorder/swing"    style={{ fontSize: 12, color: "#3fb950", background: "#0d2a0d", border: "1px solid #3fb95033", padding: "6px 14px", borderRadius: 6, textDecoration: "none" }}>
            Swing Listesi →
          </Link>
          <Link href="/admin/trading/preorder/longterm" style={{ fontSize: 12, color: "#3b82f6", background: "#0d1a2e", border: "1px solid #3b82f633", padding: "6px 14px", borderRadius: 6, textDecoration: "none" }}>
            Long Term Listesi →
          </Link>
          <Link href="/admin/portfolio/order/swing"       style={{ fontSize: 12, color: "#e3b341", background: "#1a1a0d", border: "1px solid #e3b34133", padding: "6px 14px", borderRadius: 6, textDecoration: "none" }}>
            Swing Portföy →
          </Link>
          <Link href="/admin/portfolio/order/longterm"    style={{ fontSize: 12, color: "#e3b341", background: "#1a1a0d", border: "1px solid #e3b34133", padding: "6px 14px", borderRadius: 6, textDecoration: "none" }}>
            LT Portföy →
          </Link>
        </div>
      )}
    </div>
  );
}
