"""
SPX Live Engine — Session Replay Engine & Daily Review Report Generator
Reconstructs historical sessions minute-by-minute and generates 16:00 ET Session Analytics.
"""

import pandas as pd
import datetime
import json
import logging
from typing import Dict, Any, List, Optional
from spx_engine.time_session import SPXSessionClock, NY_TZ
from spx_engine.levels_vwap import SPXLevelEngine
from spx_engine.structure_engine import SPXStructureEngine
from spx_engine.scoring_state import SPXScoringStateEngine, SignalState
from spx_engine.storage import SPXStorageManager

logger = logging.getLogger("spx_engine.analytics_replay")

class SPXSessionReplayEngine:
    def __init__(self, storage_mgr: Optional[SPXStorageManager] = None):
        self.clock = SPXSessionClock()
        self.storage_mgr = storage_mgr or SPXStorageManager()
        self.level_engine = SPXLevelEngine(self.clock)
        self.structure_engine = SPXStructureEngine()
        self.scoring_engine = SPXScoringStateEngine()

    def run_historical_replay(self, es_df: pd.DataFrame, spx_df: pd.DataFrame,
                               target_date_str: str) -> List[dict]:
        snapshots = []
        if es_df.empty or spx_df.empty:
            return snapshots

        es_day = es_df[es_df.index.strftime("%Y-%m-%d") == target_date_str]
        spx_day = spx_df[spx_df.index.strftime("%Y-%m-%d") == target_date_str]

        if es_day.empty:
            return snapshots

        prev_state = SignalState.NEUTRAL

        for idx in range(len(es_day)):
            current_time = es_day.index[idx]

            es_hist = es_df[es_df.index <= current_time]
            spx_hist = spx_df[spx_df.index <= current_time]

            es_5m = es_hist.resample('5min').agg({'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}).dropna()
            es_15m = es_hist.resample('15min').agg({'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}).dropna()
            spx_5m = spx_hist.resample('5min').agg({'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}).dropna()

            levels = self.level_engine.compute_all_levels(es_hist, spx_hist, dt=current_time)
            mtf_struct = self.structure_engine.build_multi_timeframe_summary(es_15m, es_5m, es_hist, spx_5m, spx_hist)

            spx_lvl = levels.get("spx", {})
            orh = spx_lvl.get("orh", 0.0)
            orl = spx_lvl.get("orl", 0.0)
            
            brk_long = self.structure_engine.evaluate_level_breakout(spx_hist, orh, "LONG", spx_5m) if orh > 0 else "NONE"
            brk_short = self.structure_engine.evaluate_level_breakout(spx_hist, orl, "SHORT", spx_5m) if orl > 0 else "NONE"

            l_score, s_score, net_score, score_breakdown = self.scoring_engine.compute_scores(
                levels_data=levels,
                structure_data=mtf_struct,
                nq_direction=mtf_struct.get("es_5m", "NEUTRAL"),
                vix_direction="BELOW_VWAP",
                breadth_positive=True,
                spx_breakout_state_long=brk_long,
                spx_breakout_state_short=brk_short
            )

            phase = self.clock.get_session_phase(current_time)
            conf_tier, prob_bucket = self.scoring_engine.determine_confidence_and_probability(l_score, s_score, net_score)
            
            new_state, state_changed = self.scoring_engine.evaluate_state_transition(
                prev_state=prev_state,
                long_score=l_score,
                short_score=s_score,
                net_score=net_score,
                session_phase=phase
            )
            prev_state = new_state

            snapshot = {
                "timestamp": current_time.isoformat(),
                "session_phase": phase,
                "macro_state": "NORMAL",
                "spx_price": float(spx_hist.iloc[-1]['close']) if not spx_hist.empty else 0.0,
                "es_price": float(es_hist.iloc[-1]['close']),
                "es_spx_basis": round(float(es_hist.iloc[-1]['close']) - (float(spx_hist.iloc[-1]['close']) if not spx_hist.empty else 0.0), 2),
                "spx": levels.get("spx", {}),
                "es": levels.get("es", {}),
                "long_score": l_score,
                "short_score": s_score,
                "net_score": net_score,
                "confidence_tier": conf_tier,
                "state": new_state,
                "evidence_packet_version": "2.1"
            }
            snapshots.append(snapshot)

        return snapshots

    def generate_daily_session_review(self, date_str: str, snapshots: List[dict]) -> str:
        if not snapshots:
            return f"# DAILY SPX SESSION REVIEW ({date_str})\n\nNo snapshot data recorded for this date."

        df_snap = pd.DataFrame(snapshots)
        first_confirmed = df_snap[df_snap['state'].str.contains("CONFIRMED|STRONG", na=False)]
        
        premarket_bias = "NEUTRAL"
        pm_snaps = df_snap[df_snap['session_phase'].str.contains("PREMARKET", na=False)]
        if not pm_snaps.empty:
            avg_net = pm_snaps['net_score'].mean()
            if avg_net >= 2.0:
                premarket_bias = "STRONG LONG BIAS"
            elif avg_net >= 1.0:
                premarket_bias = "LONG BIAS"
            elif avg_net <= -2.0:
                premarket_bias = "STRONG SHORT BIAS"
            elif avg_net <= -1.0:
                premarket_bias = "SHORT BIAS"

        max_long_score = df_snap['long_score'].max()
        max_short_score = df_snap['short_score'].max()
        first_signal_time = first_confirmed.iloc[0]['timestamp'] if not first_confirmed.empty else "None"
        first_signal_dir = first_confirmed.iloc[0]['state'] if not first_confirmed.empty else "NEUTRAL"

        report = f"""# DAILY SPX SESSION REVIEW ({date_str})

### Executive Summary
- **Premarket Bias**: `{premarket_bias}`
- **First Confirmed Direction**: `{first_signal_dir}`
- **Confirmation Time**: `{first_signal_time}`
- **Strongest Long Score**: `{max_long_score} / 7.0`
- **Strongest Short Score**: `{max_short_score} / 7.0`
- **Total Session Snapshots Logged**: `{len(snapshots)}`

---

### Major State Transitions
"""
        prev_st = None
        for s in snapshots:
            st = s['state']
            if st != prev_st:
                report += f"- `{s['timestamp'][11:19]} ET`: state changed to **{st}** (Long: {s['long_score']}, Short: {s['short_score']}, Net: {s['net_score']})\n"
                prev_st = st

        report += "\n---\n*Report generated automatically by SPX Analytics Replay Engine at 16:00 ET.*"
        return report
