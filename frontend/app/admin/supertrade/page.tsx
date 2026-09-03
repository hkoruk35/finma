"use client";

/**
 * SPX SuperTrade — Yönetici Konsolu
 * Canlı terminal ve seans yeniden oynatma aynı hesaplama motorunu kullanır.
 * Tüm sayısal değerler /api/admin/supertrade uç noktalarından gelir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EngineNav from "@/components/admin/EngineNav";
import ContextEnginePanel from "@/components/admin/ContextEnginePanel";
import StrategyLab from "@/components/admin/StrategyLab";
import SuperTradeForecast from "@/components/admin/SuperTradeForecast";
import SuperTradeLiveChart from "@/components/admin/SuperTradeLiveChart";
import {
  Badge,
  EmptyState,
  INSET,
  Panel,
  Row,
  SectionTitle,
  Stat,
  Tabs,
  num,
  signed,
  toneClass,
} from "@/components/admin/supertrade/ui";
import { buildChain, minutesToClose, simulateRunners } from "@/lib/spx/options";
import type {
  Decision,
  Frame,
  OptionQuote,
  SPXReplayResponse,
  SPXSnapshot,
  ScoreFactor,
  SignalState,
  StructureSet,
} from "@/lib/spx/types";

const LIVE_POLL_MS = 20000;
/** Piyasa kapalıyken veri saatlerce değişmez — 20 sn'de bir sorgulamak boşuna. */
const CLOSED_POLL_MS = 5 * 60 * 1000;

const STATE_LABEL: Record<SignalState, string> = {
  NEUTRAL: "Nötr / Beklemede",
  WATCH_LONG: "Long İzleme",
  WATCH_SHORT: "Short İzleme",
  EARLY_LONG: "Erken Long",
  EARLY_SHORT: "Erken Short",
  CONFIRMED_LONG: "Teyitli Long",
  CONFIRMED_SHORT: "Teyitli Short",
  STRONG_LONG: "Güçlü Long",
  STRONG_SHORT: "Güçlü Short",
  LONG_WEAKENING: "Long Zayıflıyor",
  SHORT_WEAKENING: "Short Zayıflıyor",
  FAILED_LONG: "Long Kırılımı Başarısız",
  FAILED_SHORT: "Short Kırılımı Başarısız",
  CHOP: "Testere / İşlem Yok",
  DATA_STALE: "Veri Akışı Beklemede",
};

const CONFIDENCE_LABEL: Record<string, string> = {
  LOW: "Düşük",
  MEDIUM: "Orta",
  HIGH: "Yüksek",
  VERY_HIGH: "Çok Yüksek",
};

const PHASE_LABEL: Record<string, string> = {
  PRE_SESSION: "Seans öncesi",
  PREMARKET: "Açılış öncesi",
  OPENING_RANGE: "Açılış aralığı (09:30–09:35)",
  MAIN_WINDOW: "Ana sinyal penceresi (09:35–10:30)",
  MID_SESSION: "Seans ortası",
  CLOSING: "Kapanış bölgesi",
  AFTER_HOURS: "Seans kapalı",
};

const STRUCTURE_LABEL: Record<string, string> = {
  UPTREND: "Yükselen",
  DOWNTREND: "Düşen",
  RANGE: "Yatay",
};

const SPEEDS = [
  { value: 1, label: "1 dk/sn" },
  { value: 5, label: "5 dk/sn" },
  { value: 15, label: "15 dk/sn" },
  { value: 60, label: "60 dk/sn" },
];

const FEED_LABEL: Record<string, string> = {
  LIVE: "Canlı",
  DELAYED: "Gecikmeli",
  STALE: "Bayat",
  CLOSED: "Kapanış",
  MISSING: "Yok",
};

