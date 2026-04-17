import { MetadataRoute } from 'next';
import { getAllTickers, getSwingAllPicks } from '@/lib/data';
import { getAllLangParams } from '@/lib/analysis-langs';
import { getAllArchivedTickers, getArchivedDates } from '@/lib/analysis-archive';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [allTickers, swingData] = await Promise.all([
    getAllTickers(),
    getSwingAllPicks(),
  ]);

  const baseUrl = 'https://bogastock.com';
  const now = new Date();

  // ── Static routes ─────────────────────────────────────────────
  const staticRoutes = [
    { route: '',                             priority: 1.0, cf: 'hourly'  },
    { route: '/swing-picks',                 priority: 0.9, cf: 'daily'   },
    { route: '/swing-performance',           priority: 0.8, cf: 'daily'   },
    { route: '/category/top-scores',         priority: 0.8, cf: 'daily'   },
    { route: '/category/breakout',           priority: 0.8, cf: 'daily'   },
    { route: '/category/undervalued',        priority: 0.8, cf: 'daily'   },
    { route: '/category/momentum',           priority: 0.8, cf: 'daily'   },
    { route: '/category/reversal',           priority: 0.8, cf: 'daily'   },
    { route: '/category/dividend',           priority: 0.7, cf: 'daily'   },
    { route: '/academy',                     priority: 0.9, cf: 'weekly'  },
    { route: '/academy/how-to-start-investing', priority: 0.8, cf: 'monthly' },
    { route: '/academy/rsi-indicator',       priority: 0.8, cf: 'monthly' },
    { route: '/academy/momentum-trading',    priority: 0.8, cf: 'monthly' },
    { route: '/academy/ai-stock-picking',    priority: 0.8, cf: 'monthly' },
    { route: '/about',                       priority: 0.5, cf: 'monthly' },
    { route: '/about/how-it-works',          priority: 0.8, cf: 'monthly' },
    { route: '/contact',                     priority: 0.5, cf: 'monthly' },
    { route: '/disclaimer',                  priority: 0.3, cf: 'monthly' },
    { route: '/privacy',                     priority: 0.3, cf: 'monthly' },
    { route: '/terms',                       priority: 0.3, cf: 'monthly' },
    { route: '/login',                       priority: 0.4, cf: 'monthly' },
    { route: '/register',                    priority: 0.4, cf: 'monthly' },
  ].map(({ route, priority, cf }) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: cf as MetadataRoute.Sitemap[0]['changeFrequency'],
    priority,
  }));

  // ── /stock/[ticker] — all 500+ stocks ─────────────────────────
  const stockRoutes = allTickers.map(stock => ({
    url: `${baseUrl}/stock/${stock.ticker.toLowerCase()}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.6,
  }));

  // ── Sector routes ──────────────────────────────────────────────
  const sectorRoutes = [
    'technology', 'financials', 'healthcare', 'consumer-discretionary',
    'industrials', 'communication-services', 'energy', 'consumer-staples',
    'real-estate', 'materials', 'utilities',
  ].map(sector => ({
    url: `${baseUrl}/sector/${sector}`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  // ── /[lang]/[slug]/[ticker] — current swing picks × 6 languages ──
  const picks = swingData?.picks ?? [];
  const langParams = getAllLangParams();

  const langCurrentRoutes = langParams.flatMap(({ lang, slug }) =>
    picks.map((pick: any) => ({
      url: `${baseUrl}/${lang}/${slug}/${pick.ticker.toLowerCase()}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: lang === 'en' ? 0.9 : 0.8,
    }))
  );

  // ── /[lang]/[slug]/[ticker]/[date] — archive pages (Limit to last 7 days per stock) ──
  const archivedTickers = getAllArchivedTickers();
  // We limit to prevent sitemap overflow (>50k URLs)
  const langArchiveRoutes = langParams.flatMap(({ lang, slug }) =>
    archivedTickers.flatMap(ticker =>
      getArchivedDates(ticker).slice(0, 7).map(date => ({
        url: `${baseUrl}/${lang}/${slug}/${ticker.toLowerCase()}/${date}`,
        lastModified: new Date(date),
        changeFrequency: 'never' as const,
        priority: 0.4,
      }))
    )
  );

  return [
    ...staticRoutes,
    ...stockRoutes,
    ...sectorRoutes,
    ...langCurrentRoutes,
    ...langArchiveRoutes,
  ];
}
