"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { copy, type Locale } from "@/lib/i18n/copy";

interface ScheduleItem {
  key: string;
  hour: number;
  minute: number;
  days: number[]; // 0=Sun, 1=Mon...6=Sat
  slug: string;
}

const SCHEDULE: ScheduleItem[] = [
  { key: "bannerAsia1", hour: 2, minute: 5, days: [1, 2, 3, 4, 5], slug: "nikkei-225" },
  { key: "bannerAsia2", hour: 2, minute: 35, days: [1, 2, 3, 4, 5], slug: "kospi" },
  { key: "bannerAsia3", hour: 3, minute: 5, days: [1, 2, 3, 4, 5], slug: "shanghai-composite" },
  { key: "bannerAsia4", hour: 4, minute: 5, days: [1, 2, 3, 4, 5], slug: "hang-seng" },
  { key: "bannerAsia5", hour: 6, minute: 5, days: [1, 2, 3, 4, 5], slug: "nifty-50" },
  { key: "bannerUsPre", hour: 9, minute: 0, days: [1, 2, 3, 4, 5], slug: "sp500" },
  { key: "bannerEuClose", hour: 11, minute: 35, days: [1, 2, 3, 4, 5], slug: "dax" },
  { key: "bannerUsMid", hour: 13, minute: 0, days: [1, 2, 3, 4, 5], slug: "sp500" },
  { key: "bannerLatAm1", hour: 16, minute: 5, days: [1, 2, 3, 4, 5], slug: "bovespa" },
  { key: "bannerUsClose", hour: 16, minute: 5, days: [1, 2, 3, 4, 5], slug: "sp500" },
  { key: "bannerLatAm2", hour: 17, minute: 5, days: [1, 2, 3, 4, 5], slug: "ipc-mexico" },
  // Weekly represents the weekend blocks
  { key: "bannerWeekly", hour: 10, minute: 0, days: [0, 6], slug: "sp500" },
];

export default function HomeScheduleBanner({ locale }: { locale: Locale }) {
  const t = copy[locale].schedule;
  const [activeItem, setActiveItem] = useState<{ item: ScheduleItem; isRunning: boolean } | null>(null);

  useEffect(() => {
    const updateSchedule = () => {
      // Get current time in ET
      const now = new Date();
      const etString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const etDate = new Date(etString);
      
      const currentHour = etDate.getHours();
      const currentMinute = etDate.getMinutes();
      const currentDay = etDate.getDay();

      const currentTotalMinutes = currentHour * 60 + currentMinute;

      // Find the currently running or next upcoming item
      let nextItem: ScheduleItem | null = null;
      let minDiff = Infinity;
      let isRunning = false;

      // Check if it's the weekend
      if (currentDay === 0 || currentDay === 6) {
        nextItem = SCHEDULE.find(s => s.key === "bannerWeekly") || null;
        isRunning = currentHour >= 10 && currentHour <= 23;
      } else {
        // Weekdays
        for (const s of SCHEDULE) {
          if (!s.days.includes(currentDay)) continue;
          const itemMinutes = s.hour * 60 + s.minute;
          const diff = itemMinutes - currentTotalMinutes;
          
          // Consider running if we are within 30 minutes after the start time
          if (diff <= 0 && diff > -30) {
            nextItem = s;
            isRunning = true;
            break;
          } else if (diff > 0 && diff < minDiff) {
            minDiff = diff;
            nextItem = s;
            isRunning = false;
          }
        }

        // If no upcoming item today, point to the first item tomorrow
        if (!nextItem) {
          nextItem = SCHEDULE.find(s => s.days.includes(1)) || null; // Assume Asia1
          isRunning = false;
        }
      }

      setActiveItem(nextItem ? { item: nextItem, isRunning } : null);
    };

    updateSchedule();
    const interval = setInterval(updateSchedule, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!activeItem) return null;

  const { item, isRunning } = activeItem;
  // Format hour (12h am/pm) for ET
  const ampm = item.hour >= 12 ? 'PM' : 'AM';
  const h = item.hour % 12 || 12;
  const m = item.minute.toString().padStart(2, "0");
  const timeStr = `${h}:${m} ${ampm} ET`;
  
  const itemName = (t as any)[item.key] || item.key;
  
  return (
    <Link 
      href={`/global/${locale}/${item.slug}`}
      className="group flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#0d131f]/90 border border-[#1e2a3a] hover:border-[#3b82f6]/50 rounded-xl p-3 mb-4 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-r from-transparent via-[#3b82f6]/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-3 w-full md:w-auto">
        <div className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${isRunning ? 'bg-emerald-500/10' : 'bg-blue-500/20 text-blue-400'}`}>
          {isRunning ? (
            <span className="relative flex h-4 w-4">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.9)]"></span>
            </span>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row md:items-center md:gap-3 w-full">
          <div className="flex items-center gap-2 mb-1 md:mb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 md:hidden">{t.bannerPrefix}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${isRunning ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
              {isRunning ? t.nowRunning : t.upNext}
            </span>
          </div>
          <p className="text-sm font-medium text-slate-200">
            {itemName} <span className="text-slate-500 font-normal ml-1 whitespace-nowrap">{t.at} {timeStr}</span>
          </p>
        </div>
      </div>
      
      <div className="hidden md:flex items-center text-xs font-bold text-white bg-[#3b82f6] px-4 py-1.5 rounded-lg group-hover:bg-blue-500 transition-colors shadow-lg shadow-blue-500/30 whitespace-nowrap">
        {(t as any).viewAnalysis || "Analizi Aç"} <span className="ml-1.5">→</span>
      </div>
    </Link>
  );
}
