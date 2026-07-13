# BOGA AI — Güvenlik İzleme Botu (Tasarım)

Bu doküman, 2026-07-13 tarihli güvenlik taramasında bulunan açıkları kapattıktan
sonra, bu kapatmaların **kalıcı** kaldığını ve yeni açıkların erken fark edildiğini
garanti etmek için kurulması önerilen izleme sisteminin tasarımını anlatır.

## Neden gerekli

Bu turda düzeltilen açıkların hepsi "sessiz" açıklardı — sistem çalışıyor
görünüyordu, hiçbir hata vermiyordu, ama `curl` ile kimlik doğrulamadan tüm
algoritma çıktısı (giriş/hedef/stop seviyeleri) indirilebiliyordu. Bu tür
açıklar kod incelemesiyle bulunur ama **yeniden içeri sızmasını** engellemenin
tek yolu sürekli/otomatik kontrol. Tek seferlik bir denetim yeterli değil —
her yeni API route, her yeni `public/` dosyası, her yeni admin sayfası aynı
hatayı tekrar edebilir.

## Katman 1 — Regresyon kontrol scripti (en öncelikli, en ucuz)

Bugün düzeltilen 4 maddenin her biri için "bu artık böyle davranmalı" iddiasını
otomatik doğrulayan basit bir script. CI'da (her deploy öncesi) ve/veya günlük
cron ile çalışır. Kod değişikliği gerektirmez, sadece HTTP istekleri atar.

**Kontrol listesi:**

