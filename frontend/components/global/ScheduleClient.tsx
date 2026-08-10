"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface ScheduleItem {
  ticker: string;
  slug: string;
  name: string;
  type: "daily" | "weekly";
  suffix: string; // "PreMarket", "Midday", "Closing", "Weekly"
  etHour: number;
  etMinute: number;
  days: number[];
  region: "us" | "eu" | "latam" | "asia";
  localTimeStr?: string;
}

const SCHEDULES: ScheduleItem[] = [
  // US PreMarket
  { ticker: 'SPX', slug: 'sp500', name: 'S&P 500', type: 'daily', suffix: 'PreMarket', etHour: 9, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'NDX', slug: 'nasdaq-100', name: 'Nasdaq 100', type: 'daily', suffix: 'PreMarket', etHour: 9, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'DJI', slug: 'dow-jones', name: 'Dow Jones', type: 'daily', suffix: 'PreMarket', etHour: 9, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'RUT', slug: 'russell-2000', name: 'Russell 2000', type: 'daily', suffix: 'PreMarket', etHour: 9, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  
  // US Midday
  { ticker: 'SPX', slug: 'sp500', name: 'S&P 500', type: 'daily', suffix: 'Midday', etHour: 13, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'NDX', slug: 'nasdaq-100', name: 'Nasdaq 100', type: 'daily', suffix: 'Midday', etHour: 13, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'DJI', slug: 'dow-jones', name: 'Dow Jones', type: 'daily', suffix: 'Midday', etHour: 13, etMinute: 0, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'RUT', slug: 'russell-2000', name: 'Russell 2000', type: 'daily', suffix: 'Midday', etHour: 13, etMinute: 0, days: [1,2,3,4,5], region: 'us' },

  // US Closing
  { ticker: 'SPX', slug: 'sp500', name: 'S&P 500', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 5, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'NDX', slug: 'nasdaq-100', name: 'Nasdaq 100', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 5, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'DJI', slug: 'dow-jones', name: 'Dow Jones', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 5, days: [1,2,3,4,5], region: 'us' },
  { ticker: 'RUT', slug: 'russell-2000', name: 'Russell 2000', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 5, days: [1,2,3,4,5], region: 'us' },

  // Europe Closing
  { ticker: 'DAX', slug: 'dax', name: 'DAX', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'FTSE100', slug: 'ftse-100', name: 'FTSE 100', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'CAC40', slug: 'cac-40', name: 'CAC 40', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'IBEX35', slug: 'ibex-35', name: 'IBEX 35', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'STOXX600', slug: 'stoxx-600', name: 'STOXX 600', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'FTSEMIB', slug: 'ftse-mib', name: 'FTSE MIB', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'SMI', slug: 'smi', name: 'SMI', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },
  { ticker: 'AEX', slug: 'aex', name: 'AEX', type: 'daily', suffix: 'Closing', etHour: 11, etMinute: 45, days: [1,2,3,4,5], region: 'eu', localTimeStr: '05:45 PM CET' },

  // LatAm
  // 16:05 ET'de ABD kapanisiyla cakisiyordu — LatAm 16:10'a alindi (once ABD).
  { ticker: 'BOVESPA', slug: 'bovespa', name: 'BOVESPA', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 10, days: [1,2,3,4,5], region: 'latam', localTimeStr: '05:10 PM BRT' },
  { ticker: 'MERVAL', slug: 'merval', name: 'MERVAL', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 10, days: [1,2,3,4,5], region: 'latam', localTimeStr: '05:10 PM ART' },
  { ticker: 'IPCMEXICO', slug: 'ipc-mexico', name: 'IPC MEXICO', type: 'daily', suffix: 'Closing', etHour: 16, etMinute: 10, days: [1,2,3,4,5], region: 'latam', localTimeStr: '03:10 PM CST' },

  // Asia
  { ticker: 'NIKKEI225', slug: 'nikkei-225', name: 'NIKKEI 225', type: 'daily', suffix: 'Closing', etHour: 2, etMinute: 5, days: [1,2,3,4,5], region: 'asia', localTimeStr: '03:05 PM JST' },
  { ticker: 'ASX200', slug: 'asx-200', name: 'ASX 200', type: 'daily', suffix: 'Closing', etHour: 2, etMinute: 5, days: [1,2,3,4,5], region: 'asia', localTimeStr: '04:05 PM AEST' },
  { ticker: 'KOSPI', slug: 'kospi', name: 'KOSPI', type: 'daily', suffix: 'Closing', etHour: 2, etMinute: 35, days: [1,2,3,4,5], region: 'asia', localTimeStr: '03:35 PM KST' },
  { ticker: 'SHANGHAI', slug: 'shanghai-composite', name: 'SHANGHAI', type: 'daily', suffix: 'Closing', etHour: 3, etMinute: 5, days: [1,2,3,4,5], region: 'asia', localTimeStr: '03:05 PM CST' },
  { ticker: 'HANGSENG', slug: 'hang-seng', name: 'HANG SENG', type: 'daily', suffix: 'Closing', etHour: 4, etMinute: 5, days: [1,2,3,4,5], region: 'asia', localTimeStr: '04:05 PM HKT' },
  { ticker: 'NIFTY50', slug: 'nifty-50', name: 'NIFTY 50', type: 'daily', suffix: 'Closing', etHour: 6, etMinute: 5, days: [1,2,3,4,5], region: 'asia', localTimeStr: '03:35 PM IST' },

  // --- WEEKLY ---
  // US
  { ticker: 'SPX', slug: 'sp500', name: 'S&P 500', type: 'weekly', suffix: 'Weekly', etHour: 10, etMinute: 0, days: [6], region: 'us' },
  { ticker: 'NDX', slug: 'nasdaq-100', name: 'Nasdaq 100', type: 'weekly', suffix: 'Weekly', etHour: 11, etMinute: 0, days: [6], region: 'us' },
  { ticker: 'DJI', slug: 'dow-jones', name: 'Dow Jones', type: 'weekly', suffix: 'Weekly', etHour: 12, etMinute: 0, days: [6], region: 'us' },
  { ticker: 'RUT', slug: 'russell-2000', name: 'Russell 2000', type: 'weekly', suffix: 'Weekly', etHour: 13, etMinute: 0, days: [6], region: 'us' },

  // Europe
  { ticker: 'DAX', slug: 'dax', name: 'DAX', type: 'weekly', suffix: 'Weekly', etHour: 14, etMinute: 0, days: [6], region: 'eu', localTimeStr: '08:00 PM CET' },
  { ticker: 'FTSE100', slug: 'ftse-100', name: 'FTSE 100', type: 'weekly', suffix: 'Weekly', etHour: 15, etMinute: 0, days: [6], region: 'eu', localTimeStr: '09:00 PM CET' },
  { ticker: 'CAC40', slug: 'cac-40', name: 'CAC 40', type: 'weekly', suffix: 'Weekly', etHour: 16, etMinute: 0, days: [6], region: 'eu', localTimeStr: '10:00 PM CET' },
  { ticker: 'IBEX35', slug: 'ibex-35', name: 'IBEX 35', type: 'weekly', suffix: 'Weekly', etHour: 17, etMinute: 0, days: [6], region: 'eu', localTimeStr: '11:00 PM CET' },
  { ticker: 'STOXX600', slug: 'stoxx-600', name: 'STOXX 600', type: 'weekly', suffix: 'Weekly', etHour: 18, etMinute: 0, days: [6], region: 'eu', localTimeStr: '12:00 AM CET' },
  { ticker: 'FTSEMIB', slug: 'ftse-mib', name: 'FTSE MIB', type: 'weekly', suffix: 'Weekly', etHour: 19, etMinute: 0, days: [6], region: 'eu', localTimeStr: '01:00 AM CET' },
  { ticker: 'SMI', slug: 'smi', name: 'SMI', type: 'weekly', suffix: 'Weekly', etHour: 20, etMinute: 0, days: [6], region: 'eu', localTimeStr: '02:00 AM CET' },
  { ticker: 'AEX', slug: 'aex', name: 'AEX', type: 'weekly', suffix: 'Weekly', etHour: 21, etMinute: 0, days: [6], region: 'eu', localTimeStr: '03:00 AM CET' },

  // Latam
  { ticker: 'BOVESPA', slug: 'bovespa', name: 'BOVESPA', type: 'weekly', suffix: 'Weekly', etHour: 22, etMinute: 0, days: [6], region: 'latam', localTimeStr: '11:00 PM BRT' },
  { ticker: 'IPCMEXICO', slug: 'ipc-mexico', name: 'IPC MEXICO', type: 'weekly', suffix: 'Weekly', etHour: 23, etMinute: 0, days: [6], region: 'latam', localTimeStr: '09:00 PM CST' },
  { ticker: 'MERVAL', slug: 'merval', name: 'MERVAL', type: 'weekly', suffix: 'Weekly', etHour: 10, etMinute: 0, days: [0], region: 'latam', localTimeStr: '11:00 AM ART' },

  // Asia
  { ticker: 'NIKKEI225', slug: 'nikkei-225', name: 'NIKKEI 225', type: 'weekly', suffix: 'Weekly', etHour: 11, etMinute: 0, days: [0], region: 'asia', localTimeStr: '12:00 AM JST' },
  { ticker: 'HANGSENG', slug: 'hang-seng', name: 'HANG SENG', type: 'weekly', suffix: 'Weekly', etHour: 12, etMinute: 0, days: [0], region: 'asia', localTimeStr: '12:00 AM HKT' },
  { ticker: 'SHANGHAI', slug: 'shanghai-composite', name: 'SHANGHAI', type: 'weekly', suffix: 'Weekly', etHour: 13, etMinute: 0, days: [0], region: 'asia', localTimeStr: '01:00 AM CST' },
  { ticker: 'KOSPI', slug: 'kospi', name: 'KOSPI', type: 'weekly', suffix: 'Weekly', etHour: 14, etMinute: 0, days: [0], region: 'asia', localTimeStr: '03:00 AM KST' },
  { ticker: 'NIFTY50', slug: 'nifty-50', name: 'NIFTY 50', type: 'weekly', suffix: 'Weekly', etHour: 15, etMinute: 0, days: [0], region: 'asia', localTimeStr: '12:30 AM IST' },
  { ticker: 'ASX200', slug: 'asx-200', name: 'ASX 200', type: 'weekly', suffix: 'Weekly', etHour: 16, etMinute: 0, days: [0], region: 'asia', localTimeStr: '06:00 AM AEST' },
];

const WORDS: Record<string, { daily: string; weekly: string; analysis: string; us: string; eu: string; latam: string; asia: string }> = {
  tr: { daily: "Günlük", weekly: "Haftalık", analysis: "analizi", us: "Amerika Birleşik Devletleri", eu: "Avrupa", latam: "Latin Amerika", asia: "Asya" },
  en: { daily: "Daily", weekly: "Weekly", analysis: "analysis", us: "United States", eu: "Europe", latam: "Latin America", asia: "Asia" },
  es: { daily: "Diario", weekly: "Semanal", analysis: "análisis", us: "Estados Unidos", eu: "Europa", latam: "América Latina", asia: "Asia" },
  fr: { daily: "Quotidien", weekly: "Hebdomadaire", analysis: "analyse", us: "États-Unis", eu: "Europe", latam: "Amérique Latine", asia: "Asie" },
  pt: { daily: "Diário", weekly: "Semanal", analysis: "análise", us: "Estados Unidos", eu: "Europa", latam: "América Latina", asia: "Ásia" }
};

function formatEtTime(h: number, m: number) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m.toString().padStart(2, '0');
  return `${hour12.toString().padStart(2, '0')}:${minStr} ${ampm} ET`;
}

