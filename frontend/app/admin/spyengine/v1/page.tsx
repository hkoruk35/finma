"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/admin/supertrade/ui";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
} from "lightweight-charts";

// ── Types ─────────────────────────────────────────────────────────

interface EngineBar {
  time: number; // unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
}

interface ForecastPoint {
  time: number;
  price: number;
}

interface ForecastSignal {
  time: number;
  price: number;
  type: "BUY" | "SELL";
  confidence: number;
  reason: string;
}

interface ForecastData {
  points: ForecastPoint[];
  signals: ForecastSignal[];
  trend: "UP" | "DOWN" | "FLAT";
  note: string;
}

interface EngineData {
  asset: string;
  m15: string;
  m5: string;
  m1: string;
  state: string;
  action: string;
  price: number;
  confidence: number;
  reasoning: string;
  isLiveSession: boolean;
  sessionDate: string | null;
  marketNote: string | null;
  bars: EngineBar[];
  forecast: ForecastData;
}

interface SignalEntry {
  time: string; // HH:mm
  epoch: number; // sinyalin üretildiği anın unix saniyesi (marker eşlemesi için)
  action: "BUY" | "SHORT" | "EXIT" | "HOLD";
  price: number;
  reasoning: string;
}

// ── Bar → mum verisi dönüşümü ───────────────────────────────────────
// Motor yanıtındaki bars dizisini lightweight-charts formatına çevirir,
// bozuk kayıtları eler ve zamana göre artan/tekrarsız hale getirir.

function toCandles(bars: EngineBar[]): CandlestickData<Time>[] {
  const seen = new Map<number, CandlestickData<Time>>();
  for (const b of bars) {
    if (!b || !Number.isFinite(b.open) || !Number.isFinite(b.close) || !Number.isFinite(b.time)) continue;
    seen.set(b.time, {
      time: b.time as unknown as Time,
      open: b.open,
      high: b.high,
      low: b.low,
      close: b.close,
    });
  }
  return Array.from(seen.values()).sort((a, b) => (a.time as number) - (b.time as number));
}

// Tahmin çizgisi: son mumun kapanışından başlar (koptuğu izlenimi vermemek
// için ilk nokta olarak eklenir), ardından backend'in ürettiği kesikli
// projeksiyon noktaları gelir.
function toForecastLine(points: ForecastPoint[], lastCandle: CandlestickData<Time> | undefined): LineData<Time>[] {
  const out: LineData<Time>[] = [];
  if (lastCandle) out.push({ time: lastCandle.time, value: lastCandle.close });
  for (const p of points) {
    if (!Number.isFinite(p.price) || !Number.isFinite(p.time)) continue;
    out.push({ time: p.time as unknown as Time, value: p.price });
  }
  return out;
}

// ── Color helpers ─────────────────────────────────────────────────

function actionColor(action: string) {
  switch (action) {
    case "BUY":    return "bg-green-500/20 text-green-400 border border-green-500/30";
    case "SHORT":  return "bg-red-500/20 text-red-400 border border-red-500/30";
    case "HOLD":   return "bg-blue-500/20 text-blue-400 border border-blue-500/30";
    case "EXIT":   return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
    default:       return "bg-slate-700 text-slate-300";
  }
}

function confidenceColor(score: number) {
  if (score >= 80) return "text-green-400 font-bold";
  if (score >= 70) return "text-blue-400";
  if (score >= 60) return "text-yellow-400";
  return "text-slate-400";
}

function m15Color(v: string) {
  if (v === "Bullish") return "text-green-400";
  if (v === "Bearish") return "text-red-400";
  return "text-slate-400";
}
function m5Color(v: string) {
  if (v.includes("Breakout") && v !== "Breakout Watch") return "text-green-400";
  if (v === "Breakout Watch") return "text-yellow-400";
  if (v.includes("Reversal")) return "text-red-400";
  return "text-slate-400";
}
function m1Color(v: string) {
  if (v !== "Waiting" && !v.includes("Bearish")) return "text-green-400";
  if (v.includes("Bearish")) return "text-red-400";
  return "text-slate-400";
}
function dotColor(v: string, kind: "m15" | "m5" | "m1") {
  if (kind === "m15") return v === "Bullish" ? "bg-green-500" : v === "Bearish" ? "bg-red-500" : "bg-slate-500";
  if (kind === "m5") {
    if (v.includes("Breakout") && v !== "Breakout Watch") return "bg-green-500";
    if (v === "Breakout Watch") return "bg-yellow-500";
    return "bg-slate-500";
  }
  if (kind === "m1") return v !== "Waiting" && !v.includes("Bearish") ? "bg-green-500" : v.includes("Bearish") ? "bg-red-500" : "bg-slate-500";
  return "bg-slate-500";
}

