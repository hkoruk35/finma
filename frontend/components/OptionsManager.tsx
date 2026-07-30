"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OptionsManager() {
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  const runScanner = async () => {
    if (isRunning) return;
    
    const confirmRun = confirm("Run the BOGA AI v220 Options Scanner now? This will take about 2-3 minutes.");
    if (!confirmRun) return;

    setIsRunning(true);
    setStatus("Scanning market universe (500+ stocks)...");
    
    try {
      const res = await fetch("/api/options/run", { method: "POST" });
      const data = await res.json();
      
      if (data.success) {
        setStatus("Scan completed successfully! Refreshing data...");
        router.refresh();
        // Wait a bit and refresh again to be sure
        setTimeout(() => router.refresh(), 2000);
      } else {
        setStatus(`Error: ${data.error || "Unknown error occurred"}`);
      }
    } catch (e) {
      setStatus("Failed to trigger scanner. Check server logs.");
    } finally {
      setIsRunning(false);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={runScanner}
        disabled={isRunning}
        className={`px-6 py-2.5 rounded-xl font-black text-sm uppercase tracking-widest transition-all shadow-lg ${
          isRunning 
            ? "bg-slate-700 text-slate-400 cursor-not-allowed" 
            : "bg-[#3b82f6] text-white hover:bg-blue-600 hover:shadow-blue-500/20 active:scale-95"
        }`}
      >
        {isRunning ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Scanning...
          </span>
        ) : (
          "Run Scanner Now"
        )}
      </button>
      {status && (
        <div className={`text-[10px] font-medium uppercase tracking-wider ${status.startsWith("Error") ? "text-red-400" : "text-[#3b82f6]"}`}>
          {status}
        </div>
      )}
    </div>
  );
}