export default function ScheduleClient({ locale }: { locale: string }) {
  const [currentEtTime, setCurrentEtTime] = useState<{ day: number; totalMins: number }>({ day: 0, totalMins: 0 });
  const w = WORDS[locale] || WORDS["en"];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const etString = now.toLocaleString("en-US", { timeZone: "America/New_York" });
      const etDate = new Date(etString);
      setCurrentEtTime({
        day: etDate.getDay(),
        totalMins: etDate.getHours() * 60 + etDate.getMinutes(),
      });
    };
    updateTime();
    const iv = setInterval(updateTime, 30000);
    return () => clearInterval(iv);
  }, []);

  const isActive = (item: ScheduleItem) => {
    if (!item.days.includes(currentEtTime.day)) return false;
    const itemMins = item.etHour * 60 + item.etMinute;
    const diff = currentEtTime.totalMins - itemMins;
    return diff >= 0 && diff <= 30; // Active for 30 minutes after scheduled time
  };

  const renderGroup = (regionKey: "us" | "eu" | "latam" | "asia", title: string) => {
    const items = SCHEDULES.filter(s => s.region === regionKey);
    return (
      <div className="bg-[#0b101b]/70 border border-[#1e2a3a]/60 rounded-xl p-5 shadow-xl flex flex-col mb-6">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 border-b border-[#1e2a3a]/60 pb-3 mb-4">
          {title}
        </h3>
        <div className="flex flex-col gap-2">
          {items.map((item, idx) => {
            const active = isActive(item);
            const prefix = item.type === "daily" ? w.daily : w.weekly;
            const linkHref = `/global/${locale}/${item.slug}`;
            const timeEt = formatEtTime(item.etHour, item.etMinute);
            const timeDisplay = item.localTimeStr ? `${item.localTimeStr} (${timeEt})` : timeEt;

            return (
              <Link 
                key={`${item.ticker}-${idx}`} 
                href={linkHref}
                className="group flex items-center justify-between p-3 rounded-lg bg-[#141b2b]/50 hover:bg-[#1e2a3a]/40 border border-transparent hover:border-[#3b82f6]/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-3 flex justify-center">
                    {active ? (
                      <span className="animate-pulse bg-emerald-500 rounded-full w-2.5 h-2.5 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                    ) : (
                      <span className="bg-slate-600 rounded-full w-1.5 h-1.5" />
                    )}
                  </div>
                  <div className="text-sm text-slate-300 group-hover:text-white transition-colors flex flex-col sm:flex-row sm:items-center sm:gap-1.5">
                    <span className="font-medium">
                      {prefix} <span className="text-[#3b82f6] group-hover:text-blue-400">{item.name}</span> {timeDisplay} {item.suffix} {w.analysis}
                    </span>
                  </div>
                </div>
                <div className="text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity transform group-hover:translate-x-1">
                  →
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-6">
        <div>
          {renderGroup("us", w.us)}
          {renderGroup("eu", w.eu)}
        </div>
        <div>
          {renderGroup("latam", w.latam)}
          {renderGroup("asia", w.asia)}
        </div>
      </div>
    </div>
  );
}
