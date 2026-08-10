/**
 * Supabase istemcilerinin ortak fetch'i — her sorguya sert bir zaman aşımı ve
 * DB tamamen düştüğünde devreye giren bir devre kesici (circuit breaker) ekler.
 *
 * Neden: 2026-08-10'da projenin Postgres instance'ı yanıt vermez hale geldi
 * (pooler "server login has been failing, cached error: connect timeout"
 * döndürüyordu). supabase-js kendiliğinden zaman aşımı uygulamadığı için
 * sorgular süresiz askıda kaldı; sonucu:
 *   - /api/home-movers, /api/top100 gibi route'lar hiç cevap dönmedi
 *     (ana sayfadaki listeler boş kaldı),
 *   - `next build`'in "Collecting page data" adımı takıldı ve arka arkaya
 *     6 Vercel deploy'u "Building" durumunda çakıldı — yeni veri siteye
 *     hiç ulaşamadı.
 *
 * Neden sadece zaman aşımı yetmiyor: 5 sn'lik dar bir sınır, paralel ISR
 * static generation sırasında sağlıklı DB'de bile isabet ediyordu (bkz.
 * d44f675c — earningsCalendar/publicPosts 5s → 20s). Bu yüzden sınır 20 sn'de
 * bırakıldı; ama DB tamamen ölüyken her sayfanın 20 sn beklemesi build'i
 * saatlere çıkarırdı. Devre kesici bu iki ihtiyacı ayırır:
 *   - DB sağlıklı, sadece yavaş  → tam 20 sn pay,
 *   - DB ölü (üst üste 3 hata)   → sonraki istekler ağa hiç çıkmadan anında
 *                                  hata verir, çağıran kendi fallback'ine düşer.
 * Soğuma süresi dolunca tek bir deneme isteği salınır; başarılıysa devre
 * kapanır ve normal işleyiş kendiliğinden geri gelir.
 */

/** Tek sorgu için üst sınır. Paralel build yükünü kaldıracak kadar cömert. */
export const SUPABASE_TIMEOUT_MS = Number(process.env.SUPABASE_TIMEOUT_MS) || 20000;

/** Devre bu kadar ardışık hatadan sonra açılır. */
const FAILURE_THRESHOLD = 3;
/** Devre açıkken yeni bir deneme isteği salmadan önce beklenen süre. */
const COOLDOWN_MS = 30_000;

// Süreç ömrü boyunca yaşayan durum. Build sırasında her worker kendi
// sayacını tutar — bu istenen davranış, her worker DB'nin ölü olduğunu
// kendi başına birkaç istekte öğrenir.
let consecutiveFailures = 0;
let circuitOpenedAt = 0;

function circuitIsOpen(): boolean {
  if (consecutiveFailures < FAILURE_THRESHOLD) return false;
  if (Date.now() - circuitOpenedAt >= COOLDOWN_MS) {
    // Yarı-açık: tek bir deneme isteğine izin ver. Başarısız olursa
    // recordFailure() soğumayı yeniden başlatır.
    circuitOpenedAt = Date.now();
    return false;
  }
  return true;
}

function recordFailure() {
  consecutiveFailures++;
  if (consecutiveFailures === FAILURE_THRESHOLD) {
    circuitOpenedAt = Date.now();
    console.error(
      `[supabaseFetch] ${FAILURE_THRESHOLD} ardışık hata — devre açıldı, ` +
        `${COOLDOWN_MS / 1000}s boyunca Supabase istekleri anında reddedilecek.`
    );
  }
}

function recordSuccess() {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    console.warn("[supabaseFetch] Supabase yeniden yanıt veriyor — devre kapatıldı.");
  }
  consecutiveFailures = 0;
}

type FetchInput = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

/**
 * supabase-js'in `global.fetch` seçeneğine verilecek sarmalayıcı.
 * Çağıranın kendi `.abortSignal()` sinyali varsa korunur — iki sinyalden
 * hangisi önce tetiklenirse istek o an düşer.
 */
export function createTimeoutFetch(timeoutMs: number = SUPABASE_TIMEOUT_MS) {
  return async (input: FetchInput, init?: FetchInit): Promise<Response> => {
    if (circuitIsOpen()) {
      throw new Error("[supabaseFetch] Supabase ulaşılamıyor (devre açık) — istek atlandı.");
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const callerSignal = init?.signal;

    let signal: AbortSignal = timeoutSignal;
    if (callerSignal) {
      // AbortSignal.any Node 20+ / modern tarayıcılarda var; yoksa askıda
      // kalmayı önlemek önceliklidir, timeout sinyalini kullanırız.
      signal =
        typeof AbortSignal.any === "function"
          ? AbortSignal.any([callerSignal, timeoutSignal])
          : timeoutSignal;
    }

    try {
      const res = await fetch(input, { ...init, signal });
      // 5xx sunucunun ayakta olduğunu gösterir; devreyi açmaya değmez.
      recordSuccess();
      return res;
    } catch (err) {
      // Çağıran isteği bilerek iptal ettiyse bu bir DB arızası değildir.
      if (!callerSignal?.aborted) recordFailure();
      throw err;
    }
  };
}
