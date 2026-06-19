"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ── Types ────────────────────────────────────────────────────────────────────

interface SavedAnalysis {
  ticker: string;
  company: string;
  conviction: number;
  recommendation: { type: string; label: string; reason: string; hold: string };
  price: number;
  savedAt: string;
  status: "saved" | "approved_swing" | "approved_longterm";
  approvedType?: "swing" | "longterm";
  approvedAt?: string;
  approvedPrice?: number;
  analysis?: {
    context: { weinstein: { label: string; stage: number } };
    timeframes: { d1: { rsi: number; ema50: number } };
    rvol: number;
    tradePlan: { stop: { price: number; pct: number }; rr1: number };
  };
}

interface LivePrice {
  current: number;
  change_pct: number;
  change_pct_1w?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (n: number) => isFinite(n) ? n.toFixed(2) : "—";
const fmt1 = (n: number) => isFinite(n) ? n.toFixed(1) : "—";

function pctColor(p: number) {
  return p > 0 ? "#3fb950" : p < 0 ? "#f85149" : "#8b949e";
}

function convColor(n: number) {
  return n >= 75 ? "#3fb950" : n >= 55 ? "#e3b341" : "#f85149";
}

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

// ── Component ────────────────────────────────────────────────────────────────

export default function PreOrderListClient({ type }: { type: "swing" | "longterm" }) {
  const [entries, setEntries] = useState<SavedAnalysis[]>([]);
  const [prices, setPrices] = useState<Record<string, LivePrice>>({});
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const statusKey = type === "swing" ? "approved_swing" : "approved_longterm";

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    loadStore("preorder_analyses").then((store: Record<string, any>) => {
      const list = Object.values(store) as SavedAnalysis[];
      const filtered = showAll
        ? list.filter(e => e.status === statusKey || e.status === "saved")
        : list.filter(e => e.status === statusKey);
      filtered.sort((a, b) => new Date(b.approvedAt ?? b.savedAt).getTime() - new Date(a.approvedAt ?? a.savedAt).getTime());
      setEntries(filtered);
      setLoading(false);
      // Fetch live prices
      if (filtered.length > 0) {
        const tickers = filtered.map(e => e.ticker).join(",");
        fetch(`/api/watchlist-data?tickers=${tickers}`)
          .then(r => r.json())
          .then((data: Record<string, any>) => {
            const p: Record<string, LivePrice> = {};
            Object.entries(data).forEach(([sym, d]: [string, any]) => {
              if (d?.price) p[sym] = { current: d.price.current, change_pct: d.price.change_pct, change_pct_1w: d.price.change_pct_1w };
            });
            setPrices(p);
          })
          .catch(() => {});
      }
    });
  }, [statusKey, showAll]);

  const handleRemove = async (ticker: string) => {
    setRemoving(ticker);
    const store = await loadStore("preorder_analyses") as Record<string, any>;
    delete store[ticker];
    await saveStore("preorder_analyses", store);
    setEntries(prev => prev.filter(e => e.ticker !== ticker));
    setRemoving(null);
    showToast(`${ticker} listeden kaldırıldı`);
  };

  const typeLabel = type === "swing" ? "Swing" : "Long Term";
  const typeColor = type === "swing" ? "#3fb950" : "#3b82f6";

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto", padding: "20px 16px 60px", color: "#e6edf3" }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 70, right: 20, zIndex: 1000,
          background: "#1a3a1a", border: "1px solid #3fb950", color: "#3fb950",
          padding: "10px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
        }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/tracker" style={{ color: "#8b949e", fontSize: 11, textDecoration: "none" }}>← Tracker</Link>
            <span style={{ color: "#30363d" }}>/</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: typeColor }}>
              Pre-Order: {typeLabel}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>
            Onaylanan pozisyonlar ve anlık performans takibi
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              padding: "7px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: showAll ? "#161b22" : "transparent",
              border: "1px solid #30363d", color: "#8b949e",
            }}
          >
            {showAll ? "Tümünü Gizle" : "Tümünü Göster"}
          </button>
          <Link href={`/order/${type}`} style={{
            padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: "#161b22", border: `1px solid ${typeColor}44`,
            color: typeColor, textDecoration: "none", display: "inline-block",
          }}>
            {typeLabel} Portföy →
          </Link>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8b949e" }}>Yükleniyor…</div>
      ) : entries.length === 0 ? (
        <div style={{
          textAlign: "center", padding: 60, background: "#161b22",
          border: "1px solid #30363d", borderRadius: 10,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#c9d1d9", marginBottom: 8 }}>
            Henüz {typeLabel} pozisyonu onaylanmadı
          </div>
          <div style={{ fontSize: 13, color: "#8b949e", marginBottom: 20 }}>
            Tracker'dan bir hisse seçerek Pre-Order analizine git ve "{typeLabel} Onayla" butonunu kullan.
          </div>
          <Link href="/tracker" style={{ color: "#3b82f6", fontSize: 13, textDecoration: "none" }}>
            Tracker'a Git →
          </Link>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid #30363d" }}>
                {["TICKER", "ŞİRKET", "ONAY FİYATI", "GÜNCEL FİYAT", "G.DEĞ.", "TOPLAM G.", "KONVİKSİYON", "RSI", "RVOL", "ÖNERI", "STOP", "R/R", "ONAY TARİHİ", "İŞLEM"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: h === "TICKER" || h === "ŞİRKET" || h === "ÖNERI" ? "left" : "right", fontWeight: 900, fontSize: 10, color: "#8b949e", letterSpacing: "0.05em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const live = prices[entry.ticker];
                const currentPrice = live?.current ?? entry.price;
                const approvedPrice = entry.approvedPrice ?? entry.price;
                const totalPnlPct = approvedPrice > 0 ? ((currentPrice - approvedPrice) / approvedPrice) * 100 : 0;
                const dayChangePct = live?.change_pct ?? 0;
                const rsi = entry.analysis?.timeframes?.d1?.rsi ?? 0;
                const rvol = entry.analysis?.rvol ?? 0;
                const isApproved = entry.status === statusKey;

                return (
                  <tr
                    key={entry.ticker}
                    style={{
                      borderBottom: "1px solid #21262d",
                      background: isApproved ? (totalPnlPct >= 0 ? "#0d1f0d" : "#1f0d0d") : "#0d1117",
                      opacity: isApproved ? 1 : 0.6,
                    }}
                  >
                    <td style={{ padding: "9px 10px", textAlign: "left" }}>
                      <Link href={`/preorder/${entry.ticker}`} style={{ fontWeight: 900, fontFamily: "monospace", color: typeColor, textDecoration: "none", fontSize: 13 }}>
                        {entry.ticker}
                      </Link>
                    </td>
                    <td style={{ padding: "9px 10px", color: "#c9d1d9", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.company}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#8b949e" }}>
                      ${fmt2(approvedPrice)}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#e6edf3" }}>
                      {live ? `$${fmt2(currentPrice)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: pctColor(dayChangePct) }}>
                      {live ? `${dayChangePct >= 0 ? "+" : ""}${fmt2(dayChangePct)}%` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: pctColor(totalPnlPct) }}>
                      {live ? `${totalPnlPct >= 0 ? "+" : ""}${fmt1(totalPnlPct)}%` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>
                      <span style={{ color: convColor(entry.conviction), fontWeight: 700, fontFamily: "monospace" }}>
                        {entry.conviction}
                      </span>
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: rsi >= 70 ? "#f85149" : rsi >= 50 ? "#3fb950" : "#e3b341" }}>
                      {rsi ? fmt1(rsi) : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: rvol >= 1.5 ? "#3fb950" : rvol >= 0.8 ? "#8b949e" : "#f85149" }}>
                      {rvol ? `${fmt2(rvol)}x` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "left" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: typeColor }}>{entry.recommendation.label}</span>
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#f85149", fontSize: 11 }}>
                      {entry.analysis?.tradePlan?.stop ? `$${fmt2(entry.analysis.tradePlan.stop.price)}` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#e3b341", fontSize: 11 }}>
                      {entry.analysis?.tradePlan?.rr1 ? `${fmt1(entry.analysis.tradePlan.rr1)}:1` : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right", color: "#8b949e", fontSize: 10 }}>
                      {entry.approvedAt ? new Date(entry.approvedAt).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" }) : "—"}
                    </td>
                    <td style={{ padding: "9px 10px", textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <Link
                          href={`/preorder/${entry.ticker}`}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3,
                            border: `1px solid ${typeColor}44`, color: typeColor,
                            background: "transparent", textDecoration: "none", cursor: "pointer",
                          }}
                        >
                          Analiz
                        </Link>
                        <Link
                          href={`/order/${type}?add=${entry.ticker}&price=${approvedPrice}`}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3,
                            border: "1px solid #e3b34144", color: "#e3b341",
                            background: "transparent", textDecoration: "none", cursor: "pointer",
                          }}
                        >
                          Emir Aç
                        </Link>
                        <button
                          onClick={() => handleRemove(entry.ticker)}
                          disabled={removing === entry.ticker}
                          style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 3,
                            border: "1px solid #f8514944", color: "#f85149",
                            background: "transparent", cursor: "pointer",
                          }}
                        >
                          {removing === entry.ticker ? "…" : "✕"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary stats */}
      {entries.length > 0 && Object.keys(prices).length > 0 && (
        <div style={{
          marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "14px 16px",
        }}>
          {(() => {
            const approved = entries.filter(e => e.status === statusKey);
            const withPrices = approved.filter(e => prices[e.ticker]);
            const totalPnl = withPrices.reduce((sum, e) => {
              const cur = prices[e.ticker].current;
              const ap = e.approvedPrice ?? e.price;
              return sum + (ap > 0 ? ((cur - ap) / ap) * 100 : 0);
            }, 0);
            const avgPnl = withPrices.length > 0 ? totalPnl / withPrices.length : 0;
            const winners = withPrices.filter(e => {
              const cur = prices[e.ticker].current;
              const ap = e.approvedPrice ?? e.price;
              return cur > ap;
            }).length;
            return (
              <>
                <div>
                  <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Toplam Pozisyon</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: typeColor, fontFamily: "monospace" }}>{approved.length}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Ort. PnL</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: pctColor(avgPnl), fontFamily: "monospace" }}>
                    {avgPnl >= 0 ? "+" : ""}{fmt1(avgPnl)}%
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Kazanan / Kaybeden</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "monospace" }}>
                    <span style={{ color: "#3fb950" }}>{winners}</span>
                    <span style={{ color: "#8b949e" }}>/</span>
                    <span style={{ color: "#f85149" }}>{withPrices.length - winners}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Başarı Oranı</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#e3b341", fontFamily: "monospace" }}>
                    {withPrices.length > 0 ? Math.round((winners / withPrices.length) * 100) : 0}%
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
