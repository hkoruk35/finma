"use client";

/**
 * SPY Engine V2 — kendi grafik motorumuz (lightweight-charts v5).
 *
 * ZAMAN KAYMASI YOK: mum zaman damgaları GERÇEK unix saniyesidir; New York
 * saatini göstermek için damga kaydırılmaz, yalnızca eksen biçimlendiricisi
 * (tickMarkFormatter / timeFormatter) America/New_York'a çevirir. Bu yüzden
 * grafikteki 09:30 ile Yahoo'nun 09:30 mumu birebir aynı mumdur.
 *
 * Paneller: 0 = fiyat (mum + Bollinger + EMA50 + VWAP + hacim),
 *           1 = RSI(14), 2 = MACD(12,26,9).
 * Göstergeler lib/spyengine/core.ts'ten gelir — motorun karar verirken
 * kullandığı fonksiyonların TA KENDİSİ, ayrı bir kopyası değil.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  LineStyle,
  LineType,
  CrosshairMode,
  createSeriesMarkers,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type IPriceLine,
  type Time,
  type SeriesMarker,
  type MouseEventParams,
} from "lightweight-charts";
import {
  heikinAshi,
  bollinger,
  ema,
  rsi,
  macd,
  sessionVwap,
  nyClock,
  type Bar,
} from "@/lib/spyengine/core";
import { EVENT_STYLE, EVENT_LABEL, type EngineEvent, type PositionState } from "@/lib/spyengine/strategy";

// ── Renk paleti (tek tema: koyu terminal) ────────────────────────
const C = {
  bg: "#0a0e17",
  grid: "#151c28",
  border: "#1c2635",
  text: "#8b949e",
  up: "#22c55e",
  down: "#ef4444",
  bbBand: "#3b82f6",
  bbFill: "rgba(59,130,246,0.06)",
  ema: "#f59e0b",
  vwap: "#e879f9",
  volUp: "rgba(34,197,94,0.35)",
  volDown: "rgba(239,68,68,0.35)",
  rsi: "#60a5fa",
  macd: "#60a5fa",
  signal: "#f59e0b",
  trail: "#a855f7",
};

export interface ChartToggles {
  candleType: "HA" | "NORMAL";
  bb: boolean;
  ema50: boolean;
  vwap: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
  markers: boolean;
  levels: boolean;
}

export interface SpyChartProps {
  bars: Bar[];
  timeframe: "1m" | "5m" | "15m";
  events: EngineEvent[];
  position: PositionState | null;
  toggles: ChartToggles;
  height: number;
  /** Yeni mum geldikçe sağa kaydır */
  autoScroll: boolean;
  /**
   * V4 -- Seviye panelindeki seviyeler (destek/direnç, premarket ve seans
   * uçları, dünkü kapanış). SEVIYE düğmesiyle birlikte açılıp kapanır.
   */
  levelLines?: { price: number; label: string; color: string }[];
  /**
   * İlk yüklemede görünür aralığı SON N DAKİKA ile sınırlar (örn. 1m için
   * 60, 5m için 120) — verilmezse eskisi gibi tüm seans fitContent() ile
   * sığdırılır. Amaç: tüm günü tek pencereye sıkıştırıp mumları, üst
   * etiketleri ve seviye çizgilerini iç içe geçirmemek; kullanıcı sonradan
   * zoom/pan yaparsa dokunulmaz (bkz. didFitRef, yalnızca İLK yüklemede).
   */
  defaultWindowMin?: number;
}

interface LegendState {
  time: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  rsi: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
  bbU: number | null;
  bbM: number | null;
  bbL: number | null;
  ema: number | null;
  vwap: number | null;
}

const EMPTY_LEGEND: LegendState = {
  time: null, open: null, high: null, low: null, close: null, volume: null,
  rsi: null, macd: null, signal: null, hist: null,
  bbU: null, bbM: null, bbL: null, ema: null, vwap: null,
};

const num = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? "—" : v.toFixed(d);

