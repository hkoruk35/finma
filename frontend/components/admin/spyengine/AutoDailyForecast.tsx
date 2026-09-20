"use client";

/**
 * SPY Engine — Otomatik Günlük Tahmin paneli (Daily Forecast sekmesi üstü).
 *
 * Şimdiki/sonraki NY seansının 09:30–16:00 en-olası saatlik yolunu çoklu
 * kaynaktan üretir (ES=F + Kalshi + VIX + NASDAQ + 15m EMA21/VWAP yapısı) ve
 * mumlu grafikte gösterir; seans açıksa gerçekleşen 30dk mumları üstüne biner.
 * Her 15m mum kapanışında otomatik yenilenir. Bu bir TAHMİNDİR, ölçüm değil.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart, CandlestickSeries, CrosshairMode,
  type IChartApi, type ISeriesApi, type Time,
} from "lightweight-charts";
import { Panel } from "./panels";
import { nyClock } from "@/lib/spyengine/core";

interface Vote {
  key: string;
  label: string;
  direction: "YUKARI" | "AŞAĞI" | "NÖTR";
  detail: string;
}
interface Bar { time: number; open: number; high: number; low: number; close: number; }
interface ForecastResp {
  ok: boolean;
  error?: string;
  targetDate?: string;
  marketOpen?: boolean;
  spyPrevClose?: number;
  spySpot?: number | null;
  forecast?: {
    openEstimate: number; closeTarget: number; expectedRangePct: number;
    direction: "YUKARI" | "AŞAĞI" | "NÖTR"; confidence: number; narrative: string; votes: Vote[];
  };
  kalshi?: { eventTicker: string; impliedCloseSpx: number | null; impliedCloseSpy: number | null } | null;
  inputs?: { esChangePct: number | null; vix: number | null; nasdaqChangePct: number | null; ema21Slope: number | null; aboveVwap: boolean | null; atr15m: number | null };
  path?: Bar[];
  actual?: Bar[];
}

const C_UP = "#22c55e", C_DOWN = "#ef4444", C_ACT_UP = "#38bdf8", C_ACT_DOWN = "#0ea5e9";

function secsToNext15m(): number {
  const span = 15 * 60 * 1000;
  return Math.ceil((span - (Date.now() % span)) / 1000);
}

const dirTone = (d: string) => (d === "YUKARI" ? "text-[#22c55e]" : d === "AŞAĞI" ? "text-[#ef4444]" : "text-slate-400");
const dirArrow = (d: string) => (d === "YUKARI" ? "▲" : d === "AŞAĞI" ? "▼" : "▬");

export default function AutoDailyForecast() {
  const [data, setData] = useState<ForecastResp | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(secsToNext15m());
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const chartRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<IChartApi | null>(null);
  const fRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const aRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const inited = useRef(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/admin/spyengine/v2/daily-forecast", { credentials: "include", cache: "no-store" });
      const json: ForecastResp = await res.json();
      if (!json.ok) throw new Error(json.error || "tahmin alınamadı");
      setData(json);
      setLastFetch(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (!inited.current) { inited.current = true; load(); } }, [load]);

  useEffect(() => {
    const t = setInterval(() => {
      const s = secsToNext15m();
      setCountdown(s);
      if (s >= 15 * 60 - 1) load();
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  // Grafik kurulumu (bir kez)
  useEffect(() => {
    if (!chartRef.current || apiRef.current) return;
    const chart = createChart(chartRef.current, {
      autoSize: true,
      layout: { background: { color: "#0a0e17" }, textColor: "#8b949e", attributionLogo: false },
      grid: { vertLines: { color: "#151c28" }, horzLines: { color: "#151c28" } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1c2635", tickMarkFormatter: (t: Time) => nyClock(t as number) },
      localization: { timeFormatter: (t: Time) => `${nyClock(t as number)} ET`, priceFormatter: (p: number) => p.toFixed(2) },
      rightPriceScale: { borderColor: "#1c2635" },
      height: 360,
    });
    fRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(34,197,94,0.30)", downColor: "rgba(239,68,68,0.30)",
      borderUpColor: C_UP, borderDownColor: C_DOWN, wickUpColor: C_UP, wickDownColor: C_DOWN, title: "Tahmin",
    });
    aRef.current = chart.addSeries(CandlestickSeries, {
      upColor: C_ACT_UP, downColor: C_ACT_DOWN, borderUpColor: C_ACT_UP, borderDownColor: C_ACT_DOWN,
      wickUpColor: C_ACT_UP, wickDownColor: C_ACT_DOWN, title: "Gerçekleşen",
    });
    apiRef.current = chart;
    const ro = new ResizeObserver(() => { if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth }); });
    ro.observe(chartRef.current);
    return () => { ro.disconnect(); chart.remove(); apiRef.current = null; };
  }, []);

  // Veri → grafik
  useEffect(() => {
    if (!fRef.current || !aRef.current) return;
    const f = (data?.path ?? []).map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close }));
    const a = (data?.actual ?? []).map((b) => ({ time: b.time as Time, open: b.open, high: b.high, low: b.low, close: b.close }));
    fRef.current.setData(f);
    aRef.current.setData(a);
    apiRef.current?.timeScale().fitContent();
  }, [data]);

  const cd = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`;
  const fc = data?.forecast;

  return (
    <Panel
      title="Otomatik Günlük Tahmin — 09:30-16:00 ET (en olası senaryo)"
      right={
        <span className="flex items-center gap-2 text-[10px] text-slate-400">
          <span>15m yenile: <b className="font-mono text-slate-200">{cd}</b></span>
          <button onClick={load} disabled={loading} className="rounded border border-[#2a3a52] bg-[#131a26] px-2 py-0.5 text-slate-300 hover:bg-[#1a2434] disabled:opacity-50">
            {loading ? "…" : "yenile"}
          </button>
        </span>
      }
    >
      {error && <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{error}</div>}

      {/* Senaryo özeti */}
      {fc && (
        <div className="mb-2 rounded border border-[#1c2635] bg-[#0f141d] px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="text-slate-500">Hedef seans: <b className="font-mono text-slate-200">{data?.targetDate}</b> {data?.marketOpen ? "(açık)" : "(sonraki)"}</span>
            <span className={`font-bold ${dirTone(fc.direction)}`}>{dirArrow(fc.direction)} {fc.direction}</span>
            <span className="text-slate-400">Güven: <b className="text-slate-200">{fc.confidence}/100</b></span>
            <span className="text-slate-400">Açılış ~<b className="font-mono text-slate-200">{fc.openEstimate.toFixed(2)}</b></span>
            <span className="text-slate-400">Hedef kapanış ~<b className="font-mono text-slate-200">{fc.closeTarget.toFixed(2)}</b></span>
            <span className="text-slate-400">Gün aralığı ~<b className="font-mono text-slate-200">%{(fc.expectedRangePct * 100).toFixed(2)}</b></span>
          </div>
          <div className="mt-1 text-[10px] leading-snug text-slate-500">{fc.narrative}</div>
        </div>
      )}

      {/* Kaynak oyları */}
      {fc && (
        <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {fc.votes.map((v) => (
            <div key={v.key} className="rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1.5">
              <div className="text-[9px] text-slate-500">{v.label}</div>
              <div className={`text-[11px] font-bold ${dirTone(v.direction)}`}>{dirArrow(v.direction)} {v.direction}</div>
              <div className="text-[9px] text-slate-500">{v.detail}</div>
            </div>
          ))}
        </div>
      )}

      {/* Kalshi + endeks şeridi */}
      {data && (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[9.5px] text-slate-500">
          <span>Kalshi ima kapanış (SPY): <b className="font-mono text-slate-300">{data.kalshi?.impliedCloseSpy ?? "—"}</b> {data.kalshi ? `(SPX ${data.kalshi.impliedCloseSpx?.toFixed(0) ?? "—"})` : "(veri yok)"}</span>
          <span>ES=F gece: <b className="font-mono text-slate-300">{data.inputs?.esChangePct == null ? "—" : `${(data.inputs.esChangePct * 100).toFixed(2)}%`}</b></span>
          <span>VIX: <b className="font-mono text-slate-300">{data.inputs?.vix?.toFixed(1) ?? "—"}</b></span>
          <span>NASDAQ: <b className="font-mono text-slate-300">{data.inputs?.nasdaqChangePct == null ? "—" : `${(data.inputs.nasdaqChangePct * 100).toFixed(2)}%`}</b></span>
          <span>15m ATR: <b className="font-mono text-slate-300">{data.inputs?.atr15m ?? "—"}</b></span>
        </div>
      )}

      <div className="mb-1 flex items-center gap-4 text-[10px] text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: C_UP }} /> Tahmin</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: C_ACT_UP }} /> Gerçekleşen</span>
        {lastFetch && <span className="ml-auto text-slate-600">Son güncelleme: {new Date(lastFetch).toLocaleTimeString("tr-TR")}</span>}
      </div>
      <div ref={chartRef} className="w-full" />
      <div className="mt-1 text-[9px] text-slate-600">
        Tahmin çoklu kaynaktan üretilen en-olası tek yoldur (Monte Carlo değil); kesinlik iddiası taşımaz. Kaynak eksikse ilgili oy nötrleşir.
      </div>
    </Panel>
  );
}
