'use client'

import { Shield } from 'lucide-react'

export function LegalFooter() {
  return (
    <footer className="mt-8 border-t border-finma-border/40 py-4 px-2">
      <div className="flex items-start gap-2 max-w-5xl mx-auto">
        <Shield className="w-3.5 h-3.5 text-finma-text-dim/50 shrink-0 mt-0.5" />
        <p className="text-[10px] text-finma-text-dim/60 leading-relaxed">
          FinMA yapay zeka destekli piyasa analiz platformudur. Sunulan içerikler yalnızca bilgilendirme amaçlıdır; yatırım tavsiyesi niteliği taşımaz. Nihai karar kullanıcıya aittir.
        </p>
      </div>
      <div className="text-center mt-3">
        <span className="text-[9px] text-finma-text-dim/40">
          © 2026 FinMA
        </span>
      </div>
    </footer>
  )
}
