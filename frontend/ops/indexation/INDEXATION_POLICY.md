# BogaStock — İndeksleme ve Sayfa Şişmesi Politikası (v1.0)

**Amaç:** analiz üretimi ölçeklenirken URL sayısının kontrolsüz büyümesini engellemek;
Vercel render maliyetini ve Supabase okuma yükünü sabit tutmak; Google'ın tarama
bütçesini yalnızca gerçekten değerli sayfalara yönlendirmek.

**Bu doküman uygulamayı yapacak agent için bağlayıcıdır.** Burada yazmayan bir davranış
varsayılmasın; belirsizlik varsa dur ve sor.

> **Uygulama notu (2026-08-24):** Bu belge, bogastock.com kod tabanının o anki gerçek
> rota yapısını değil, tasarım aşamasındaki varsayımsal bir rota şemasını kullanıyor
> (`/{lang}/stock/{symbol}`, `/{lang}/earnings/{symbol}/{YYYY-Qn}`). Depoda böyle rotalar
> yok; gerçek hisse sayfası `/global/{locale}/graphic/{ticker}` (+ Terminal'de seçili
> sembol), earnings ise `/global/{locale}/earning` tek sayfası, ve günlük swing pick
> sayfaları zaten `/[lang]/[slug]/[ticker]` ve `/[lang]/[slug]/[ticker]/[date]` olarak
> mevcut (bkz. `app/sitemap.ts`). Bu doküman ve aşağıdaki şema/job script'i şu an yalnızca
> **referans/tasarım materyali** olarak buraya kondu; render katmanına, sitemap.ts'e veya
> robots.ts'e bağlanmadı. Uygulamaya geçmeden önce `family`→gerçek rota eşlemesi
> netleştirilmeli (bkz. `ops/indexation/README.md`).

---

## 0. Temel ilke

> İçerik üretmek ile URL üretmek aynı şey değildir.

Bir hisse için her gün analiz üretilebilir. Bunu her gün yeni bir adrese koymak zorunlu
değildir. `/stock/NVDA` tek adres olarak kalır, içeriği her gün değişir; Google onu
"sürekli güncellenen canlı sayfa" olarak görür — bu, 252 ayrı ince sayfadan çok daha
güçlü bir sinyaldir.

---

## 1. Değişmez kurallar

Beşi de pazarlık dışıdır. İhlal eden implementasyon reddedilir.

1. **Hisse günlük analizleri tarihli URL ALMAZ.** `/stock/NVDA/daily/2026-08-21` gibi
   bir rota **yazılmaz**. Geçmiş analiz `?d=YYYY-MM-DD` query parametresiyle
   client-side yüklenir; `canonical` daima `/stock/{SYMBOL}` kalır. Bu rotayı sonradan
   eklemek 9 milyon URL demektir ve geri alınamaz.
2. **`noindex` olan hiçbir URL sitemap'e girmez.** Çelişkili sinyal tarama bütçesini
   yakar.
3. **Tarihli sayfa bir kez render edilir, bir daha edilmez.** `revalidate: false`.
   Geçmiş bir günün analizi asla değişmez.
4. **`noindex` bir sayfa 404 veya 410 dönmez.** `200` döner, kullanıcıya açıktır,
   `follow` ile iç bağlantı akışını taşır. İndeksten çıkarmak silmek değildir.
5. **Politika kodda değil veritabanında yaşar.** Render sırasında `page_registry`
   tablosundaki `robots_directive` doğrudan meta etikete basılır. Sayfa tipi başına
   `if` bloğu yazılmaz.

---

## 2. İndeksleme Skoru

```
IndexScore = 0.40·U + 0.25·D + 0.20·K + 0.15·T
```

### U — Benzersizlik oranı (0–1)

Sayfanın token'larından, aynı `family` + `lang` içindeki kardeş sayfaların ≥%80'inde
geçenler çıkarılır.

```
U = (sayfaya özgü token sayısı) / (toplam token sayısı)
```

**Ölçek notu:** U büyük ölçüde aile düzeyinde bir özelliktir — aynı şablondan üretilen
tüm günlük analizler benzer U'ya sahiptir. Bu yüzden:

