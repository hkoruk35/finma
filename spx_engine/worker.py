"""
SPX Live Engine — Background Daemon Worker
Runs independently of the Streamlit UI / Next.js server, continuously operating from 07:00 ET to 16:00 ET.
Fetches data, evaluates deterministic signals, triggers AI, and persists state to SQLite DB.
"""

import time
import datetime
import logging
from typing import Optional
from spx_engine.time_session import SPXSessionClock, SPXSessionPhase, NY_TZ
from spx_engine.market_feed import SPXMarketFeedManager, DataQualityStatus
from spx_engine.levels_vwap import SPXLevelEngine
from spx_engine.structure_engine import SPXStructureEngine
from spx_engine.scoring_state import SPXScoringStateEngine, SignalState
from spx_engine.storage import SPXStorageManager

logger = logging.getLogger("spx_engine.worker")

class SPXBackgroundWorker:
    def __init__(self, feed_mgr: Optional[SPXMarketFeedManager] = None,
                 storage_mgr: Optional[SPXStorageManager] = None):
        self.clock = SPXSessionClock()
        self.feed_mgr = feed_mgr or SPXMarketFeedManager()
        self.storage_mgr = storage_mgr or SPXStorageManager()
        self.level_engine = SPXLevelEngine(self.clock)
        self.structure_engine = SPXStructureEngine()
        self.scoring_engine = SPXScoringStateEngine()
        
        self.is_running = False
        self.last_ai_timestamp: Optional[datetime.datetime] = None
        self.last_state = SignalState.NEUTRAL

    def run_single_cycle(self) -> dict:
        now = self.clock.get_ny_now()
        session_phase = self.clock.get_session_phase(now)

        es_1m, es_meta = self.feed_mgr.update_symbol_candles("ES", "1m")
        spx_1m, spx_meta = self.feed_mgr.update_symbol_candles("SPX", "1m")
        nq_1m, _ = self.feed_mgr.update_symbol_candles("NQ", "1m")
        vix_1m, _ = self.feed_mgr.update_symbol_candles("VIX", "1m")
        spy_1m, _ = self.feed_mgr.update_symbol_candles("SPY", "1m")

        es_5m, _ = self.feed_mgr.update_symbol_candles("ES", "5m")
        es_15m, _ = self.feed_mgr.update_symbol_candles("ES", "15m")
        spx_5m, _ = self.feed_mgr.update_symbol_candles("SPX", "5m")

        is_integrity_valid, integrity_msg, details = self.feed_mgr.evaluate_overall_data_integrity()
        is_data_stale = not is_integrity_valid

        levels_data = self.level_engine.compute_all_levels(es_1m, spx_1m, spy_1m, now)

        mtf_structure = self.structure_engine.build_multi_timeframe_summary(
            es_15m, es_5m, es_1m, spx_5m, spx_1m
        )

        spx_lvl = levels_data.get("spx", {})
        orh = spx_lvl.get("orh", 0.0)
        orl = spx_lvl.get("orl", 0.0)
        
        spx_breakout_long = self.structure_engine.evaluate_level_breakout(spx_1m, orh, "LONG", spx_5m) if orh > 0 else "NONE"
        spx_breakout_short = self.structure_engine.evaluate_level_breakout(spx_1m, orl, "SHORT", spx_5m) if orl > 0 else "NONE"

        nq_struct = mtf_structure.get("es_5m", "NEUTRAL")
        vix_dir = "BELOW_VWAP" if not vix_1m.empty and vix_1m.iloc[-1]['close'] < vix_1m.iloc[-1]['open'] else "ABOVE_VWAP"
        
        l_score, s_score, net_score, score_breakdown = self.scoring_engine.compute_scores(
            levels_data=levels_data,
            structure_data=mtf_structure,
            nq_direction=nq_struct,
            vix_direction=vix_dir,
            breadth_positive=True,
            spx_breakout_state_long=spx_breakout_long,
            spx_breakout_state_short=spx_breakout_short
        )

        confidence_tier, prob_bucket = self.scoring_engine.determine_confidence_and_probability(l_score, s_score, net_score)
        
        new_state, state_changed = self.scoring_engine.evaluate_state_transition(
            prev_state=self.last_state,
            long_score=l_score,
            short_score=s_score,
            net_score=net_score,
            session_phase=session_phase,
            is_data_stale=is_data_stale
        )

        if state_changed:
            self.storage_mgr.save_signal_event(
                event_type=f"STATE_TRANSITION_{new_state}",
                price=float(spx_1m.iloc[-1]['close']) if not spx_1m.empty else 0.0,
                relevant_level=f"ORH:{orh:.1f}" if net_score > 0 else f"ORL:{orl:.1f}",
                state_before=self.last_state,
                state_after=new_state,
                net_before=0.0,
                net_after=net_score
            )
            self.last_state = new_state

        snapshot_payload = {
            "timestamp": now.isoformat(),
            "session_phase": session_phase,
            "macro_state": "NORMAL",
            "spx_price": float(spx_1m.iloc[-1]['close']) if not spx_1m.empty else 0.0,
            "es_price": float(es_1m.iloc[-1]['close']) if not es_1m.empty else 0.0,
            "es_spx_basis": self.feed_mgr.get_es_spx_basis(),
            "spx": levels_data.get("spx", {}),
            "es": levels_data.get("es", {}),
            "nq": {"direction": nq_struct},
            "vix": {"direction": vix_dir},
            "breadth": {"state": "POSITIVE"},
            "long_score": l_score,
            "short_score": s_score,
            "net_score": net_score,
            "confidence_tier": confidence_tier,
            "state": new_state,
            "ai_analysis": None,
            "evidence_packet_version": "2.1"
        }

        self.storage_mgr.save_snapshot(snapshot_payload)
        return snapshot_payload

    def start_background_loop(self, poll_interval_sec: int = 60):
        self.is_running = True
        logger.info("SPX Background Worker Daemon Started.")
        while self.is_running:
            try:
                self.run_single_cycle()
            except Exception as e:
                logger.error(f"Error in SPX Background Worker cycle: {e}")
            time.sleep(poll_interval_sec)

    def stop(self):
        self.is_running = False
        logger.info("SPX Background Worker Daemon Stopped.")
