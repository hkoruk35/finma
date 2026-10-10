import Link from "next/link";

/** Yalnızca Türkçe ana sayfada: ABD Borsası Eğitim Rehberi'ne giriş kartı. */
export default function HomeEducationCard() {
  return (
    <Link
      href="/global/tr/egitim"
      className="block bg-[#202327] border border-[#30343A]/60 rounded-xl p-4 hover:border-[#3b82f6]/60 transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-1 h-4 rounded-full bg-[#10b981]" />
        <span className="text-sm font-semibold text-white">Eğitim Rehberi</span>
        <span className="ml-auto text-[11px] px-2 py-0.5 rounded-full bg-[#2a2e35] text-[#94a3b8]">Tümü</span>
      </div>
      <p className="text-sm text-white font-medium leading-snug">ABD Borsası: Sıfırdan Profesyonelliğe</p>
      <p className="text-xs text-[#94a3b8] mt-1 leading-relaxed">16 bölüm, Türkçe video eğitimleri ve uygulamalı örnekler.</p>
    </Link>
  );
}