- `family` + `lang` başına haftada bir kez, **500 sayfalık rastgele örnek** üzerinden
  hesaplanır ve `family_uniqueness` tablosunda saklanır
- Aile üyesi sayısı < 500 ise tüm aile üzerinden hesaplanır
- Evergreen sayfalar (endeks ana sayfası, hisse ana sayfası) için sayfa başına
  hesaplanır — sayıları yönetilebilir

U < 0.30 olan bir aile zaten indekslenmeye değmez. Bunu Google'ın söylemesini bekleme.

### D — Talep sinyali (0–1)

```
D = min(1, log(1 + gösterim_90g + 3 × iç_tıklama_90g) / log(50))
```

- Gösterim: Google Search Console API'sinden günlük çekilir → `gsc_daily`
- İç tıklama: kendi analitiğinden
- **Yeni sayfa muafiyeti:** `first_seen` 14 günden yeniyse `D = 0.5` (ölçüm şansı verilir)

### K — Kalıcılık (sabit)

| Sayfa tipi | K |
|---|---|
| Evergreen (endeks/hisse ana sayfası, bilanço analizi) | 1.00 |
| Tarihli analiz (günlük/haftalık arşiv) | 0.30 |
| Anlık liste görüntüsü | 0.00 |

### T — Tazelik (0–1)

```
T = exp(−yaş_gün / yarı_ömür)
```

| Aile | Yarı ömür (gün) |
|---|---|
| Günlük analiz | 7 |
| Haftalık analiz | 30 |
| Bilanço analizi | 120 |
| Evergreen | ∞ → T = 1.0 |

### Karar eşikleri

| IndexScore | `robots_directive` | `in_sitemap` |
|---|---|---|
| ≥ 0.55 | `index,follow` | `true` |
| 0.30 – 0.55 | `noindex,follow` | `false` |
| < 0.30 | `noindex,follow` — **ve bu ailede yeni URL üretilmez** | `false` |

Üçüncü satır bir uyarıdır: skor kalıcı olarak 0.30'un altındaysa o aile URL olarak değil,
üst sayfanın sekmesi/akordeonu olarak sunulmalıdır. Agent bu durumu rapor eder,
kendiliğinden rota silmez.

---

## 3. Aile bazlı politika

| `family` | Rota | Politika |
|---|---|---|
| `index_main` | `/{lang}/{index}` | Her zaman `index,follow`. ISR `revalidate: 3600`. |
| `index_daily` | `/{lang}/{index}/daily/{YYYY-MM-DD}` | Son **7 gün** `index`, sonrası `noindex,follow`. 90 günden eski sitemap'ten çıkar, URL 200 kalır. `revalidate: false`. |
| `index_weekly` | `/{lang}/{index}/weekly/{YYYY-Www}` | Son **12 hafta** `index`, sonrası `noindex,follow`. `revalidate: false`. |
| `stock_main` | `/{lang}/stock/{symbol}` | Kademeye göre (§4). ISR `revalidate: 3600`. |
| `stock_daily` | **YOK** | Tarihli rota yazılmaz (Kural 1). |
| `earnings` | `/{lang}/earnings/{symbol}/{YYYY-Qn}` | Her zaman `index,follow`. En yüksek benzersizlikli ailen — çeyrekte bir, gerçek olay. `revalidate: false`. |
| `list` | `/{lang}/top100` vb. | Tek kalıcı URL. Tarihli arşiv yok. ISR `revalidate: 3600`. |

---

## 4. Kademeli hisse evreni

6.000 sembolün 6 dilde indekslenmiş sayfası olması gerekmez.

| Kademe | Yaklaşık sembol | Politika |
|---|---|---|
| 1 | ~200 | 6 dilde tam sayfa, `index,follow`, sitemap'te |
| 2 | ~800 | 6 dilde sayfa, `index,follow`, sitemap'te |
| 3 | ~5.000 | Sayfa var, `noindex,follow`, sitemap'te değil |

Kademe 3 sayfaları **silinmez** — kullanıcı ve iç bağlantılar erişir, arama sonuçlarında
yarışmaz.

