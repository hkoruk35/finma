'use client'

import { useState, useEffect } from 'react'
import { Download, X, Smartphone } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSGuide, setShowIOSGuide] = useState(false)

  useEffect(() => {
    // Check if already in standalone mode (installed)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setDismissed(true)
      return
    }

    // Check if dismissed before (localStorage)
    if (localStorage.getItem('finma-install-dismissed') === 'true') {
      setDismissed(true)
      return
    }

    // iOS detection (beforeinstallprompt doesn't fire on iOS Safari)
    const ua = navigator.userAgent
    const isIOSDevice = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    setIsIOS(isIOSDevice)

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    localStorage.setItem('finma-install-dismissed', 'true')
  }

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
        setDismissed(true)
      }
    }
  }

  // Nothing to show
  if (dismissed) return null
  if (!deferredPrompt && !isIOS) return null

  // iOS: Show guide for Add to Home Screen
  if (isIOS) {
    return (
      <>
        <div className="fixed bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50
                        bg-finma-card border border-finma-primary/30 rounded-lg p-3
                        flex items-center gap-3 shadow-lg shadow-finma-primary/10 animate-fade-in">
          <Smartphone className="w-5 h-5 text-finma-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-semibold text-white">Ana Ekrana Ekle</div>
            <div className="text-[10px] text-finma-text-dim mt-0.5">
              Uygulama olarak kullanmak için tıklayın
            </div>
          </div>
          <button
            onClick={() => setShowIOSGuide(true)}
            className="finma-btn-primary text-[10px] py-1.5 px-3 whitespace-nowrap"
          >
            Nasıl?
          </button>
          <button onClick={handleDismiss} className="p-1 text-finma-text-dim hover:text-finma-text">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* iOS Step Guide Modal */}
        {showIOSGuide && (
          <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center">
            <div className="fixed inset-0 bg-black/60" onClick={() => setShowIOSGuide(false)} />
            <div className="relative bg-finma-card border border-finma-border rounded-t-xl md:rounded-xl p-5 w-full md:max-w-sm mx-0 md:mx-4 animate-fade-in">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-3 right-3 p-1 text-finma-text-dim hover:text-finma-text"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="text-sm font-semibold text-white mb-3">FinMA&apos;yı Ana Ekrana Ekle</div>
              <div className="space-y-3 text-xs text-finma-text-dim">
                <div className="flex items-start gap-2">
                  <span className="bg-finma-primary/20 text-finma-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                  <span>Safari&apos;da alt menüdeki <strong className="text-white">Paylaş</strong> butonuna dokunun (kare + ok ikonu)</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-finma-primary/20 text-finma-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                  <span>Listede <strong className="text-white">&quot;Ana Ekrana Ekle&quot;</strong> seçeneğine dokunun</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="bg-finma-primary/20 text-finma-primary rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                  <span>Sağ üstteki <strong className="text-white">Ekle</strong> butonuna dokunun</span>
                </div>
              </div>
              <button
                onClick={() => { setShowIOSGuide(false); handleDismiss() }}
                className="finma-btn-primary w-full mt-4 text-xs"
              >
                Anladım
              </button>
            </div>
          </div>
        )}
      </>
    )
  }

  // Android/Chrome: Direct install prompt
  return (
    <div className="fixed bottom-4 left-3 right-3 md:left-auto md:right-4 md:w-80 z-50
                    bg-finma-card border border-finma-primary/30 rounded-lg p-3
                    flex items-center gap-3 shadow-lg shadow-finma-primary/10 animate-fade-in">
      <Download className="w-5 h-5 text-finma-primary shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-white">Uygulamayı Yükle</div>
        <div className="text-[10px] text-finma-text-dim mt-0.5">Ana ekrana ekleyerek hızlı erişin</div>
      </div>
      <button onClick={handleInstall} className="finma-btn-primary text-[10px] py-1.5 px-3 whitespace-nowrap">
        Yükle
      </button>
      <button onClick={handleDismiss} className="p-1 text-finma-text-dim hover:text-finma-text">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
