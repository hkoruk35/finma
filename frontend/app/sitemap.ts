import { MetadataRoute } from 'next';
import { getAllTickers } from '@/lib/data';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const allTickers = await getAllTickers();
  const baseUrl = 'https://bogastock.com';
  
  const staticRoutes = [
    { route: '', priority: 1.0, changefreq: 'hourly' },
    { route: '/category/top-scores', priority: 0.8, changefreq: 'daily' },
    { route: '/category/breakout', priority: 0.8, changefreq: 'daily' },
    { route: '/category/undervalued', priority: 0.8, changefreq: 'daily' },
    { route: '/category/momentum', priority: 0.8, changefreq: 'daily' },
    { route: '/category/reversal', priority: 0.8, changefreq: 'daily' },
    { route: '/category/dividend', priority: 0.8, changefreq: 'daily' },
    { route: '/about', priority: 0.5, changefreq: 'monthly' },
    { route: '/about/how-it-works', priority: 0.8, changefreq: 'daily' },
    { route: '/contact', priority: 0.5, changefreq: 'monthly' },
    { route: '/disclaimer', priority: 0.3, changefreq: 'monthly' },
    { route: '/privacy', priority: 0.3, changefreq: 'monthly' },
    { route: '/terms', priority: 0.3, changefreq: 'monthly' },
    { route: '/login', priority: 0.4, changefreq: 'monthly' },
    { route: '/register', priority: 0.4, changefreq: 'monthly' },
    { route: '/academy', priority: 0.9, changefreq: 'weekly' },
    { route: '/academy/how-to-start-investing', priority: 0.8, changefreq: 'monthly' },
    { route: '/academy/rsi-indicator', priority: 0.8, changefreq: 'monthly' },
    { route: '/academy/momentum-trading', priority: 0.8, changefreq: 'monthly' },
    { route: '/academy/ai-stock-picking', priority: 0.8, changefreq: 'monthly' },
  ].map(item => ({
    url: `${baseUrl}${item.route}`,
    lastModified: new Date(),
    changeFrequency: item.changefreq as any,
    priority: item.priority,
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
