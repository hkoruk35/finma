interface MarketStatusCardProps {
  regime: "BULLISH" | "BEARISH" | "NEUTRAL";
  locale: "tr" | "en";
}

const REGIME_STYLE: Record<MarketStatusCardProps["regime"], { color: string; tr: string; en: string }> = {
  BULLISH: { color: "#22c55e", tr: "YÜKSELİŞ", en: "BULLISH" },
  BEARISH: { color: "#ef4444", tr: "DÜŞÜŞ", en: "BEARISH" },
  NEUTRAL: { color: "#f59e0b", tr: "NÖTR", en: "NEUTRAL" },
};

export default function MarketStatusCard({ regime, locale }: MarketStatusCardProps) {
  const style = REGIME_STYLE[regime];
  const label = locale === "tr" ? style.tr : style.en;
  const title = locale === "tr" ? "PİYASA DURUMU" : "MARKET STATUS";

  return (
    <div className="glass-card border-2 border-[#1e2a3a]/50 rounded-2xl overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-[#1e2a3a]">
        <span className="w-1.5 h-6 rounded-full" style={{ background: style.color }} />
        <h3 className="text-sm font-black text-white uppercase tracking-tight">{title}</h3>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
        <span className="w-2.5 h-2.5 rounded-full live-dot" style={{ background: style.color }} />
        <div className="text-2xl font-black tracking-tight" style={{ color: style.color }}>
          {label}
        </div>
      </div>
    </div>
  );
}
