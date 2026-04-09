import { MetadataRoute } from 'next';
import { getAllTickers } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allTickers = await getAllTickers();
  const baseUrl = 'https://finmasmart.com';
  
  const staticRoutes = [
    '',
    '/login',
    '/register',
    '/about',
    '/contact',
    '/disclaimer',
    '/privacy',
    '/category/top-signals',
    '/category/breakout',
    '/category/undervalued',
    '/category/momentum',
    '/category/reversal',
    '/category/dividend',
  ].map(route => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const stockRoutes = allTickers.map(stock => ({
    url: `${baseUrl}/stock/${stock.ticker.toLowerCase()}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  const sectorRoutes = [
    'technology', 'financials', 'healthcare', 'consumer-discretionary',
    'industrials', 'communication-services', 'energy', 'consumer-staples',
    'real-estate', 'materials', 'utilities'
  ].map(sector => ({
    url: `${baseUrl}/sector/${sector}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...stockRoutes, ...sectorRoutes];
}