### Otomatik terfi / tenzil

```
Kademe 3 → 2 :  son 30 günde ≥1 GSC gösterimi VEYA ≥3 iç tıklama
Kademe 2 → 1 :  son 90 günde ≥50 gösterim
Tenzil       :  son 180 günde 0 gösterim → bir kademe aşağı
```

Kademe 1'den tenzil edilen sembol en fazla Kademe 2'ye düşer (koruma bandı).
Her kademe değişikliği `page_registry_audit` tablosuna yazılır.

---

## 5. Maliyet kontrolü (Vercel + Supabase)

Vercel'de maliyeti URL **sayısı** değil, **render sayısı** üretir:

```
Aylık maliyet ≈ (URL × bot tarama sıklığı × render süresi) + (DB okuma × sorgu sayısı)
```

Beş kontrol:

1. **Tarihli sayfalar sonsuza kadar statik.** `export const revalidate = false`.
   İlk render'dan sonra kalıcı olarak CDN'den servis edilir. Ömür boyu 1 render.
   Tek başına en büyük tasarruf kalemi.
2. **Yalnız canlı sayfa yenilenir.** `index_main`, `stock_main`, `list` → saatlik ISR.
   Diğer her şey dondurulmuş.
3. **Sayfa başına tek satır okuma.** Analiz çıktısı tek bir `JSONB` sütununda saklanır;
   render 10 join'li sorgu değil 1 birincil anahtar okuması yapar.
4. **`robots.txt` ile tarama şekillendirme:**
   ```
   User-agent: AhrefsBot
   Disallow: /
   User-agent: SemrushBot
   Disallow: /
   User-agent: MJ12bot
   Disallow: /
   User-agent: DotBot
   Disallow: /
   User-agent: *
   Disallow: /*?d=
   Sitemap: https://bogastock.com/sitemap.xml
   ```
   `?d=` engeli, geçmiş analiz parametresinin ayrı URL olarak taranmasını önler.
5. **Sitemap disiplini.** Yalnız `in_sitemap = true` satırlar. Aile ve dile göre
   bölünmüş sitemap index: `sitemap-index_main-tr.xml`, `sitemap-stock_main-en.xml` …
   Dosya başına en fazla 45.000 URL.

---

## 6. Uygulama sırası (agent için)

Sırayla, her adım bir öncekine bağlı:

1. `page_registry_schema.sql` uygulanır (§ ayrı dosya)
2. Search Console API entegrasyonu → `gsc_daily` günlük dolar (bu olmadan `D` hep 0.5 kalır)
3. Mevcut URL'ler `page_registry`'ye kaydedilir (`family`, `lang`, `first_seen`,
   `content_date`, `tier`)
4. `index_score_job.py` günlük cron olarak kurulur
5. Sayfa render'ları `robots_directive` sütununu okuyacak şekilde değiştirilir
6. Sitemap üretimi `v_sitemap_urls` görünümünden yapılır
7. `robots.txt` güncellenir
8. **En son:** `index_daily` ailesindeki 7 günden eski sayfalar `noindex`'e alınır

Adım 8 en sona bırakılır çünkü geri kalan altyapı çalışmadan yapılırsa geri alınamaz.

---

## 7. İzleme

Job her çalıştığında `page_registry_audit`'e özet yazar. Haftalık kontrol edilecekler:

| Metrik | Beklenen | Alarm |
|---|---|---|
| `index,follow` URL sayısı | Yavaş büyür | Haftada %20'den hızlı büyürse politika sızıntısı var |
| GSC "Crawled – currently not indexed" | Düşer veya sabit | Büyüyorsa eşikler gevşek |
| Sitemap URL sayısı | `index` sayısına eşit | Fark varsa üretimde hata |
| Aile başına ortalama U | Sabit | Düşerse şablon çeşitliliği azalmış |

---

## 8. Geri alma

Politika hatalı çıkarsa geri dönüş tek `UPDATE`:

```sql
UPDATE page_registry SET robots_directive = 'index,follow', in_sitemap = true
WHERE family = '<aile>';
```

Bu yüzden politika koda gömülmez. Kural 5'in sebebi budur.
