import os

locales = ['en', 'es', 'fr', 'pt', 'tr']
base_dir = os.path.join(os.getcwd(), 'frontend', 'app', 'global')

template = '''import { Metadata } from 'next';
import Link from 'next/link';
import ListsNavigation from '@/components/global/ListsNavigation';
import ThemeDetailClient from '@/components/ThemeDetailClient';
import MemberHeader from '@/components/public/MemberHeader';
import Footer from '@/components/Footer';
import { HOT_THEMES_2026 } from '@/lib/hotThemes2026';
import { notFound } from 'next/navigation';

export const revalidate = 60;

export async function generateMetadata({ params }: { params: { locale: string, theme: string } }): Promise<Metadata> {
  const themeObj = HOT_THEMES_2026.find(t => t.slug === params.theme);
  return {
    title: themeObj ? \\ | BOGASTOCK\ : 'Market Theme | BOGASTOCK',
    description: 'Explore the top stocks and trends in this market theme.',
  };
}

export default function ThemePage({ params }: { params: { locale: string, theme: string } }) {
  const themeObj = HOT_THEMES_2026.find(t => t.slug === params.theme);
  
  if (!themeObj) {
    notFound();
  }

  const locale = params.locale || '{LOCALE}';

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0e17]">
      <MemberHeader locale={locale as any} />

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-4 md:py-6">
        <nav className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">
          <Link href={\/global/\/home\} className="hover:text-[#3b82f6] transition-colors">Gösterge Paneli</Link>
          <span className="opacity-30">/</span>
          <Link href={\/global/\/trend\} className="hover:text-[#3b82f6] transition-colors">Temalar</Link>
          <span className="opacity-30">/</span>
          <span className="text-white italic">{themeObj.title}</span>
        </nav>

        <ListsNavigation locale={locale as any} activePath="swing" />

        <div className="relative z-10">
          <ThemeDetailClient themeName={themeObj.title} initialTickers={themeObj.stocks.map(s => s.ticker)} />
        </div>
      </main>

      <Footer hidePlatform={true} locale={locale as any} />
    </div>
  );
}
'''

for locale in locales:
    dir_path = os.path.join(base_dir, locale, 'themes', '[theme]')
    os.makedirs(dir_path, exist_ok=True)
    file_path = os.path.join(dir_path, 'page.tsx')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(template.replace('{LOCALE}', locale))

print("Created theme pages for all locales.")