/** Ham saniye yerine okunabilir yaş: "48 sn", "12 dk", "2 gün" */
function formatAge(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "—";
  if (sec < 90) return `${sec} sn`;
  const minutes = Math.round(sec / 60);
  if (minutes < 90) return `${minutes} dk`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} sa`;
  return `${Math.round(hours / 24)} gün`;
}

function directionTone(direction: string): "up" | "down" | "neutral" {
  if (direction === "LONG") return "up";
  if (direction === "SHORT") return "down";
  return "neutral";
}

function actionColor(tone: Decision["tone"]): string {
  if (tone === "POSITIVE") return "text-[#22c55e]";
  if (tone === "NEGATIVE") return "text-[#ef4444]";
  if (tone === "WARNING") return "text-slate-200";
  return "text-slate-300";
}

export default function SuperTradePage() {
  const [mode, setMode] = useState<"live" | "forecast" | "replay">("live");

  const [snapshot, setSnapshot] = useState<SPXSnapshot | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const [replay, setReplay] = useState<SPXReplayResponse | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [loadingReplay, setLoadingReplay] = useState(false);
  const [replayDate, setReplayDate] = useState<string>("");
  const [replayIndex, setReplayIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(15);

  const [chainView, setChainView] = useState<"auto" | "call" | "put">("auto");

  // ── Canlı veri döngüsü ──
  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/supertrade", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        setSnapshotError(data?.error || `Sunucu hatası (${res.status})`);
      } else {
        setSnapshot(data as SPXSnapshot);
        setSnapshotError(null);
        setLastUpdated(data.asOf ? new Date(data.asOf) : new Date());
      }
    } catch (err) {
      setSnapshotError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const pollMs = snapshot?.isLiveSession === false ? CLOSED_POLL_MS : LIVE_POLL_MS;
  const startedRef = useRef(false);

  useEffect(() => {
    if (mode !== "live") {
      startedRef.current = false;
      return;
    }
    if (!startedRef.current) {
      startedRef.current = true;
      fetchSnapshot();
    }
    const id = setInterval(fetchSnapshot, pollMs);
    return () => clearInterval(id);
  }, [mode, fetchSnapshot, pollMs]);

  // ── Yeniden oynatma verisi ──
  const fetchReplay = useCallback(async (date?: string) => {
    setLoadingReplay(true);
    try {
      const url = date ? `/api/admin/supertrade/replay?date=${date}` : "/api/admin/supertrade/replay";
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || data?.ok === false) {
        setReplayError(data?.error || `Sunucu hatası (${res.status})`);
      } else {
        const payload = data as SPXReplayResponse;
        setReplay(payload);
        setReplayDate(payload.date);
        setReplayIndex(0);
        setReplayError(null);
      }
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : "Bağlantı hatası");
    } finally {
      setLoadingReplay(false);
    }
  }, []);

  useEffect(() => {
    if (mode === "replay" && !replay && !loadingReplay) fetchReplay();
  }, [mode, replay, loadingReplay, fetchReplay]);

  // ── Oynatma zamanlayıcısı ──
  useEffect(() => {
    if (mode !== "replay" || !playing || !replay) return;
    const id = setInterval(() => {
      setReplayIndex((prev) => {
        if (prev >= replay.frames.length - 1) {
          setPlaying(false);
          return replay.frames.length - 1;
        }
        return prev + 1;
      });
    }, Math.max(40, 1000 / speed));
    return () => clearInterval(id);
  }, [mode, playing, speed, replay]);

  // ── Birleşik görünüm modeli ──
  const view = useMemo(() => {
    if (mode === "replay") {
      if (!replay || !replay.frames.length) return null;
      const idx = Math.min(replayIndex, replay.frames.length - 1);
      const frame: Frame = replay.frames[idx];
      return {
        isReplay: true,
        isLiveSession: false,
        phase: frame.phase,
        sessionDate: replay.date,
        frame,
        factors: frame.factors,
        decision: frame.decision,
        structure: frame.structure,
        levels: replay.levels,
        context: replay.context,
        bars: replay.bars,
        cutoffTime: frame.time,
        frames: replay.frames.slice(0, idx + 1),
        vix: replay.context.volatility.vix,
        notes: replay.notes,
        feeds: null,
        changes: null,
      };
    }
    if (!snapshot || !snapshot.frames.length) return null;
    const lite = snapshot.frames[snapshot.frames.length - 1];
    return {
      isReplay: false,
      isLiveSession: snapshot.isLiveSession,
      phase: snapshot.phase,
      sessionDate: snapshot.sessionDate,
      frame: {
        ...lite,
        state: snapshot.state,
        factors: snapshot.factors,
        structure: snapshot.structure,
        decision: snapshot.decision,
      } as Frame,
      factors: snapshot.factors,
      decision: snapshot.decision,
      structure: snapshot.structure,
      levels: snapshot.levels,
      context: snapshot.context,
      bars: snapshot.bars,
      cutoffTime: undefined as number | undefined,
      frames: snapshot.frames,
      vix: snapshot.vixPrice,
      notes: snapshot.notes,
      feeds: snapshot.feeds,
      changes: snapshot.changes,
    };
  }, [mode, snapshot, replay, replayIndex]);

  // ── Otomatik İşlem Kaydı (Performans Takibi) ──
  useEffect(() => {
    if (mode !== "live" || !view || !view.isLiveSession) return;
    
    const state = view.frame.state;
    if (state.startsWith("CONFIRMED_") || state.startsWith("STRONG_")) {
      const direction = state.includes("LONG") ? "LONG" : "SHORT";
      const spx = view.levels.spx;
      // İptal seviyesi: Long için ORH (direnç kırılamazsa) veya Short için ORL
      // Not: Bu sadece basit bir referanstır, asıl değerlendirmeyi backend (performance-tracker) yapar
      const invalidationPrice = direction === "LONG" ? spx.orh : spx.orl;

      fetch("/api/admin/supertrade/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_date: view.sessionDate,
          signal_state: state,
          direction,
          entry_price: view.frame.spxPrice,
          invalidation_price: invalidationPrice,
          net_score: view.frame.netScore,
          strategy_json: { timeLabel: view.frame.timeLabel, vwap: view.frame.vwap }
        }),
      }).catch((err) => console.error("Logging error:", err));
    }
  }, [view?.frame.state, view?.isLiveSession, mode]);

  // ── Runner simülasyonu (oynatma sırasında ilerler) ──
  const runners = useMemo(() => {
    if (!view) return null;
    if (!view.isReplay && snapshot) return snapshot.runners;
    return simulateRunners({ frames: view.frames, vix: view.vix || 15 });
  }, [view, snapshot]);

  // ── Opsiyon zinciri ──
  const chain = useMemo<OptionQuote[]>(() => {
    if (!view) return [];
    const direction = view.decision.direction;
    const type: "CALL" | "PUT" =
      chainView === "call" ? "CALL" : chainView === "put" ? "PUT" : direction === "SHORT" ? "PUT" : "CALL";

    if (!view.isReplay && snapshot && chainView === "auto") return snapshot.chain;

    const [hh, mm] = view.frame.timeLabel.split(":").map(Number);
    const spot = view.frame.spxPrice;
    const orSize = view.levels.spx.orSize || 6;
    const target = type === "PUT" ? spot - Math.max(5, orSize * 2) : spot + Math.max(5, orSize * 2);

    return buildChain({
      spot,
      vix: view.vix || 15,
      minutesLeft: minutesToClose(hh * 60 + mm),
      type,
      targetPrice: target,
    });
  }, [view, chainView, snapshot]);

  const chainType = chain[0]?.type ?? "CALL";

  const loading = mode === "live" ? loadingLive : loadingReplay;
  const error = mode === "live" ? snapshotError : replayError;

  // ── İskelet / hata ──
  if (!view) {
    return (
      <div className="min-h-screen bg-[#0a0e17] p-5 text-slate-300">
        <Header mode={mode} setMode={setMode} lastUpdated={lastUpdated} live={mode === "live"} />
        <div className="mt-4">
          {error ? (
            <Panel title="Veri alınamadı">
              <p className="text-[12px] leading-relaxed text-slate-300">{error}</p>
              <p className="mt-2 text-[11px] text-slate-500">
                Piyasa veri sağlayıcısına ulaşılamadığında panel boş kalır. Bağlantıyı kontrol edip
                yeniden deneyin.
              </p>
              <button
                type="button"
                onClick={() => (mode === "live" ? fetchSnapshot() : fetchReplay(replayDate))}
                className="mt-3 rounded border border-[#3b82f6]/40 bg-[#3b82f6]/10 px-3 py-1.5 text-[12px] font-medium text-[#3b82f6] transition-colors hover:bg-[#3b82f6]/20"
              >
                Yeniden dene
              </button>
            </Panel>
          ) : (
            <EmptyState>{loading ? "Piyasa verisi yükleniyor…" : "Görüntülenecek veri yok"}</EmptyState>
          )}
        </div>
      </div>
    );
  }

  if (mode === "forecast") {
    return (
      <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
        <Header mode={mode} setMode={setMode} lastUpdated={lastUpdated} live={false} />
        {snapshot ? (
          <SuperTradeForecast snapshot={snapshot} />
        ) : (
          <EmptyState>Tahmin analizi için canlı veri bekleniyor...</EmptyState>
        )}
      </div>
    );
  }

  const { frame, decision, levels, structure, factors, context } = view;
  const dirTone = directionTone(decision.direction);
  const supporting = factors.filter((f) =>
    frame.netScore >= 0 ? f.weight > 0 : f.weight < 0
  );
  const conflicting = factors.filter((f) =>
    frame.netScore >= 0 ? f.weight < 0 : f.weight > 0
  );
  const neutralFactors = factors.filter((f) => f.weight === 0);

  return (
    <div className="min-h-screen bg-[#0a0e17] p-4 text-slate-300 md:p-5">
      <Header mode={mode} setMode={setMode} lastUpdated={lastUpdated} live={mode === "live"} />

      {/* Yeniden oynatma kontrol çubuğu */}
      {mode === "replay" && replay && (
        <div className={`${INSET} mt-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center`}>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3b82f6] text-[12px] text-white transition-colors hover:bg-[#2563eb]"
              aria-label={playing ? "Duraklat" : "Oynat"}
            >
              {playing ? "❚❚" : "▶"}
            </button>
            <div>
              <div className="text-[10px] uppercase tracking-[0.07em] text-[#3b82f6]">Simülasyon saati</div>
              <div className="text-[13px] tabular-nums text-slate-100">
                {frame.timeLabel} ET
                <span className="ml-2 text-[11px] text-slate-500">
                  {replayIndex + 1} / {replay.frames.length} dakika
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 px-1">
            <input
              type="range"
              min={0}
              max={Math.max(0, replay.frames.length - 1)}
              value={replayIndex}
              onChange={(e) => setReplayIndex(Number(e.target.value))}
              className="h-1 w-full cursor-pointer appearance-none rounded bg-[#1c2635] accent-[#3b82f6]"
            />
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-slate-500">
              <span>09:30</span>
              <span>11:00</span>
              <span>13:00</span>
              <span>16:00</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={replayDate}
              onChange={(e) => {
                setPlaying(false);
                fetchReplay(e.target.value);
              }}
              className="rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1 text-[11px] text-slate-300 outline-none"
            >
              {replay.availableDates.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1 text-[11px] text-slate-300 outline-none"
            >
              {SPEEDS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {view.notes.length > 0 && (
        <div className="mt-4 rounded-md border border-[#1c2635] bg-[#0f141d] px-3 py-2 text-[11px] text-slate-400">
          {view.notes.join(" · ")}
        </div>
      )}

      {/* Durum ve aksiyon */}
      <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel padding="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={dirTone}>{decision.direction === "NEUTRAL" ? "Yönsüz" : decision.direction}</Badge>
            <h2
              className={`text-[20px] font-medium leading-tight ${
                dirTone === "up" ? "text-[#22c55e]" : dirTone === "down" ? "text-[#ef4444]" : "text-slate-200"
              }`}
            >
              {STATE_LABEL[frame.state]}
            </h2>
            <span className="text-[12px] text-slate-500">
              {PHASE_LABEL[view.phase]} · {view.sessionDate}
              {mode === "replay" && ` · ${frame.timeLabel} ET`}
            </span>
          </div>

          <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
            {decision.statusStrength}. Net skor{" "}
            <span className={toneClass(frame.netScore)}>{signed(frame.netScore, 1)}</span>, güven{" "}
            <span className="text-slate-200">{CONFIDENCE_LABEL[frame.confidence]}</span>.
          </p>

          <div className="mt-3 grid grid-cols-1 gap-3 border-t border-[#1c2635] pt-3 md:grid-cols-3">
            <div>
              <SectionTitle>AKSİYON PLANI & KARAR</SectionTitle>
              <p className={`mt-1 text-[13px] font-medium leading-snug ${actionColor(decision.tone)}`}>
                {decision.action}
              </p>
            </div>
            <div className="md:border-l md:border-[#1c2635] md:pl-3">
              <SectionTitle>PİYASA TEYİDİ & ONAY</SectionTitle>
              <p className="mt-1 text-[13px] leading-snug text-slate-300">{decision.confirmation}</p>
            </div>
            <div className="md:border-l md:border-[#1c2635] md:pl-3">
              <SectionTitle>RİSK YÖNETİMİ & İPTAL KOŞULU (STOP)</SectionTitle>
              <p className="mt-1 text-[13px] leading-snug text-slate-300">{decision.invalidation}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Veri akışı" hint={mode === "replay" ? "arşiv" : undefined} padding="p-4">
          {view.feeds ? (
            <div className="space-y-0.5">
              {view.feeds.map((f) => (
                <Row
                  key={f.symbol}
                  label={f.label}
                  value={
                    <span
                      className={
                        f.status === "LIVE"
                          ? "text-[#22c55e]"
                          : f.status === "STALE" || f.status === "MISSING"
                          ? "text-[#ef4444]"
                          : "text-slate-400"
                      }
                    >
                      {FEED_LABEL[f.status] ?? f.status}
                      {f.status !== "CLOSED" && (
                        <span className="ml-1.5 text-[11px] text-slate-500">
                          {formatAge(f.ageSec)}
                        </span>
                      )}
                    </span>
                  }
                />
              ))}
              <div className="mt-2 border-t border-[#1c2635] pt-2">
                <Row
                  label="Son güncelleme"
                  value={lastUpdated ? lastUpdated.toLocaleTimeString("tr-TR") : "—"}
                />
                <Row
                  label="Yenileme aralığı"
                  value={pollMs >= 60000 ? `${pollMs / 60000} dk` : `${pollMs / 1000} sn`}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-0.5">
              <Row label="Kaynak" value="Arşiv seans verisi" />
              <Row label="Seans" value={view.sessionDate} />
              <Row label="Kare sayısı" value={`${replay?.frames.length ?? 0} dakika`} />
              <Row label="Hesaplama" value="Canlı motorla birebir aynı" />
            </div>
          )}
        </Panel>
      </div>

      {/* Metrik şeridi */}
      <Panel className="mt-3" padding="p-4">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          <Stat label="SPX endeksi" value={num(frame.spxPrice)} sub="Spot endeks" />
          <Stat label="ES vadeli" value={num(frame.esPrice)} sub="CME Globex" />
          <Stat
            label="ES − SPX farkı"
            value={signed(frame.basis)}
            valueClass={toneClass(frame.basis)}
            sub="Basis"
          />
          <Stat
            label="Net skor"
            value={signed(frame.netScore, 1)}
            valueClass={toneClass(frame.netScore)}
            sub={`Long ${frame.longScore.toFixed(1)} · Short ${frame.shortScore.toFixed(1)}`}
          />
          <Stat label="Güven" value={CONFIDENCE_LABEL[frame.confidence]} sub="Faktör uyumu" />
          <Stat label="Seans VWAP" value={num(frame.vwap)} sub={`ES ${frame.esPrice >= frame.vwap ? "üstünde" : "altında"}`} />
        </div>
      </Panel>

      {/* Bağlam ve rejim */}
      <div className="mt-3">
        <ContextEnginePanel context={context} liveState={frame.state} />
      </div>

      {/* Grafik ve yan paneller */}
      <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <SuperTradeLiveChart
          esBars={view.bars.es}
          spxBars={view.bars.spx}
          levels={{
            vwap: frame.vwap,
            onh: levels.es.onh,
            onl: levels.es.onl,
            orh: levels.spx.orh,
            orl: levels.spx.orl,
            pdc: levels.es.pdc,
          }}
          vwapStartTime={view.frames[0]?.time ?? 0}
          cutoffTime={view.cutoffTime}
          isReplay={view.isReplay}
          loading={loading}
        />

        <div className="flex flex-col gap-3">
          <Panel title="Kritik seviyeler" padding="p-4">
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                <Row label="Açılış ORH" value={num(levels.spx.orh)} />
                <Row label="Açılış ORL" value={num(levels.spx.orl)} />
                <Row label="OR genişliği" value={`${num(levels.spx.orSize)} puan`} />
                <Row label="Seans VWAP" value={num(frame.vwap)} valueClass="text-[#3b82f6]" />
              </div>
              <div>
                <Row label="Gece ONH" value={num(levels.es.onh)} />
                <Row label="Gece ONL" value={num(levels.es.onl)} />
                <Row label="ON orta nokta" value={num(levels.es.onMid)} />
                <Row label="Önceki kapanış" value={num(levels.es.pdc)} />
              </div>
            </div>
            <div className="mt-2 border-t border-[#1c2635] pt-2">
              <Row
                label="Fiyatın OR bandına göre konumu"
                value={
                  levels.spx.vsOr === "ABOVE"
                    ? "Bandın üstünde"
                    : levels.spx.vsOr === "BELOW"
                    ? "Bandın altında"
                    : "Bant içinde"
                }
                valueClass={
                  levels.spx.vsOr === "ABOVE"
                    ? "text-[#22c55e]"
                    : levels.spx.vsOr === "BELOW"
                    ? "text-[#ef4444]"
                    : "text-slate-300"
                }
              />
              <Row
                label="Test edilen seviye"
                value={decision.triggerLevelName}
                valueClass="text-slate-200"
              />
              <Row label="Kırılım durumu" value={decision.statusBadge} valueClass="text-slate-200" />
            </div>
          </Panel>

          <Panel title="Zaman dilimi yapısı" padding="p-4">
            <StructureRows structure={structure} />
          </Panel>

          {view.changes && view.changes.length > 0 && (
            <Panel
              title={view.isLiveSession ? "Son 5 dakikada ne değişti" : "Kapanışın son 5 dakikası"}
              padding="p-4"
            >
              <div className="space-y-0.5">
                {view.changes.map((c, i) => (
                  <Row
                    key={i}
                    label={c.label}
                    value={
                      <span className={c.tone === "UP" ? "text-[#22c55e]" : c.tone === "DOWN" ? "text-[#ef4444]" : "text-slate-300"}>
                        {c.to}
                      </span>
                    }
                    title={`Önceki: ${c.from}`}
                  />
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>

      {/* Gerekçeler */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Skoru destekleyenler" hint={`${supporting.length} faktör`} padding="p-4">
          <FactorList factors={supporting} emptyText="Yönü destekleyen faktör yok." />
        </Panel>
        <Panel title="Çelişen faktörler" hint={`${conflicting.length} faktör`} padding="p-4">
          <FactorList factors={conflicting} emptyText="Çelişen faktör yok." />
        </Panel>
        <Panel title="Nötr / bekleyen" hint={`${neutralFactors.length} faktör`} padding="p-4">
          <FactorList factors={neutralFactors} emptyText="Nötr faktör yok." />
        </Panel>
      </div>

      {/* Opsiyon zinciri */}
      <Panel
        className="mt-3"
        title="0DTE opsiyon zinciri"
        hint="teorik prim · Black-Scholes"
        padding="p-4"
        right={
          <Tabs
            size="sm"
            value={chainView}
            onChange={setChainView}
            options={[
              { value: "auto", label: `Yöne göre (${chainType})` },
              { value: "call", label: "CALL" },
              { value: "put", label: "PUT" },
            ]}
          />
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-[#1c2635] text-[10px] uppercase tracking-[0.06em] text-[#3b82f6]">
                <th className="px-2 py-2 font-medium">Grev</th>
                <th className="px-2 py-2 font-medium">Kullanım</th>
                <th className="px-2 py-2 font-medium">Tip</th>
                <th className="px-2 py-2 font-medium">OTM uzaklık</th>
                <th className="px-2 py-2 font-medium">Teorik prim</th>
                <th className="px-2 py-2 font-medium">Delta</th>
                <th className="px-2 py-2 font-medium">Günlük theta</th>
                <th className="px-2 py-2 font-medium">Başa baş</th>
                <th className="px-2 py-2 font-medium">Hedefte prim</th>
                <th className="px-2 py-2 font-medium">Hedef getirisi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1c2635]/70 tabular-nums">
              {chain.map((o) => (
                <tr key={`${o.type}-${o.strike}`} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-2 py-2 text-slate-400">{o.label}</td>
                  <td className="px-2 py-2 text-slate-100">{o.strike}</td>
                  <td className={`px-2 py-2 ${o.type === "CALL" ? "text-[#22c55e]" : "text-[#ef4444]"}`}>
                    {o.type}
                  </td>
                  <td className="px-2 py-2 text-slate-400">
                    {signed(o.otmPts)} ({o.otmPct.toFixed(2)}%)
                  </td>
                  <td className="px-2 py-2 text-slate-100">${o.premium.toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-400">{o.delta.toFixed(2)}</td>
                  <td className="px-2 py-2 text-[#ef4444]">{o.theta.toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-300">{o.breakeven.toFixed(2)}</td>
                  <td className="px-2 py-2 text-slate-300">${o.premiumAtTarget.toFixed(2)}</td>
                  <td className={`px-2 py-2 ${toneClass(o.targetReturnPct)}`}>
                    {signed(o.targetReturnPct, 1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          &quot;Hedefte prim&quot;, fiyatın açılış aralığının iki katı kadar hedef seviyeye ulaşması ve
          kalan sürenin %60&apos;ının tükenmesi varsayımıyla modellenmiştir.
        </p>
      </Panel>

      {/* Runner modelleri */}
      <Panel
        className="mt-3"
        title="Runner çıkış modelleri"
        hint={runners?.available ? `${runners.contracts} kontrat · ${runners.strike} grev` : undefined}
        padding="p-4"
      >
        {runners?.available ? (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
              <span>
                Giriş: <span className="text-slate-300">{runners.entryTime} ET</span>
              </span>
              <span>
                Yön:{" "}
                <span className={runners.direction === "LONG" ? "text-[#22c55e]" : "text-[#ef4444]"}>
                  {runners.direction}
                </span>
              </span>
              <span>
                Giriş primi:{" "}
                <span className="text-slate-300">${runners.models[0]?.entryPremium.toFixed(2)}</span>
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
              {runners.models.map((m) => (
                <div
                  key={m.id}
                  className={`${INSET} p-3 ${m.id === runners.bestId ? "ring-1 ring-[#3b82f6]/40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[12px] font-medium text-slate-100">{m.name}</div>
                    {m.id === runners.bestId && <Badge tone="brand">En iyi</Badge>}
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{m.rule}</p>
                  <div className="mt-2 border-t border-[#1c2635] pt-2">
                    <Row
                      label="Kâr / zarar"
                      value={`${m.pnl >= 0 ? "+" : ""}$${m.pnl.toFixed(2)}`}
                      valueClass={toneClass(m.pnl)}
                    />
                    <Row label="Zirve kâr" value={`+$${Math.max(0, m.maxPnl).toFixed(2)}`} />
                    <Row
                      label="Geri çekilme"
                      value={`${m.drawdownPct.toFixed(1)}%`}
                      valueClass={m.drawdownPct < 0 ? "text-[#ef4444]" : "text-slate-400"}
                    />
                    <Row label="Çıkış" value={m.open ? "Açık" : `${m.exitTime} ET`} />
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState>{runners?.reason ?? "Runner simülasyonu için veri yok."}</EmptyState>
        )}
      </Panel>

      {/* Strateji laboratuvarı */}
      <div className="mt-3">
        <StrategyLab
          spxPrice={frame.spxPrice}
          state={frame.state}
          vix={view.vix || 15}
          minutesLeft={minutesToClose(
            Number(frame.timeLabel.split(":")[0]) * 60 + Number(frame.timeLabel.split(":")[1])
          )}
        />
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
        Bu konsol araştırma ve karar desteği amaçlıdır. Opsiyon primleri teorik modellerdir, otomatik
        emre dönüşmez ve yatırım tavsiyesi değildir.
      </p>
    </div>
  );
}

