"use client";

import { useState } from "react";

interface Props {
  aiReport: string;
  generatedAt: string | null;
  cacheHit: boolean;
  onGenerate: () => void;
  isLoading: boolean;
}

const SECTION_COLORS: Record<string, string> = {
  "[SİSTEM ANALİZİ]": "text-cyan-400",
  "[EMA ANALİZİ]": "text-blue-400",
  "[HACİM ANALİZİ]": "text-purple-400",
  "[MOMENTUM KALİTESİ]": "text-yellow-400",
  "[STOP-LOSS ANALİZİ]": "text-red-400",
  "[YATAY KALANLAR]": "text-orange-400",
  "[SEKTÖREL ANALİZ]": "text-teal-400",
  "[BOT OPTİMİZASYONU]": "text-green-400",
  "[SONUÇ ÖZETİ]": "text-white",
};

function colorizeReport(report: string): React.ReactNode[] {
  const lines = report.split("\n");
  return lines.map((line, i) => {
    // Bölüm başlığı
    const sectionMatch = Object.keys(SECTION_COLORS).find((key) =>
      line.trim().startsWith(key)
    );
    if (sectionMatch) {
      return (
        <div key={i} className={`font-bold mt-4 mb-1 ${SECTION_COLORS[sectionMatch]}`}>
          {line}
        </div>
      );
    }
    // Bullet noktası
    if (line.trim().startsWith("-") || line.trim().startsWith("•")) {
      const content = line.replace(/^[\s\-•]+/, "");
      // WIN vurgusu
      if (/WIN|başarı|kar|kazanç/i.test(content)) {
        return <div key={i} className="text-green-300 pl-4 text-sm">{"  "}{line}</div>;
      }
      // LOSS vurgusu
      if (/LOSS|stop|kayıp|başarısız/i.test(content)) {
        return <div key={i} className="text-red-300 pl-4 text-sm">{"  "}{line}</div>;
      }
      return <div key={i} className="text-gray-300 pl-4 text-sm">{"  "}{line}</div>;
    }
    // Ok işareti (MEVCUT → ÖNERİ)
    if (line.includes("→")) {
      return (
        <div key={i} className="text-yellow-200 pl-4 text-sm font-mono">
          {"  "}{line}
        </div>
      );
    }
    // Boş satır
    if (!line.trim()) return <div key={i} className="h-1" />;
    // Normal satır
    return (
      <div key={i} className="text-gray-400 text-sm pl-2">
        {line}
      </div>
    );
  });
}

export default function TerminalReport({
  aiReport,
  generatedAt,
  cacheHit,
  onGenerate,
  isLoading,
}: Props) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-[#080b12] border border-green-900/40 rounded font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-green-900/30 bg-[#0d1117]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-[11px] text-gray-500 ml-2">BOGA_KRITER_ANALYSIS — swing117_bot</span>
        </div>
        <div className="flex items-center gap-3">
          {generatedAt && (
            <span className="text-[10px] text-gray-600">
              {cacheHit ? "CACHE HIT · " : ""}
              {new Date(generatedAt).toLocaleTimeString("tr-TR")}
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-white transition-colors"
          >
            {expanded ? "daralt" : "genişlet"}
          </button>
        </div>
      </div>

      {/* Terminal body */}
      {expanded && (
        <div className="p-4 min-h-[200px]">
          {!aiReport && !isLoading && (
            <div className="flex flex-col items-start gap-3">
              <div className="text-green-400 text-sm">
                {">"} Sistem hazır. AI analizini başlatmak için butona bas.
              </div>
              <div className="text-gray-500 text-xs">
                {">"} Son 10 rapor günündeki tüm trade'ler Claude API üzerinden analiz edilecek.
              </div>
              <button
                onClick={onGenerate}
                className="mt-2 px-5 py-2 border border-green-500 text-green-400 text-sm rounded hover:bg-green-500/10 transition-colors"
              >
                {">"} ANALİZ ÜRET
              </button>
            </div>
          )}

          {isLoading && (
            <div className="space-y-1">
              <div className="text-green-400 text-sm animate-pulse">
                {">"} Claude API bağlantısı kuruluyor...
              </div>
              <div className="text-gray-500 text-xs animate-pulse">
                {">"} Trade verileri sıkıştırılıp analiz ediliyor...
              </div>
              <div className="text-gray-600 text-xs mt-4 animate-pulse">
                {"_ "}
              </div>
            </div>
          )}

          {aiReport && !isLoading && (
            <div className="space-y-0.5 text-sm leading-relaxed">
              <div className="text-gray-600 text-xs mb-3">
                {">"} Analiz tamamlandı. {cacheHit ? "[önbellekten]" : "[yeni analiz]"}
              </div>
              {colorizeReport(aiReport)}
              <div className="mt-4 pt-3 border-t border-green-900/20 flex gap-3">
                <button
                  onClick={onGenerate}
                  className="text-[11px] text-gray-500 hover:text-green-400 transition-colors border border-white/10 px-3 py-1 rounded"
                >
                  Yenile (Force Refresh)
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
