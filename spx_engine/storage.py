"""
SPX Live Engine — SQLite Database Persistence Manager
Handles migrations, snapshots, signal events, audit logs, and option research storage.
"""

import sqlite3
import os
import json
import datetime
import logging
from typing import Dict, Any, List, Optional
from spx_engine.time_session import NY_TZ

logger = logging.getLogger("spx_engine.storage")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "market.db")

class SPXStorageManager:
    def __init__(self, db_path: str = DB_PATH):
        self.db_path = db_path
        self._init_db()

    def _get_conn(self):
        return sqlite3.connect(self.db_path)

    def _init_db(self):
        conn = self._get_conn()
        cursor = conn.cursor()

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS spx_live_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                session_phase TEXT NOT NULL,
                macro_state TEXT NOT NULL,
                spx_price REAL NOT NULL,
                es_price REAL NOT NULL,
                es_spx_basis REAL NOT NULL,
                spx_json TEXT NOT NULL,
                es_json TEXT NOT NULL,
                nq_json TEXT NOT NULL,
                vix_json TEXT NOT NULL,
                breadth_json TEXT NOT NULL,
                long_score REAL NOT NULL,
                short_score REAL NOT NULL,
                net_score REAL NOT NULL,
                confidence_tier TEXT NOT NULL,
                state TEXT NOT NULL,
                ai_analysis_json TEXT,
                evidence_packet_version TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS spx_signal_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                event_type TEXT NOT NULL,
                price REAL NOT NULL,
                relevant_level TEXT,
                long_score_before REAL,
                long_score_after REAL,
                net_score_before REAL,
                net_score_after REAL,
                state_before TEXT,
                state_after TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS spx_audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp DATETIME NOT NULL,
                username TEXT NOT NULL,
                action TEXT NOT NULL,
                viewed_signal TEXT,
                manual_notes TEXT,
                manual_override TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS spx_option_research (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                signal_id INTEGER,
                signal_timestamp DATETIME NOT NULL,
                direction TEXT NOT NULL,
                expiry TEXT NOT NULL,
                dte INTEGER NOT NULL,
                spx_price_at_signal REAL NOT NULL,
                strike REAL NOT NULL,
                option_type TEXT NOT NULL,
                distance_otm_points REAL NOT NULL,
                distance_otm_pct REAL NOT NULL,
                entry_bid REAL,
                entry_ask REAL NOT NULL,
                entry_mid REAL,
                exit_bid REAL,
                iv_at_entry REAL,
                delta_at_entry REAL,
                quote_timestamp DATETIME,
                quote_age_ms INTEGER,
                mark_source TEXT NOT NULL,
                model_a_pnl REAL,
                model_b_pnl REAL,
                model_c_pnl REAL,
                model_d_pnl REAL,
                model_e_pnl REAL,
                mfe_pts REAL,
                mae_pts REAL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        conn.commit()
        conn.close()

    def save_snapshot(self, snapshot_data: dict) -> int:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO spx_live_snapshots (
                timestamp, session_phase, macro_state, spx_price, es_price, es_spx_basis,
                spx_json, es_json, nq_json, vix_json, breadth_json,
                long_score, short_score, net_score, confidence_tier, state,
                ai_analysis_json, evidence_packet_version
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            snapshot_data.get("timestamp", datetime.datetime.now(NY_TZ).isoformat()),
            snapshot_data.get("session_phase", "OFF_HOURS"),
            snapshot_data.get("macro_state", "NORMAL"),
            float(snapshot_data.get("spx_price", 0.0)),
            float(snapshot_data.get("es_price", 0.0)),
            float(snapshot_data.get("es_spx_basis", 0.0)),
            json.dumps(snapshot_data.get("spx", {})),
            json.dumps(snapshot_data.get("es", {})),
            json.dumps(snapshot_data.get("nq", {})),
            json.dumps(snapshot_data.get("vix", {})),
            json.dumps(snapshot_data.get("breadth", {})),
            float(snapshot_data.get("long_score", 0.0)),
            float(snapshot_data.get("short_score", 0.0)),
            float(snapshot_data.get("net_score", 0.0)),
            snapshot_data.get("confidence_tier", "LOW"),
            snapshot_data.get("state", "NEUTRAL"),
            json.dumps(snapshot_data.get("ai_analysis", {})) if snapshot_data.get("ai_analysis") else None,
            snapshot_data.get("evidence_packet_version", "2.1")
        ))
        row_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return row_id

    def get_latest_snapshot(self) -> Optional[dict]:
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            SELECT timestamp, session_phase, macro_state, spx_price, es_price, es_spx_basis,
                   spx_json, es_json, nq_json, vix_json, breadth_json,
                   long_score, short_score, net_score, confidence_tier, state,
                   ai_analysis_json, evidence_packet_version
            FROM spx_live_snapshots
            ORDER BY id DESC LIMIT 1
        ''')
        row = cursor.fetchone()
        conn.close()
        if not row:
            return None

        return {
            "timestamp": row[0],
            "session_phase": row[1],
            "macro_state": row[2],
            "spx_price": row[3],
            "es_price": row[4],
            "es_spx_basis": row[5],
            "spx": json.loads(row[6]) if row[6] else {},
            "es": json.loads(row[7]) if row[7] else {},
            "nq": json.loads(row[8]) if row[8] else {},
            "vix": json.loads(row[9]) if row[9] else {},
            "breadth": json.loads(row[10]) if row[10] else {},
            "long_score": row[11],
            "short_score": row[12],
            "net_score": row[13],
            "confidence_tier": row[14],
            "state": row[15],
            "ai_analysis": json.loads(row[16]) if row[16] else None,
            "evidence_packet_version": row[17]
        }

    def save_signal_event(self, event_type: str, price: float, relevant_level: str,
                          state_before: str, state_after: str,
                          score_before: float = 0.0, score_after: float = 0.0,
                          net_before: float = 0.0, net_after: float = 0.0):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO spx_signal_events (
                timestamp, event_type, price, relevant_level,
                long_score_before, long_score_after, net_score_before, net_score_after,
                state_before, state_after
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            datetime.datetime.now(NY_TZ).isoformat(),
            event_type, price, relevant_level,
            score_before, score_after, net_before, net_after,
            state_before, state_after
        ))
        conn.commit()
        conn.close()

    def log_admin_action(self, username: str, action: str, viewed_signal: str = "",
                         manual_notes: str = "", manual_override: str = ""):
        conn = self._get_conn()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO spx_audit_log (
                timestamp, username, action, viewed_signal, manual_notes, manual_override
            ) VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            datetime.datetime.now(NY_TZ).isoformat(),
            username, action, viewed_signal, manual_notes, manual_override
        ))
        conn.commit()
        conn.close()