// ── Yardımcı bileşenler ─────────────────────────────────────────

function Header({
  mode,
  setMode,
  lastUpdated,
  live,
}: {
  mode: "live" | "forecast" | "replay";
  setMode: (m: "live" | "forecast" | "replay") => void;
  lastUpdated: Date | null;
  live: boolean;
}) {
  return (
    <header className="flex flex-col gap-3 border-b border-[#1c2635] pb-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[16px] font-medium tracking-tight text-[#3b82f6]">
            SPX Yön ve Teyit Motoru
          </h1>
          <Badge tone="brand">SuperTrade v3</Badge>
          {lastUpdated && (
            <span className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-[#22c55e]" : "bg-slate-500"}`} />
              {lastUpdated.toLocaleDateString("tr-TR")} {lastUpdated.toLocaleTimeString("tr-TR")}
            </span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Yönetici konsolu — gün içi seviye, yapı ve kırılım teyidi takibi
        </p>
        <div className="mt-2">
          <EngineNav />
        </div>
      </div>
      <Tabs
        value={mode}
        onChange={(m) => setMode(m as any)}
        options={[
          { value: "live", label: "Canlı / Bugün" },
          { value: "forecast", label: "Tahmin (Yarın)" },
          { value: "replay", label: "Arşiv (Geçmiş)" },
        ]}
      />
    </header>
  );
}

function FactorList({ factors, emptyText }: { factors: ScoreFactor[]; emptyText: string }) {
  if (!factors.length) {
    return <p className="text-[12px] text-slate-500">{emptyText}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {factors.map((f, i) => (
        <li key={i} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[12px] text-slate-200">{f.label}</div>
            <div className="text-[11px] leading-snug text-slate-500">{f.detail}</div>
          </div>
          <span className={`shrink-0 text-[12px] tabular-nums ${toneClass(f.weight)}`}>
            {f.weight === 0 ? "0.00" : signed(f.weight)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function StructureRows({ structure }: { structure: StructureSet }) {
  const rows: { label: string; value: string }[] = [
    { label: "ES 15 dakika", value: STRUCTURE_LABEL[structure.es15m] },
    { label: "ES 5 dakika", value: STRUCTURE_LABEL[structure.es5m] },
    { label: "ES 1 dakika", value: STRUCTURE_LABEL[structure.es1m] },
    { label: "SPX 5 dakika", value: STRUCTURE_LABEL[structure.spx5m] },
    { label: "SPX 1 dakika", value: STRUCTURE_LABEL[structure.spx1m] },
  ];
  return (
    <div className="space-y-0.5">
      {rows.map((r) => (
        <Row
          key={r.label}
          label={r.label}
          value={r.value}
          valueClass={
            r.value === "Yükselen"
              ? "text-[#22c55e]"
              : r.value === "Düşen"
              ? "text-[#ef4444]"
              : "text-slate-400"
          }
        />
      ))}
    </div>
  );
}
