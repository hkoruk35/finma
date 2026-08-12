import type { FutureContent, FutureSide } from "@/lib/futureContent";

function SidePanel({ side, accent }: { side: FutureSide; accent: string }) {
  return (
    <div className="flex-1 px-6 md:px-10 py-12">
      <p className={`text-xs font-medium uppercase tracking-[0.3em] mb-3`} style={{ color: accent }}>
        {side.eyebrow}
      </p>
      <h2 className="text-2xl md:text-3xl font-black text-white mb-2 tracking-tight">{side.brand}</h2>
      <p className="text-sm text-white/60 mb-6">{side.tagline}</p>
      <p className="text-white/80 leading-relaxed mb-8">{side.intro}</p>

      <div className="grid grid-cols-2 gap-4 mb-10">
        {side.stats.map((stat, idx) => (
          <div key={idx} className="glass-card p-4">
            <div className="text-xl md:text-2xl font-black mb-1" style={{ color: accent }}>
              {stat.number}
            </div>
            <p className="text-white/60 text-xs leading-snug">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-6">
        {side.sections.map((sec, idx) => (
          <div key={idx} className="glass-card p-5 md:p-6 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: accent }}></div>
            <h3 className="text-base font-bold text-white mb-2">{sec.title}</h3>
            <p className="text-white/70 text-sm leading-relaxed">{sec.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FuturePageContent({ content }: { content: FutureContent }) {
  return (
    <>
      <div className="text-center px-4 pt-16 pb-12 max-w-3xl mx-auto">
        <p className="text-xs font-medium text-[#3b82f6] uppercase tracking-[0.3em] mb-4">{content.badge}</p>
        <h1 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tight leading-tight">
          {content.title}
        </h1>
        <p className="text-lg text-white/80 leading-relaxed">{content.subtitle}</p>
      </div>

      <div className="max-w-6xl mx-auto w-full flex flex-col md:flex-row md:divide-x md:divide-white/10">
        <SidePanel side={content.left} accent="#3b82f6" />
        <SidePanel side={content.right} accent="#22c55e" />
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-16 text-center">
        <div className="glass-card p-8 md:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#3b82f6] via-[#8b5cf6] to-[#22c55e]"></div>
          <p className="text-white/80 italic leading-relaxed">{content.closing}</p>
        </div>
      </div>
    </>
  );
}
