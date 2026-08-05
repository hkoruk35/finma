'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n/copy';

const STORAGE_KEY = 'boga_cookie_consent';

const TEXT: Record<Locale, { message: string; accept: string; policy: string }> = {
  tr: {
    message: 'Bu site, deneyiminizi geliştirmek için çerezler kullanır. Siteyi kullanmaya devam ederek çerez kullanımını kabul etmiş olursunuz.',
    accept: 'Çerezleri Kabul Ediyorum',
    policy: 'Gizlilik Politikası',
  },
  en: {
    message: 'This site uses cookies to improve your experience. By continuing to use the site, you accept our use of cookies.',
    accept: 'Accept Cookies',
    policy: 'Privacy Policy',
  },
  es: {
    message: 'Este sitio utiliza cookies para mejorar su experiencia. Al continuar utilizando el sitio, acepta nuestro uso de cookies.',
    accept: 'Aceptar Cookies',
    policy: 'Política de Privacidad',
  },
  fr: {
    message: 'Ce site utilise des cookies pour améliorer votre expérience. En continuant à utiliser le site, vous acceptez notre utilisation des cookies.',
    accept: 'Accepter les Cookies',
    policy: 'Politique de Confidentialité',
  },
  pt: {
    message: 'Este site utiliza cookies para melhorar sua experiência. Ao continuar usando o site, você aceita nosso uso de cookies.',
    accept: 'Aceitar Cookies',
    policy: 'Política de Privacidade',
  },
};

export default function CookieConsent({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const t = TEXT[locale] ?? TEXT.en;

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) !== '1') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-[#0f1117] border-t border-[#1e2a3a] shadow-[0_-4px_20px_rgba(0,0,0,0.4)]">
      <div className="max-w-[1600px] mx-auto px-4 py-3.5 flex flex-col sm:flex-row items-center gap-3">
        <p className="text-[12px] text-white/70 flex-1 text-center sm:text-left">
          {t.message}{' '}
          <Link href={`/global/${locale}/privacy`} className="text-[#3b82f6] hover:underline">
            {t.policy}
          </Link>
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 px-5 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[12px] font-bold uppercase tracking-wide transition-colors"
        >
          {t.accept}
        </button>
      </div>
    </div>
  );
}
