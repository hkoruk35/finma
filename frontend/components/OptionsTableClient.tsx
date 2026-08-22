"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { OptionPick } from "@/lib/data";
import TickerHoverChart from "./TickerHoverChart";
import { formatNumber } from "@/lib/formatNumber";

function n(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return formatNumber(v, d);
}
function pct(v: any, d = 1): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  const x = Number(v);
  return (x >= 0 ? "+" : "") + formatNumber(x, d) + "%";
}
function dollar(v: any, d = 2): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return "$" + formatNumber(v, d);
}
function num(v: any, d = 0): string {
  if (v == null || v === "" || isNaN(Number(v))) return "—";
  return formatNumber(Number(v), d);
}

const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
  <th className={`px-2 py-2 text-[10px] font-medium text-slate-500 uppercase tracking-tight whitespace-nowrap border-b border-white/10 ${right ? "text-right" : center ? "text-center" : "text-left"}`}>
    {children}
  </th>
);

const TD = ({ children, center, right, cls }: { children: React.ReactNode; center?: boolean; right?: boolean; cls?: string }) => (
  <td className={`px-2 py-1.5 text-[11px] font-medium whitespace-nowrap border-b border-white/[0.03] ${center ? "text-center" : right ? "text-right" : "text-left"} ${cls || "text-slate-300"}`}>
    {children}
  </td>
);

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " ET";
  } catch { return iso; }
};

