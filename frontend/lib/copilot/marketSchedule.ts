// Dynamic US Market Schedule, Holidays, Early Closes, and Report Timing Engine

export interface MarketStatus {
  isOpen: boolean;
  isHoliday: boolean;
  isEarlyClose: boolean;
  holidayName?: string;
  marketOpenET: string;
  marketCloseET: string;
  premarketTimeET: string;
  middayTimeET: string;
  closingTimeET: string;
}

const US_HOLIDAYS_2026: Record<string, string> = {
  "2026-01-01": "New Year's Day",
  "2026-01-19": "Martin Luther King Jr. Day",
  "2026-02-16": "Washington's Birthday",
  "2026-04-03": "Good Friday",
  "2026-05-25": "Memorial Day",
  "2026-06-19": "Juneteenth",
  "2026-07-03": "Independence Day (Observed)",
  "2026-09-07": "Labor Day",
  "2026-11-26": "Thanksgiving Day",
  "2026-12-25": "Christmas Day",
};

const US_EARLY_CLOSES_2026: Record<string, string> = {
  "2026-07-02": "Independence Day Eve (Close 13:00 ET)",
  "2026-11-27": "Black Friday (Close 13:00 ET)",
  "2026-12-24": "Christmas Eve (Close 13:00 ET)",
};

export function getUSMarketStatus(date: Date = new Date()): MarketStatus {
  // Convert date to US Eastern Time YYYY-MM-DD
  const etDateStr = date.toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const dayOfWeek = new Date(etDateStr).getDay();

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const holidayName = US_HOLIDAYS_2026[etDateStr];
  const isHoliday = isWeekend || !!holidayName;
  const earlyCloseReason = US_EARLY_CLOSES_2026[etDateStr];
  const isEarlyClose = !isHoliday && !!earlyCloseReason;

  const marketOpenET = "09:30";
  const marketCloseET = isEarlyClose ? "13:00" : "16:00";

  // Dynamic timing rule:
  // Premarket: 45 min before open -> 08:45 ET
  // Midday: 2.5 hours after open -> 12:00 ET (or 11:15 ET if early close)
  // Closing: 15 min after close -> 16:15 ET (or 13:15 ET if early close)
  const premarketTimeET = "08:45";
  const middayTimeET = isEarlyClose ? "11:15" : "12:00";
  const closingTimeET = isEarlyClose ? "13:15" : "16:15";

  const timeStrET = date.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });
  const isOpen = !isHoliday && timeStrET >= "09:30:00" && timeStrET <= `${marketCloseET}:00`;

  return {
    isOpen,
    isHoliday,
    isEarlyClose,
    holidayName: holidayName || (isWeekend ? "Weekend" : undefined),
    marketOpenET,
    marketCloseET,
    premarketTimeET,
    middayTimeET,
    closingTimeET,
  };
}

export function getCurrentPeriodKey(date: Date = new Date()): "premarket" | "midday" | "closing" | "off_hours" {
  const status = getUSMarketStatus(date);
  const timeStrET = date.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false });

  if (timeStrET >= "08:00:00" && timeStrET < "11:00:00") return "premarket";
  if (timeStrET >= "11:00:00" && timeStrET < "14:30:00") return "midday";
  if (timeStrET >= "14:30:00" && timeStrET <= "17:00:00") return "closing";
  return "off_hours";
}
