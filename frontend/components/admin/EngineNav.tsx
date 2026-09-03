"use client";

/**
 * Motor sayfaları arası gezinme şeridi.
 *
 * NEDEN: dört sayfa aynı işin farklı yüzleri ama aralarında yalnızca
 * spyengine ↔ supertrade/v4 tek yönlü bağlantıları vardı; diğer ikisine
 * ancak URL yazarak ya da yan menüden gidiliyordu. Rota listesi burada TEK
 * yerde durur — yeni bir motor sayfası eklenince tek dosya güncellenir,
 * dört başlıkta ayrı ayrı link kopyalanmaz.
 *
 * Rotalar dosya sisteminden doğrulandı (frontend/AGENTS.md §2: rota tahmin
 * edilmez), tahmin edilmedi.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  /** Kısa açıklama — tooltip */
  hint: string;
}

const ITEMS: NavItem[] = [
  { href: "/admin/spyengine/v1", label: "SPY Engine", hint: "SPY 0DTE rejim farkında sinyal motoru" },
  { href: "/admin/supertrade", label: "SPX Yön Motoru", hint: "SuperTrade v3 — seviye, yapı ve kırılım teyidi" },
  { href: "/admin/supertrade/v4", label: "Fırsat Tarayıcı", hint: "SuperTrade V4 — çoklu varlık kırılım taraması" },
  { href: "/admin/supertrade/performance", label: "Performans", hint: "Geçmiş sinyaller, isabet ve dersler" },
];

export default function EngineNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Motor sayfaları">
      {ITEMS.map((it) => {
        // Tam eşleşme: /admin/supertrade, /admin/supertrade/v4'ü aktif saymasın
        const active = pathname === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            title={it.hint}
            aria-current={active ? "page" : undefined}
            className={`rounded border px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              active
                ? "border-[#3b82f6]/50 bg-[#3b82f6]/15 text-[#60a5fa]"
                : "border-[#1c2635] bg-[#111827] text-slate-400 hover:bg-[#1c2635] hover:text-slate-200"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
