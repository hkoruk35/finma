"""
SPX Live Session & Timezone Clock Engine + Official Trading Calendar
Timezone: America/New_York (Handles DST automatically)
"""

import datetime
from typing import Tuple

try:
    import pytz
    NY_TZ = pytz.timezone("America/New_York")
    def localize_ny(dt: datetime.datetime) -> datetime.datetime:
        if dt.tzinfo is None:
            return NY_TZ.localize(dt)
        return dt.astimezone(NY_TZ)
except ImportError:
    import zoneinfo
    NY_TZ = zoneinfo.ZoneInfo("America/New_York")
    def localize_ny(dt: datetime.datetime) -> datetime.datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=NY_TZ)
        return dt.astimezone(NY_TZ)


class SPXSessionPhase:
    EARLY_PREMARKET = "EARLY_PREMARKET"     # 07:00 - 08:59 ET
    LATE_PREMARKET = "LATE_PREMARKET"       # 09:00 - 09:29 ET
    OPENING_DISCOVERY = "OPENING_DISCOVERY" # 09:30 - 09:34 ET (OR5)
    MAIN_SIGNAL_WINDOW = "MAIN_SIGNAL_WINDOW" # 09:35 - 10:30 ET
    REST_OF_SESSION = "REST_OF_SESSION"     # 10:30 - 16:00 ET (or 13:00 ET on early close)
    OFF_HOURS = "OFF_HOURS"                 # Session closed / Holiday / Weekend

class SPXTradingCalendar:
    """
    Handles NYSE/Cboe official trading holidays and early closure schedules.
    """
    HOLIDAYS = [
        "2026-01-01", "2026-01-19", "2026-02-16", "2026-04-03", "2026-05-25",
        "2026-06-19", "2026-07-03", "2026-09-07", "2026-11-26", "2026-12-25",
        "2025-01-01", "2025-01-20", "2025-02-17", "2025-04-18", "2025-05-26",
        "2025-06-19", "2025-07-04", "2025-09-01", "2025-11-27", "2025-12-25"
    ]

    EARLY_CLOSE_DAYS = [
        "2026-07-02", "2026-11-27", "2026-12-24",
        "2025-07-03", "2025-11-28", "2025-12-24"
    ]

    @classmethod
    def is_trading_day(cls, dt: datetime.datetime = None) -> bool:
        if dt is None:
            dt = datetime.datetime.now(NY_TZ)
        date_str = dt.strftime("%Y-%m-%d")
        if dt.weekday() >= 5:  # Saturday or Sunday
            return False
        if date_str in cls.HOLIDAYS:
            return False
        return True

    @classmethod
    def get_market_close_time(cls, dt: datetime.datetime = None) -> datetime.time:
        if dt is None:
            dt = datetime.datetime.now(NY_TZ)
        date_str = dt.strftime("%Y-%m-%d")
        if date_str in cls.EARLY_CLOSE_DAYS:
            return datetime.time(13, 0, 0)
        return datetime.time(16, 0, 0)


