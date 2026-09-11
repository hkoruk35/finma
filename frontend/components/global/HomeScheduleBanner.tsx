import { copy, type Locale } from "@/lib/i18n/copy";
import { INDEX_DEFINITIONS, type IndexSymbol } from "@/lib/indices";
import { getLatestSnapshotPerSymbol } from "@/lib/indexSnapshots";
import HomeScheduleBannerCarousel, { type ScheduleCarouselItem } from "@/components/global/HomeScheduleBannerCarousel";

// 2026-08-23 kullanıcı talebi: "Canlı analiz uyarısını endeks tickerlarının
// altına taşı ve son 5 analizin duyurusunu güncellenme saati ile beraber
// oradan duyur. Carousel şeklinde olsun." — bu bileşen önceden Task
// Scheduler saatlerine göre "şu an çalışıyor / sırada" tahmini gösteren bir
// SCHEDULE dizisi kullanıyordu (bkz. eski sürüm, git geçmişi). Artık GERÇEK
// tamamlanmış analizleri gösteriyor: tüm endekslerin en son (created_at)
// snapshot'ı çekilip en yeni 5'i alınıyor. Konumu page.tsx'te
// MarketOverviewTabs'in (üst ticker satırı) hemen altına taşındı.
const ALL_SYMBOLS = Object.keys(INDEX_DEFINITIONS) as IndexSymbol[];
const CAROUSEL_SIZE = 5;

export default async function HomeScheduleBanner({ locale }: { locale: Locale }) {
  const t = copy[locale].schedule;
  const snapshots = await getLatestSnapshotPerSymbol(ALL_SYMBOLS, 300);

  // 2026-09-10: Kart saf "en son güncellenen" rotasyonuyla seçildiğinde
  // EN/global anasayfada bile ABD dışı bir endeks (örn. IPC México) ilk
  // sırada çıkabiliyordu. ABD piyasası artık her zaman öncelikli — aynı
  // rotasyon içinde en yeni güncellenen ABD endeksi öne alınır, kalan
  // sıralama yine "en son güncellenen" mantığıyla devam eder.
  const items: ScheduleCarouselItem[] = snapshots
    .filter((s) => !!s.created_at)
    .sort((a, b) => {
      const aUs = INDEX_DEFINITIONS[a.index_symbol]?.region === "us";
      const bUs = INDEX_DEFINITIONS[b.index_symbol]?.region === "us";
      if (aUs !== bUs) return aUs ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    })
    .slice(0, CAROUSEL_SIZE)
    .map((s) => {
      const def = INDEX_DEFINITIONS[s.index_symbol];
      return {
        key: s.index_symbol,
        name: def?.names[locale] ?? s.index_symbol,
        slug: def?.slug ?? "",
        region: def?.region ?? "us",
        updatedAt: s.created_at,
        changePct: s.change_pct,
      };
    })
    .filter((item) => !!item.slug);

  if (items.length === 0) return null;

  return (
    <HomeScheduleBannerCarousel
      locale={locale}
      items={items}
      labels={{ badge: t.liveBadge, updated: t.updatedLabel, viewAnalysis: t.viewAnalysis }}
    />
  );
}
