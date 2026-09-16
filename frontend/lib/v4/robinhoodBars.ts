/**
 * `robinhood_spy_bars` tablosunu okur (bkz. app/api/internal/robinhood-spy-sync/route.ts
 * — robinhood_spy_sync.py poller'ı buraya yazıyor) ve Yahoo'nun taşımadığı
 * overnight (20:00-04:00 ET) barlarını Bar[] olarak döndürür.
 *
 * BİLİNÇLİ TASARIM: bu dosya Robinhood'a hiç canlı istek atmaz — sadece
 * Supabase'den son yazılmış satırları okur. Robinhood'un OAuth/MFA
 * karmaşıklığı tamamen Python poller'da (kullanıcının kendi makinesinde)
 * kalır; Vercel serverless tarafı asla Robinhood credential'ı görmez.
 * Tablo boşsa veya bayatsa (poller kapalıysa) sessizce boş dizi döner —
 * çağıran taraf (lib/v4/snapshot.ts) bu durumda saf Yahoo verisine düşer.
 */

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Bar } from "./types";

// Poller ~60-90s aralıkla yazıyor; 6 dakikadan eski en son satır varsa
// poller'ın durduğunu/tıkandığını varsayıp bu kaynağı devre dışı bırak —
// bayat overnight verisiyle canlı motoru beslemektense Yahoo'ya düşmek
// (site zaten "piyasa kapalı" fallback'ini biliyor) daha güvenli.
const STALE_AFTER_SEC = 6 * 60;

export async function fetchRobinhoodSpyBars(sinceUnixSec: number): Promise<{ bars: Bar[]; fresh: boolean }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("robinhood_spy_bars")
      .select("time, open, high, low, close, volume")
      .gte("time", sinceUnixSec)
      .order("time", { ascending: true })
      .limit(5000);

    if (error || !data || !data.length) return { bars: [], fresh: false };

    const newest = data[data.length - 1].time as number;
    const fresh = Date.now() / 1000 - newest < STALE_AFTER_SEC;
    if (!fresh) return { bars: [], fresh: false };

    const bars: Bar[] = data
      .map((r: any) => ({
        time: Number(r.time),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        volume: Number(r.volume) || 0,
      }))
      .filter((b) => Number.isFinite(b.open) && Number.isFinite(b.close));

    return { bars, fresh: true };
  } catch (e) {
    console.error("fetchRobinhoodSpyBars error", e);
    return { bars: [], fresh: false };
  }
}
