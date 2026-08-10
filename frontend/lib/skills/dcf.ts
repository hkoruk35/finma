import { formatNumber } from "@/lib/formatNumber";

// WACC defaults by Yahoo Finance industry string
const SECTOR_WACC: Record<string, number> = {
  "Technology":                    0.11,
  "Semiconductors":                0.11,
  "Software—Application":          0.10,
  "Software—Infrastructure":       0.10,
  "Internet Content & Information": 0.10,
  "Wireless Telecom":              0.12,
  "Telecom Services":              0.12,
  "Communication Equipment":       0.12,
  "Healthcare":                    0.10,
  "Biotechnology":                 0.13,
  "Drug Manufacturers—General":    0.10,
  "Medical Devices":               0.10,
  "Energy":                        0.13,
  "Oil & Gas Integrated":          0.12,
  "Utilities—Regulated Electric":  0.08,
  "Utilities":                     0.08,
  "Financial Services":            0.09,
  "Banks—Regional":                0.09,
  "Real Estate":                   0.09,
  "REIT—Diversified":              0.09,
  "Consumer Cyclical":             0.10,
  "Consumer Defensive":            0.09,
  "Industrials":                   0.10,
  "default":                       0.115,
};

export interface DCFInput {
  ticker: string;
  currentPrice: number;
  revenueGrowthRate?: number;
  wacc?: number;
}

export interface DCFScenario {
  value: number;
  upside: number;
}

export interface DCFOutput {
  ticker: string;
  currentPrice: number;
  intrinsicValue: number;
  upside: number;
  scenarios: {
    bull: DCFScenario;
    base: DCFScenario;
    bear: DCFScenario;
  };
  wacc: number;
  usedGrowthRate: number;
  pvFCFSum: number;
  pvTerminalValue: number;
  netDebt: number;
  sharesOutstanding: number;
  methodology: string;
  warning?: string;
}

export function calcDCF(params: DCFInput, yfData: any): DCFOutput {
  const fd  = yfData?.financialData        ?? {};
  const ks  = yfData?.defaultKeyStatistics ?? {};
  const sd  = yfData?.summaryDetail        ?? {};
  const ap  = yfData?.assetProfile         ?? {};

  const rawFCF       = fd.freeCashflow?.raw      ?? 0;
  const totalRevenue = fd.totalRevenue?.raw       ?? 0;
  const sharesOut    = ks.sharesOutstanding?.raw  ?? ks.floatShares?.raw ?? 1;
  const totalDebt    = fd.totalDebt?.raw          ?? 0;
  const totalCash    = fd.totalCash?.raw          ?? fd.totalCashPerShare?.raw
                         ? (fd.totalCashPerShare?.raw ?? 0) * sharesOut
                         : 0;
  const netDebt      = totalDebt - totalCash;
  const revenueGrowth = fd.revenueGrowth?.raw     ?? 0.10;
  const industry      = ap.industry               ?? "default";

  const wacc = params.wacc ?? SECTOR_WACC[industry] ?? SECTOR_WACC["default"];
  const g    = params.revenueGrowthRate ?? revenueGrowth;
  const tgr  = 0.03;

  // Pre-profit fallback: estimate FCF from revenue at 8% margin
  let baseFCF = rawFCF;
  let warning: string | undefined;
  if (baseFCF === 0) {
    if (totalRevenue > 0) {
      baseFCF = totalRevenue * 0.08;
      warning = "FCF=0 — gelirin %8'i FCF olarak tahmin edildi. Dikkatli yorumla.";
    } else {
      return {
        ticker: params.ticker, currentPrice: params.currentPrice,
        intrinsicValue: 0, upside: 0,
        scenarios: { bull: { value: 0, upside: 0 }, base: { value: 0, upside: 0 }, bear: { value: 0, upside: 0 } },
        wacc, usedGrowthRate: g, pvFCFSum: 0, pvTerminalValue: 0,
        netDebt, sharesOutstanding: sharesOut,
        methodology: "Yetersiz finansal veri — DCF hesaplanamadı.",
        warning: "Yahoo Finance FCF ve revenue verisi bulunamadı.",
      };
    }
  }

  function projectScenario(growthMult: number) {
    const fcfs = Array.from({ length: 5 }, (_, i) =>
      baseFCF * Math.pow(1 + g * growthMult, i + 1)
    );
    const pvFCFs = fcfs.reduce(
      (sum, fcf, i) => sum + fcf / Math.pow(1 + wacc, i + 1), 0
    );
    const terminalFCF = fcfs[4] * (1 + tgr);
    const pvTerminal  = wacc > tgr
      ? (terminalFCF / (wacc - tgr)) / Math.pow(1 + wacc, 5)
      : 0;
    const equityValue = pvFCFs + pvTerminal - netDebt;
    const value = Math.max(0.01, equityValue / sharesOut);
    return { value: +formatNumber(value, 2), pvFCFs, pvTerminal };
  }

  const base = projectScenario(1.00);
  const bull = projectScenario(1.35);
  const bear = projectScenario(0.65);

  const upside = (base.value - params.currentPrice) / params.currentPrice;

  return {
    ticker:             params.ticker,
    currentPrice:       params.currentPrice,
    intrinsicValue:     base.value,
    upside:             +formatNumber(upside, 4),
    scenarios: {
      bull: { value: bull.value, upside: +formatNumber(((bull.value - params.currentPrice) / params.currentPrice), 4) },
      base: { value: base.value, upside: +formatNumber(upside, 4) },
      bear: { value: bear.value, upside: +formatNumber(((bear.value - params.currentPrice) / params.currentPrice), 4) },
    },
    wacc,
    usedGrowthRate:     +formatNumber(g, 4),
    pvFCFSum:           +formatNumber(base.pvFCFs, 0),
    pvTerminalValue:    +formatNumber(base.pvTerminal, 0),
    netDebt:            +formatNumber(netDebt, 0),
    sharesOutstanding:  sharesOut,
    methodology:        `5Y FCF DCF | WACC: ${formatNumber((wacc * 100), 1)}% | Büyüme: ${formatNumber((g * 100), 1)}% | TGR: ${formatNumber((tgr * 100), 1)}%`,
    ...(warning ? { warning } : {}),
  };
}
