"use client";

import { useState } from "react";
import Link from "next/link";

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
  return report.split("\n").map((line, i) => {
    const sectionMatch = Object.keys(SECTION_COLORS).find((key) => line.trim().startsWith(key));
    if (sectionMatch) {
      return <div key={i} className={`font-bold mt-4 mb-1 ${SECTION_COLORS[sectionMatch]}`}>{line}</div>;
    }
    if (line.trim().startsWith("-") || line.trim().startsWith("•") || line.trim().startsWith("*")) {
      const hasWin = /WIN|başarı|kar|kazanç/i.test(line);
      const hasLoss = /LOSS|stop|kayıp|başarısız/i.test(line);
      return (
        <div key={i} className={`pl-4 text-sm ${hasWin ? "text-green-300" : hasLoss ? "text-red-300" : "text-gray-200"}`}>
          {line}
        </div>
      );
    }
    if (line.includes("→")) {
      return <div key={i} className="text-yellow-200 pl-4 text-sm font-mono">{line}</div>;
    }
    if (!line.trim()) return <div key={i} className="h-1" />;
    // Markdown bold/header
    if (line.startsWith("#") || line.startsWith("**")) {
      return <div key={i} className="text-white font-semibold text-sm pl-2 mt-2">{line.replace(/^#+\s*/, "").replace(/\*\*/g, "")}</div>;
    }
    return <div key={i} className="text-gray-300 text-sm pl-2">{line}</div>;
  });
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadPDF(report: string, generatedAt: string | null) {
  // PDF'i text formatında indir (jsPDF bağımlılığı eklememek için)
  const dateStr = generatedAt ? new Date(generatedAt).toLocaleDateString("tr-TR") : new Date().toLocaleDateString("tr-TR");
  const content = `BOGA AI — KRITER ANALİZİ RAPORU\nTarih: ${dateStr}\n\n${report}`;
  // Basit HTML → PDF yaklaşımı (print API)
  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`
    <html>
    <head>
      <title>Kriter Analizi — BOGA AI</title>
      <style>
        body { font-family: monospace; font-size: 12px; line-height: 1.6; padding: 24px; max-width: 800px; margin: 0 auto; color: #111; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        pre { white-space: pre-wrap; word-wrap: break-word; }
      </style>
    </head>
    <body>
      <h1>BOGA AI — KRITER ANALİZİ RAPORU</h1>
      <p style="color:#666; font-size:11px">Tarih: ${dateStr}</p>
      <hr />
      <pre>${report.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
    </body>
    </html>
  `);
  win.document.close();
  setTimeout(() => { win.print(); }, 500);
}

export default function TerminalReport({
  aiReport,
  generatedAt,
  cacheHit,
  onGenerate,
  isLoading,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);

  const dateTag = generatedAt ? new Date(generatedAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiReport).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleMD = () => {
    const header = `# BOGA AI — Kriter Analizi Raporu\n_Tarih: ${dateTag}_\n\n---\n\n`;
    downloadFile(header + aiReport, `kriter_analizi_${dateTag}.md`, "text/markdown");
  };

  return (
    <div className="bg-[#080b12] border border-green-900/40 rounded font-mono">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-green-900/30 bg-[#0d1117]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
          <span className="text-[11px] text-gray-400 ml-2">BOGA_KRITER_ANALYSIS — swing117_bot</span>
        </div>
        <div className="flex items-center gap-2">
          {generatedAt && (
            <span className="text-[10px] text-gray-500">
              {cacheHit ? "CACHE · " : ""}
              {new Date(generatedAt).toLocaleTimeString("tr-TR")}
            </span>
          )}
          {/* Arşiv butonu */}
          <Link
            href="/swing"
            className="text-[10px] text-gray-400 hover:text-cyan-400 border border-white/10 px-2 py-0.5 rounded transition-colors"
          >
            Arşiv
          </Link>
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
              <div className="text-gray-400 text-xs">
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
              <div className="text-green-400 text-sm animate-pulse">{">"} Claude API bağlantısı kuruluyor...</div>
              <div className="text-gray-400 text-xs animate-pulse">{">"} Trade verileri sıkıştırılıp analiz ediliyor...</div>
              <div className="text-gray-600 text-xs mt-4 animate-pulse">{"_ "}</div>
            </div>
          )}

          {aiReport && !isLoading && (
            <div className="space-y-0.5 text-sm leading-relaxed">
              <div className="text-gray-500 text-xs mb-3">
                {">"} Analiz tamamlandı. {cacheHit ? "[önbellekten]" : "[yeni analiz]"}
              </div>
              {colorizeReport(aiReport)}

              {/* Aksiyon butonları */}
              <div className="mt-5 pt-3 border-t border-green-900/20 flex flex-wrap gap-2">
                <button
                  onClick={onGenerate}
                  className="text-[11px] text-gray-400 hover:text-green-400 transition-colors border border-white/10 px-3 py-1.5 rounded"
                >
                  Yenile (Force Refresh)
                </button>
                <button
                  onClick={handleCopy}
                  className={`text-[11px] border px-3 py-1.5 rounded transition-colors ${copied ? "text-green-400 border-green-800/40" : "text-gray-400 hover:text-white border-white/10"}`}
                >
                  {copied ? "✓ Kopyalandı" : "Kopyala"}
                </button>
                <button
                  onClick={handleMD}
                  className="text-[11px] text-gray-400 hover:text-cyan-400 border border-white/10 px-3 py-1.5 rounded transition-colors"
                >
                  .md İndir
                </button>
                <button
                  onClick={() => downloadPDF(aiReport, generatedAt)}
                  className="text-[11px] text-gray-400 hover:text-purple-400 border border-white/10 px-3 py-1.5 rounded transition-colors"
                >
                  PDF Kaydet
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
