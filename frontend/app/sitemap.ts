import { MetadataRoute } from 'next';
import { getSwingAllPicks } from '@/lib/data';
import { getAllLangParams } from '@/lib/analysis-langs';
import { getAllArchivedTickers, getArchivedDates } from '@/lib/analysis-archive';
import { INDEX_LIST, INDEX_LOCALES, type IndexSymbol } from '@/lib/indices';
import { getAllDailyTradeDates, getAllWeeklyLabels } from '@/lib/indexSnapshots';
import { ASSET_CLASS_SLUGS, ASSET_CLASS_LOCALES } from '@/lib/assetClasses';

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
    // Premium Club — pricing/membership landing page, all 6 locales
    { route: '/global/en/premium_club',      priority: 0.8, cf: 'weekly'  },
    { route: '/global/tr/premium_club',      priority: 0.8, cf: 'weekly'  },
    { route: '/global/es/premium_club',      priority: 0.8, cf: 'weekly'  },
    { route: '/global/fr/premium_club',      priority: 0.8, cf: 'weekly'  },
    { route: '/global/pt/premium_club',      priority: 0.8, cf: 'weekly'  },
    { route: '/global/id/premium_club',      priority: 0.8, cf: 'weekly'  },
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

  // ── /global/{locale}/markets + /global/{locale}/{indexSlug}/** — market index landing + per-index + archives ──
  const indexBySymbol = new Map(INDEX_LIST.map((idx) => [idx.symbol, idx]));

  const indexLandingRoutes = INDEX_LOCALES.map((locale) => ({
    url: `${baseUrl}/global/${locale}/markets`,
    lastModified: now,
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  const indexPerIndexRoutes = INDEX_LOCALES.flatMap((locale) =>
    INDEX_LIST.flatMap((idx) => [
      {
        url: `${baseUrl}/global/${locale}/${idx.slug}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      },
      {
        url: `${baseUrl}/global/${locale}/${idx.slug}/daily`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.5,
      },
      {
        url: `${baseUrl}/global/${locale}/${idx.slug}/weekly`,
        lastModified: now,
        changeFrequency: 'weekly' as const,
        priority: 0.5,
      },
    ])
  );

  // İndeksleme/sayfa-şişmesi politikası (bkz. ops/indexation/INDEXATION_POLICY.md §3):
  // index_daily ailesinde sitemap'te yalnız SON 7 GÜN, index_weekly'de SON 12 HAFTA
  // kalır — daha eskisi sitemap'ten çıkar (sayfa 200 kalmaya devam eder, sadece
  // sitemap'ten ve dolayısıyla aktif taramadan düşer). Aksi halde her sembol × her
  // dil × sınırsız geçmiş tarih sitemap'i kontrolsüz büyütür.
  const SITEMAP_DAILY_DAYS_PER_SYMBOL = 7;
  const SITEMAP_WEEKLY_WEEKS_PER_SYMBOL = 12;

  let indexDailyDetailRoutes: MetadataRoute.Sitemap = [];
  let indexWeeklyDetailRoutes: MetadataRoute.Sitemap = [];
  try {
    const [dailyDates, weeklyLabels] = await Promise.all([
      getAllDailyTradeDates(),
      getAllWeeklyLabels(),
    ]);

    // getAllDailyTradeDates/getAllWeeklyLabels trade_date/week_start'a göre
    // descending sıralı geliyor (bkz. lib/indexSnapshots.ts) — sembol başına
    // ilk N satırı almak "en yeni N" demek.
    const dailyPerSymbolCount = new Map<string, number>();
    const recentDailyDates = dailyDates.filter((row) => {
      if (!indexBySymbol.has(row.index_symbol as IndexSymbol)) return false;
      const n = dailyPerSymbolCount.get(row.index_symbol) ?? 0;
      if (n >= SITEMAP_DAILY_DAYS_PER_SYMBOL) return false;
      dailyPerSymbolCount.set(row.index_symbol, n + 1);
      return true;
    });

    const weeklyPerSymbolCount = new Map<string, number>();
    const recentWeeklyLabels = weeklyLabels.filter((row) => {
      if (!indexBySymbol.has(row.index_symbol as IndexSymbol)) return false;
      const n = weeklyPerSymbolCount.get(row.index_symbol) ?? 0;
      if (n >= SITEMAP_WEEKLY_WEEKS_PER_SYMBOL) return false;
      weeklyPerSymbolCount.set(row.index_symbol, n + 1);
      return true;
    });

    indexDailyDetailRoutes = INDEX_LOCALES.flatMap((locale) =>
      recentDailyDates.map((row) => {
        const idx = indexBySymbol.get(row.index_symbol as IndexSymbol)!;
        return {
          url: `${baseUrl}/global/${locale}/${idx.slug}/daily/${row.trade_date}`,
          lastModified: new Date(row.trade_date),
          changeFrequency: 'never' as const,
          priority: 0.4,
        };
      })
    );

    indexWeeklyDetailRoutes = INDEX_LOCALES.flatMap((locale) =>
      recentWeeklyLabels.map((row) => {
        const idx = indexBySymbol.get(row.index_symbol as IndexSymbol)!;
        return {
          url: `${baseUrl}/global/${locale}/${idx.slug}/weekly/${row.week_label.toLowerCase()}`,
          lastModified: now,
          changeFrequency: 'never' as const,
          priority: 0.4,
        };
      })
    );
  } catch {
    // Supabase erisilemez olabilir (build ortami) — statik/landing rotalari yine de eklenir.
  }

  // ── /global/{locale}/{forex|commodities|crypto|futures} — canlı varlık sınıfı sayfaları ──
  const assetClassRoutes = ASSET_CLASS_LOCALES.flatMap((locale) =>
    ASSET_CLASS_SLUGS.map((slug) => ({
      url: `${baseUrl}/global/${locale}/${slug}`,
      lastModified: now,
      changeFrequency: 'hourly' as const,
      priority: 0.75,
    }))
  );

  return [
    ...staticRoutes,
    ...langCurrentRoutes,
    ...langArchiveRoutes,
    ...indexLandingRoutes,
    ...indexPerIndexRoutes,
    ...indexDailyDetailRoutes,
    ...indexWeeklyDetailRoutes,
    ...assetClassRoutes,
  ];
}
