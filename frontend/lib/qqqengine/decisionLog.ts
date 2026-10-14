/**
 * QQQ Engine — Karar Günlüğü (SPY ile aynı fabrika, QQQ ayarı + teknoloji liderleri filtresi).
 * Teknoloji liderleri serisi her gün için o günün verisinden yeniden kurulur; kayıtlar `qqqengine_decisions` anahtarında.
 */

import { createDecisionLog } from "@/lib/spyengine/decisionStore";
import { buildTechSnapshot, TECH_HOLDINGS } from "./techs";
import { QQQ_LADDER_CFG } from "./config";

const qqq = createDecisionLog({
  key: "qqqengine_decisions",
  symbol: "QQQ",
  cfg: QQQ_LADDER_CFG,
  extra: {
    symbols: TECH_HOLDINGS.map((h) => h.sym),
    techFor: (by, main) => (date, nowSec) => buildTechSnapshot(by, main, date, nowSec).series,
  },
});

export const updateQqqDecisionLog = qqq.update;
export const appendQqqLiveEvents = qqq.appendLive;
