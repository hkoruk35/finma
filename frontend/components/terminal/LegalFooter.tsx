'use client'

import { Shield } from 'lucide-react'

export function LegalFooter() {
  return (
    <footer className="mt-8 border-t border-finma-border/40 py-4 px-2">
      <div className="flex items-start gap-2 max-w-5xl mx-auto">
        <Shield className="w-3.5 h-3.5 text-finma-text-dim/50 shrink-0 mt-0.5" />
        <p className="text-[10px] text-finma-text-dim/60 leading-relaxed">
          <span className="font-semibold text-finma-text-dim/80">Yasal Uyarı:</span>{' '}
          FinMA bir yatırım danışmanlığı veya aracı kurum hizmeti sunmamaktadır. Bu platformda yer alan bilgiler, analizler ve sinyaller yalnızca bilgilendirme amaçlıdır ve yatırım tavsiyesi niteliği taşımaz. FinMA yalnızca finansal analiz ve portföy yönetim aracıdır. Yatırım kararlarınız tamamen kendi sorumluluğunuzdadır. Geçmiş performans gelecekteki sonuçların garantisi değildir.
        </p>
      </div>
    </footer>
  )
}
