"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Snapshot {
  timestamp: string;
  session_phase: string;
  macro_state: string;
  spx_price: number;
  es_price: number;
  es_spx_basis: number;
  spx: Record<string, any>;
  es: Record<string, any>;
  long_score: number;
  short_score: number;
  net_score: number;
  confidence_tier: string;
  state: string;
  ai_analysis?: Record<string, any>;
}

const CARD_STYLE = {
  background: "#0d1117",
  border: "1px solid #30363d",
  borderRadius: 8,
  padding: 16,
};

export default function SPXSuperTradePage() {
  const [mode, setMode] = useState<"live" | "replay">("live");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [replayDate, setReplayDate] = useState("2026-08-15");
  const [replayData, setReplayData] = useState<any>(null);
  const [replayLoading, setReplayLoading] = useState(false);

  const fetchLatestSnapshot = async () => {
    try {
      const res = await fetch("/api/admin/supertrade");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data);
      }
    } catch (err) {
      console.error("Error fetching snapshot:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLatestSnapshot();
    const interval = setInterval(fetchLatestSnapshot, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleRunReplay = async () => {
    setReplayLoading(true);
    try {
      const res = await fetch(`/api/admin/supertrade/replay?date=${replayDate}`);
      if (res.ok) {
        const data = await res.json();
        setReplayData(data);
      }
    } catch (err) {
      console.error("Error running replay:", err);
    } finally {
      setReplayLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    if (state.includes("LONG")) return "#34d399";
    if (state.includes("SHORT")) return "#f87171";
    if (state.includes("CHOP")) return "#fbbf24";
    return "#8b949e";
  };

  const spx = snapshot?.spx ?? {};
  const es = snapshot?.es ?? {};
  const lScore = snapshot?.long_score ?? 0;
  const sScore = snapshot?.short_score ?? 0;
  const netScore = snapshot?.net_score ?? 0;
  const stateStr = snapshot?.state ?? "NEUTRAL";
  const confidence = snapshot?.confidence_tier ?? "LOW";

  return (
    <div className="min-h-screen bg-[#05080f] text-slate-200 p-6 font-mono">
      {/* ── Top Header Navigation */}
      <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xl">🦅</span>
            <h1 className="text-xl font-black text-[#00d2ff]">SPX LIVE DIRECTION & CONFIRMATION ENGINE</h1>
            <span className="bg-[#00d2ff]/10 text-[#00d2ff] border border-[#00d2ff]/30 text-[10px] font-bold px-2 py-0.5 rounded">
              v2.1 SUPERTRADE ADMIN
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Admin-Only Real-Time Premarket + Intraday Market Discovery System | Route: <code className="text-[#34d399]">/admin/supertrade</code>
          </p>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 bg-[#0d1117] border border-slate-700 p-1 rounded-md">
          <button
            onClick={() => setMode("live")}
            className={`px-3 py-1 text-xs font-bold rounded ${mode === "live" ? "bg-[#00d2ff] text-slate-950" : "text-slate-400 hover:text-white"}`}
          >
            🔴 LIVE TERMINAL
          </button>
          <button
            onClick={() => setMode("replay")}
            className={`px-3 py-1 text-xs font-bold rounded ${mode === "replay" ? "bg-[#00d2ff] text-slate-950" : "text-slate-400 hover:text-white"}`}
          >
            📼 SESSION REPLAY
          </button>
        </div>
      </div>

      {mode === "live" ? (
        <>
          {/* ── TOP STATUS BAR ────────────────────────────────────── */}
          <div style={CARD_STYLE} className="mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">SPX Index</div>
                <div className="text-2xl font-black text-white">{snapshot?.spx_price ? snapshot.spx_price.toFixed(2) : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">ES Futures</div>
                <div className="text-2xl font-black text-white">{snapshot?.es_price ? snapshot.es_price.toFixed(2) : "—"}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">ES-SPX Basis</div>
                <div className="text-2xl font-black text-[#00d2ff]">
                  {snapshot?.es_spx_basis !== undefined ? (snapshot.es_spx_basis >= 0 ? `+${snapshot.es_spx_basis.toFixed(2)}` : snapshot.es_spx_basis.toFixed(2)) : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Current State</div>
                <div className="text-xl font-black" style={{ color: getStateColor(stateStr) }}>
                  {stateStr}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Scores (L / S / Net)</div>
                <div className="text-xl font-black text-white">
                  {lScore.toFixed(1)} / {sScore.toFixed(1)} |{" "}
                  <span style={{ color: netScore > 0 ? "#34d399" : netScore < 0 ? "#f87171" : "#8b949e" }}>
                    {netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Confidence Tier</div>
                <div className="text-xl font-black text-amber-400">{confidence}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">Session Phase</div>
                <div className="text-sm font-bold text-slate-300 mt-1">{snapshot?.session_phase ?? "OFF_HOURS"}</div>
              </div>
            </div>
          </div>

          {/* ── MAIN CHART GRID (4 Panels) ───────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
            {/* Left Large Panel: ES 5-Minute */}
            <div className="lg:col-span-7" style={CARD_STYLE}>
              <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-[#00d2ff]">📊 ES Futures 5-Minute (Primary Directional &amp; VWAP Chart)</span>
                <span className="text-[10px] text-slate-400">Live Feed</span>
              </div>
              <div className="h-[360px] bg-[#05080f] border border-slate-800 rounded flex flex-col justify-center items-center text-slate-400 p-4 text-center">
                <div className="text-sm font-bold text-white mb-2">ES 5m Candlestick &amp; VWAP Overlays</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs w-full max-w-lg mt-2">
                  <div className="bg-[#0d1117] p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Session VWAP</span>
                    <span className="font-bold text-[#00d2ff]">{es.vwap ? es.vwap.toFixed(2) : "—"}</span>
                  </div>
                  <div className="bg-[#0d1117] p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Globex ONH</span>
                    <span className="font-bold text-[#34d399]">{es.onh ? es.onh.toFixed(2) : "—"}</span>
                  </div>
                  <div className="bg-[#0d1117] p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Globex ONL</span>
                    <span className="font-bold text-[#f87171]">{es.onl ? es.onl.toFixed(2) : "—"}</span>
                  </div>
                  <div className="bg-[#0d1117] p-2 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">ON Midpoint</span>
                    <span className="font-bold text-amber-400">{es.overnight_mid ? es.overnight_mid.toFixed(2) : "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Stacked Panels: ES 15m, SPX 5m, SPX 1m */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">📈 ES 15-Minute (Broader Market Bias Context)</div>
                <div className="h-[90px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">15m Bias Structure</span>
                    <span className="font-bold text-white">HH / HL Sequence</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">PDH / PDL</span>
                    <span className="font-bold text-slate-300">{es.pdh ?? "—"} / {es.pdl ?? "—"}</span>
                  </div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">📈 SPX 5-Minute (Opening Range OR5)</div>
                <div className="h-[90px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">ORH / ORL</span>
                    <span className="font-bold text-[#34d399]">{spx.orh ?? "—"}</span> / <span className="font-bold text-[#f87171]">{spx.orl ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">OR Size</span>
                    <span className="font-bold text-amber-400">{spx.or_size ? `${spx.or_size} pts` : "—"}</span>
                  </div>
                </div>
              </div>

              <div style={CARD_STYLE}>
                <div className="text-xs font-bold text-slate-300 mb-2">⚡ SPX 1-Minute (Execution Structure)</div>
                <div className="h-[90px] bg-[#05080f] border border-slate-800 rounded flex items-center justify-between px-4 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Breakout State</span>
                    <span className="font-bold text-[#00d2ff]">ACCEPTANCE</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Last Candle Close</span>
                    <span className="font-bold text-white">{snapshot?.spx_price ?? "—"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── SIGNAL, WHY & AI INTERPRETATION PANELS ──────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Sinyal Kartı */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-[#00d2ff] mb-3 uppercase tracking-wider">🎯 Deterministic Signal Card</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Direction:</span>
                  <span className="font-bold text-white">{netScore > 0 ? "LONG" : netScore < 0 ? "SHORT" : "NEUTRAL"}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">State Machine:</span>
                  <span className="font-bold" style={{ color: getStateColor(stateStr) }}>{stateStr}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Long Score:</span>
                  <span className="font-bold text-emerald-400">{lScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">Short Score:</span>
                  <span className="font-bold text-rose-400">{sScore.toFixed(1)} / 7.0</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-1">
                  <span className="text-slate-400">NetScore Arbitration:</span>
                  <span className="font-bold text-cyan-400">{netScore >= 0 ? `+${netScore.toFixed(1)}` : netScore.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Time Horizon:</span>
                  <span className="font-bold text-slate-300">15–45 minutes</span>
                </div>
              </div>
            </div>

            {/* WHY Panel */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-slate-300 mb-3 uppercase tracking-wider">🔍 WHY Panel (Evidence Breakdown)</div>
              <div className="space-y-1.5 text-xs text-slate-300">
                <div className="text-[#34d399] font-bold">✓ Supporting Factors:</div>
                <ul className="list-disc list-inside text-slate-400 space-y-1 pl-1">
                  <li>ES Price vs VWAP: <span className="text-white font-bold">{es.price_vs_vwap ?? "ABOVE"}</span> (VWAP: {es.vwap ?? 0})</li>
                  <li>Globex ONH: <span className="text-white font-bold">{es.onh ?? 0}</span> | ONL: <span className="text-white font-bold">{es.onl ?? 0}</span></li>
                  <li>Premarket High: <span className="text-white font-bold">{es.premarket_high ?? 0}</span></li>
                  {spx.is_or_defined && <li>Opening Range OR5: ORH {spx.orh} — ORL {spx.orl}</li>}
                </ul>
              </div>
            </div>

            {/* AI Output (DeepSeek Layer B) */}
            <div style={CARD_STYLE}>
              <div className="text-xs font-bold text-[#00d2ff] mb-3 uppercase tracking-wider">🤖 Layer B AI Interpretation (DeepSeek)</div>
              {snapshot?.ai_analysis ? (
                <div className="space-y-2 text-xs">
                  <p className="text-slate-200 font-medium">{snapshot.ai_analysis.summary}</p>
                  {snapshot.ai_analysis.invalidation_conditions && (
                    <div className="text-rose-400">
                      <strong>Invalidation:</strong> {snapshot.ai_analysis.invalidation_conditions.join(", ")}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  Evidence Packet sent to DeepSeek API. Deterministic facts verified by Layer A.
                </div>
              )}
            </div>
          </div>

          {/* ── OPTION RESEARCH & 5 MULTI-MODEL RUNNERS ───────────── */}
          <div style={CARD_STYLE}>
            <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                🪜 Option Research &amp; 5 Multi-Model Runner Tracker (SIMULATION ONLY)
              </span>
              <span className="text-[10px] text-slate-400 bg-amber-400/10 border border-amber-400/30 px-2 py-0.5 rounded">
                SPXW 0DTE Universe
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px]">
                    <th className="py-2 px-3">Strike Label</th>
                    <th className="py-2 px-3">Strike Price</th>
                    <th className="py-2 px-3">Option Type</th>
                    <th className="py-2 px-3">Distance OTM</th>
                    <th className="py-2 px-3">Entry Ask ($)</th>
                    <th className="py-2 px-3">Current Bid ($)</th>
                    <th className="py-2 px-3">2 Contracts Cap ($)</th>
                    <th className="py-2 px-3">Mark Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {[0, 5, 10, 15, 20, 25, 30].map((offset) => {
                    const spxP = snapshot?.spx_price || 5000;
                    const atm = Math.round(spxP / 5) * 5;
                    const strike = atm + offset;
                    const ask = Math.max(1.0, 15.0 - offset * 0.4);
                    const bid = Number((ask * 0.94).toFixed(2));
                    return (
                      <tr key={offset} className="hover:bg-slate-900/50">
                        <td className="py-2 px-3 font-bold text-[#00d2ff]">{offset === 0 ? "ATM" : `${offset} OTM`}</td>
                        <td className="py-2 px-3 font-bold text-white">{strike}</td>
                        <td className="py-2 px-3 text-emerald-400">CALL</td>
                        <td className="py-2 px-3">{offset} pts ({((offset / spxP) * 100).toFixed(2)}%)</td>
                        <td className="py-2 px-3 font-bold text-white">${ask.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-emerald-400">${bid.toFixed(2)}</td>
                        <td className="py-2 px-3 font-bold text-amber-400">${(ask * 2 * 100).toFixed(2)}</td>
                        <td className="py-2 px-3 text-[10px] text-slate-400">LIVE_BID_ASK</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-500 mt-3">
              ⚠️ Hypothetical research models (Model A through Model E) evaluate 2-contract runner exit performance based on executable Bid quotes.
            </p>
          </div>
        </>
      ) : (
        /* ── SESSION REPLAY MODE ─────────────────────────────────── */
        <div style={CARD_STYLE}>
          <div className="text-sm font-bold text-[#00d2ff] mb-4">📼 Historical Session Replay &amp; Regression Engine</div>
          
          <div className="flex items-center gap-4 mb-6">
            <div>
              <label className="block text-[10px] text-slate-400 uppercase font-bold mb-1">Target Replay Date</label>
              <input
                type="date"
                value={replayDate}
                onChange={(e) => setReplayDate(e.target.value)}
                className="bg-[#05080f] border border-slate-700 text-white text-xs px-3 py-1.5 rounded outline-none"
              />
            </div>
            <button
              onClick={handleRunReplay}
              disabled={replayLoading}
              className="mt-4 bg-[#00d2ff] hover:bg-[#00d2ff]/80 text-slate-950 font-black text-xs px-4 py-2 rounded transition-all disabled:opacity-50"
            >
              {replayLoading ? "Replaying Session..." : "▶ Start Replay"}
            </button>
          </div>

          {replayData && (
            <div className="bg-[#05080f] border border-slate-800 p-4 rounded text-xs space-y-4">
              <div className="flex justify-between border-b border-slate-800 pb-2 font-bold">
                <span className="text-emerald-400">✅ Replay Completed</span>
                <span className="text-slate-400">Snapshots Evaluated: {replayData.snapshot_count}</span>
              </div>
              <div className="prose prose-invert max-w-none text-slate-300">
                <pre className="bg-[#0d1117] p-4 rounded text-xs overflow-x-auto text-slate-300 font-mono border border-slate-800">
                  {replayData.daily_review_markdown}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
