"use client";

/**
 * SPY Engine — Daily Forecast sekmesi.
 *
 * Kullanıcı kendi 5 dakikalık (09:30-16:00 ET) SPY tahminini elle girer
 * (tek kapanış fiyatı ya da tam O/H/L/C mumu), sistem bunu o günün
 * gerçekleşen SPY 5m mumlarıyla karşılaştırıp mumlu grafik + tablo halinde
 * gösterir ve her günü ayrı arşivler. Motor kararına HİÇBİR etkisi yok —
 * sadece kullanıcının kendi tahmin yönteminin isabetini test etmek için.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  createChart, CandlestickSeries, CrosshairMode,
  type IChartApi, type ISeriesApi, type Time,
} from "lightweight-charts";
import { Panel, num, signed, tone } from "./panels";
import { nyDateTimeToEpoch } from "@/lib/spyengine/core";

interface Ohlc {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Row {
  time: string;
  forecast: Ohlc | null;
  actual: Ohlc | null;
  diff: number | null;
  diffPct: number | null;
}

interface ArchiveEntry {
  date: string;
  points: number;
  checked: number;
  avgAbsDiffPct: number | null;
  updatedAt: string;
}

interface RawPoint {
  time: string;
  close: number;
  open?: number;
  high?: number;
  low?: number;
}

function todayEt(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const C_UP = "#22c55e";
const C_DOWN = "#ef4444";
const C_ACTUAL_UP = "#38bdf8";
const C_ACTUAL_DOWN = "#0ea5e9";

/**
 * Satır başına bir nokta parse eder. İki format kabul edilir:
 *   1) "HH:MM,fiyat"                 -> tek kapanış (mum = düz çizgi gibi çizilir)
 *   2) "HH:MM O H L C" (virgül/boşluk/tab ayrılmış 4 değer) -> tam mum
 */
function parseForecastText(text: string): RawPoint[] {
  const out: RawPoint[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[,\t]+|\s+/).map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const time = parts[0];
    if (!/^\d{2}:\d{2}$/.test(time)) continue;
    const nums = parts.slice(1).map(Number);
    if (nums.some((n) => !Number.isFinite(n))) continue;

    if (nums.length >= 4) {
      const [open, high, low, close] = nums;
      out.push({ time, open, high, low, close });
    } else {
      out.push({ time, close: nums[0] });
    }
  }
  return out;
}

function pointsToText(points: RawPoint[]): string {
  return points
    .map((p) =>
      p.open != null && p.high != null && p.low != null
        ? `${p.time} ${p.open} ${p.high} ${p.low} ${p.close}`
        : `${p.time},${p.close}`
    )
    .join("\n");
}

