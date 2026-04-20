import Script from "next/script";

interface StructuredDataProps {
  data: Record<string, any>;
  type?: string;
}

export default function StructuredData({ data, type = "ld+json" }: StructuredDataProps) {
  return (
    <Script
      id={`structured-data-${type}`}
      type={`application/${type}`}
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
      strategy="afterInteractive"
    />
  );
}
