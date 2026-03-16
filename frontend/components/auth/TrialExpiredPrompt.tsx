'use client'

import { Clock, AlertTriangle } from 'lucide-react'

export function TrialExpiredPrompt() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="max-w-md w-full bg-finma-card border border-finma-border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-finma-yellow/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-finma-yellow" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Deneme Süreniz Doldu</h2>
        <p className="text-sm text-finma-text-dim mb-6">
          7 günlük ücretsiz Pro deneme süreniz sona erdi. Pro özelliklerine erişmeye devam etmek için üyeliğinizi yükseltin.
        </p>

        <div className="bg-finma-yellow/5 border border-finma-yellow/20 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-xs text-finma-yellow">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Üyelik yükseltme için yöneticinizle iletişime geçin.</span>
          </div>
        </div>

        <div className="text-[10px] text-finma-text-dim">
          Piyasa verileri ve dashboard hala erişilebilir durumda.
        </div>
      </div>
    </div>
  )
}
