"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { formatNumber } from "@/lib/formatNumber";

// ── Types ────────────────────────────────────────────────────────────────────

interface Order {
  id: string;
  ticker: string;
  company: string;
  entryDate: string;
  entryPrice: number;
  quantity: number;
  totalCost: number;
  stopPrice: number;
  target1: number;
  target2: number;
  status: "open" | "closed";
  exitDate?: string;
  exitPrice?: number;
  notes?: string;
}

interface PortfolioStore {
  orders: Order[];
}

interface LiveData {
  current: number;
  prev_close: number;
  change_pct: number;
  change_pct_1w?: number;
  change_pct_1m?: number;
  change_pct_1y?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmt2 = (n: number) => isFinite(n) ? formatNumber(n, 2) : "—";
const fmt1 = (n: number) => isFinite(n) ? formatNumber(n, 1) : "—";
const fmtM = (n: number) => {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 1e6) return `${sign}$${formatNumber(abs / 1e6, 2)}M`;
  if (abs >= 1e3) return `${sign}$${formatNumber(abs / 1e3, 1)}K`;
  return `${sign}$${formatNumber(abs, 2)}`;
};
const pctColor = (p: number) => p > 0 ? "#3fb950" : p < 0 ? "#f85149" : "#8b949e";
const uid = () => Math.random().toString(36).slice(2, 10);

async function loadStore(key: string): Promise<PortfolioStore> {
  try {
    const res = await fetch(`/api/store/${key}`);
    const { value } = await res.json();
    return (value ?? { orders: [] }) as PortfolioStore;
  } catch { return { orders: [] }; }
}

