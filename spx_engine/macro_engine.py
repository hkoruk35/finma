"""
SPX Live Engine — Macro Event Engine (5-State Macro Risk Manager)
Manages economic calendar releases (CPI, FOMC, NFP) and suppresses technical bias during high-impact news windows.
"""

import datetime
import logging
from typing import Dict, Any, List, Optional, Tuple
from spx_engine.time_session import NY_TZ, localize_ny

logger = logging.getLogger("spx_engine.macro_engine")

class MacroState:
    NORMAL = "NORMAL"
    PRE_EVENT = "PRE_EVENT"                     # T-10m to T-1m
    EVENT_LOCKOUT = "EVENT_LOCKOUT"             # T-0m to T+2m
    POST_EVENT_DISCOVERY = "POST_EVENT_DISCOVERY" # T+2m until 5m structure reforms

class SPXMacroEngine:
    def __init__(self):
        self.events_schedule = [
            {"date": "2026-08-15", "time": "08:30", "name": "CPI Inflation Report", "impact": "HIGH"},
            {"date": "2026-08-15", "time": "14:00", "name": "FOMC Rate Decision", "impact": "HIGH"},
            {"date": "2026-08-14", "time": "08:30", "name": "PPI Inflation Report", "impact": "HIGH"},
            {"date": "2026-08-07", "time": "08:30", "name": "Non-Farm Payrolls (NFP)", "impact": "HIGH"}
        ]

    def add_custom_event(self, date_str: str, time_str: str, name: str, impact: str = "HIGH"):
        self.events_schedule.append({
            "date": date_str, "time": time_str, "name": name, "impact": impact
        })

    def evaluate_macro_state(self, dt: Optional[datetime.datetime] = None) -> Tuple[str, Optional[dict]]:
        if dt is None:
            dt = datetime.datetime.now(NY_TZ)
        else:
            dt = localize_ny(dt)

        current_date_str = dt.strftime("%Y-%m-%d")
        
        for ev in self.events_schedule:
            if ev["date"] == current_date_str:
                ev_time_parts = ev["time"].split(":")
                ev_dt = localize_ny(datetime.datetime.combine(
                    dt.date(),
                    datetime.time(int(ev_time_parts[0]), int(ev_time_parts[1]), 0)
                ))

                delta_sec = (dt - ev_dt).total_seconds()

                if -600 <= delta_sec < -60:
                    return MacroState.PRE_EVENT, ev
                elif -60 <= delta_sec <= 120:
                    return MacroState.EVENT_LOCKOUT, ev
                elif 120 < delta_sec <= 900:
                    return MacroState.POST_EVENT_DISCOVERY, ev

        return MacroState.NORMAL, None

    def get_next_market_event(self, dt: Optional[datetime.datetime] = None) -> str:
        if dt is None:
            dt = datetime.datetime.now(NY_TZ)
        else:
            dt = localize_ny(dt)

        current_date_str = dt.strftime("%Y-%m-%d")
        for ev in self.events_schedule:
            if ev["date"] == current_date_str:
                ev_time_parts = ev["time"].split(":")
                ev_dt = localize_ny(datetime.datetime.combine(
                    dt.date(),
                    datetime.time(int(ev_time_parts[0]), int(ev_time_parts[1]), 0)
                ))
                if ev_dt >= dt:
                    return f"{ev['time']} ET — {ev['name']}"
        return "None Remaining Today"