class SPXSessionClock:
    def __init__(self):
        self.tz = NY_TZ
        self.calendar = SPXTradingCalendar()

    def get_ny_now(self) -> datetime.datetime:
        return datetime.datetime.now(self.tz)

    def to_ny(self, dt: datetime.datetime) -> datetime.datetime:
        return localize_ny(dt)

    def get_globex_overnight_window(self, dt: datetime.datetime = None) -> Tuple[datetime.datetime, datetime.datetime]:
        if dt is None:
            dt = self.get_ny_now()
        else:
            dt = self.to_ny(dt)

        prev_day = dt.date() - datetime.timedelta(days=1)
        while prev_day.weekday() >= 5 or prev_day.strftime("%Y-%m-%d") in SPXTradingCalendar.HOLIDAYS:
            prev_day -= datetime.timedelta(days=1)

        start_dt = localize_ny(datetime.datetime.combine(prev_day, datetime.time(18, 0, 0)))
        end_dt = localize_ny(datetime.datetime.combine(dt.date(), datetime.time(9, 29, 59)))
        return start_dt, end_dt

    def get_premarket_window(self, dt: datetime.datetime = None) -> Tuple[datetime.datetime, datetime.datetime]:
        if dt is None:
            dt = self.get_ny_now()
        else:
            dt = self.to_ny(dt)

        start_dt = localize_ny(datetime.datetime.combine(dt.date(), datetime.time(7, 0, 0)))
        end_dt = localize_ny(datetime.datetime.combine(dt.date(), datetime.time(9, 29, 59)))
        return start_dt, end_dt

    def get_session_phase(self, dt: datetime.datetime = None) -> str:
        if dt is None:
            dt = self.get_ny_now()
        else:
            dt = self.to_ny(dt)

        if not self.calendar.is_trading_day(dt):
            return SPXSessionPhase.OFF_HOURS

        t = dt.time()
        close_time = self.calendar.get_market_close_time(dt)
        
        t_0700 = datetime.time(7, 0, 0)
        t_0900 = datetime.time(9, 0, 0)
        t_0930 = datetime.time(9, 30, 0)
        t_0935 = datetime.time(9, 35, 0)
        t_1030 = datetime.time(10, 30, 0)

        if t_0700 <= t < t_0900:
            return SPXSessionPhase.EARLY_PREMARKET
        elif t_0900 <= t < t_0930:
            return SPXSessionPhase.LATE_PREMARKET
        elif t_0930 <= t < t_0935:
            return SPXSessionPhase.OPENING_DISCOVERY
        elif t_0935 <= t < t_1030:
            return SPXSessionPhase.MAIN_SIGNAL_WINDOW
        elif t_1030 <= t < close_time:
            return SPXSessionPhase.REST_OF_SESSION
        else:
            return SPXSessionPhase.OFF_HOURS

    def is_market_hours(self, dt: datetime.datetime = None) -> bool:
        phase = self.get_session_phase(dt)
        return phase in (
            SPXSessionPhase.OPENING_DISCOVERY,
            SPXSessionPhase.MAIN_SIGNAL_WINDOW,
            SPXSessionPhase.REST_OF_SESSION
        )

    def should_trigger_ai_analysis(self, last_ai_timestamp: datetime.datetime, dt: datetime.datetime = None,
                                   is_active_signal: bool = False, state_changed: bool = False) -> bool:
        if state_changed:
            return True

        if dt is None:
            dt = self.get_ny_now()
        else:
            dt = self.to_ny(dt)

        phase = self.get_session_phase(dt)
        if phase == SPXSessionPhase.OFF_HOURS:
            return False

        if last_ai_timestamp is None:
            return True

        last_ai = self.to_ny(last_ai_timestamp)
        elapsed_sec = (dt - last_ai).total_seconds()

        if phase == SPXSessionPhase.EARLY_PREMARKET:
            return elapsed_sec >= 870
        elif phase in (SPXSessionPhase.LATE_PREMARKET, SPXSessionPhase.OPENING_DISCOVERY):
            return elapsed_sec >= 270
        else:
            return elapsed_sec >= 270 if is_active_signal else elapsed_sec >= 870

    def get_next_ai_scheduled_str(self, last_ai_timestamp: datetime.datetime, dt: datetime.datetime = None, is_active_signal: bool = False) -> str:
        if dt is None:
            dt = self.get_ny_now()
        else:
            dt = self.to_ny(dt)

        phase = self.get_session_phase(dt)
        if phase == SPXSessionPhase.OFF_HOURS:
            return "Session Closed"

        interval_mins = 5 if (phase in (SPXSessionPhase.LATE_PREMARKET, SPXSessionPhase.OPENING_DISCOVERY) or is_active_signal) else 15

        if last_ai_timestamp is None:
            return "Due Now"

        last_ai = self.to_ny(last_ai_timestamp)
        next_dt = last_ai + datetime.timedelta(minutes=interval_mins)
        if next_dt <= dt:
            return "Due Now"

        remaining = int((next_dt - dt).total_seconds())
        mins = remaining // 60
        secs = remaining % 60
        return f"in {mins}m {secs:02d}s ({next_dt.strftime('%H:%M:%S ET')})"