async function saveStore(key: string, value: unknown) {
  await fetch(`/api/store/${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value }),
  });
}

// ── Empty form ────────────────────────────────────────────────────────────────

const emptyForm = (ticker = "", price = "") => ({
  ticker: ticker.toUpperCase(),
  entryDate: new Date().toISOString().slice(0, 10),
  entryPrice: price,
  quantity: "",
  stopPrice: "",
  target1: "",
  target2: "",
  notes: "",
});

// ── Component ────────────────────────────────────────────────────────────────

export default function PortfolioClient({ type }: { type: "swing" | "longterm" }) {
  const searchParams = useSearchParams();
  const prefillTicker = searchParams.get("add") ?? "";
  const prefillPrice  = searchParams.get("price") ?? "";

  const storeKey = type === "swing" ? "portfolio_swing" : "portfolio_longterm";
  const typeLabel = type === "swing" ? "Swing" : "Long Term";
  const typeColor = type === "swing" ? "#3fb950" : "#3b82f6";

  const role = useUserRole();
  const isReadonly = role === "readonly";
  const [orders, setOrders] = useState<Order[]>([]);
  const [prices, setPrices] = useState<Record<string, LiveData>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(!!(prefillTicker && role !== "readonly"));
  const [form, setForm] = useState(emptyForm(prefillTicker, prefillPrice));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({ exitPrice: "", exitDate: new Date().toISOString().slice(0, 10) });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Load orders
  useEffect(() => {
    loadStore(storeKey).then(store => {
      setOrders(store.orders ?? []);
      setLoading(false);
    });
  }, [storeKey]);

  // Fetch live prices for all open orders
  useEffect(() => {
    const openTickers = orders.filter(o => o.status === "open").map(o => o.ticker);
    if (openTickers.length === 0) return;
    fetch(`/api/watchlist-data?tickers=${openTickers.join(",")}`)
      .then(r => r.json())
      .then((data: Record<string, any>) => {
        const p: Record<string, LiveData> = {};
        Object.entries(data).forEach(([sym, d]: [string, any]) => {
          if (d?.price) p[sym] = {
            current: d.price.current,
            prev_close: d.price.prev_close,
            change_pct: d.price.change_pct ?? 0,
            change_pct_1w: d.price.change_pct_1w,
            change_pct_1m: d.price.change_pct_1m,
            change_pct_1y: d.price.change_pct_1y,
          };
        });
        setPrices(p);
      })
      .catch(() => {});
  }, [orders]);

  // Add order
  const handleAdd = useCallback(async () => {
    if (!form.ticker || !form.entryPrice || !form.quantity) return;
    setSaving(true);
    const entryPrice = parseFloat(form.entryPrice as string);
    const quantity   = parseFloat(form.quantity as string);
    const newOrder: Order = {
      id: uid(),
      ticker:    form.ticker.toUpperCase(),
      company:   form.ticker.toUpperCase(),
      entryDate: form.entryDate,
      entryPrice,
      quantity,
      totalCost: entryPrice * quantity,
      stopPrice: parseFloat(form.stopPrice as string) || entryPrice * 0.95,
      target1:   parseFloat(form.target1 as string)  || entryPrice * 1.08,
      target2:   parseFloat(form.target2 as string)  || entryPrice * 1.15,
      status:    "open",
      notes:     form.notes as string,
    };
    const store = await loadStore(storeKey);
    store.orders = [newOrder, ...(store.orders ?? [])];
    await saveStore(storeKey, store);
    setOrders(store.orders);
    setShowForm(false);
    setForm(emptyForm());
    setSaving(false);
    showToast(`${newOrder.ticker} portföye eklendi ✓`);
  }, [form, storeKey]);

  // Close order
  const handleClose = useCallback(async (id: string) => {
    const exitPrice = parseFloat(closeForm.exitPrice);
    if (!exitPrice) return;
    const store = await loadStore(storeKey);
    store.orders = (store.orders ?? []).map(o =>
      o.id === id ? { ...o, status: "closed", exitPrice, exitDate: closeForm.exitDate } : o
    );
    await saveStore(storeKey, store);
    setOrders(store.orders);
    setClosingId(null);
    setCloseForm({ exitPrice: "", exitDate: new Date().toISOString().slice(0, 10) });
    showToast("Pozisyon kapatıldı ✓");
  }, [closeForm, storeKey]);

  // Remove order
  const handleRemove = useCallback(async (id: string) => {
    const store = await loadStore(storeKey);
    store.orders = (store.orders ?? []).filter(o => o.id !== id);
    await saveStore(storeKey, store);
    setOrders(store.orders);
    showToast("Emir silindi");
  }, [storeKey]);

  // ── PnL calculations ─────────────────────────────────────────────────────

  const calcPnL = (order: Order) => {
    const live = prices[order.ticker];
    if (order.status === "closed" && order.exitPrice) {
      const realizedTotal = (order.exitPrice - order.entryPrice) * order.quantity;
      const realizedPct = ((order.exitPrice - order.entryPrice) / order.entryPrice) * 100;
      return { total: realizedTotal, totalPct: realizedPct, daily: 0, dailyPct: 0, weekly: 0, monthly: 0, realized: true };
    }
    if (!live) return { total: 0, totalPct: 0, daily: 0, dailyPct: 0, weekly: 0, monthly: 0, realized: false };
    const totalPct = ((live.current - order.entryPrice) / order.entryPrice) * 100;
    const total = (live.current - order.entryPrice) * order.quantity;
    const dailyPct = live.change_pct ?? 0;
    const daily = (live.prev_close > 0 ? (live.current - live.prev_close) : 0) * order.quantity;
    const weeklyPct = live.change_pct_1w ?? 0;
    const weekly = order.entryPrice * order.quantity * weeklyPct / 100;
    const monthlyPct = live.change_pct_1m ?? 0;
    const monthly = order.entryPrice * order.quantity * monthlyPct / 100;
    return { total, totalPct, daily, dailyPct, weekly, monthly, realized: false };
  };

  // Portfolio aggregates
  const openOrders = orders.filter(o => o.status === "open");
  const closedOrders = orders.filter(o => o.status === "closed");

  const aggDaily   = openOrders.reduce((s, o) => s + (calcPnL(o).daily ?? 0), 0);
  const aggTotal   = openOrders.reduce((s, o) => s + (calcPnL(o).total ?? 0), 0);
  const aggWeekly  = openOrders.reduce((s, o) => s + (calcPnL(o).weekly ?? 0), 0);
  const aggMonthly = openOrders.reduce((s, o) => s + (calcPnL(o).monthly ?? 0), 0);
  const totalCost  = openOrders.reduce((s, o) => s + o.totalCost, 0);
  const realizedPnL = closedOrders.reduce((s, o) => {
    if (o.exitPrice) return s + (o.exitPrice - o.entryPrice) * o.quantity;
    return s;
  }, 0);
  const ytdPnL = aggTotal + realizedPnL;
  const annualPct = totalCost > 0 ? (aggTotal / totalCost) * 100 * (365 / Math.max(1, openOrders.reduce((mx, o) => {
    const days = (Date.now() - new Date(o.entryDate).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(mx, days);
  }, 1))) : 0;

  const inputStyle: CSSProperties = {
    background: "#0d1117", border: "1px solid #30363d", color: "#e6edf3",
    padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace",
    width: "100%", outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "20px 16px 60px", color: "#e6edf3" }}>

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
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/admin/portfolio/tracker" style={{ color: "#8b949e", fontSize: 11, textDecoration: "none" }}>← Tracker</Link>
            <span style={{ color: "#30363d" }}>/</span>
            <Link href={`/preorder/${type}`} style={{ color: "#8b949e", fontSize: 11, textDecoration: "none" }}>Pre-Order</Link>
            <span style={{ color: "#30363d" }}>/</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: typeColor }}>
              {typeLabel} Portföy
            </span>
          </div>
          <div style={{ fontSize: 12, color: "#8b949e" }}>Canlı portföy takibi — günlük ve kümülatif PnL istatistikleri</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/preorder/${type}`} style={{
            padding: "7px 14px", borderRadius: 6, fontSize: 11, fontWeight: 700,
            background: "transparent", border: "1px solid #30363d", color: "#8b949e",
            textDecoration: "none",
          }}>
            ← Liste
          </Link>
          {!isReadonly && (
            <button
              onClick={() => setShowForm(v => !v)}
              style={{
                padding: "7px 18px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: showForm ? "#161b22" : `${typeColor}20`,
                border: `1px solid ${typeColor}66`, color: typeColor,
              }}
            >
              {showForm ? "İptal" : "+ Yeni Emir"}
            </button>
          )}
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 10, marginBottom: 20, background: "#161b22", border: "1px solid #30363d", borderRadius: 8, padding: "14px 16px",
        }}>
          {[
            { label: "Günlük PnL",      val: aggDaily,    dollar: true },
            { label: "Haftalık PnL",    val: aggWeekly,   dollar: true },
            { label: "Aylık PnL",       val: aggMonthly,  dollar: true },
            { label: "Toplam PnL",      val: aggTotal,    dollar: true },
            { label: "YTD PnL",         val: ytdPnL,      dollar: true },
            { label: "Gerçekleşen PnL", val: realizedPnL, dollar: true },
            { label: "Açık Pozisyon",   val: openOrders.length, dollar: false },
            { label: "Toplam Maliyet",  val: totalCost,   dollar: true },
          ].map(({ label, val, dollar }) => (
            <div key={label}>
              <div style={{ fontSize: 9, color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>{label}</div>
              <div style={{
                fontSize: dollar ? 16 : 24, fontWeight: 700, fontFamily: "monospace",
                color: dollar ? pctColor(val as number) : typeColor,
              }}>
                {dollar ? fmtM(val as number) : String(val)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {showForm && !isReadonly && (
        <div style={{ background: "#161b22", border: `1px solid ${typeColor}44`, borderRadius: 8, padding: "16px", marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 14 }}>
            Yeni {typeLabel} Emri
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
            {[
              { label: "Ticker *", key: "ticker", type: "text", placeholder: "AAPL" },
              { label: "Giriş Tarihi *", key: "entryDate", type: "date", placeholder: "" },
              { label: "Giriş Fiyatı *", key: "entryPrice", type: "number", placeholder: "195.50" },
              { label: "Lot / Adet *", key: "quantity", type: "number", placeholder: "100" },
              { label: "Stop Fiyatı", key: "stopPrice", type: "number", placeholder: "185.00" },
              { label: "Hedef 1", key: "target1", type: "number", placeholder: "210.00" },
              { label: "Hedef 2", key: "target2", type: "number", placeholder: "225.00" },
            ].map(({ label, key, type: t, placeholder }) => (
              <div key={key}>
                <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 4 }}>{label}</div>
                <input
                  type={t}
                  value={(form as any)[key]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ gridColumn: "1 / -1" }}>
              <div style={{ fontSize: 10, color: "#8b949e", marginBottom: 4 }}>Not</div>
              <input
                type="text"
                value={form.notes as string}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Opsiyonel not…"
                style={inputStyle}
              />
            </div>
          </div>
          {form.entryPrice && form.quantity && (
            <div style={{ marginTop: 10, fontSize: 11, color: "#8b949e" }}>
              Toplam Maliyet: <span style={{ color: "#e3b341", fontWeight: 700, fontFamily: "monospace" }}>
                ${(parseFloat(form.entryPrice as string || "0") * parseFloat(form.quantity as string || "0")).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={saving || !form.ticker || !form.entryPrice || !form.quantity}
              style={{
                padding: "8px 22px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: `${typeColor}20`, border: `1px solid ${typeColor}`, color: typeColor,
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "Kaydediliyor…" : "Ekle"}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: "8px 16px", borderRadius: 6, cursor: "pointer", fontSize: 12, background: "transparent", border: "1px solid #30363d", color: "#8b949e" }}>
              İptal
            </button>
          </div>
        </div>
      )}

      {/* Orders table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#8b949e" }}>Yükleniyor…</div>
      ) : orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "#161b22", border: "1px solid #30363d", borderRadius: 10 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#c9d1d9", marginBottom: 8 }}>Portföy boş</div>
          <div style={{ fontSize: 13, color: "#8b949e" }}>Pre-Order listesinden "Emir Aç" butonunu kullan veya yukarıdan ekle.</div>
        </div>
      ) : (
        <>
          {/* Open orders */}
          {openOrders.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                Açık Pozisyonlar ({openOrders.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #30363d" }}>
                      {["TICKER", "GİRİŞ TARİHİ", "GİRİŞ", "GÜNCEL", "LOT", "MALİYET", "G.DEĞ.", "TOP. PnL", "HAFTALıK", "AYLIK", "STOP", "İŞLEM"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: h === "TICKER" ? "left" : "right", fontWeight: 900, fontSize: 10, color: "#8b949e" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openOrders.map(order => {
                      const live = prices[order.ticker];
                      const pnl = calcPnL(order);
                      const currentPrice = live?.current ?? order.entryPrice;
                      const stopPct = order.stopPrice > 0 ? ((currentPrice - order.stopPrice) / order.stopPrice) * 100 : 0;
                      return (
                        <tr key={order.id} style={{ borderBottom: "1px solid #21262d", background: pnl.totalPct >= 0 ? "#0a1a0a" : "#1a0a0a" }}>
                          <td style={{ padding: "9px 10px", textAlign: "left" }}>
                            <Link href={`/preorder/${order.ticker}`} style={{ fontWeight: 900, fontFamily: "monospace", color: typeColor, textDecoration: "none" }}>
                              {order.ticker}
                            </Link>
                            {order.notes && <div style={{ fontSize: 10, color: "#8b949e", marginTop: 2 }}>{order.notes}</div>}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                            {new Date(order.entryDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#8b949e" }}>
                            ${fmt2(order.entryPrice)}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 700, color: "#e6edf3" }}>
                            {live ? `$${fmt2(currentPrice)}` : "—"}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#c9d1d9" }}>
                            {order.quantity}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace", color: "#8b949e" }}>
                            ${formatNumber(order.totalCost / 1000, 1)}K
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: pctColor(pnl.dailyPct) }}>
                            {live ? `${pnl.dailyPct >= 0 ? "+" : ""}${fmt2(pnl.dailyPct)}%` : "—"}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700 }}>
                            <div style={{ color: pctColor(pnl.totalPct) }}>{live ? `${pnl.totalPct >= 0 ? "+" : ""}${fmt1(pnl.totalPct)}%` : "—"}</div>
                            {live && <div style={{ fontSize: 10, color: pctColor(pnl.total) }}>{fmtM(pnl.total)}</div>}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: pctColor(pnl.weekly) }}>
                            {live && isFinite(pnl.weekly) ? fmtM(pnl.weekly) : "—"}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, color: pctColor(pnl.monthly) }}>
                            {live && isFinite(pnl.monthly) ? fmtM(pnl.monthly) : "—"}
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right", fontFamily: "monospace" }}>
                            <span style={{ color: stopPct < -10 ? "#f85149" : stopPct < -5 ? "#e3b341" : "#3fb950", fontSize: 11 }}>
                              ${fmt2(order.stopPrice)}
                            </span>
                            <div style={{ fontSize: 9, color: pctColor(stopPct) }}>{fmt1(stopPct)}%</div>
                          </td>
                          <td style={{ padding: "9px 10px", textAlign: "right" }}>
                            {isReadonly ? null : closingId === order.id ? (
                              <div style={{ display: "flex", gap: 4, flexWrap: "nowrap", alignItems: "center" }}>
                                <input
                                  type="number"
                                  placeholder="Çıkış fiyatı"
                                  value={closeForm.exitPrice}
                                  onChange={e => setCloseForm(prev => ({ ...prev, exitPrice: e.target.value }))}
                                  style={{ ...inputStyle, width: 80, padding: "3px 6px" }}
                                />
                                <button onClick={() => handleClose(order.id)} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 3, background: "#3fb95020", border: "1px solid #3fb950", color: "#3fb950", cursor: "pointer" }}>✓</button>
                                <button onClick={() => setClosingId(null)} style={{ fontSize: 10, padding: "3px 6px", borderRadius: 3, background: "transparent", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer" }}>✕</button>
                              </div>
                            ) : (
                              <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                                <button onClick={() => setClosingId(order.id)} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 3, background: "#e3b34120", border: "1px solid #e3b34166", color: "#e3b341", cursor: "pointer" }}>
                                  Kapat
                                </button>
                                <button onClick={() => handleRemove(order.id)} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "transparent", border: "1px solid #f8514944", color: "#f85149", cursor: "pointer" }}>
                                  ✕
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Closed orders */}
          {closedOrders.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, color: "#8b949e", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>
                Kapatılan Pozisyonlar ({closedOrders.length})
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #30363d" }}>
                      {["TICKER", "GİRİŞ TARİHİ", "ÇIKIŞ TARİHİ", "GİRİŞ", "ÇIKIŞ", "LOT", "GER. PnL", "GER. PnL%", "İŞLEM"].map(h => (
                        <th key={h} style={{ padding: "7px 10px", textAlign: h === "TICKER" ? "left" : "right", fontWeight: 900, fontSize: 10, color: "#8b949e" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {closedOrders.map(order => {
                      const pnl = calcPnL(order);
                      return (
                        <tr key={order.id} style={{ borderBottom: "1px solid #21262d", opacity: 0.7 }}>
                          <td style={{ padding: "8px 10px", fontFamily: "monospace", fontWeight: 700, color: "#8b949e" }}>{order.ticker}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                            {new Date(order.entryDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", color: "#8b949e", fontSize: 11 }}>
                            {order.exitDate ? new Date(order.exitDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "2-digit" }) : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#8b949e" }}>${fmt2(order.entryPrice)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#c9d1d9" }}>{order.exitPrice ? `$${fmt2(order.exitPrice)}` : "—"}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", color: "#8b949e" }}>{order.quantity}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: pctColor(pnl.total) }}>{fmtM(pnl.total)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: pctColor(pnl.totalPct) }}>{fmt1(pnl.totalPct)}%</td>
                          <td style={{ padding: "8px 10px", textAlign: "right" }}>
                            {!isReadonly && (
                              <button onClick={() => handleRemove(order.id)} style={{ fontSize: 10, padding: "2px 6px", borderRadius: 3, background: "transparent", border: "1px solid #30363d", color: "#8b949e", cursor: "pointer" }}>
                                Sil
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
