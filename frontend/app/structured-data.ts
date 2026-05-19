// JSON-LD Structured Data for AI & Google crawlers

export const getWebsiteStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "BOGA AI - Blue One Global Analysis",
    "description": "Daily AI-powered analysis of +8000 top US stocks with trading signals and scores",
    "url": "https://bogastock.com",
    "sameAs": [
      "https://twitter.com/bogaai",
      "https://instagram.com/bogaai",
      "https://linkedin.com/company/bogaai"
    ],
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://bogastock.com/stock/{search_term_string}"
      },
      "query-input": "required name=search_term_string"
    }
  };
};

export const getOrganizationStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "BOGA AI - Blue One Global Analysis",
    "alternateName": "BOGA",
    "url": "https://bogastock.com",
    "logo": "https://bogastock.com/finmawave.png",
    "description": "AI-powered stock analysis platform providing daily trading signals and technical analysis",
    "foundingDate": "2023",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+1-XXX-XXX-XXXX",
      "contactType": "Customer Service"
    },
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "US"
    }
  };
};

export const getArticleStructuredData = (title: string, description: string, datePublished: string) => {
  return {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": title,
    "description": description,
    "image": "https://bogastock.com/finmawave.png",
    "datePublished": datePublished,
    "author": {
      "@type": "Organization",
      "name": "BOGA AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "BOGA AI",
      "logo": {
        "@type": "ImageObject",
        "url": "https://bogastock.com/finmawave.png"
      }
    }
  };
};

export const getFinancialServiceStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    "name": "BOGA AI Stock Analysis",
    "description": "AI-powered stock market analysis and trading signals",
    "url": "https://bogastock.com",
    "provider": {
      "@type": "Organization",
      "name": "BOGA AI"
    },
    "areaServed": {
      "@type": "Country",
      "name": "US"
    }
  };
};
