"use client";

import React, { useState, useEffect } from 'react';

const MarketStatus = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        const checkMarketStatus = () => {
            const now = new Date();
            const nyTime = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York',
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
                weekday: 'long'
            }).formatToParts(now);

            const parts = nyTime.reduce((acc, part) => {
                acc[part.type] = part.value;
                return acc;
            }, {} as Record<string, string>);

            const weekday = parts.weekday;
            const hour = parseInt(parts.hour);
            const minute = parseInt(parts.minute);

            const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
            const totalMinutes = hour * 60 + minute;
            const openMinutes = 9 * 60 + 30; // 09:30
            const closeMinutes = 16 * 60;   // 16:00

            // Market is open Mon-Fri, 9:30 AM to 4:00 PM ET
            const open = !isWeekend && totalMinutes >= openMinutes && totalMinutes < closeMinutes;
            setIsOpen(open);
        };

        checkMarketStatus();
        const interval = setInterval(checkMarketStatus, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);

    // Prevent hydration mismatch
    if (!isMounted) {
        return (
            <div className="flex items-center gap-2 mt-1">
                <div className="w-2 h-2 rounded-full bg-[#64748b]"></div>
                <span className="text-[10px] font-black text-[#64748b] uppercase tracking-[0.2em]">CHECKING MARKET...</span>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isOpen ? "bg-[#22c55e] live-dot" : "bg-[#64748b]"}`}></div>
            <span className="text-[10px] font-black text-[#64748b] uppercase tracking-[0.2em]">
                MARKET IS {isOpen ? "OPEN" : "CLOSED"}
            </span>
        </div>
    );
};

export default MarketStatus;