// ── Main component ────────────────────────────────────────────────

export default function SPYEngineV1() {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const forecastSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [engineData, setEngineData] = useState<EngineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signals, setSignals] = useState<SignalEntry[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  // Interval içindeki fetch closure'ının her zaman en güncel sinyal
  // listesini görmesi için ref kullanılıyor (useState tek başına stale
  // closure'a düşüp marker'ların hiç görünmemesine yol açıyordu).
  const signalsRef = useRef<SignalEntry[]>([]);
  useEffect(() => {
    signalsRef.current = signals;
  }, [signals]);

  // ── Chart init ──────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: {
        background: { color: "#0a0e17" },
        textColor: "#8b949e",
      },
      grid: {
        vertLines: { color: "#1c2635" },
        horzLines: { color: "#1c2635" },
      },
      crosshair: {
        vertLine: { color: "#3b82f6", style: 1 },
        horzLine: { color: "#3b82f6", style: 1 },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: "#1c2635",
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      rightPriceScale: { borderColor: "#1c2635" },
      width: chartRef.current.clientWidth,
      height: 380,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });

    // 60 dakikalık tahmin çizgisi — kesikli, mor tonda; gerçek mumlarla
    // karışmaması için ayrı bir seri.
    const forecastSeries = chart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    });

    chartApiRef.current = chart;
    seriesRef.current = series;
    forecastSeriesRef.current = forecastSeries;

    const ro = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // ── Engine + candle data fetch ──────────────────────────────────
  // Grafik ve sinyal etiketleri artık tek bir uç noktadan (spyengine/v1)
  // geliyor; ayrı bir supertrade/v4 çağrısı ve onun uyuşmayan yanıt şekli
  // (results.SPY.spxChart) kaldırıldı. Piyasa kapalıyken (hafta sonu, mesai
  // dışı) backend zaten son tamamlanmış seansın (örn. Cuma) mumlarını
  // döndürür, bu yüzden ek bir hafta sonu dalı gerekmiyor.
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      try {
        const res = await fetch("/api/admin/spyengine/v1?symbol=SPY");
        const json = await res.json();
        if (cancelled) return;

        if (json.ok && json.data) {
          const data: EngineData = json.data;
          setEngineData(data);
          setError(null);

          // Sinyal loguna ekle (yineleme yapma)
          let nextSignals = signalsRef.current;
          if (data.action === "BUY" || data.action === "SHORT") {
            const nowDate = new Date();
            const now = nowDate.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
            const last = signalsRef.current[0];
            if (!(last?.action === data.action && last?.time === now)) {
              nextSignals = [
                { time: now, epoch: Math.floor(nowDate.getTime() / 1000), action: data.action as any, price: data.price, reasoning: data.reasoning },
                ...signalsRef.current.slice(0, 19),
              ];
              signalsRef.current = nextSignals;
              setSignals(nextSignals);
            }
          }

          // Mumları çiz
          const candles = toCandles(data.bars || []);
          if (candles.length && seriesRef.current) {
            seriesRef.current.setData(candles);

            const firstTime = candles[0].time as number;
            const lastTime = candles[candles.length - 1].time as number;
            const markers: SeriesMarker<Time>[] = nextSignals
              .filter((s) => (s.action === "BUY" || s.action === "SHORT") && s.epoch >= firstTime && s.epoch <= lastTime + 300)
              .slice(0, 10)
              .map((s) => {
                // Sinyal anına en yakın (>= zamanlı ilk) mumu bul
                let closest = candles[candles.length - 1];
                for (const c of candles) {
                  if ((c.time as number) >= s.epoch) {
                    closest = c;
                    break;
                  }
                }
                return {
                  time: closest.time,
                  position: s.action === "BUY" ? "belowBar" : "aboveBar",
                  color: s.action === "BUY" ? "#22c55e" : "#ef4444",
                  shape: s.action === "BUY" ? "arrowUp" : "arrowDown",
                  text: s.action === "BUY" ? `▲ BUY $${s.price.toFixed(2)}` : `▼ SHORT $${s.price.toFixed(2)}`,
                  size: 2,
                } as SeriesMarker<Time>;
              });

            if (seriesRef.current) {
              createSeriesMarkers(seriesRef.current, markers);
            }

            // ── 60 dk tahmin çizgisi + olası BUY/SELL noktaları ──
            const forecast = data.forecast;
            const lastCandle = candles[candles.length - 1];
            if (forecastSeriesRef.current) {
              const line = toForecastLine(forecast?.points || [], lastCandle);
              forecastSeriesRef.current.setData(line);

              const forecastMarkers: SeriesMarker<Time>[] = (forecast?.signals || []).map((s) => ({
                time: s.time as unknown as Time,
                position: s.type === "BUY" ? "belowBar" : "aboveBar",
                color: s.type === "BUY" ? "#4ade80" : "#f87171",
                shape: "circle",
                text: `${s.type === "BUY" ? "≈BUY" : "≈SELL"} $${s.price.toFixed(2)}`,
                size: 1,
              }));
              createSeriesMarkers(forecastSeriesRef.current, forecastMarkers);
            }

            // Grafiğin sol yarısı geçmiş mumları, sağ yarısı tahmini
            // kapsayacak şekilde görünür aralığı elle ayarla: geçmiş
            // penceresini tahmin ufku (60 dk) kadar geriye çek.
            const lastCandleTime = lastCandle.time as number;
            const horizonSec = forecast?.points?.length
              ? (forecast.points[forecast.points.length - 1].time as number) - lastCandleTime
              : 60 * 60;
            const rangeFrom = Math.max(firstTime, lastCandleTime - horizonSec) as unknown as Time;
            const rangeTo = (forecast?.points?.length
              ? forecast.points[forecast.points.length - 1].time
              : lastCandleTime) as unknown as Time;
            chartApiRef.current?.timeScale().setVisibleRange({ from: rangeFrom, to: rangeTo });
          }
        } else {
          setError(json.error || "Bilinmeyen hata");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setLastUpdated(new Date().toLocaleTimeString("tr-TR"));
        }
      }
    };

    fetchAll();
    // 60 saniyede bir güncelleme — önceki 15s aralık, SuperTrade V4
    // dashboard'ıyla birlikte Yahoo Finance'e çok sık paralel istek atarak
    // rate-limit'e (HTTP 429) yol açıyor olabilirdi (bkz. lib/v4/snapshot.ts
    // hata mesajı iyileştirmesi). Cache TTL de aynı 60s'e hizalandı.
    const interval = setInterval(fetchAll, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">

      {/* Header */}
      <header className="mb-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1c2635] pb-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h1 className="text-[18px] font-semibold tracking-tight text-[#eab308]">SPYEngine V1</h1>
            <Badge tone="brand">Canlı Sinyal Motoru</Badge>
          </div>
          <p className="text-[12px] text-slate-500">
            15m yön filtresi → 5m setup → 1m hassas tetik · Non-repainting · Sadece kapalı mum
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-slate-600 font-mono">Son güncelleme: {lastUpdated}</span>
          )}
          <Link
            href="/admin/supertrade/v4"
            className="flex items-center gap-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors px-3 py-1.5 text-[12px] font-medium text-slate-300 whitespace-nowrap"
          >
            🦅 SuperTrade V4
          </Link>
        </div>
      </header>

      {/* Hata */}
      {error && (
        <div className="mb-4 text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-500/30">
          Motor hatası: {error}
        </div>
      )}

      {/* Piyasa kapalı / hafta sonu bilgisi */}
      {engineData && !engineData.isLiveSession && engineData.marketNote && (
        <div className="mb-4 flex items-center gap-2 text-amber-300/90 text-[12px] bg-amber-500/10 px-3 py-2 rounded border border-amber-500/20">
          <span>🕒</span>
          <span>{engineData.marketNote}</span>
        </div>
      )}

      {/* Stat kartları */}
      {loading && !engineData ? (
        <div className="text-slate-500 text-sm mb-6">Piyasa verileri yükleniyor...</div>
      ) : engineData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">State</div>
            <div className="text-[18px] font-bold text-white">{engineData.state}</div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Güven Skoru</div>
            <div className={`text-[18px] font-bold ${confidenceColor(engineData.confidence)}`}>
              {engineData.confidence > 0 ? `${engineData.confidence}/100` : "—"}
            </div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">SPY Fiyatı</div>
            <div className="text-[18px] font-bold text-white">${engineData.price.toFixed(2)}</div>
          </div>
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
            <div className="text-[10px] text-slate-500 mb-1 uppercase tracking-wider font-semibold">Tavsiye</div>
            <span className={`inline-block text-[14px] font-bold px-3 py-1 rounded ${actionColor(engineData.action)}`}>
              {engineData.action}
            </span>
          </div>
        </div>
      )}

      {/* ── SPY Grafik ── */}
      <div className="mb-5 bg-[#0d1117] border border-[#1c2635] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1c2635]">
          <span className="text-[12px] font-semibold text-slate-400">
            SPY · 1m Grafik {engineData?.isLiveSession ? "(Canlı)" : engineData?.sessionDate ? `(${engineData.sessionDate} kapanışı)` : ""}
          </span>
          <span className="text-[11px] text-slate-600">
            ▲ BUY / ▼ SHORT · gerçek sinyal &nbsp;·&nbsp; <span className="text-[#a78bfa]">┈┈</span> 60 dk tahmin (≈BUY/≈SELL)
          </span>
        </div>
        <div ref={chartRef} className="w-full" />
      </div>

      {/* ── 3-Katman Sinyal Tablosu ── */}
      {engineData && (
        <div className="mb-5 bg-[#111827] border border-[#1f2937] rounded-lg overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-[#1f2937]">
                {["Varlık", "15m · Yön/Rejim", "5m · Setup Motoru", "1m · Hassas Tetik", "Sonuç"].map((h) => (
                  <th key={h} className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="hover:bg-[#1c2635]/40 transition-colors">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-100">SPY</div>
                  <div className="text-[11px] text-slate-500">S&P 500 ETF</div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotColor(engineData.m15, "m15")}`} />
                    <span className={m15Color(engineData.m15)}>{engineData.m15}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotColor(engineData.m5, "m5")}`} />
                    <span className={m5Color(engineData.m5)}>{engineData.m5}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${dotColor(engineData.m1, "m1")}`} />
                    <span className={m1Color(engineData.m1)}>{engineData.m1}</span>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-block text-[12px] font-bold px-2.5 py-1 rounded ${actionColor(engineData.action)}`}>
                    {engineData.action}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── 60 Dakikalık Tahmin ── */}
      {engineData?.forecast && (
        <div className="mb-5 bg-[#111827] border border-[#1f2937] rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] font-semibold text-slate-400 flex items-center gap-2">
              <span className="text-[#a78bfa]">┈┈</span> 60 Dakikalık Tahmin (5m, hacim + eğilim)
            </div>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                engineData.forecast.trend === "UP"
                  ? "bg-green-500/20 text-green-400"
                  : engineData.forecast.trend === "DOWN"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-slate-700 text-slate-300"
              }`}
            >
              {engineData.forecast.trend === "UP" ? "Yukarı eğilim" : engineData.forecast.trend === "DOWN" ? "Aşağı eğilim" : "Yatay"}
            </span>
          </div>
          {engineData.forecast.signals.length === 0 ? (
            <div className="text-[12px] text-slate-600 italic">Belirgin bir olası dönüş/devam noktası bulunamadı.</div>
          ) : (
            <div className="flex flex-col gap-1.5 mb-2">
              {engineData.forecast.signals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] font-mono">
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${s.type === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    ≈{s.type}
                  </span>
                  <span className="text-slate-300">${s.price.toFixed(2)}</span>
                  <span className="text-slate-500">{s.confidence}/100</span>
                  <span className="text-slate-600 text-[11px] truncate">{s.reason}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[11px] text-slate-600 italic">{engineData.forecast.note}</div>
        </div>
      )}

      {/* ── Sinyal Log ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Reasoning */}
        {engineData && (
          <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
            <div className="text-[12px] font-semibold text-slate-400 mb-2 flex items-center gap-2">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Motor Açıklaması
            </div>
            <div className="text-[12px] font-mono bg-[#0d1117] p-3 rounded border border-[#1c2635] text-slate-400">
              <span className="text-[#3b82f6]">{lastUpdated}</span> — {engineData.reasoning}
            </div>
          </div>
        )}

        {/* Sinyal geçmişi */}
        <div className="bg-[#111827] border border-[#1f2937] rounded-lg p-4">
          <div className="text-[12px] font-semibold text-slate-400 mb-2">Oturum Sinyal Geçmişi</div>
          {signals.length === 0 ? (
            <div className="text-[12px] text-slate-600 italic">Henüz BUY/SHORT sinyali üretilmedi.</div>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto">
              {signals.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] font-mono">
                  <span className="text-slate-600">{s.time}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${s.action === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                    {s.action}
                  </span>
                  <span className="text-slate-300">${s.price.toFixed(2)}</span>
                  <span className="text-slate-600 text-[11px] truncate">{s.reasoning}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
