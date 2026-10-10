import { Metadata } from "next";
import Link from "next/link";
import MemberHeader from "@/components/public/MemberHeader";
import Footer from "@/components/Footer";
import {
  EGITIM_GROUPS,
  EGITIM_INTRO,
  EGITIM_SECTIONS,
  EGITIM_TITLE,
  egitimStats,
  videoHref,
  CHANNEL_URL,
  type Block,
  type Level,
} from "@/lib/egitim/abdBorsasiRehberi";

export const metadata: Metadata = {
  title: "ABD Borsası Eğitim Rehberi",
  description:
    "ABD borsasını sıfırdan öğrenin: NYSE/NASDAQ, endeksler, teknik ve temel analiz, risk yönetimi, vergi, broker seçimi ve her bölüm için Türkçe video eğitimleri.",
  alternates: { canonical: "https://bogastock.com/global/tr/egitim" },
};

const LEVEL_STYLE: Record<Level, string> = {
  Başlangıç: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  Orta: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  İleri: "text-rose-300 bg-rose-500/10 border-rose-500/30",
};

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case "p":
      return <p className="text-[#94a3b8] text-sm md:text-base leading-relaxed">{b.text}</p>;
    case "terms":
      return (
        <dl className="grid gap-3">
          {b.items.map((it) => (
            <div key={it.term} className="rounded-lg bg-[#0a0e17]/60 border border-[#1e2a3a] px-4 py-3">
              <dt className="text-white font-semibold text-sm md:text-base">{it.term}</dt>
              <dd className="text-[#94a3b8] text-sm leading-relaxed mt-1">{it.text}</dd>
            </div>
          ))}
        </dl>
      );
    case "ul":
      return (
        <div>
          {b.title && <h3 className="text-white font-semibold text-sm md:text-base mb-2">{b.title}</h3>}
          <ul className="space-y-1.5">
            {b.items.map((it) => (
              <li key={it} className="flex gap-2 text-[#94a3b8] text-sm leading-relaxed">
                <span className="mt-2 w-1.5 h-1.5 rounded-full bg-[#3b82f6] shrink-0" />
                <span>{it}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    case "note":
      return (
        <div
          className={`rounded-lg border px-4 py-3 text-sm leading-relaxed ${
            b.tone === "warn"
              ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
              : "border-[#3b82f6]/30 bg-[#3b82f6]/10 text-blue-100"
          }`}
        >
          {b.text}
        </div>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          {b.caption && <div className="text-xs text-[#64748b] mb-2">{b.caption}</div>}
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr>
                {b.head.map((h) => (
                  <th key={h} className="px-3 py-2 text-[#64748b] font-medium border-b border-[#1e2a3a] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className={`px-3 py-2 border-b border-[#1e2a3a]/60 ${i === 0 ? "text-white" : "text-[#94a3b8]"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "mistakes":
      return (
        <div className="grid gap-3 md:grid-cols-2">
          {b.items.map((m) => (
            <div key={m.title} className="rounded-lg bg-[#0a0e17]/60 border border-[#1e2a3a] px-4 py-3">
              <div className="text-white font-semibold text-sm mb-2">{m.title}</div>
              <ul className="space-y-1 mb-2">
                {m.bad.map((x) => (
                  <li key={x} className="text-rose-300/90 text-xs leading-relaxed">
                    ✕ {x}
                  </li>
                ))}
              </ul>
              <div className="text-emerald-300 text-xs leading-relaxed">✓ {m.fix}</div>
            </div>
          ))}
        </div>
      );
  }
}

export default function EgitimPage() {
  const stats = egitimStats();
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17] font-manrope">
      <MemberHeader locale="tr" />

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 md:py-16">
        <header className="mb-10 md:mb-14">
          <Link href="/global/tr/home" className="text-xs text-[#64748b] hover:text-white transition-colors">
            ← Ana sayfa
          </Link>
          <h1 className="mt-3 text-3xl md:text-5xl font-black text-white tracking-tight leading-tight">{EGITIM_TITLE}</h1>
          <p className="mt-4 text-[#94a3b8] text-base md:text-lg max-w-3xl">{EGITIM_INTRO}</p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="px-3 py-1 rounded-full bg-[#1e2a3a]/60 border border-[#1e2a3a] text-[#94a3b8]">{stats.sections} bölüm</span>
            <span className="px-3 py-1 rounded-full bg-[#1e2a3a]/60 border border-[#1e2a3a] text-[#94a3b8]">{stats.videos} eğitim videosu</span>
            <span className="px-3 py-1 rounded-full bg-[#1e2a3a]/60 border border-[#1e2a3a] text-[#94a3b8]">Yalnızca Türkçe</span>
          </div>
        </header>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
          <aside className="mb-8 lg:mb-0">
            <nav aria-label="İçindekiler" className="lg:sticky lg:top-24 rounded-xl bg-[#1e2a3a]/40 border border-[#1e2a3a] p-4 lg:max-h-[calc(100vh-7rem)] overflow-y-auto">
              <div className="text-xs uppercase tracking-wider text-[#64748b] mb-3">İçindekiler</div>
              {EGITIM_GROUPS.map((g) => (
                <div key={g} className="mb-3 last:mb-0">
                  <div className="text-[11px] font-semibold text-[#3b82f6] mb-1">{g}</div>
                  <ul className="space-y-0.5">
                    {EGITIM_SECTIONS.filter((s) => s.group === g).map((s) => (
                      <li key={s.id}>
                        <a href={`#${s.id}`} className="block text-sm text-[#94a3b8] hover:text-white transition-colors py-0.5">
                          {EGITIM_SECTIONS.indexOf(s) + 1}. {s.title.split(":")[0]}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>

          <div className="space-y-6">
            {EGITIM_SECTIONS.map((s, i) => (
              <section
                key={s.id}
                id={s.id}
                className="scroll-mt-24 bg-[#1e2a3a]/40 border border-[#1e2a3a] rounded-xl p-5 md:p-7"
              >
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="text-xs font-bold text-[#3b82f6]">BÖLÜM {i + 1}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${LEVEL_STYLE[s.level]}`}>{s.level}</span>
                </div>
                <h2 className="text-xl md:text-2xl font-bold text-white mb-4 leading-snug">{s.title}</h2>
                <div className={s.images ? "md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:gap-6 md:items-start" : ""}>
                  <div className="space-y-4">
                    {s.blocks.map((b, bi) => (
                      <BlockView key={bi} b={b} />
                    ))}
                  </div>
                  {s.images && (
                    <div className="mt-5 md:mt-0 space-y-4">
                      {s.images.map((im) => (
                        <a key={im.src} href={im.src} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-[#1e2a3a] hover:border-[#3b82f6]/60 transition-colors">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={im.src} alt={im.alt} loading="lazy" decoding="async" className="w-full h-auto block" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-[#1e2a3a]">
                  <h3 className="text-sm font-semibold text-white mb-3">Eğitim Videosu</h3>
                  <a
                    href={videoHref(s.video)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg bg-[#0a0e17]/60 border border-[#1e2a3a] hover:border-[#ef4444]/50 px-3 py-2.5 transition-colors group"
                  >
                    <span className="w-8 h-8 rounded-md bg-[#ef4444]/15 text-[#ef4444] flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </span>
                    <span className="text-sm text-[#cbd5e1] group-hover:text-white transition-colors leading-snug">{s.video.title}</span>
                    <span className="ml-auto text-[11px] text-[#64748b] shrink-0">Sidar Demirgil · YouTube</span>
                  </a>
                </div>
              </section>
            ))}

            <p className="text-xs text-[#64748b] leading-relaxed">
              Videolar YouTube&apos;daki{" "}
              <a href={CHANNEL_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Sidar Demirgil</a>{" "}
              kanalına aittir. Bu sayfadaki içerik genel eğitim amaçlıdır ve yatırım tavsiyesi değildir. Ayrıntılar için{" "}
              <Link href="/global/tr/disclaimer" className="underline hover:text-white">
                yasal uyarıyı
              </Link>{" "}
              okuyun.
            </p>
          </div>
        </div>
      </main>

      <Footer locale="tr" />
    </div>
  );
}
