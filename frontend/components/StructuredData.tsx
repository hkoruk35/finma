import React from 'react';

export default function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BOGA AI",
    "alternateName": ["Blue One Global Analysis", "BOGA Stock"],
    "url": "https://bogastock.com",
    "description": "AI-powered US stock analysis and trading signals for 6,000+ premier stocks and ETFs.",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://bogastock.com/stock/{search_term_string}"
      },
      "query-input": "required name=search_term_string"
    },
    "publisher": {
      "@type": "Organization",
      "name": "BOGA AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://bogastock.com/logo/boga_stock_icon.png"
      }
    }
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
