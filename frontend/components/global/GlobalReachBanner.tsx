import type { ReactNode } from "react";

type Lang = "en" | "es" | "fr" | "pt" | "tr";

const NODE_POSITIONS = [4, 11, 18, 25, 32, 39, 46, 53, 60, 67, 74, 81, 88, 95];
const PULSE_POSITIONS = [18, 53, 88];

function GlobeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} fill="none" stroke="currentColor" strokeWidth={1}>
      <circle cx="16" cy="16" r="13" />
      <ellipse cx="16" cy="16" rx="13" ry="5.5" />
      <ellipse cx="16" cy="16" rx="6" ry="13" />
      <line x1="3" y1="16" x2="29" y2="16" />
    </svg>
  );
}

function Num({ children }: { children: ReactNode }) {
  return <span className="text-[#3b82f6] font-bold">{children}</span>;
}

const COPY: Record<Lang, ReactNode> = {
  en: (
    <>
      <Num>70+</Num> countries · <Num>40,000+</Num> traders worldwide · live US market coverage, now in{" "}
      <Num>5</Num> languages
    </>
  ),
  es: (
    <>
      Más de <Num>70</Num> países · más de <Num>40.000</Num> traders · el pulso de Wall Street, ahora en{" "}
      <Num>5</Num> idiomas
    </>
  ),
  fr: (
    <>
      Plus de <Num>70</Num> pays · plus de <Num>40 000</Num> traders · le pouls de Wall Street, désormais en{" "}
      <Num>5</Num> langues
    </>
  ),
  pt: (
    <>
      Mais de <Num>70</Num> países · mais de <Num>40.000</Num> traders · o pulso de Wall Street, agora em{" "}
      <Num>5</Num> idiomas
    </>
  ),
  tr: (
    <>
      <Num>70&apos;ten</Num> fazla ülke · <Num>40.000&apos;i</Num> aşkın üye · ABD borsalarını{" "}
      <Num>5</Num> dilde canlı takip ediyoruz
    </>
  ),
};

export default function GlobalReachBanner({ lang }: { lang: Lang }) {
  return (
    <div className="relative w-full overflow-hidden bg-[#0a0e17] border-b border-[#1e2a3a]">
      <div className="absolute inset-0 pointer-events-none">
        <GlobeMark className="absolute -left-3 top-1/2 -translate-y-1/2 w-14 h-14 text-[#3b82f6]/[0.08]" />
        <GlobeMark className="absolute -right-3 top-1/2 -translate-y-1/2 w-14 h-14 text-[#3b82f6]/[0.08] scale-x-[-1]" />
        <div className="absolute left-0 right-0 top-1/2 h-px bg-gradient-to-r from-transparent via-[#3b82f6]/25 to-transparent" />
        {NODE_POSITIONS.map((pct) => (
          <span
            key={pct}
            className="absolute top-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-[#3b82f6]/40"
            style={{ left: `${pct}%` }}
          />
        ))}
        {PULSE_POSITIONS.map((pct) => (
          <span
            key={pct}
            className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-[#3b82f6]/70 animate-pulse"
            style={{ left: `${pct}%` }}
          />
        ))}
      </div>

      <div className="relative max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-center text-center">
        <p className="text-[11px] sm:text-xs text-white/60 tracking-wide">{COPY[lang]}</p>
      </div>
    </div>
  );
}
