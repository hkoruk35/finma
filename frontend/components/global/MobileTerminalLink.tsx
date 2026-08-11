'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import type { Locale } from '@/lib/i18n/copy';

interface Props {
  locale: Locale;
  targetHref: string;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export default function MobileTerminalLink({ locale, targetHref, children, className, title }: Props) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (targetHref.includes('/kayit') || targetHref.includes('/register')) {
      return;
    }
    const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
    if (isMobile) {
      e.preventDefault();
      setShowModal(true);
    }
  };

  const handleConfirm = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('allow_mobile_terminal', 'true');
    }
    setShowModal(false);
    router.push(targetHref);
  };

  const labels = {
    tr: {
      title: "TERMINAL Kullanım Uyarısı",
      desc: "Mükemmel ve detaylı bir TERMINAL deneyimi için bilgisayar (PC) kullanımı tavsiye edilir.",
      confirm: "Tamam (Devam Et)",
      cancel: "İptal"
    },
    en: {
      title: "TERMINAL Experience Notice",
      desc: "For the best and most comprehensive TERMINAL experience, using a PC is recommended.",
      confirm: "Continue",
      cancel: "Cancel"
    },
    es: {
      title: "Aviso de Uso del TERMINAL",
      desc: "Para la mejor experiencia en el TERMINAL, se recomienda usar una computadora (PC).",
      confirm: "Continuar",
      cancel: "Cancelar"
    },
    fr: {
      title: "Avis d'Utilisation du TERMINAL",
      desc: "Pour une expérience TERMINAL optimale, l'utilisation d'un ordinateur (PC) est recommandée.",
      confirm: "Continuer",
      cancel: "Annuler"
    },
    pt: {
      title: "Aviso de Uso do TERMINAL",
      desc: "Para a melhor experiência no TERMINAL, é recomendado o uso de um computador (PC).",
      confirm: "Continuar",
      cancel: "Cancelar"
    },
    id: {
      title: "Pemberitahuan Penggunaan TERMINAL",
      desc: "Untuk pengalaman TERMINAL terbaik dan paling lengkap, disarankan menggunakan komputer (PC).",
      confirm: "Lanjutkan",
      cancel: "Batal"
    }
  }[locale] ?? {
    title: "TERMINAL Experience Notice",
    desc: "For the best and most comprehensive TERMINAL experience, using a PC is recommended.",
    confirm: "Continue",
    cancel: "Cancel"
  };

  return (
    <>
      <a href={targetHref} onClick={handleClick} className={className} title={title}>
        {children}
      </a>

      {mounted && showModal && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0d1424] border-2 border-amber-500/50 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl shadow-amber-500/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4 border-2 border-amber-500/40">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-amber-400 uppercase tracking-tight mb-2">
              {labels.title}
            </h3>
            <p className="text-sm text-white/80 leading-relaxed mb-6">
              {labels.desc}
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-white/60 font-medium text-xs uppercase tracking-wider hover:bg-white/5 transition-colors"
              >
                {labels.cancel}
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#3b82f6] hover:bg-blue-600 text-white font-medium text-xs uppercase tracking-wider shadow-lg shadow-blue-500/20 transition-all"
              >
                {labels.confirm}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
