# ops/indexation — İndeksleme politikası (referans materyali)

Bu klasördeki üç dosya, `page_registry` tabanlı indeksleme/robots/sitemap
politikasının tasarım/uygulama tasarısıdır:

- `INDEXATION_POLICY.md` — politika belgesi (skorlama formülü, eşikler, kademeler,
  uygulama sırası)
- `page_registry_schema.sql` — önerilen Supabase/Postgres şeması (`page_registry`,
  `gsc_daily`, `family_uniqueness`, view'lar, koruyucu constraint'ler)
- `index_score_job.py` — günlük skorlama işi (dry-run/commit modları)

## Durum (2026-08-24 güncelleme): rota eşlemesi çözüldü, kod-seviyesi tedbirler uygulandı

İlk halinde bu doküman kod tabanında **mevcut olmayan** bir rota şeması varsayıyordu
(`/{lang}/stock/{symbol}`, `/{lang}/earnings/{symbol}/{YYYY-Qn}`). Gerçek rota
envanteri çıkarıldı ve aşağıdaki eşleme netleştirildi; buna göre **DB/GSC gerektirmeyen,
hemen uygulanabilir kısım** koda uygulandı. Supabase şema migrasyonu ve GSC
entegrasyonu (aşağıda "Uygulanmadı" bölümü) hâlâ bekliyor — bu ortamdan üretim
Supabase'ine veya Google Search Console API'sine ağ erişimi yok.

### Gerçek rota → politika ailesi eşlemesi

| Politika ailesi | Doküman varsayımı | Depodaki gerçek rota | Not |
|---|---|---|---|
| `stock_main` (evergreen hisse sayfası) | `/{lang}/stock/{symbol}` | `/global/{locale}/graphic/{ticker}` (+ Terminal'de seçili sembol) | Kademeli hisse evreni (§4) burada anlamlı; henüz `tier` alanı DB'de yok. |
| `stock_daily` (Kural 1: tarihli rota YAZILMAZ) | rota yok (bilinçli) | **Zaten var**: `/[lang]/[slug]/[ticker]` (güncel swing pick) ve `/[lang]/[slug]/[ticker]/[date]` (arşiv, `app/[lang]/[slug]/[ticker]/[date]/page.tsx`) | Kural 1'in önlemeye çalıştığı büyüme riski burada zaten gerçekleşmiş durumda — rotayı geri almak mümkün değil, bu yüzden **index_daily mantığı** (son 7 gün index, sonrası noindex) bu rotaya uygulandı (bkz. aşağı). |
| `index_daily` | `/{lang}/{index}/daily/{YYYY-MM-DD}` | `/global/{locale}/{indexSlug}/daily/{date}` | Rota adı aynı; sitemap'te sembol başına son 7 güne kırpıldı. |
| `index_weekly` | `/{lang}/{index}/weekly/{YYYY-Www}` | `/global/{locale}/{indexSlug}/weekly/{weekLabel}` | Rota adı aynı; sitemap'te sembol başına son 12 haftaya kırpıldı. |
| `earnings` | `/{lang}/earnings/{symbol}/{YYYY-Qn}` | Yok — `earning` tek bir sayfa (`/global/{locale}/earning`), sembol bazlı ayrı rota değil | Bu aile depoda karşılıksız; uygulanmadı. |
| `list` | `/{lang}/top100` vb. | `/global/{locale}/{forex\|commodities\|crypto\|futures}` ve benzeri sabit landing sayfaları | Zaten tek kalıcı URL, ISR ile — ek işlem gerekmedi. |

### Uygulandı (bu round, DB/GSC gerektirmeyen kısım)

1. **`app/sitemap.ts`** — `index_daily`/`index_weekly` detay rotaları artık sembol
   başına sırasıyla **son 7 gün** / **son 12 hafta** ile sınırlı (önceden `supabase`
   sorgusundaki genel `limit(5000)`/`limit(2000)` dışında hiçbir kırpma yoktu — her
   sembol × her dil × sınırsız geçmiş tarih sitemap'e giriyordu). `getAllDailyTradeDates`/
   `getAllWeeklyLabels` zaten `trade_date`/`week_start`'a göre azalan sırayla geldiği
   için sembol başına ilk N satırı almak "en yeni N" anlamına geliyor.
2. **`app/[lang]/[slug]/[ticker]/[date]/page.tsx`** — `generateMetadata`'ya
   `index_daily` mantığının analojisi uygulandı: tarih son **7 gün** içindeyse
   `index,follow`, daha eskiyse `noindex,follow`. Sayfa hâlâ `200` dönüyor, silinmiyor
   (Kural 4). Daha önce bu sayfada hiç `robots` alanı yoktu — yani her arşiv tarihi
   varsayılan olarak indekslenebilirdi.
3. **`app/robots.ts`** — kötü niyetli/backlink botları listesine `DotBot` eklendi
   (§5'teki bad-bot listesiyle hizalandı; `AhrefsBot`/`SemrushBot`/`MJ12bot` zaten
   engelliydi).

Not: `?d=` query-parametresi engeli (§5) uygulanmadı — bu site geçmiş analizi query
parametresiyle değil path segmentiyle (`/[date]`) sunuyor, dolayısıyla dokümandaki
o kural bu mimaride karşılıksız.

### Uygulanmadı — Supabase/GSC erişimi gerektiriyor

- `page_registry_schema.sql` üretim Supabase'ine migrate edilmedi.
- `index_score_job.py` hiç çalıştırılmadı (`DATABASE_URL` yok, ayrıca job'ın
  okuduğu `page_content` tablosunun bu depoda karşılığı yok — mevcut analiz verisi
  `/api/preorder-analysis`'ten canlı çekiliyor, ayrı bir içerik tablosu tutulmuyor).
- Google Search Console API entegrasyonu (`gsc_daily` besleme) yapılmadı — bu
  olmadan gerçek `D` (talep) skoru hiç hesaplanamaz; yukarıdaki 7 gün/12 hafta
  eşikleri GSC verisi olmadan uygulanabilen, daha kaba ama anında etkili bir
  "yaş bazlı" ön tedbir olarak düşünülmeli, `IndexScore`'un yerini tutmuyor.
- `stock_main` (`/graphic/{ticker}`) için kademeli evren (§4, Kademe 1/2/3) hiç
  uygulanmadı — bunun için `page_registry` + `tier` alanı ve terfi/tenzil job'ı
  gerekiyor.

Bkz. `INDEXATION_POLICY.md` başındaki "Uygulama notu".