export default function OptionsTableClient({ allPicks, latestData }: { allPicks: OptionPick[], latestData: any }) {
  const [selectedDate, setSelectedDate] = useState<string>("ALL");

  const uniqueDates = useMemo(() => {
    const dates = allPicks.map((p: any) => p.date).filter(Boolean);
    return Array.from(new Set(dates));
  }, [allPicks]);

  const filteredPicks = useMemo(() => {
    if (selectedDate === "ALL") return allPicks;
    return allPicks.filter((p: any) => p.date === selectedDate);
  }, [allPicks, selectedDate]);

  const handleCopy = () => {
    if (!filteredPicks.length) return;
    const header = "DATE\tTICKER\tSCORE\tSECTOR\tSETUP\tPRICE\tIVR\tRSI\tRVOL\tRS60\tTYPE\tSTRIKE\tEXP\tCOST\tΔ\tΓ\tΘ\tΓ/Θ\tSIM%\tTP\tSL";
    const rows = filteredPicks.flatMap((pick: any) => {
      const opts = pick.options || {};
      const contracts = [];
      if (opts.gamma_sweet) contracts.push({ ...opts.gamma_sweet, label: "GAMMA" });
      if (opts.institutional) contracts.push({ ...opts.institutional, label: "INST." });
      if (contracts.length === 0 && pick.institutional) contracts.push({ ...pick.institutional, label: "INST." });
      if (contracts.length === 0) contracts.push({ label: "—" });
      
      return contracts.map((c, cIdx) => {
        return [
          cIdx === 0 ? pick.date : pick.date,
          pick.ticker,
          cIdx === 0 ? formatNumber(pick.score, 0) : "",
          cIdx === 0 ? (pick.sector_info?.etf || pick.sector || "—") : "",
          cIdx === 0 ? (pick.s5?.setup_type || pick.entry_mode_label || "—") : "",
          cIdx === 0 ? dollar(pick.current_price) : "",
          cIdx === 0 ? n(pick.iv_rank || opts.iv_rank, 0) : "",
          cIdx === 0 ? n(pick.mtf?.rsi_1d || pick.rsi, 1) : "",
          cIdx === 0 ? n(pick.s7?.today_rvol || pick.rvol, 1) + "x" : "",
          cIdx === 0 ? pct(pick.l4?.rs_60 || pick.rs_vs_spy_60d) : "",
          c.label,
          c.strike ? `$${c.strike} C` : "—",
          c.expiration || c.expiry || "—",
          dollar(c.cost_per_contract || c.contract_cost || (c.premium ? c.premium * 100 : null), 0),
          n(c.delta, 2),
          n(c.gamma, 4),
          n(c.theta, 3),
          n(c.gt_ratio, 2),
          pct(c.sim?.pnl_pct || c.sim_gain_pct, 0),
          dollar(c.tp_price),
          dollar(c.sl_price)
        ].join("\t");
      });
    });
    navigator.clipboard.writeText([header, ...rows].join("\n"));
    alert("List copied to clipboard!");
  };

  const handleDownloadCSV = () => {
    if (!filteredPicks.length) return;
    const header = "DATE,TICKER,SCORE,SECTOR,SETUP,PRICE,IVR,RSI,RVOL,RS60,TYPE,STRIKE,EXP,COST,DELTA,GAMMA,THETA,GT_RATIO,SIM,TP,SL\n";
    const rows = filteredPicks.flatMap((pick: any) => {
      const opts = pick.options || {};
      const contracts = [];
      if (opts.gamma_sweet) contracts.push({ ...opts.gamma_sweet, label: "GAMMA" });
      if (opts.institutional) contracts.push({ ...opts.institutional, label: "INST." });
      if (contracts.length === 0 && pick.institutional) contracts.push({ ...pick.institutional, label: "INST." });
      if (contracts.length === 0) contracts.push({ label: "—" });
      
      return contracts.map((c, cIdx) => {
        return [
          pick.date,
          pick.ticker,
          cIdx === 0 ? formatNumber(pick.score, 0) : "",
          cIdx === 0 ? (pick.sector_info?.etf || pick.sector || "") : "",
          cIdx === 0 ? (pick.s5?.setup_type || pick.entry_mode_label || "") : "",
          cIdx === 0 ? pick.current_price : "",
          cIdx === 0 ? (pick.iv_rank || opts.iv_rank || "") : "",
          cIdx === 0 ? (pick.mtf?.rsi_1d || pick.rsi || "") : "",
          cIdx === 0 ? (pick.s7?.today_rvol || pick.rvol || "") : "",
          cIdx === 0 ? (pick.l4?.rs_60 || pick.rs_vs_spy_60d || "") : "",
          c.label,
          c.strike || "",
          c.expiration || c.expiry || "",
          c.cost_per_contract || c.contract_cost || (c.premium ? c.premium * 100 : ""),
          c.delta || "",
          c.gamma || "",
          c.theta || "",
          c.gt_ratio || "",
          c.sim?.pnl_pct || c.sim_gain_pct || "",
          c.tp_price || "",
          c.sl_price || ""
        ].map(v => `"${v}"`).join(",");
      });
    });
    
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `boga_options_${selectedDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadXLS = () => {
    if (!filteredPicks.length) return;
    const header = "DATE\tTICKER\tSCORE\tSECTOR\tSETUP\tPRICE\tIVR\tRSI\tRVOL\tRS60\tTYPE\tSTRIKE\tEXP\tCOST\tDELTA\tGAMMA\tTHETA\tGT_RATIO\tSIM\tTP\tSL\n";
    const rows = filteredPicks.flatMap((pick: any) => {
      const opts = pick.options || {};
      const contracts = [];
      if (opts.gamma_sweet) contracts.push({ ...opts.gamma_sweet, label: "GAMMA" });
      if (opts.institutional) contracts.push({ ...opts.institutional, label: "INST." });
      if (contracts.length === 0 && pick.institutional) contracts.push({ ...pick.institutional, label: "INST." });
      if (contracts.length === 0) contracts.push({ label: "—" });
      
      return contracts.map((c, cIdx) => {
        return [
          pick.date,
          pick.ticker,
          cIdx === 0 ? formatNumber(pick.score, 0) : "",
          cIdx === 0 ? (pick.sector_info?.etf || pick.sector || "") : "",
          cIdx === 0 ? (pick.s5?.setup_type || pick.entry_mode_label || "") : "",
          cIdx === 0 ? pick.current_price : "",
          cIdx === 0 ? (pick.iv_rank || opts.iv_rank || "") : "",
          cIdx === 0 ? (pick.mtf?.rsi_1d || pick.rsi || "") : "",
          cIdx === 0 ? (pick.s7?.today_rvol || pick.rvol || "") : "",
          cIdx === 0 ? (pick.l4?.rs_60 || pick.rs_vs_spy_60d || "") : "",
          c.label,
          c.strike || "",
          c.expiration || c.expiry || "",
          c.cost_per_contract || c.contract_cost || (c.premium ? c.premium * 100 : ""),
          c.delta || "",
          c.gamma || "",
          c.theta || "",
          c.gt_ratio || "",
          c.sim?.pnl_pct || c.sim_gain_pct || "",
          c.tp_price || "",
          c.sl_price || ""
        ].join("\t");
      });
    });
    
    const blob = new Blob([header + rows.join("\n")], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `boga_options_${selectedDate}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg font-medium text-white tracking-tighter uppercase italic">
            BOGA <span className="text-[#3b82f6]">OPTIONS</span> v242
          </span>
          <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded border border-white/10 uppercase tracking-widest font-medium">
            Institutional Terminal
          </span>
          <Link 
            href="/admin/trading/options/performance" 
            className="ml-2 text-[10px] text-white hover:text-[#34d399] bg-[#34d399]/10 hover:bg-[#34d399]/20 px-3 py-1 rounded border border-[#34d399]/30 hover:border-[#34d399]/60 uppercase tracking-widest font-medium flex items-center gap-1.5 transition-all"
          >
            <span className="w-1.5 h-1.5 bg-[#34d399] rounded-full animate-pulse" />
            View P&amp;L Dashboard ↗
          </Link>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <select 
                value={selectedDate} 
                onChange={e => setSelectedDate(e.target.value)}
                className="bg-[#0c121d] border border-white/10 text-[10px] font-medium text-white px-2 py-1 outline-none uppercase tracking-wider"
              >
                <option value="ALL">All Dates</option>
                {uniqueDates.map(d => <option key={String(d)} value={String(d)}>{String(d)}</option>)}
              </select>
              <button onClick={handleCopy} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
                Copy
              </button>
              <button onClick={handleDownloadCSV} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
                CSV
              </button>
              <button onClick={handleDownloadXLS} className="bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-medium text-white px-2 py-1 uppercase tracking-wider transition-colors">
                XLS
              </button>
            </div>
            {latestData && (
              <div className="flex items-center gap-4 text-[10px] font-medium uppercase tracking-wider text-slate-400 ml-4">
                <span>VIX: <span className={latestData.vix < 20 ? "text-emerald-400" : "text-red-400"}>{formatNumber(latestData.vix, 1)}</span></span>
                <span className="hidden md:inline">|</span>
                <span>UNIVERSE: <span className="text-white">{latestData.universe_size}</span></span>
                <span className="hidden md:inline">|</span>
                <span>UPDATED: <span className="text-[#3b82f6]">{formatTime(latestData.generated_at)}</span></span>
              </div>
            )}
        </div>
      </div>

      <div className="bg-[#080c14] border border-white/10 rounded overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse leading-none">
            <thead className="bg-[#0c121d]">
              <tr>
                <TH>DATE</TH>
                <TH>TICKER</TH>
                <TH center>SCORE</TH>
                <TH>SECTOR</TH>
                <TH>SETUP</TH>
                <TH right>PRICE</TH>
                <TH right>IVR</TH>
                <TH right>RSI</TH>
                <TH right>RVOL</TH>
                <TH right>RS60</TH>
                <TH center>TYPE</TH>
                <TH>STRIKE</TH>
                <TH>EXP</TH>
                <TH right>COST</TH>
                <TH right>Δ</TH>
                <TH right>Γ</TH>
                <TH right>Θ</TH>
                <TH right>Γ/Θ</TH>
                <TH right>SIM%</TH>
                <TH right>TP</TH>
                <TH right>SL</TH>
              </tr>
            </thead>
            <tbody>
              {filteredPicks.length === 0 ? (
                <tr>
                  <td colSpan={30} className="px-6 py-20 text-center text-slate-500 uppercase tracking-widest font-medium">
                    [ NO ACTIVE SIGNALS FOUND IN DATABASE ]
                  </td>
                </tr>
              ) : (
                filteredPicks.map((pick, i) => {
                  const raw: any = pick;
                  const opts = raw.options || {};
                  
                  const contracts = [];
                  if (opts.gamma_sweet) contracts.push({ ...opts.gamma_sweet, label: "GAMMA" });
                  if (opts.institutional) contracts.push({ ...opts.institutional, label: "INST." });
                  if (contracts.length === 0 && raw.institutional) contracts.push({ ...raw.institutional, label: "INST." });
                  if (contracts.length === 0) contracts.push({ label: "—" });

                  const scoreCls = raw.score >= 90 ? "text-amber-400" : raw.score >= 75 ? "text-[#3b82f6]" : "text-emerald-400";
                  
                  return contracts.map((c, cIdx) => (
                    <tr key={`${raw.date}-${raw.ticker}-${cIdx}`} className="hover:bg-white/[0.04] transition-colors">
                      <TD cls={cIdx === 0 ? "text-slate-500" : "text-transparent"}>{cIdx === 0 ? raw.date : raw.date}</TD>
                      <TD cls={cIdx === 0 ? "text-white font-medium" : "text-slate-700"}>
                        {cIdx === 0 ? (
                          <TickerHoverChart ticker={raw.ticker}><Link href={`/en/analysis/${raw.ticker.toLowerCase()}`} className="hover:text-[#3b82f6]">{raw.ticker}</Link></TickerHoverChart>
                        ) : raw.ticker}
                      </TD>
                      <TD center cls={cIdx === 0 ? `font-medium ${scoreCls}` : "text-slate-700"}>{cIdx === 0 ? formatNumber(raw.score, 0) : ""}</TD>
                      <TD cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>
                        {cIdx === 0 ? (raw.sector_info?.etf || raw.sector || "—") : ""}
                      </TD>
                      <TD cls={cIdx === 0 ? "text-[#3b82f6] text-[10px]" : "text-transparent"}>
                        {cIdx === 0 ? (raw.s5?.setup_type || raw.entry_mode_label || "—") : ""}
                      </TD>
                      <TD right cls={cIdx === 0 ? "text-white" : "text-transparent"}>{cIdx === 0 ? dollar(raw.current_price) : ""}</TD>
                      
                      <TD right cls={cIdx === 0 ? ((raw.iv_rank ?? 0) < 30 ? "text-emerald-500" : "text-red-500") : "text-transparent"}>
                         {cIdx === 0 ? n(raw.iv_rank || opts.iv_rank, 0) : ""}
                      </TD>
                      <TD right cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>{cIdx === 0 ? n(raw.mtf?.rsi_1d || raw.rsi, 1) : ""}</TD>
                      <TD right cls={cIdx === 0 ? "text-slate-400" : "text-transparent"}>{cIdx === 0 ? n(raw.s7?.today_rvol || raw.rvol, 1) + "x" : ""}</TD>
                      <TD right cls={cIdx === 0 ? (Number(raw.l4?.rs_60 || raw.rs_vs_spy_60d) >= 0 ? "text-emerald-500" : "text-red-500") : "text-transparent"}>
                        {cIdx === 0 ? pct(raw.l4?.rs_60 || raw.rs_vs_spy_60d) : ""}
                      </TD>

                      <TD center cls={c.label === "GAMMA" ? "text-emerald-400 font-medium" : c.label === "INST." ? "text-purple-400 font-medium" : "text-slate-600"}>
                        {c.label}
                      </TD>
                      <TD cls="text-white font-medium">{c.strike ? `$${c.strike} C` : "—"}</TD>
                      <TD cls="text-slate-400">{c.expiration || c.expiry || "—"}</TD>
                      <TD right cls="text-white font-medium">{dollar(c.cost_per_contract || c.contract_cost || (c.premium ? c.premium * 100 : null), 0)}</TD>
                      <TD right cls="text-[#3b82f6]">{n(c.delta, 2)}</TD>
                      <TD right cls="text-purple-400">{n(c.gamma, 4)}</TD>
                      <TD right cls="text-red-400">{n(c.theta, 3)}</TD>
                      <TD right cls={Number(c.gt_ratio) >= 0.5 ? "text-emerald-400" : "text-slate-500"}>{n(c.gt_ratio, 2)}</TD>
                      
                      <TD right cls={Number(c.sim?.pnl_pct || c.sim_gain_pct) >= 0 ? "text-emerald-400 font-medium" : "text-red-400"}>
                        {pct(c.sim?.pnl_pct || c.sim_gain_pct, 0)}
                      </TD>
                      <TD right cls="text-emerald-500">{dollar(c.tp_price)}</TD>
                      <TD right cls="text-red-500">{dollar(c.sl_price)}</TD>
                    </tr>
                  ));
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
