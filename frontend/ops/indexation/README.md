# ops/indexation — İndeksleme politikası (referans materyali)

Bu klasördeki üç dosya, `page_registry` tabanlı indeksleme/robots/sitemap
politikasının tasarım/uygulama tasarısıdır:

- `INDEXATION_POLICY.md` — politika belgesi (skorlama formülü, eşikler, kademeler,
  uygulama sırası)
- `page_registry_schema.sql` — önerilen Supabase/Postgres şeması (`page_registry`,
  `gsc_daily`, `family_uniqueness`, view'lar, koruyucu constraint'ler)
- `index_score_job.py` — günlük skorlama işi (dry-run/commit modları)

## Durum: uygulanmadı

Bu dosyalar **repoya yalnızca referans olarak eklendi**. Aşağıdaki hiçbiri
henüz yapılmadı:

- Şema Supabase'e migrate edilmedi (üretim veritabanına DDL çalıştırmak için
  bu ortamdan ağ/kimlik bilgisi erişimi yok).
- `index_score_job.py` hiç çalıştırılmadı (`DATABASE_URL` yok).
- Google Search Console API entegrasyonu (`gsc_daily` besleme) yapılmadı.
- `app/robots.ts`, `app/sitemap.ts` veya herhangi bir sayfa render dosyası
  bu şemayı okuyacak şekilde **değiştirilmedi**.

## Bilinen uyumsuzluk — rota eşlemesi netleşmeden ilerlenmemeli

Doküman, kod tabanında **mevcut olmayan** bir rota şeması varsayıyor:

| Doküman varsayımı | Depoda gerçekte olan |
|---|---|
| `stock_main` → `/{lang}/stock/{symbol}` | Yok. Gerçek hisse sayfası `/global/{locale}/graphic/{ticker}`; Terminal sayfasında da seçili sembol gösteriliyor. |
| `earnings` → `/{lang}/earnings/{symbol}/{YYYY-Qn}` | Yok. `earning` tek bir sayfa (`/global/{locale}/earning`), sembol bazlı ayrı rota değil. |
| `stock_daily` (tarihli, kasıtlı olarak rota YOK) | Zaten `/[lang]/[slug]/[ticker]` (swing pick ana sayfası) ve `/[lang]/[slug]/[ticker]/[date]` (arşiv) rotaları `app/sitemap.ts`'te mevcut — Kural 1'in bahsettiği "9 milyon URL" riski muhtemelen bu ayrı sistemle ilgili, ayrıca değerlendirilmeli. |

Şemayı ve `index_score_job.py`'yi olduğu gibi devreye almak, `page_registry.url_path`
hiçbir gerçek render edilen sayfayla eşleşmeyeceği için işlevsiz kalır (ya da yanlış
sayfalar üzerinde karar üretir). İlerlemeden önce:

1. Her `family` için gerçek route pattern'i netleştirilmeli (yukarıdaki tablo
   başlangıç noktası).
2. `page_content` tablosunun (job'ın `body_text` okuduğu, U hesaplamasında
   kullanılan) bu depoda karşılığı olup olmadığı teyit edilmeli — mevcut analiz
   verisi `/api/preorder-analysis`'ten geliyor, ayrı bir `page_content` tablosu
   şu an yok.
3. Route eşlemesi netleştikten sonra §6'daki adımlar (şema migrasyonu → GSC
   entegrasyonu → mevcut URL'lerin kaydı → cron kurulumu → render/sitemap/robots.txt
   entegrasyonu) sırayla uygulanabilir.

Bkz. `INDEXATION_POLICY.md` başındaki "Uygulama notu".