| Kontrol | Beklenen sonuç | Bugün neden önemli |
|---|---|---|
| `GET /data/latest/stocks/AAPL.json` | `404` | Önceden `200` dönüyordu — tüm skorlar açıktı |
| `GET /api/data/stocks/AAPL.json` (cookie'siz) | `403`/`401` | Üyelik kontrolü olmadan `200` dönerdi |
| `POST /api/deep-analysis` (cookie'siz) | `401` | Ücretli Gemini/Claude çağrısı ücretsiz tetiklenebiliyordu |
| `POST /api/ask` genel sohbet (cookie'siz, ticker olmayan mesaj) | `401` | Aynı sorun |
| `POST /api/ask` ticker önizleme (cookie'siz) | `200` (bilinçli olarak public) | Regresyon: bunu da kapatırsak `/graphic` sayfaları kırılır |
| `GET /admin/members`, `/admin/admins`, `/admin/plans`, `/admin/campaigns`, `/admin/sitemap`, `/admin/top100` (boga_auth'sız) | `307 → /admin/account/login` | Önceden boş kabuk olarak `200` render ediliyordu |
| Ana sayfa response header'ları | `Content-Security-Policy`, `X-Frame-Options: DENY` içermeli | Clickjacking koruması |
| `POST /api/ask` — art arda 45+ istek/15dk aynı IP | Bir noktadan sonra `429` | Rate limit devrede mi |

**Uygulama önerisi:** `scripts/security-check.mjs` adında ~80 satırlık bağımsız
bir Node scripti — `fetch` ile yukarıdaki tabloyu sırayla dener, beklenenden
farklı bir status code görürse non-zero exit code + açıklayıcı log verir.
GitHub Actions'a (veya mevcut deploy pipeline'ına) "deploy sonrası smoke test"
adımı olarak eklenir. Böylece biri yanlışlıkla bir route'u tekrar public
yaparsa, bir sonraki deploy'da hemen fark edilir — insan hafızasına güvenmek
zorunda kalınmaz.

## Katman 2 — Anomali/istismar tespiti (orta öncelik)

Regresyon kontrolü "bilinen açıkların kapalı kaldığını" doğrular ama **yeni**
bir istismar girişimini (ör. biri gerçekten `/api/data`'yı brute-force
deniyor) canlıda yakalamaz. Bunun için:

1. **Supabase'de bir `security_events` tablosu** açılır: `ip`, `path`,
   `status_code`, `reason`, `created_at`.
2. `lib/apiAuth.ts` ve `lib/rateLimit.ts` içindeki red (403/401/429) dönüşleri,
   `supabaseAdmin` ile bu tabloya best-effort (await'siz, hataya toleranslı)
   bir satır yazar. Zaten bu dosyalar merkezi olduğu için tek noktadan
   eklenir — her route'a ayrı ayrı log kodu yazmaya gerek yok.
3. **Vercel Cron (`app/api/cron/security-digest/route.ts`, günde 1 kez):**
   son 24 saatte aynı IP'den X'ten fazla 403/401 varsa (örn. >20), veya
   `/admin/*` üzerinde art arda başarısız boga_auth denemesi varsa, bunu
   özetleyen bir mesaj oluşturur.
4. **Bildirim kanalı:** mevcut altyapıda X (Twitter) botu ve muhtemelen
   e-posta/Supabase zaten var — en basit yol bu özeti admin'in e-postasına
   veya bir Telegram botuna göndermek (Telegram Bot API tek `fetch` çağrısı,
   yeni bağımlılık gerektirmez).

Bu katman "birisi şu an saldırıyor" sorusuna günlük gecikmeli de olsa cevap
verir — gerçek zamanlı değil ama mevcut cron altyapısına (`app/api/cron/*`)
doğal olarak oturuyor, yeni bir sistem kurmak gerekmiyor.

## Katman 3 — Rate limiting'i güçlendirme (orta-uzun vade)

Bugün eklenen rate limiter'lar (`lib/rateLimit.ts`, ayrıca mevcut
`app/api/auth/login/route.ts` ve `preorder-analysis`) **in-memory Map**
kullanıyor. Vercel serverless'ta her fonksiyon çağrısı farklı bir instance'a
düşebilir — instance'lar hafıza paylaşmaz. Yani "15 dakikada 40 istek" limiti
gerçekte "15 dakikada 40 × (aktif instance sayısı)" gibi davranabilir.

Bunu gerçek/garanti bir limite çevirmek için: **Upstash Redis** (Vercel
entegrasyonu tek tıkla kurulur, ücretsiz katmanı bu ölçek için yeterli).
`lib/rateLimit.ts`'in imzası değişmez, sadece iç implementasyonu Map yerine
Redis `INCR` + `EXPIRE` kullanır — çağıran kod (ask/deep-analysis route'ları)
hiç değişmez.

## Katman 4 — Uç nokta (WAF) koruması (isteğe bağlı, en üst katman)

Cloudflare (ücretsiz plan) DNS'in önüne alınırsa: temel bot/DDoS filtrelemesi,
IP başına global rate limit, ve "bu IP'den dakikada 500+ istek" gibi kaba
saldırıları uygulama koduna hiç ulaşmadan keser. Bu, yukarıdaki katmanların
üstüne eklenir, yerine geçmez — uygulama seviyesi kontroller (auth, plan
kontrolü) yine gereklidir çünkü WAF "bu kullanıcı premium mu" bilmez.

## Öncelik sırası (uygulama zamanı tahminleriyle)

1. **Katman 1 (regresyon scripti)** — ~1 saat, tek dosya, bağımlılık yok.
   Bugünün 4 düzeltmesinin kalıcılığını garanti eden en ucuz yatırım.
2. **Katman 3 (Upstash Redis)** — ~30 dk kurulum + küçük kod değişikliği.
   Bugünkü rate limitlerin "gerçekten" çalışmasını sağlar.
3. **Katman 2 (anomali tespiti + günlük özet)** — ~2-3 saat. Yeni saldırı
   girişimlerini görünür kılar.
4. **Katman 4 (Cloudflare)** — DNS değişikliği gerektirir, kullanıcı onayı
   şart (bu doküman kapsamında uygulanmadı, sadece öneri).

## Bugün kapatılan açıklar (özet — bu doküman bunların üstüne inşa edilir)

1. `public/data/*` JSON'ları artık doğrudan HTTP ile erişilemiyor
   (`proxy.ts` 404 döner); tek yol üyelik/plan kontrolü yapan
   `/api/data/[...path]/route.ts`.
2. `/api/ask` (genel sohbet dalı) ve `/api/deep-analysis` artık giriş
   yapılmasını zorunlu kılıyor + IP başına rate limit uyguluyor.
   `/api/ask`'ın ticker-önizleme dalı bilinçli olarak public kaldı (public
   `/graphic` sayfalarının çalışması için) ama artık rate-limitli.
3. `next.config.ts`'e CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options`,
   `Referrer-Policy`, `Permissions-Policy` eklendi.
4. `proxy.ts`'deki admin sayfa istisnaları (`/admin/members`, `/admin/admins`,
   `/admin/plans`, `/admin/campaigns`, `/admin/sitemap`, `/admin/top100`,
   `/admin/messages`) kaldırıldı — hepsi artık diğer admin sayfalarıyla aynı
   `boga_auth` kontrolüne tabi.
