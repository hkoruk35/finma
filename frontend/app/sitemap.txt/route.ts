export const runtime = "edge";

const baseUrl = "https://bogastock.com";

const locales = ["en", "tr", "es", "fr", "pt", "id"];

const routes = [
  "",
  "/discover",
  "/today",
  "/newsroom",
  "/terminal",
  "/markets",
  "/earning-calendar",
  "/insider",
  "/themes",
  "/about",
  "/contact",
  "/terms",
  "/privacy",
  "/disclaimer",
  "/sitemap"
];

const localeSpecificRoutes: Record<string, string[]> = {
  en: ["/faq"],
  tr: ["/sss"],
  es: ["/faq"],
  fr: ["/faq"],
  pt: ["/Perguntas_Frequentes"],
};

export async function GET() {
  let content = "";

  for (const locale of locales) {
    for (const route of routes) {
      content += `${baseUrl}/global/${locale}${route}\n`;
    }

    const specificRoutes = localeSpecificRoutes[locale] || [];
    for (const route of specificRoutes) {
      content += `${baseUrl}/global/${locale}${route}\n`;
    }
  }

  return new Response(content, {
    headers: {
      "Content-Type": "text/plain",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=43200",
    },
  });
}
