'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Locale } from '@/lib/i18n/copy';

export const CONSENT_STORAGE_KEY = 'boga_cookie_consent';
export const CONSENT_EVENT = 'boga-cookie-consent-changed';

const TEXT: Record<Locale, { message: string; accept: string; reject: string; policy: string }> = {
  tr: {
    message: 'Bu site, deneyiminizi geliştirmek ve trafiği analiz etmek için çerezler kullanır. "Kabul Ediyorum"a basarak analiz/reklam çerezlerine izin verirsiniz; "Reddet"e basarsanız bu çerezler yüklenmez, site yalnızca temel işlevlerle çalışmaya devam eder.',
    accept: 'Kabul Ediyorum',
    reject: 'Reddet',
    policy: 'Gizlilik Politikası',
  },
  en: {
    message: 'This site uses cookies to improve your experience and analyze traffic. Click "Accept" to allow analytics/advertising cookies; click "Reject" and those cookies will not load — the site will keep working with only essential functionality.',
    accept: 'Accept',
    reject: 'Reject',
    policy: 'Privacy Policy',
  },
  es: {
    message: 'Este sitio utiliza cookies para mejorar su experiencia y analizar el tráfico. Al hacer clic en "Aceptar" permite cookies de análisis/publicidad; si hace clic en "Rechazar" esas cookies no se cargarán — el sitio seguirá funcionando solo con lo esencial.',
    accept: 'Aceptar',
    reject: 'Rechazar',
    policy: 'Política de Privacidad',
  },
  fr: {
    message: 'Ce site utilise des cookies pour améliorer votre expérience et analyser le trafic. En cliquant sur "Accepter", vous autorisez les cookies d\'analyse/publicité ; en cliquant sur "Refuser", ces cookies ne seront pas chargés — le site continuera de fonctionner avec les fonctions essentielles uniquement.',
    accept: 'Accepter',
    reject: 'Refuser',
    policy: 'Politique de Confidentialité',
  },
  pt: {
    message: 'Este site utiliza cookies para melhorar sua experiência e analisar o tráfego. Ao clicar em "Aceitar" você permite cookies de análise/publicidade; ao clicar em "Rejeitar" esses cookies não serão carregados — o site continuará funcionando apenas com o essencial.',
    accept: 'Aceitar',
    reject: 'Rejeitar',
    policy: 'Política de Privacidade',
  },
  id: {
    message: 'Situs ini menggunakan cookie untuk meningkatkan pengalaman Anda dan menganalisis lalu lintas. Klik "Terima" untuk mengizinkan cookie analitik/iklan; klik "Tolak" dan cookie tersebut tidak akan dimuat — situs akan tetap berfungsi hanya dengan fitur penting.',
    accept: 'Terima',
    reject: 'Tolak',
    policy: 'Kebijakan Privasi',
  },
};

type Consent = 'accepted' | 'rejected';

export default function CookieConsent({ locale }: { locale: Locale }) {
  const [visible, setVisible] = useState(false);
  const t = TEXT[locale] ?? TEXT.en;

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored !== 'accepted' && stored !== 'rejected') {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const choose = (value: Consent) => {
    try {
      window.localStorage.setItem(CONSENT_STORAGE_KEY, value);
      window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => choose('rejected')}
            className="px-5 py-2 rounded-lg bg-transparent border border-[#1e2a3a] hover:border-white/30 text-white/70 hover:text-white text-[12px] font-bold uppercase tracking-wide transition-colors"
          >
            {t.reject}
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="px-5 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-[12px] font-bold uppercase tracking-wide transition-colors"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
