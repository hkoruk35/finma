import { supabaseAdmin } from "@/lib/supabase-admin";
import type { HotTheme } from "@/lib/hotThemes2026";

// Tek gerçek kaynak: admin panelindeki (ThemeDetailClient, /admin/trading/csp/[theme])
// "özel ekle" / "listeden kaldır" işlemleri Supabase shared_store'a
// (theme_overrides, hot_themes_removals) yazıyor. Public tema sayfaları
// (/global/[locale]/themes/[theme]) ve Copilot'un tema hisse listesi de AYNI
// iki tabloyu okuyup admin ile birebir aynı birleşik listeyi hesaplamalı —
// aksi halde admin'de 18 hisse varken public'te 10 görünmesi gibi bir sapma
// oluşuyordu (admin tarafındaki eklemeler/çıkarmalar hiçbir zaman public'e
// yansımıyordu).
export async function getEffectiveThemeTickers(
  theme: Pick<HotTheme, "slug" | "title" | "stocks">
): Promise<string[]> {
  const baseTickers = theme.stocks.map((s) => s.ticker);
  try {
    // Sinirli timeout: Supabase yavas/erisilemez oldugunda bu sorgu sonsuza
    // kadar askida kalip sayfa render'ini (ozellikle SSG build'i) bloklamasin
    // — bkz. 2026-08-08 stabilite fix. Public tema sayfasi zaten 15dk ISR
    // revalidate ile bu fonksiyonu seyrek cagiriyor, admin akislarinin
    // taze veri ihtiyaci timeout'tan etkilenmiyor (sadece ust sinir).
    const [{ data: overridesRow }, { data: removalsRow }] = await Promise.all([
      supabaseAdmin.from("shared_store").select("value").eq("key", "theme_overrides").abortSignal(AbortSignal.timeout(5000)).maybeSingle(),
      supabaseAdmin.from("shared_store").select("value").eq("key", "hot_themes_removals").abortSignal(AbortSignal.timeout(5000)).maybeSingle(),
    ]);

    const customTickers: string[] =
      (overridesRow?.value as Record<string, string[]> | null)?.[theme.title] ?? [];
    const removedTickers: string[] =
      (removalsRow?.value as { removedStocks?: Record<string, string[]> } | null)?.removedStocks?.[theme.slug] ?? [];
    const removed = new Set(removedTickers);

    return Array.from(new Set([...baseTickers, ...customTickers])).filter((t) => !removed.has(t));
  } catch {
    return baseTickers;
  }
}
