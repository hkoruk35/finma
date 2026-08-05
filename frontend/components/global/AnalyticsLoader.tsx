'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from './CookieConsent';

/**
 * Google Analytics ve AdSense, kullanıcı çerez bannerında "Kabul Ediyorum"
 * demeden yüklenmez — "Reddet" seçilirse veya henüz seçim yapılmamışsa bu
 * component null döner, hiçbir 3. taraf script enjekte edilmez.
 */
export default function AnalyticsLoader() {
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setAccepted(window.localStorage.getItem(CONSENT_STORAGE_KEY) === 'accepted');
      } catch {
        setAccepted(false);
      }
    };
    read();
    window.addEventListener(CONSENT_EVENT, read);
    window.addEventListener('storage', read);
    return () => {
      window.removeEventListener(CONSENT_EVENT, read);
      window.removeEventListener('storage', read);
    };
  }, []);

  if (!accepted) return null;

  return (
    <>
      <Script id="google-analytics" strategy="afterInteractive" src="https://www.googletagmanager.com/gtag/js?id=G-CCSWK67D93" />
      <Script id="google-analytics-config" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-CCSWK67D93');
        `}
      </Script>
      <Script
        id="google-adsense"
        async
        src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-1081747094060539"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
    </>
  );
}