export default function SpyChart({
  bars, timeframe, events, position, toggles, height, autoScroll, levelLines, defaultWindowMin,
}: SpyChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const bbUpRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMidRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowRef = useRef<ISeriesApi<"Area"> | null>(null);
  const emaRef = useRef<ISeriesApi<"Line"> | null>(null);
  const vwapRef = useRef<ISeriesApi<"Line"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const trailRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdRef = useRef<ISeriesApi<"Line"> | null>(null);
  const signalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const histRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const didFitRef = useRef(false);
  /**
   * Seviye çizgileri (destek/direnç, premarket/seans uçları, dünkü kapanış)
   * candle serisine createPriceLine ile ekleniyor -- lightweight-charts
   * varsayılan autoscale'i BUNLARI da fiyat aralığına dahil ediyor, uzak bir
   * seviye (örn. premarket dip) mumlardan çok uzaktaysa eksen aşağı doğru
   * gereksiz yere geriliyor ve mumlar panelin en üstüne sıkışıyor. Bu ref,
   * candle serisinin autoscaleInfoProvider'ının SADECE görünür mumlardan
   * fiyat aralığı hesaplamasını sağlar -- seviye çizgileri eksene dahil
   * edilmez, mumlar dikeyde ortalanmış/dolgun görünür.
   */
  const barsForScaleRef = useRef<{ time: number; high: number; low: number }[]>([]);

  // Crosshair okuması: yalnızca fare hareketinde (harici olay) yazılır.
  // Fare grafiğin dışındayken son mumun değerleri gösterilir — bu, render
  // sırasında türetilir, effect içinde setState edilmez.
  const [hover, setHover] = useState<LegendState | null>(null);

  // ── Hesaplanmış seriler (motorla aynı fonksiyonlar) ─────────────
  const computed = useMemo(() => {
    const closes = bars.map((b) => b.close);
    const display = toggles.candleType === "HA" ? heikinAshi(bars) : bars;
    return {
      display,
      bb: bollinger(closes, 20, 2),
      ema50: ema(closes, 50),
      vwap: sessionVwap(bars),
      rsi14: rsi(closes, 14),
      macd: macd(closes, 12, 26, 9),
    };
  }, [bars, toggles.candleType]);

  // ── Grafik kurulumu (bir kez) ───────────────────────────────────
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { color: C.bg },
        textColor: C.text,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: C.border, separatorHoverColor: "#26334a", enableResize: true },
      },
      grid: {
        vertLines: { color: C.grid },
        horzLines: { color: C.grid },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#3b82f6", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1d4ed8" },
        horzLine: { color: "#3b82f6", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#1d4ed8" },
      },
      // top 0.22: üst-sol OHLC/gösterge legend'ı (2 satır) için mumların
      // üstünde net boşluk bırakır -- legend'in mumlarla iç içe geçmemesi.
      rightPriceScale: { borderColor: C.border, scaleMargins: { top: 0.22, bottom: 0.1 } },
      timeScale: {
        borderColor: C.border,
        timeVisible: true,
        secondsVisible: false,
        // Son mum ile sağdaki seviye etiketi sütunu arasında boşluk bırakır
        // -- mum akışı seviye etiketlerine değmeden bitsin diye.
        rightOffset: 10,
        barSpacing: 7,
        // GERÇEK zaman damgası korunur; sadece etiket NY'ye çevrilir.
        tickMarkFormatter: (t: Time) => nyClock(t as number),
      },
      localization: {
        timeFormatter: (t: Time) => `${nyClock(t as number, true)} ET`,
        priceFormatter: (p: number) => p.toFixed(2),
      },
      handleScroll: true,
      handleScale: true,
    });
    chartRef.current = chart;

    // ── Pane 0: fiyat ─────────────────────────────────────────────
    // Bollinger alt bandı Area olarak çizilir: üstündeki dolgu bandın
    // içini Robinhood'daki gibi hafifçe boyar.
    bbLowRef.current = chart.addSeries(AreaSeries, {
      lineColor: C.bbBand, topColor: C.bbFill, bottomColor: "rgba(0,0,0,0)",
      lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, 0);
    bbUpRef.current = chart.addSeries(LineSeries, {
      color: C.bbBand, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, 0);
    bbMidRef.current = chart.addSeries(LineSeries, {
      color: "#7c8da8", lineWidth: 1, lineStyle: LineStyle.Dotted,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, 0);
    emaRef.current = chart.addSeries(LineSeries, {
      color: C.ema, lineWidth: 2, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, 0);
    vwapRef.current = chart.addSeries(LineSeries, {
      color: C.vwap, lineWidth: 1, lineStyle: LineStyle.LargeDashed,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    }, 0);

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: C.up, downColor: C.down, borderVisible: false,
      wickUpColor: C.up, wickDownColor: C.down,
      priceLineColor: "#e2e8f0", priceLineStyle: LineStyle.Dotted,
      // Fiyat aralığını SADECE görünür mumlardan hesapla -- seviye
      // çizgileri (createPriceLine) uzakta olsa bile ekseni germesin.
      autoscaleInfoProvider: () => {
        const bars = barsForScaleRef.current;
        if (!bars.length) return null;
        const range = chart.timeScale().getVisibleRange();
        const visible = range
          ? bars.filter((b) => b.time >= (range.from as number) && b.time <= (range.to as number))
          : bars;
        const src = visible.length ? visible : bars;
        let min = Infinity, max = -Infinity;
        for (const b of src) {
          if (b.low < min) min = b.low;
          if (b.high > max) max = b.high;
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        const pad = Math.max((max - min) * 0.12, 0.05);
        return { priceRange: { minValue: min - pad, maxValue: max + pad } };
      },
    }, 0);

    // Trailing stop — kademeli (WithSteps) ve kesikli; her yükseliş
    // geçmişte de görünür kalır (talimat §7).
    trailRef.current = chart.addSeries(LineSeries, {
      color: C.trail, lineWidth: 2, lineStyle: LineStyle.Dashed, lineType: LineType.WithSteps,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      title: "Trailing",
    }, 0);

    // Hacim — fiyat panelinin altına bindirilmiş ayrı ölçek
    volRef.current = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      priceLineVisible: false, lastValueVisible: false,
    }, 0);
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    // ── Pane 1: RSI ───────────────────────────────────────────────
    rsiRef.current = chart.addSeries(LineSeries, {
      color: C.rsi, lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      priceFormat: { type: "price", precision: 1, minMove: 0.1 },
      title: "RSI 14",
    }, 1);
    rsiRef.current.createPriceLine({ price: 70, color: "#ef444455", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    rsiRef.current.createPriceLine({ price: 30, color: "#22c55e55", lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
    rsiRef.current.createPriceLine({ price: 50, color: "#64748b33", lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: "" });

    // ── Pane 2: MACD ──────────────────────────────────────────────
    histRef.current = chart.addSeries(HistogramSeries, {
      priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    }, 2);
    macdRef.current = chart.addSeries(LineSeries, {
      color: C.macd, lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
      title: "MACD",
    }, 2);
    signalRef.current = chart.addSeries(LineSeries, {
      color: C.signal, lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
      priceFormat: { type: "price", precision: 3, minMove: 0.001 },
    }, 2);

    markersRef.current = createSeriesMarkers(candleRef.current, []);

    // Crosshair → üst sol OHLC/gösterge okuması (Robinhood tarzı)
    const onMove = (param: MouseEventParams) => {
      if (!param.time || !candleRef.current) {
        setHover(null);
        return;
      }
      const t = param.time as number;
      const c = param.seriesData.get(candleRef.current) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      setHover({
        ...EMPTY_LEGEND,
        time: t,
        open: c?.open ?? null, high: c?.high ?? null, low: c?.low ?? null, close: c?.close ?? null,
        volume: (param.seriesData.get(volRef.current!) as { value: number } | undefined)?.value ?? null,
        rsi: (param.seriesData.get(rsiRef.current!) as { value: number } | undefined)?.value ?? null,
        macd: (param.seriesData.get(macdRef.current!) as { value: number } | undefined)?.value ?? null,
        signal: (param.seriesData.get(signalRef.current!) as { value: number } | undefined)?.value ?? null,
        hist: (param.seriesData.get(histRef.current!) as { value: number } | undefined)?.value ?? null,
        bbU: (param.seriesData.get(bbUpRef.current!) as { value: number } | undefined)?.value ?? null,
        bbM: (param.seriesData.get(bbMidRef.current!) as { value: number } | undefined)?.value ?? null,
        bbL: (param.seriesData.get(bbLowRef.current!) as { value: number } | undefined)?.value ?? null,
        ema: (param.seriesData.get(emaRef.current!) as { value: number } | undefined)?.value ?? null,
        vwap: (param.seriesData.get(vwapRef.current!) as { value: number } | undefined)?.value ?? null,
      });
    };
    chart.subscribeCrosshairMove(onMove);

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      markersRef.current = null;
      priceLinesRef.current = [];
      didFitRef.current = false;
    };
  }, []);

  // ── Panel yükseklikleri (RSI/MACD açık-kapalı) ──────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const panes = chart.panes();
    const sub = (toggles.rsi ? 1 : 0) + (toggles.macd ? 1 : 0);
    const subH = sub ? Math.max(60, Math.round(height * 0.14)) : 0;
    const priceH = Math.max(200, height - subH * sub - 30);
    try {
      panes[0]?.setHeight(priceH);
      panes[1]?.setHeight(toggles.rsi ? subH : 1);
      panes[2]?.setHeight(toggles.macd ? subH : 1);
    } catch {
      // Panel henüz oluşmadıysa sessizce geç — bir sonraki render'da oturur.
    }
  }, [height, toggles.rsi, toggles.macd]);

  // ── Veri yazımı ─────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !candleRef.current) return;
    const { display, bb, ema50, vwap, rsi14, macd: m } = computed;
    const T = (t: number) => t as unknown as Time;

    barsForScaleRef.current = display.map((b) => ({ time: b.time, high: b.high, low: b.low }));
    candleRef.current.setData(
      display.map((b) => ({ time: T(b.time), open: b.open, high: b.high, low: b.low, close: b.close }))
    );

    const line = (series: (number | null)[], on: boolean) =>
      on ? bars.flatMap((b, i) => (series[i] == null ? [] : [{ time: T(b.time), value: series[i] as number }])) : [];

    bbUpRef.current?.setData(line(bb.upper, toggles.bb));
    bbMidRef.current?.setData(line(bb.mid, toggles.bb));
    bbLowRef.current?.setData(line(bb.lower, toggles.bb));
    emaRef.current?.setData(line(ema50, toggles.ema50));
    vwapRef.current?.setData(line(vwap, toggles.vwap));

    volRef.current?.setData(
      toggles.volume
        ? bars.map((b) => ({
            time: T(b.time),
            value: b.volume || 0,
            color: b.close >= b.open ? C.volUp : C.volDown,
          }))
        : []
    );

    rsiRef.current?.setData(line(rsi14, toggles.rsi));
    macdRef.current?.setData(line(m.macd, toggles.macd));
    signalRef.current?.setData(line(m.signal, toggles.macd));
    histRef.current?.setData(
      toggles.macd
        ? bars.flatMap((b, i) =>
            m.hist[i] == null
              ? []
              : [{
                  time: T(b.time),
                  value: m.hist[i] as number,
                  color: (m.hist[i] as number) >= 0 ? "rgba(34,197,94,0.55)" : "rgba(239,68,68,0.55)",
                }]
          )
        : []
    );

    // İlk veri geldiğinde bir kez sığdır; sonrasında kullanıcının zoom'una dokunma.
    if (!didFitRef.current && display.length) {
      if (defaultWindowMin) {
        // Son N dakikayı göster (örn. 1m için 60, 5m için 120) -- tüm günü
        // tek pencereye sıkıştırmak yerine son durumu okunur büyüklükte
        // gösterir; üst etiketler ve seviye çizgileri hâlâ görünür kalır.
        const lastT = display[display.length - 1].time;
        const fromT = lastT - defaultWindowMin * 60;
        chartRef.current.timeScale().setVisibleRange({
          from: fromT as unknown as Time,
          to: lastT as unknown as Time,
        });
      } else {
        chartRef.current.timeScale().fitContent();
      }
      didFitRef.current = true;
    } else if (autoScroll && display.length) {
      chartRef.current.timeScale().scrollToRealTime();
    }

  }, [computed, bars, toggles, autoScroll, defaultWindowMin]);

  // Fare grafiğin dışındayken gösterilen varsayılan okuma = son mum.
  const lastLegend = useMemo<LegendState>(() => {
    const li = bars.length - 1;
    if (li < 0) return EMPTY_LEGEND;
    const { display, bb, ema50, vwap, rsi14, macd: m } = computed;
    return {
      time: bars[li].time,
      open: display[li].open, high: display[li].high, low: display[li].low, close: display[li].close,
      volume: bars[li].volume,
      rsi: rsi14[li], macd: m.macd[li], signal: m.signal[li], hist: m.hist[li],
      bbU: bb.upper[li], bbM: bb.mid[li], bbL: bb.lower[li],
      ema: ema50[li], vwap: vwap[li],
    };
  }, [bars, computed]);

  const legend = hover ?? lastLegend;

  // ── İşaretler (sinyal olayları) ─────────────────────────────────
  useEffect(() => {
    if (!markersRef.current) return;
    if (!toggles.markers || !bars.length) {
      markersRef.current.setMarkers([]);
      return;
    }
    const span = timeframe === "1m" ? 60 : timeframe === "5m" ? 300 : 900;
    const first = bars[0].time;
    const lastT = bars[bars.length - 1].time;

    const marks: SeriesMarker<Time>[] = [];
    for (const ev of events) {
      // Olayı, içinde bulunduğu zaman dilimi kovasına hizala
      const slot = ev.time - (ev.time % span);
      if (slot < first || slot > lastT) continue;
      const style = EVENT_STYLE[ev.kind];
      const premium = ev.premium != null ? ` ${ev.premium.toFixed(2)}` : "";
      marks.push({
        time: slot as unknown as Time,
        position: ev.kind === "ENTRY" ? (ev.side === "LONG" ? "belowBar" : "aboveBar") : "aboveBar",
        color: style.color,
        shape: style.shape,
        size: ev.kind === "ENTRY" ? 2 : 1,
        text: `${style.glyph} ${EVENT_LABEL[ev.kind]}${premium}`,
      });
    }
    markersRef.current.setMarkers(marks);
  }, [events, bars, timeframe, toggles.markers]);

  // ── Trailing stop çizgisi + seviye çizgileri ────────────────────
  useEffect(() => {
    const candle = candleRef.current;
    if (!candle || !trailRef.current) return;

    for (const pl of priceLinesRef.current) {
      try { candle.removePriceLine(pl); } catch { /* seri yeniden kuruldu */ }
    }
    priceLinesRef.current = [];

    // Trailing seviyesi OPSİYON PRİMİ ölçeğindedir; SPY fiyat ekseninde
    // anlamlı olmadığı için grafiğe çizilmez — sayısal geçmişi Pozisyon
    // panelinde adım adım gösterilir. Burada yalnızca giriş spot seviyesi
    // ve varsa çıkış spotu işaretlenir.
    trailRef.current.setData([]);

    if (!toggles.levels) return;

    // V4 seviye çizgileri -- panelde görülenlerin AYNISI, ayrı hesap yok
    for (const l of levelLines ?? []) {
      priceLinesRef.current.push(
        candle.createPriceLine({
          price: l.price,
          color: `${l.color}99`,
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          axisLabelVisible: true,
          title: l.label,
        })
      );
    }

    if (!position) return;

    priceLinesRef.current.push(
      candle.createPriceLine({
        price: position.entrySpot,
        color: position.side === "LONG" ? C.up : C.down,
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: true,
        title: `Giriş ${position.side === "LONG" ? "L" : "S"}`,
      })
    );
  }, [position, toggles.levels, levelLines]);

  const rsiVal = legend.rsi;
  const histVal = legend.hist;

  return (
    <div className="relative w-full" style={{ height }}>
      <div ref={hostRef} className="absolute inset-0" />

      {/* Robinhood tarzı üst-sol okuma paneli */}
      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-col gap-0.5 font-mono text-[10px] leading-tight">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="rounded bg-[#111827]/90 px-1.5 py-0.5 font-semibold text-slate-200">
            SPY · {timeframe} · {toggles.candleType === "HA" ? "Heikin Ashi" : "Mum"}
          </span>
          {legend.time != null && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5 text-slate-400">{nyClock(legend.time)} ET</span>
          )}
          <span className="rounded bg-[#111827]/90 px-1.5 py-0.5 text-slate-400">
            O <b className="text-slate-200">{num(legend.open)}</b>{" "}
            H <b className="text-slate-200">{num(legend.high)}</b>{" "}
            L <b className="text-slate-200">{num(legend.low)}</b>{" "}
            C <b className={legend.close != null && legend.open != null && legend.close >= legend.open ? "text-[#22c55e]" : "text-[#ef4444]"}>{num(legend.close)}</b>{" "}
            V <b className="text-slate-300">{legend.volume != null ? Math.round(legend.volume).toLocaleString("tr-TR") : "—"}</b>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {toggles.bb && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5" style={{ color: C.bbBand }}>
              BB(20,2) {num(legend.bbL)} / {num(legend.bbM)} / {num(legend.bbU)}
            </span>
          )}
          {toggles.ema50 && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5" style={{ color: C.ema }}>
              EMA50 {num(legend.ema)}
            </span>
          )}
          {toggles.vwap && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5" style={{ color: C.vwap }}>
              VWAP {num(legend.vwap)}
            </span>
          )}
          {toggles.rsi && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5" style={{ color: rsiVal != null && rsiVal >= 70 ? C.down : rsiVal != null && rsiVal <= 30 ? C.up : C.rsi }}>
              RSI14 {num(rsiVal, 1)}
            </span>
          )}
          {toggles.macd && (
            <span className="rounded bg-[#111827]/90 px-1.5 py-0.5 text-slate-300">
              MACD <b style={{ color: C.macd }}>{num(legend.macd, 3)}</b>{" "}
              S <b style={{ color: C.signal }}>{num(legend.signal, 3)}</b>{" "}
              H <b style={{ color: histVal != null && histVal >= 0 ? C.up : C.down }}>{num(histVal, 3)}</b>
            </span>
          )}
        </div>
      </div>

      {!bars.length && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0e17]/80 text-[12px] text-slate-500">
          Bu zaman dilimi için Yahoo&apos;dan mum verisi gelmedi — uydurma mum çizilmiyor.
        </div>
      )}
    </div>
  );
}
