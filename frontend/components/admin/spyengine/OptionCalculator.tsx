"use client";

/**
 * SPY Engine — SL/TP Hesaplayıcı + Canlı Opsiyon Zinciri (SPY Option sekmesi altı).
 *
 * Yol haritası v2 (§Hesaplama Örneği, §Emir Uygulaması) mantığını canlı veriyle
 * uygular: kullanıcı vade + strike seçer → sistem giriş primini, deltayı, 15m
 * yapısal stopunu (Stop_SPY), prim stopunu (Stop_prem, +0.10 payla), 1.5R
 * hedefini (Hedef_SPY / Hedef_prim), risk/ödül ve kontrat sayısını hesaplar.
 *
 * Veri: /api/admin/spyengine/v2/option-chain (canlı SPY, 15m/5m ATR(14), son
 * 15m dip/tepe, 0–5DTE zincir + Black-Scholes delta). Her 15m mum kapanışında
 * ve elle yenilenir. Hiçbir değer uydurulmaz — eksikse "—" gösterilir.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SURFACE } from "./panels";
import {
  stopSpyOf,
  stopPremiumOf,
  takeProfitSpy,
  targetPremiumOf,
  dynamicAtrMultiplier,
  positionSize,
  vixRegime,
} from "@/lib/spyengine/tradingPlan";
import { timeValueRatio } from "@/lib/spyengine/optionMath";

interface ChainRowOut {
  contractSymbol: string;
  strike: number;
  isCall: boolean;
  premiumAsk: number | null;
  premiumMid: number | null;
  bid: number | null;
  ask: number | null;
  iv: number | null;
  delta: number | null;
}

interface ExpiryOut {
  expiryEpoch: number;
  expiryDate: string;
  dte: number;
  calls: ChainRowOut[];
  puts: ChainRowOut[];
}

interface ChainResponse {
  ok: boolean;
  serverTime?: number;
  spot?: number | null;
  atr15m?: number | null;
  atr5m?: number | null;
  last15mLow?: number | null;
  last15mHigh?: number | null;
  expiries?: ExpiryOut[];
  error?: string;
}

const fmt = (n: number | null | undefined, d = 2) =>
  n == null || !Number.isFinite(n) ? "—" : n.toFixed(d);

/** Bir sonraki 15m mum kapanışına kalan saniye (00/15/30/45 ET dakikaları). */
function secsToNext15m(): number {
  const now = Date.now();
  const span = 15 * 60 * 1000;
  return Math.ceil((span - (now % span)) / 1000);
}