export default function DailyForecast() {
  const [date, setDate] = useState(todayEt());
  const [rows, setRows] = useState<Row[]>([]);
  const [checked, setChecked] = useState(0);
  const [avgAbsDiffPct, setAvgAbsDiffPct] = useState<number | null>(null);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [archive, setArchive] = useState<ArchiveEntry[]>([]);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const actualSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  const load = useCallback(async (d: string) => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/spyengine/v2/manual-forecast?date=${d}`, { credentials: "include" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "yüklenemedi");
      setRows(json.rows ?? []);
      setChecked(json.checked ?? 0);
      setAvgAbsDiffPct(json.avgAbsDiffPct ?? null);
      setTextInput(pointsToText(json.points ?? []));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadArchive = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/spyengine/v2/manual-forecast`, { credentials: "include" });
      const json = await res.json();
      if (json.ok) setArchive(json.sessions ?? []);
    } catch {
      // arşiv listesi ikincil — sessizce geç
    }
  }, []);

  useEffect(() => {
    load(date);
  }, [date, load]);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  // ── Grafik kurulumu ────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || chartApiRef.current) return;
    const chart = createChart(chartRef.current, {
      layout: { background: { color: "#0a0e17" }, textColor: "#8b949e" },
      grid: { vertLines: { color: "#151c28" }, horzLines: { color: "#151c28" } },
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: "#1c2635" },
      rightPriceScale: { borderColor: "#1c2635" },
      height: 320,
    });
    forecastSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: "rgba(34,197,94,0.35)", downColor: "rgba(239,68,68,0.35)",
      borderUpColor: C_UP, borderDownColor: C_DOWN,
      wickUpColor: C_UP, wickDownColor: C_DOWN,
      title: "Tahmin",
    });
    actualSeriesRef.current = chart.addSeries(CandlestickSeries, {
      upColor: C_ACTUAL_UP, downColor: C_ACTUAL_DOWN,
      borderUpColor: C_ACTUAL_UP, borderDownColor: C_ACTUAL_DOWN,
      wickUpColor: C_ACTUAL_UP, wickDownColor: C_ACTUAL_DOWN,
      title: "Gerçekleşen",
    });
    chartApiRef.current = chart;
    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);
    return () => {
      ro.disconnect();
      chart.remove();
      chartApiRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!forecastSeriesRef.current || !actualSeriesRef.current) return;
    const fPts = rows
      .filter((r) => r.forecast != null)
      .map((r) => ({ time: nyDateTimeToEpoch(date, hhmmToMin(r.time)) as Time, ...(r.forecast as Ohlc) }));
    const aPts = rows
      .filter((r) => r.actual != null)
      .map((r) => ({ time: nyDateTimeToEpoch(date, hhmmToMin(r.time)) as Time, ...(r.actual as Ohlc) }));
    forecastSeriesRef.current.setData(fPts);
    actualSeriesRef.current.setData(aPts);
    chartApiRef.current?.timeScale().fitContent();
  }, [rows, date]);

  const save = async () => {
    const points = parseForecastText(textInput);
    if (!points.length) {
      setMsg("Geçerli satır bulunamadı. Format: \"HH:MM,fiyat\" veya \"HH:MM açılış yüksek düşük kapanış\"");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/spyengine/v2/manual-forecast`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, points }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error || "kaydedilemedi");
      setMsg(`✓ ${json.points} nokta kaydedildi.`);
      await load(date);
      await loadArchive();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="grid grid-cols-1 gap-1 lg:grid-cols-3">
        <Panel title="Tahmin Girişi" className="lg:col-span-1">
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[10px] text-slate-400">
              Seans tarihi
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded border border-[#1c2635] bg-[#0b0f18] px-1.5 py-1 text-[10px] text-slate-200"
              />
            </label>

            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={"HH:MM,fiyat\nveya\nHH:MM açılış yüksek düşük kapanış\n\n09:30,767.50\n09:35 767.80 768.10 767.60 768.00\n..."}
              rows={16}
              className="w-full rounded border border-[#1c2635] bg-[#0b0f18] p-2 font-mono text-[10px] text-slate-200"
            />

            <button
              type="button"
              onClick={save}
              disabled={loading}
              className="rounded bg-[#0e7490] px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-[#0891b2] disabled:opacity-50"
            >
              {loading ? "Kaydediliyor…" : "Güncelle"}
            </button>
            {msg && <div className="text-[10px] text-slate-400">{msg}</div>}
          </div>
        </Panel>

        <Panel title="Tahmin vs Gerçekleşen — 09:30-16:00 (mumlu)" className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-4 text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: C_UP }} /> Tahmin
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: C_ACTUAL_UP }} /> Gerçekleşen
            </span>
            {avgAbsDiffPct != null && (
              <span className="ml-auto">
                Ort. mutlak sapma: <b className={tone(-avgAbsDiffPct)}>%{num(avgAbsDiffPct, 2)}</b> ({checked} nokta karşılaştırıldı)
              </span>
            )}
          </div>
          <div ref={chartRef} className="w-full" />
        </Panel>
      </div>

      <Panel title="Kritik İzleme Noktaları — Tahmin / Gerçekleşen / Fark">
        <div className="max-h-96 overflow-y-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="sticky top-0 bg-[#0f141d] text-slate-500">
              <tr className="border-b border-[#1c2635]">
                <th className="px-2 py-1 text-left">Saat</th>
                <th className="px-2 py-1 text-right">Tahmin (C)</th>
                <th className="px-2 py-1 text-right">Gerçekleşen (C)</th>
                <th className="px-2 py-1 text-right">Fark</th>
                <th className="px-2 py-1 text-right">Fark %</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-4 text-center text-slate-600">
                    Bu tarih için tahmin verisi yok.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.time} className="border-b border-[#151c28] text-slate-300">
                  <td className="px-2 py-1">{r.time}</td>
                  <td className="px-2 py-1 text-right">{r.forecast == null ? "—" : num(r.forecast.close)}</td>
                  <td className="px-2 py-1 text-right">{r.actual == null ? "—" : num(r.actual.close)}</td>
                  <td className={`px-2 py-1 text-right ${tone(r.diff)}`}>{signed(r.diff)}</td>
                  <td className={`px-2 py-1 text-right ${tone(r.diffPct)}`}>{r.diffPct == null ? "—" : `${signed(r.diffPct, 2)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Arşiv — Geçmiş Günler">
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full font-mono text-[10px]">
            <thead className="sticky top-0 bg-[#0f141d] text-slate-500">
              <tr className="border-b border-[#1c2635]">
                <th className="px-2 py-1 text-left">Tarih</th>
                <th className="px-2 py-1 text-right">Nokta</th>
                <th className="px-2 py-1 text-right">Karşılaştırılan</th>
                <th className="px-2 py-1 text-right">Ort. Mutlak Sapma</th>
              </tr>
            </thead>
            <tbody>
              {archive.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-4 text-center text-slate-600">Henüz arşivlenmiş tahmin yok.</td>
                </tr>
              )}
              {archive.map((a) => (
                <tr
                  key={a.date}
                  onClick={() => setDate(a.date)}
                  className={`cursor-pointer border-b border-[#151c28] hover:bg-[#111827] ${a.date === date ? "bg-[#111827] text-slate-100" : "text-slate-300"}`}
                >
                  <td className="px-2 py-1">{a.date}</td>
                  <td className="px-2 py-1 text-right">{a.points}</td>
                  <td className="px-2 py-1 text-right">{a.checked}</td>
                  <td className="px-2 py-1 text-right">{a.avgAbsDiffPct == null ? "—" : `%${num(a.avgAbsDiffPct, 2)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
