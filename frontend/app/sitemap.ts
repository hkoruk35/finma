import { MetadataRoute } from 'next';
import { getSwingAllPicks } from '@/lib/data';
import { getAllLangParams } from '@/lib/analysis-langs';
import { getAllArchivedTickers, getArchivedDates } from '@/lib/analysis-archive';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const swingData = await getSwingAllPicks();

  const baseUrl = 'https://bogastock.com';
  const now = new Date();

  // ── Static routes ─────────────────────────────────────────────
  const staticRoutes = [
    { route: '',                             priority: 1.0, cf: 'hourly'  },
    // /search is the new site home (logo + root-domain redirect target)
    { route: '/global/en/search',            priority: 0.95, cf: 'daily'  },
    { route: '/global/tr/search',            priority: 0.95, cf: 'daily'  },
    { route: '/global/es/search',            priority: 0.95, cf: 'daily'  },
    { route: '/global/fr/search',            priority: 0.95, cf: 'daily'  },
    { route: '/global/pt/search',            priority: 0.95, cf: 'daily'  },
    { route: '/global/en/terminal',            priority: 0.9, cf: 'daily'   },
    { route: '/global/en/news',                priority: 0.85, cf: 'daily'  },
    { route: '/global/en/about',              priority: 0.5, cf: 'monthly' },
    { route: '/global/tr/terminal',            priority: 0.9, cf: 'daily'   },
    { route: '/global/tr/news',                priority: 0.85, cf: 'daily'  },
    { route: '/global/tr/about',              priority: 0.5, cf: 'monthly' },
    { route: '/global/en/contact',            priority: 0.5, cf: 'monthly' },
    { route: '/global/tr/contact',            priority: 0.5, cf: 'monthly' },
    { route: '/global/en/disclaimer',         priority: 0.3, cf: 'monthly' },
    { route: '/global/tr/disclaimer',         priority: 0.3, cf: 'monthly' },
    { route: '/global/en/privacy',            priority: 0.3, cf: 'monthly' },
    { route: '/global/tr/privacy',            priority: 0.3, cf: 'monthly' },
    { route: '/global/en/terms',              priority: 0.3, cf: 'monthly' },
    { route: '/global/tr/terms',              priority: 0.3, cf: 'monthly' },
    // Global ES
    { route: '/global/es/terminal',           priority: 0.9, cf: 'daily'   },
    { route: '/global/es/home',              priority: 0.9, cf: 'daily'   },
    { route: '/global/es/swing',             priority: 0.85, cf: 'daily'  },
    { route: '/global/es/swing/archive',     priority: 0.7, cf: 'daily'   },
    { route: '/global/es/swingperformance',  priority: 0.8, cf: 'daily'   },
    { route: '/global/es/watchlist',         priority: 0.85, cf: 'daily'  },
    { route: '/global/es/performance',       priority: 0.8, cf: 'daily'   },
    { route: '/global/es/ai',               priority: 0.8, cf: 'daily'   },
    { route: '/global/es/news',              priority: 0.85, cf: 'daily'  },
    { route: '/global/es/about',             priority: 0.5, cf: 'monthly' },
    { route: '/global/es/contact',           priority: 0.5, cf: 'monthly' },
    { route: '/global/es/disclaimer',        priority: 0.3, cf: 'monthly' },
    { route: '/global/es/privacy',           priority: 0.3, cf: 'monthly' },
    { route: '/global/es/terms',             priority: 0.3, cf: 'monthly' },
    // Global FR
    { route: '/global/fr/terminal',           priority: 0.9, cf: 'daily'   },
    { route: '/global/fr/home',              priority: 0.9, cf: 'daily'   },
    { route: '/global/fr/swing',             priority: 0.85, cf: 'daily'  },
    { route: '/global/fr/swing/archive',     priority: 0.7, cf: 'daily'   },
    { route: '/global/fr/swingperformance',  priority: 0.8, cf: 'daily'   },
    { route: '/global/fr/watchlist',         priority: 0.85, cf: 'daily'  },
    { route: '/global/fr/performance',       priority: 0.8, cf: 'daily'   },
    { route: '/global/fr/ai',               priority: 0.8, cf: 'daily'   },
    { route: '/global/fr/news',              priority: 0.85, cf: 'daily'  },
    { route: '/global/fr/about',             priority: 0.5, cf: 'monthly' },
    { route: '/global/fr/contact',           priority: 0.5, cf: 'monthly' },
    { route: '/global/fr/disclaimer',        priority: 0.3, cf: 'monthly' },
    { route: '/global/fr/privacy',           priority: 0.3, cf: 'monthly' },
    { route: '/global/fr/terms',             priority: 0.3, cf: 'monthly' },
    // Global PT
    { route: '/global/pt/terminal',           priority: 0.9, cf: 'daily'   },
    { route: '/global/pt/home',              priority: 0.9, cf: 'daily'   },
    { route: '/global/pt/swing',             priority: 0.85, cf: 'daily'  },
    { route: '/global/pt/swing/archive',     priority: 0.7, cf: 'daily'   },
    { route: '/global/pt/swingperformance',  priority: 0.8, cf: 'daily'   },
    { route: '/global/pt/watchlist',         priority: 0.85, cf: 'daily'  },
    { route: '/global/pt/performance',       priority: 0.8, cf: 'daily'   },
    { route: '/global/pt/ai',               priority: 0.8, cf: 'daily'   },
    { route: '/global/pt/news',              priority: 0.85, cf: 'daily'  },
    { route: '/global/pt/about',             priority: 0.5, cf: 'monthly' },
    { route: '/global/pt/contact',           priority: 0.5, cf: 'monthly' },
    { route: '/global/pt/disclaimer',        priority: 0.3, cf: 'monthly' },
    { route: '/global/pt/privacy',           priority: 0.3, cf: 'monthly' },
    { route: '/global/pt/terms',             priority: 0.3, cf: 'monthly' },
  ].map(({ route, priority, cf }) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: cf as MetadataRoute.Sitemap[0]['changeFrequency'],
    priority,
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

  // ── /[lang]/[slug]/[ticker]/[date] — archive pages (Limit to last 3 days per stock for fewer URLs) ──
  const archivedTickers = getAllArchivedTickers();
  // We limit to prevent sitemap overflow (>50k URLs) — reduced from 7 to 3 days
  const langArchiveRoutes = langParams.flatMap(({ lang, slug }) =>
    archivedTickers.flatMap(ticker =>
      getArchivedDates(ticker).slice(0, 3).map(date => ({
        url: `${baseUrl}/${lang}/${slug}/${ticker.toLowerCase()}/${date}`,
        lastModified: new Date(date),
        changeFrequency: 'never' as const,
        priority: 0.4,
      }))
    )
  );

  return [
    ...staticRoutes,
    ...langCurrentRoutes,
    ...langArchiveRoutes,
  ];
}