export default function OptionCalculator() {
  const [data, setData] = useState<ChainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(secsToNext15m());

  // Seçimler
  const [dteIdx, setDteIdx] = useState(0);
  const [side, setSide] = useState<"CALL" | "PUT">("CALL");
  const [strike, setStrike] = useState<number | null>(null);

  // Manuel geçersiz kılmalar (boş = otomatik)
  const [entrySpyOverride, setEntrySpyOverride] = useState("");
  const [entryPremOverride, setEntryPremOverride] = useState("");
  const [swingOverride, setSwingOverride] = useState("");
  const [vixInput, setVixInput] = useState("");
  const [isDataDay, setIsDataDay] = useState(false);

  const fetchedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/spyengine/v2/option-chain", {
        credentials: "include",
        cache: "no-store",
      });
      const json: ChainResponse = await res.json();
      if (!json.ok) throw new Error(json.error || "zincir alınamadı");
      setData(json);
      setLastFetch(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // İlk yükleme
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    load();
  }, [load]);

  // 15m mum kapanışında otomatik yenile + geri sayım
  useEffect(() => {
    const t = setInterval(() => {
      const s = secsToNext15m();
      setCountdown(s);
      if (s >= 15 * 60 - 1) load(); // yeni 15m periyodu başladı
    }, 1000);
    return () => clearInterval(t);
  }, [load]);

  const expiry = data?.expiries?.[dteIdx] ?? null;
  const rows = expiry ? (side === "CALL" ? expiry.calls : expiry.puts) : [];

  // Seçili strike yoksa ATM'ye en yakını seç
  useEffect(() => {
    if (!rows.length || data?.spot == null) return;
    if (strike != null && rows.some((r) => r.strike === strike)) return;
    const spot = data.spot;
    let best = rows[0].strike;
    let bestD = Infinity;
    for (const r of rows) {
      const d = Math.abs(r.strike - spot);
      if (d < bestD) { bestD = d; best = r.strike; }
    }
    setStrike(best);
  }, [rows, data?.spot, strike]);

  const selected = rows.find((r) => r.strike === strike) ?? null;
  const dirSide: "LONG" | "SHORT" = side === "CALL" ? "LONG" : "SHORT";

  const calc = useMemo(() => {
    if (!data || data.spot == null || !selected) return null;
    const spot = data.spot;
    const atr15 = data.atr15m;
    if (atr15 == null) return null;

    const entrySpy = entrySpyOverride ? Number(entrySpyOverride) : spot;
    const entryPrem = entryPremOverride
      ? Number(entryPremOverride)
      : selected.premiumAsk ?? selected.premiumMid ?? null;
    const delta = selected.delta;
    const autoSwing = side === "CALL" ? data.last15mLow : data.last15mHigh;
    const swing = swingOverride ? Number(swingOverride) : autoSwing;

    if (entryPrem == null || delta == null || swing == null) {
      return { missing: true, entrySpy, entryPrem, delta, swing, atr15 } as const;
    }

    const vix = vixInput ? Number(vixInput) : null;
    const atrMult = dynamicAtrMultiplier({ vix, isDataDay });
    const stopSpy = stopSpyOf(swing, atr15, dirSide, atrMult);
    const stopPrem = stopPremiumOf(entryPrem, entrySpy, stopSpy, delta, dirSide);
    const targetSpy = takeProfitSpy(entrySpy, stopSpy, dirSide, 1.5);
    const targetPrem = targetPremiumOf(entryPrem, entrySpy, targetSpy, delta, dirSide);

    const riskDollars = Math.max(0, (entryPrem - stopPrem)) * 100;
    const rewardDollars = Math.max(0, (targetPrem - entryPrem)) * 100;
    const rr = riskDollars > 0 ? rewardDollars / riskDollars : null;

    const stopDistSpy = Math.abs(entrySpy - stopSpy);
    const size = positionSize(stopDistSpy, delta);
    const tvRatio = timeValueRatio(entryPrem, side === "CALL", spot, selected.strike);
    const spread =
      selected.bid != null && selected.ask != null && entryPrem > 0
        ? (selected.ask - selected.bid) / entryPrem
        : null;
    const vr = vixRegime(vix);

    return {
      missing: false as const,
      entrySpy, entryPrem, delta, swing, atr15, atrMult,
      stopSpy, stopPrem, targetSpy, targetPrem,
      riskDollars, rewardDollars, rr, stopDistSpy, size, tvRatio, spread, vr,
    };
  }, [data, selected, side, dirSide, entrySpyOverride, entryPremOverride, swingOverride, vixInput, isDataDay]);

  const cd = `${String(Math.floor(countdown / 60)).padStart(2, "0")}:${String(countdown % 60).padStart(2, "0")}`;

  return (
    <div className={`${SURFACE} p-3`}>
      {/* Başlık + canlı şerit */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-slate-200">
          SL / TP Hesaplayıcı & Canlı Opsiyon Zinciri
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          <span>15m kapanışa: <b className="font-mono text-slate-200">{cd}</b></span>
          <button
            onClick={load}
            disabled={loading}
            className="rounded border border-[#2a3a52] bg-[#131a26] px-2 py-0.5 text-slate-300 hover:bg-[#1a2434] disabled:opacity-50"
          >
            {loading ? "yenileniyor…" : "yenile"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] text-red-300">
          {error}
        </div>
      )}

      {/* Canlı SPY + ATR şeridi */}
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="SPY spot" value={fmt(data?.spot)} />
        <Stat label="ATR(14) 15m" value={fmt(data?.atr15m)} />
        <Stat label="ATR(14) 5m" value={fmt(data?.atr5m)} />
        <Stat
          label="Son 15m dip / tepe"
          value={`${fmt(data?.last15mLow)} / ${fmt(data?.last15mHigh)}`}
        />
      </div>

      {/* DTE + yön seçimi */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(data?.expiries ?? []).map((e, i) => (
          <button
            key={e.expiryEpoch}
            onClick={() => { setDteIdx(i); setStrike(null); }}
            className={`rounded px-2 py-0.5 text-[10px] font-mono ${
              i === dteIdx
                ? "border border-sky-500/50 bg-sky-500/15 text-sky-200"
                : "border border-[#1c2635] bg-[#0f141d] text-slate-400 hover:bg-[#151d2a]"
            }`}
          >
            {e.dte}DTE · {e.expiryDate.slice(5)}
          </button>
        ))}
        <div className="ml-auto flex gap-1">
          {(["CALL", "PUT"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setSide(s); setStrike(null); }}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                s === side
                  ? s === "CALL"
                    ? "border border-emerald-500/50 bg-emerald-500/15 text-emerald-200"
                    : "border border-rose-500/50 bg-rose-500/15 text-rose-200"
                  : "border border-[#1c2635] bg-[#0f141d] text-slate-400 hover:bg-[#151d2a]"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Opsiyon zinciri tablosu */}
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border-collapse text-[10px]">
          <thead>
            <tr className="text-slate-500">
              <th className="px-1.5 py-1 text-left">Strike</th>
              <th className="px-1.5 py-1 text-right">Bid</th>
              <th className="px-1.5 py-1 text-right">Ask (prim)</th>
              <th className="px-1.5 py-1 text-right">Mid</th>
              <th className="px-1.5 py-1 text-right">Delta</th>
              <th className="px-1.5 py-1 text-right">IV</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} className="px-1.5 py-3 text-center text-slate-500">Zincir verisi yok</td></tr>
            )}
            {rows.map((r) => {
              const sel = r.strike === strike;
              const inBand = r.delta != null && Math.abs(r.delta) >= 0.70 && Math.abs(r.delta) <= 0.85;
              return (
                <tr
                  key={r.contractSymbol}
                  onClick={() => setStrike(r.strike)}
                  className={`cursor-pointer border-t border-[#141c28] ${
                    sel ? "bg-sky-500/15" : "hover:bg-[#131a26]"
                  }`}
                >
                  <td className="px-1.5 py-1 font-mono text-slate-200">{r.strike}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-slate-400">{fmt(r.bid)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-slate-200">{fmt(r.ask)}</td>
                  <td className="px-1.5 py-1 text-right font-mono text-slate-400">{fmt(r.premiumMid)}</td>
                  <td className={`px-1.5 py-1 text-right font-mono ${inBand ? "text-emerald-300" : "text-slate-300"}`}>
                    {r.delta == null ? "—" : fmt(r.delta, 2)}
                  </td>
                  <td className="px-1.5 py-1 text-right font-mono text-slate-400">
                    {r.iv == null ? "—" : `${(r.iv * 100).toFixed(1)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="mt-1 text-[9px] text-slate-600">
          Yeşil delta = hedef bandı (0,70–0,85). Satıra tıklayarak strike seç. Delta = Yahoo IV'sinden Black-Scholes.
        </div>
      </div>

      {/* Manuel girişler */}
      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Field label="Giriş SPY" placeholder={fmt(data?.spot)} value={entrySpyOverride} onChange={setEntrySpyOverride} />
        <Field label="Giriş primi" placeholder={fmt(selected?.premiumAsk)} value={entryPremOverride} onChange={setEntryPremOverride} />
        <Field
          label={side === "CALL" ? "15m dip" : "15m tepe"}
          placeholder={fmt(side === "CALL" ? data?.last15mLow : data?.last15mHigh)}
          value={swingOverride}
          onChange={setSwingOverride}
        />
        <Field label="VIX" placeholder="opsiyonel" value={vixInput} onChange={setVixInput} />
        <label className="flex flex-col gap-0.5 text-[9px] text-slate-500">
          Veri/FOMC günü
          <button
            onClick={() => setIsDataDay((v) => !v)}
            className={`rounded border px-2 py-1 text-[10px] ${
              isDataDay
                ? "border-amber-500/50 bg-amber-500/15 text-amber-200"
                : "border-[#1c2635] bg-[#0f141d] text-slate-400"
            }`}
          >
            {isDataDay ? "EVET (0.50×ATR)" : "hayır"}
          </button>
        </label>
      </div>

      {/* Sonuç */}
      {!calc ? (
        <div className="rounded border border-[#1c2635] bg-[#0f141d] px-3 py-3 text-center text-[11px] text-slate-500">
          Strike seç ve canlı veri bekle — SPY, 15m ATR ve delta gerekli.
        </div>
      ) : calc.missing ? (
        <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[10px] text-amber-300">
          Hesap için eksik veri: {calc.entryPrem == null && "prim "}
          {calc.delta == null && "delta "}
          {calc.swing == null && "15m dip/tepe "}
          — elle girebilirsin.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Result label="Giriş" spy={calc.entrySpy} prem={calc.entryPrem} tone="neutral" />
          <Result label={`Stop (${calc.atrMult}×ATR)`} spy={calc.stopSpy} prem={calc.stopPrem} tone="stop" />
          <Result label="Hedef (1,5R)" spy={calc.targetSpy} prem={calc.targetPrem} tone="target" />
          <div className="rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1.5">
            <div className="text-[9px] text-slate-500">Risk / Ödül</div>
            <div className="mt-0.5 font-mono text-[12px] text-slate-200">
              ${calc.riskDollars.toFixed(0)} / ${calc.rewardDollars.toFixed(0)}
            </div>
            <div className="text-[10px] text-slate-400">R:R {calc.rr == null ? "—" : calc.rr.toFixed(2)}</div>
          </div>
          <div className="col-span-2 rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1.5 text-[10px] text-slate-300 sm:col-span-4">
            <span className="mr-3">Kontrat: <b className="text-slate-100">{calc.size.contracts}</b> (risk ${calc.size.riskDollars.toFixed(0)})</span>
            <span className="mr-3">Stop mesafesi: <b className="text-slate-100">{calc.stopDistSpy.toFixed(2)} pt</b></span>
            <span className="mr-3">
              Zaman değeri oranı:{" "}
              <b className={calc.tvRatio != null && calc.tvRatio < 0.35 ? "text-emerald-300" : "text-amber-300"}>
                {calc.tvRatio == null ? "—" : `${(calc.tvRatio * 100).toFixed(0)}%`}
              </b>{" "}
              {calc.tvRatio != null && calc.tvRatio >= 0.35 && "(>%35 — bir alt strike'a bak)"}
            </span>
            <span className="mr-3">
              Spread:{" "}
              <b className={calc.spread != null && calc.spread <= 0.015 ? "text-emerald-300" : "text-amber-300"}>
                {calc.spread == null ? "—" : `${(calc.spread * 100).toFixed(1)}%`}
              </b>{" "}
              {calc.spread != null && calc.spread > 0.015 && "(>%1,5 — işlem yok)"}
            </span>
            {calc.vr.sizeMult !== 1 && (
              <span className="text-amber-300">VIX {calc.vr.band}: {calc.vr.action}</span>
            )}
          </div>
        </div>
      )}

      {lastFetch && (
        <div className="mt-2 text-[9px] text-slate-600">
          Son güncelleme: {new Date(lastFetch).toLocaleTimeString("tr-TR")} · her 15m kapanışında otomatik yenilenir
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[#1c2635] bg-[#0f141d] px-2 py-1.5">
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-[13px] text-slate-100">{value}</div>
    </div>
  );
}

function Field({
  label, placeholder, value, onChange,
}: {
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-[9px] text-slate-500">
      {label}
      <input
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded border border-[#1c2635] bg-[#0b0f16] px-2 py-1 font-mono text-[11px] text-slate-200 placeholder:text-slate-600 focus:border-sky-500/50 focus:outline-none"
      />
    </label>
  );
}

function Result({
  label, spy, prem, tone,
}: {
  label: string; spy: number; prem: number; tone: "neutral" | "stop" | "target";
}) {
  const border =
    tone === "stop" ? "border-rose-500/40" : tone === "target" ? "border-emerald-500/40" : "border-[#1c2635]";
  const bg =
    tone === "stop" ? "bg-rose-500/10" : tone === "target" ? "bg-emerald-500/10" : "bg-[#0f141d]";
  return (
    <div className={`rounded border ${border} ${bg} px-2 py-1.5`}>
      <div className="text-[9px] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-[12px] text-slate-100">SPY {spy.toFixed(2)}</div>
      <div className="font-mono text-[12px] text-slate-300">prim {prem.toFixed(2)}</div>
    </div>
  );
}
