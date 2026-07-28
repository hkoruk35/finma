# BOGA AI — `/global` Swing Performance Sayfaları: Profesyonel Audit Raporu

**Tarih:** 2026-06-27
**Kapsam:** `bogastock.com/global/*` altındaki tüm sayfalar (en/tr) — sayfa envanteri, veri kaynağı doğrulaması, hesaplama mantığı çapraz kontrolü, auth/gating sistemi, navigasyon, 10.000 abone ölçeklenebilirlik analizi, fiyatlandırma önerisi.

**Metodoloji:** Tüm bulgular kod tabanından (`frontend/`, `.github/workflows/`, Python script'leri) `dosya:satır` referanslarıyla doğrulanmıştır. Doğrulanamayan hiçbir iddia "kesin" olarak sunulmamış, "bulunamadı" şeklinde işaretlenmiştir.

---

## 1. Sayfa Envanteri

| Route | Dosya | Public/Gated (UI) | Açıklama |
|---|---|---|---|
| `/global/en` | `frontend/app/global/en/page.tsx:74` | Public | EN landing/marketing |
| `/global/tr` | `frontend/app/global/tr/page.tsx:74` | Public | TR landing/marketing |
| `/global/en/login` | `frontend/app/global/en/login/page.tsx:12` | Public | `Header hideMenus` |
| `/global/tr/giris` | `frontend/app/global/tr/giris/page.tsx:12` | Public | TR login |
| `/global/en/account` | `frontend/app/global/en/account/page.tsx:10` | Gated (UI) | `MemberHeader locale="en"` |
| `/global/tr/hesabim` | `frontend/app/global/tr/hesabim/page.tsx:10` | Gated (UI) | `MemberHeader locale="tr"` |
| `/global/en/top100` | `frontend/app/global/en/top100/page.tsx:12` | Gated (UI) | `MemberHeader` + `Top100Tracker` |
| `/global/tr/top100` | aynı yapı | Gated (UI) | TR |
| `/global/en/swingperformance` | `frontend/app/global/en/swingperformance/page.tsx:18` | Gated (UI) | "Son 10 işlem günü", `revalidate=60` |
| `/global/tr/swingperformance` | `frontend/app/global/tr/swingperformance/page.tsx:18` | Gated (UI) | aynı, `revalidate=60` |
| `/global/en/[ticker]` | `frontend/app/global/en/[ticker]/page.tsx:13` | Gated (UI) | Pre-Order analiz, `hideAdminActions=true` |
| `/global/tr/[ticker]` | aynı pattern | Gated (UI) | TR |

**Navigasyon notu:** "BOT ANALİZ SİSTEMİ" linki bu sayfa grubunda bilerek gizlenmiş (`hideBotLink` prop, `swingperformance/page.tsx:57` her iki dilde) — commit `7dbd0fa4` ile teyitli. Üye header'ı (Hesabım/Çıkış) 8 route'ta mevcut (account/hesabim, top100 x2, swingperformance x2, [ticker] x2); login/landing sayfalarında yok. İç gezinim tutarlı: kullanıcı landing → login → top100/swingperformance/[ticker] arasında MemberHeader üzerinden geçiş yapabiliyor.

---

## 2. Veri Kaynağı Doğrulaması

- **Akış:** `frontend/lib/data.ts:794-816` (`getSwingPerformance()`). Server-side: `data-server.ts` → `readPublicJson("swing_performance.json")` diskten. Client-side: `/swing_performance.json`'a `cache: "no-store"` fetch; başarısızsa production fallback `https://bogastock.com/swing_performance.json` (satır 804).
- **"Son 10 işlem günü" mantığı:** Sayfa seviyesinde hesaplanıyor — `swingperformance/page.tsx:16` `LAST_N_DAYS = 10`, satır 32-35'te tüm history'den unique tarihler çıkarılıp sıralanıp ilk 10 alınıyor. **Bu doğru bir yaklaşım** — veri kaynağında "son 10 gün" filtresi yok, runtime'da hesaplanıyor, dolayısıyla stale/yanlış kesim riski yok.
- **Cron job:** `.github/workflows/daily-price-update.yml:1-39`. İş adı `Swing Performance Update` (dosya adıyla uyuşmuyor — kafa karıştırıcı ama fonksiyonel hata değil). Cron: `0 14,16,18,20,22 * * 1-5` (hafta içi, günde 5 kez, UTC). Script: `update_swing_performance.py`. **Veri DB'de değil — git commit/push ile deploy ediliyor** (satır 33).
- **Fiyat kaynağı:** `yfinance` (resmi olmayan Yahoo Finance API wrapper'ı) — `update_swing_performance.py:4,177`. Bu, kurumsal/profesyonel bir abonelik ürünü için **risk teşkil eder**: yfinance Yahoo'nun resmi olmayan bir kazıma katmanıdır, rate-limit/şema değişikliklerinde sessizce bozulabilir.
- **Timezone:** Workflow sabit UTC saatleri kullanıyor; script içinde `datetime.now()` (satır 144) timezone-aware değil → DST geçişlerinde (Mart/Kasım) ABD piyasa saatine göre kayma riski var. Ayrı bir `isMarketOpen()` (`Top100Tracker.tsx:78-85`, `America/New_York` kontrollü) mevcut ama swing performance hesaplamasında **kullanılmıyor**.
- **Resmi tatil takvimi:** Bulunamadı. Piyasa tatillerinde script'in ne yaptığı (atlıyor mu, hatalı fiyat mı çekiyor) doğrulanamadı.
- **Mock/dummy data:** Yok — veri yoksa "Loading..." gösteriliyor (satır 24-30), sahte veri fallback'i yok. Ancak `update_swing_performance.py:236`'da `stop_loss_high` eksikse `entry * 0.9474` varsayılan değeri kullanılıyor (tahmini fallback, gerçek veri değil — kullanıcıya ayrıştırılmadan gösteriliyor).

**Sonuç:** Veri pipeline'ı temel olarak çalışıyor ve sahte veri içermiyor, ancak (a) resmi olmayan veri kaynağı, (b) timezone/tatil handling eksikliği, (c) git-commit-as-database mimarisi — bunlar "kullanıcı veriyi kullandığında yanlış demesin" hedefine karşı **operasyonel risk**, veri doğruluğu açısından değil.

---

## 3. Performans Hesaplama Mantığı — Çapraz Kontrol (`update_swing_performance.py:50-133`)

- **Getiri formülü:** `((price - entry_price) / entry_price) * 100` (satır 96) — matematiksel olarak doğru, standart.
- **Parametreler:** `MAX_HOLD_DAYS=90`, `SL_WINDOW_DAYS=60`, `MIN_SL_PCT=-10.0`, `WIN_PCT_60D=5.0`.
- **İlk 60 gün:** EMA50 altına düşüp -%10 zarar → LOSS; +%5 getiri veya profit target → WIN.
- **60-90 gün arası:** EMA50 stop-loss kuralı **uygulanmıyor** (satır 109-112) — bu pencerede aşağı yönlü koruma yok, gerçek bir trader bu süre zarfında zarar kesebilir ama backtest etmiyor.
- **🔴 Look-ahead bias (kritik):** 90. günde sonuç, geriye dönük görülmüş `peak_price`'a göre belirleniyor, gerçek çıkış fiyatına göre değil (satır 114-118). Bu, gerçekte hiçbir trader'ın elde edemeyeceği "en iyi senaryo" sonucunu rapor ediyor.
- **Survivorship bias:** Kod seviyesinde temiz — hiçbir kayıt silinmiyor.
- **30 günlük duplicate kuralı:** Aynı ticker 30 gün içinde tekrar seçilirse istatistiklerden hariç tutuluyor (satır 286-302) — doğru pratik, manipülasyon değil.
- **Slipaj/komisyon:** Hiç hesaba katılmıyor — ham fiyat farkı.
- **Üretim verisi:** `win_rate: 87.1`, `avg_return_pct: 3.95`, `total_picks: 1124`, `duplicate_count: 248` (~%22). Düşük win threshold (+%5/60 gün) bu yüksek win rate'i matematiksel olarak açıklar, ama pazarlama materyalinde "%87 başarı oranı" gibi sunulursa **yanıltıcı olur** — threshold ve metodoloji şeffaf şekilde açıklanmalı.

**Çapraz kontrol sonucu:** Hesaplama mantığı kodlama hatası içermiyor (matematik doğru), ama metodolojik olarak iki gerçek bias var: look-ahead bias (90 gün sonu) ve slipaj/komisyon ihmali. Bu ikisi birlikte raporlanan performansı gerçek trading sonuçlarından sistematik olarak daha iyi gösterir. Ücretli bir ürün için **bu, açıklanması gereken bir metodoloji notu olmalı** (disclaimer), aksi halde "veri yanlış" değil ama "veri optimistik/idealize" itirazı meşru olur.

---

## 4. Auth / Gating Sistemi

### ⚠️ Düzeltme: Orijinal "middleware bulunamadı" bulgusu hatalıydı

İlk audit turunda dosya adı `middleware.ts` olarak arandı ve bulunamadığı için "route-level sunucu tarafı auth kontrolü yok, Top100/Swing Performance tamamen public" sonucuna varıldı. Bu sonuç **yanlıştı**. Proje Next.js 16 kullanıyor ve bu sürümde dosya kuralı `proxy.ts` olarak yeniden adlandırıldı (`node_modules/next/dist/docs/.../proxy.md:11`). Projede zaten `frontend/proxy.ts` dosyası **mevcuttu** (commit `db15abdc`, "feat: add global login pages + middleware protection for member-only global routes") ve şunu yapıyordu:

- `proxy.ts:14-22` — `/global/en/*` ve `/global/tr/*` altında landing (`/global/en`, `/global/tr`) ve login (`/global/en/login`, `/global/tr/giris`) hariç **her route'u** üye-gerekli (`isGlobalMemberPath`) olarak işaretliyor.
- `proxy.ts:24-27` — Supabase oturum çerezinin varlığını kontrol ediyor (`sb-*-auth-token` adıyla başlayan cookie).
- `proxy.ts:47-53` — Oturum çerezi yoksa locale'e göre doğru login sayfasına (`/global/en/login` veya `/global/tr/giris`) `307` redirect yapıyor.
- `proxy.ts:31-44` — Eski `/en/top100`, `/tr/top100` rotalarını da `/global/` altına ve login gereksinimine yönlendiriyor.

**Canlıda doğrulama (production, dokunulmadı):**
```
GET https://bogastock.com/global/tr/top100   → 307 → /global/tr/giris
GET https://bogastock.com/global/en/login    → 200
```
Yani Top100, Swing Performance, [ticker] ve Account/Hesabım sayfaları **zaten** sunucu tarafında gated'ti. Bu, audit metodolojisinde bir hata — dosya adı eşleşmesine güvenip framework sürüm farkını gözden kaçırma. Not düşülüyor: [[planning_style_no_hedging]] ilkesi burada ihlal edilmiş olabilir, gelecekte dosya konvansiyon değişiklikleri (middleware→proxy gibi) için framework sürümü önce kontrol edilmeli.

### Gerçek, doğrulanmış boşluk: `/api/top100` route handler

`proxy.ts:85-86`'daki matcher `/api` yollarını **kasıtlı olarak hariç tutuyor** (`matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)']`). Bu, proxy'nin sayfa seviyesinde koruma sağlarken API route'larını korumadığı anlamına geliyor — ve `app/api/top100/route.ts` (orijinal hali, satır 40-99) hiçbir `supabase.auth.getUser()` kontrolü içermiyordu, sadece IP bazlı rate limit vardı (120 istek/15dk). Bu **gerçek bir boşluktu**: sayfa login gerektirse de, `Top100Tracker.tsx` bileşeninin çektiği veriyi taşıyan API'ye doğrudan `curl https://bogastock.com/api/top100` ile login'siz erişilebiliyordu.

### ✅ Uygulanan Düzeltme (2026-06-27)

`app/api/top100/route.ts:46-49` — route handler'a `supabase.auth.getUser()` kontrolü eklendi, oturumsuz istek artık `401` döner. Bu API'nin tek tüketicisinin `Top100Tracker.tsx` (yalnızca gated `/global/{en,tr}/top100` sayfalarında kullanılıyor) olduğu doğrulandı — başka hiçbir public akış kırılmadı.

Ayrıca, defense-in-depth amaçlı, `/global` altındaki 8 gated route'a (`top100`, `swingperformance`, `[ticker]`, `account`/`hesabim` — en/tr) sunucu taraflı `layout.tsx` dosyaları eklendi. Bunlar `proxy.ts`'in cookie-varlığı kontrolünden farklı olarak Supabase'e gerçek bir `getUser()` çağrısı yapıp JWT'yi doğruluyor (sahte/expired cookie ile bypass riskini kapatıyor). Bu desen zaten projede `app/en/account/layout.tsx` ve `app/tr/hesabim/layout.tsx`'te (global olmayan hesap sayfaları için) kullanılıyordu — birebir aynı, doğrulanmış kalıp `/global` altına taşındı:

- `app/global/en/top100/layout.tsx`, `app/global/tr/top100/layout.tsx` (yeni)
- `app/global/en/swingperformance/layout.tsx`, `app/global/tr/swingperformance/layout.tsx` (yeni)
- `app/global/en/[ticker]/layout.tsx`, `app/global/tr/[ticker]/layout.tsx` (yeni)
- `app/global/en/account/layout.tsx`, `app/global/tr/hesabim/layout.tsx` (yeni) — `AccountView.tsx`'teki client-side flash riskini de ayrıca kapatıyor: sayfa artık render edilmeden önce sunucuda redirect ediliyor.

**Doğrulama:**
- `npx tsc --noEmit` → temiz, hiçbir tip hatası yok.
- Yerel dev sunucusunda (`.next` cache temizlenip taze başlatıldıktan sonra) tüm route'lar test edildi:
  - `/global/tr/top100` → `307 → /global/tr/giris` ✓
  - `/global/en/swingperformance` → `307 → /global/en/login` ✓
  - `/global/en/AAPL` ([ticker]) → `307 → /global/en/login` ✓
  - `/global/tr/hesabim` → `307 → /global/tr/giris` ✓
  - `/api/top100` (oturumsuz) → `401 {"error":"Not authenticated."}` ✓
  - `/global/en`, `/global/tr` (public landing) → `200`, değişmedi ✓
  - `/global/en/login`, `/global/tr/giris` → `200`, değişmedi ✓
- Her layout dosyası eklenmeden önce ilgili dizinin tek alt route'u olduğu doğrulandı (nested public sub-route riski yok, bkz. madde 1 sayfa envanteri).

### ⚠️ Kalan Riskler (bu turda kasıtlı olarak dokunulmadı)

1. **`public/swing_performance.json` ve `public/swing_all_picks.json` hâlâ statik dosya olarak herkese açık** (`frontend/public/swing_performance.json`). Next.js'te `public/` klasörü her zaman doğrudan servis edilir; proxy matcher'ı teorik olarak bu yolu da kapsayacak şekilde genişletilebilir, ama `lib/data.ts:804`'teki production fallback mekanizması bu dosyaya doğrudan, login'siz HTTP fetch ile bağımlı — kapatmak bu fallback'i de bozar. Bilerek dokunulmadı, ayrı bir mimari karar gerektiriyor.
2. **Ödeme/subscription altyapısı yok** — gating "kim görebilir" sorusunu çözüyor, "kim ödeme yaptı" sorusunu çözmüyor. Stripe entegrasyonu hâlâ ayrı bir iş kalemi.
3. **Login rate limiter in-memory** (`api/members/login/route.ts:5-7`) — serverless ortamda instance'lar arası paylaşılmıyor, zayıf brute-force koruması.
4. **`proxy.ts:25-27`'deki kontrol sadece cookie'nin *varlığına* bakıyor**, JWT'yi doğrulamıyor (Edge runtime'da hafif tutmak için muhtemelen kasıtlı bir tasarım). Süresi dolmuş veya bozuk bir `sb-*-auth-token` cookie'siyle sayfa seviyesinde teorik bir bypass riski var — ama artık üstüne eklenen `layout.tsx` (`getUser()` ile gerçek doğrulama) ve `/api/top100` route guard'ı bu riski sayfa ve veri seviyesinde kapatıyor.

**Güncel durum:** Sayfa ve API seviyesinde erişim kontrolü artık tutarlı şekilde uygulanıyor (zaten var olan `proxy.ts` + bu turda eklenen `layout.tsx`'ler + `/api/top100` guard'ı). Ücretli abonelik lansmanı için kalan gerçek blokaj **erişim kontrolü değil, ödeme/subscription altyapısının hiç kurulmamış olması** (madde 2) — gating "kim girebilir" sorusunu çözüyor, "kim ödeme yaptı, kim yapmadı" ayrımını yapmıyor.

---

## 5. Ölçeklenebilirlik Analizi — 10.000 Abone Hedefi

| Bileşen | Mevcut Durum | 10k Abone Riski |
|---|---|---|
| Swing performance veri okuma | `readJson` her çağrıda 4-7 path candidate + dosya parse, `data-server.ts:31-72`, ~642 KB JSON | Düşük-orta — `revalidate=60` ISR sayesinde CDN cache devrede, sorun büyütülebilir değil ama optimize değil |
| Top100 API | `api/top100/route.ts:40-99`, cache-control yok, her istek 2x Supabase sorgusu | **Orta-yüksek** — 10k kullanıcı x 5 dk polling (`Top100Tracker.tsx:10`) = sürekli Supabase connection pool yükü |
| Rate limiting | Tüm limiter'lar in-memory `Map` (login, register, top100) | **Yüksek** — Vercel serverless'te instance'lar paylaşılmaz, limit etkisiz; gerçek DDoS/abuse koruması yok |
| Client-side fetch | `getSwingPerformance()` client tarafında `cache: "no-store"` (`data.ts:801`) | Orta — CDN/browser cache bypass edilir, her client kendi sunucu yükü yaratır |
| Auth/session | Supabase Auth, ölçeklenebilir (Supabase'in kendi altyapısı) | Düşük |
| Veri deploy mekanizması | Git commit/push ile JSON güncelleme | Düşük-orta — trafik artışıyla ilgisiz ama deploy sıklığı arttıkça (günde 5x) build/deploy süresi kümülatif yük yaratabilir |
| Ödeme altyapısı | **Yok** | **Engelleyici** — 10k ölçeğinde manuel ödeme takibi yapılamaz |

**Genel değerlendirme:** Mevcut mimari (Next.js ISR + Vercel + Supabase) **teknik olarak 10.000 aboneyi kaldırabilir** — bu büyüklük Supabase/Vercel için orta ölçek sayılır, mimari yeniden yazım gerektirmez. Ancak üç somut düzeltme **lansman öncesi şart**:

1. ~~`middleware.ts` ile sunucu tarafı route gating~~ — **bu audit turunda tamamlandı.** Sayfa seviyesinde gating zaten `proxy.ts` ile mevcuttu (önceki turda gözden kaçırılmıştı); bu turda `/api/top100` route guard'ı eklendi ve sayfa seviyesine ek `layout.tsx` JWT doğrulaması (defense-in-depth) yapıldı. Bkz. Bölüm 4.
2. Ödeme/subscription entegrasyonu (Stripe önerilir — global sabit fiyat hedefi için en uygun, 135+ para birimi ve otomatik vergi desteği var). **Hâlâ yapılmadı — asıl kalan blokaj bu.**
3. In-memory rate limiter'ların Redis/Upstash gibi dağıtık bir çözüme taşınması (login brute-force ve API abuse için). **Hâlâ yapılmadı.**

Madde 2 olmadan "10k ücretli abone" hedefi **iş modeli açısından** çalışmaz — erişim artık kontrollü ama ödeme alınamıyor. Bu **trafik/performans** sorunu değil, **eksik özellik** sorunu; geliştirme süresi tahmini 1-2 hafta (Stripe entegrasyonu + rate limit migration).

---

## 6. Fiyatlandırma Önerisi

**Bağlam:** Tek dünya çapında sabit fiyat, aylık abonelik, yatırımcı/trader hedef kitlesi, hedef $10/$20/$30 aralığı.

### Karşılaştırmalı pazar konumu
- Benzer "swing trade sinyali / top-pick listesi" ürünleri (Motley Fool Stock Advisor, Trade Ideas, benzeri retail sinyal servisleri) tipik olarak $20-100/ay aralığında fiyatlanır.
- Sizin ürününüz şu an **tek bir özellik setine** sahip: Top100 listesi + son 10 gün swing performance + ticker bazlı pre-order analiz. Bu, "tam platform" değil, "odaklı sinyal/takip aracı" konumunda.
- Backtest metodolojisinde tespit edilen look-ahead bias ve slipaj ihmali, "%87 win rate" gibi rakamların ham haliyle pazarlanmasını riskli kılıyor — bu da fiyat algısını etkiler: şeffaf disclaimer olmadan agresif fiyatlama (örn. $30) itibar riski taşır.

### Öneri: **$15/ay başlangıç fiyatı** olarak, sorulan üç seçenek arasında **$20/ay**'a en yakın ama net $20 değil — aşağıda gerekçe:

Sorulan üç seçenek ($10/$20/$30) arasında **$20/ay'ı öneriyorum**, şu gerekçelerle:

- **$10** çok düşük: Bu fiyat noktası "ucuz/güvenilmez sinyal servisi" algısı yaratır, ayrıca Stripe işlem ücreti (%2.9 + $0.30) gelirin ~%6'sını yer — 10k abone x $10 = $100k MRR'da bile birim ekonomisi zayıf kalır, ücretsiz/freemium kademe için daha uygun bir fiyat.
- **$30** riskli: Metodoloji şeffaflığı (look-ahead bias, slipaj yok) düzeltilmeden bu fiyat noktasına çıkmak, kullanıcı "vaat edilen performansı alamıyorum" şikayetlerini büyütür — churn riski yüksek. Ödeme altyapısı ve gating bile henüz kurulmamışken üst fiyat bandına gitmek erken.
- **$20** dengeli: Hem "ciddi bir sinyal aracı" algısı yaratır hem de global sabit fiyat olarak gelişmekte olan piyasalardaki (TR, vb.) kullanıcılar için hâlâ erişilebilir kalır (TL bazında ~700-800 TL/ay civarı, Türkiye'de premium finans aboneliği için makul bant). $10k MRR hedefine 500 aboneyle ulaşılır — 10k abone hedefiyle de tutarlı, gerçekçi bir kademeli büyüme fiyatı.

**Ek öneri:** Lansmanda $20'yi **early-bird/founding member** fiyatı olarak sunup ("ilk 1000 üyeye ömür boyu $20" gibi), metodoloji şeffaflığı (disclaimer + gerçekçi backtest düzeltmeleri) ve ödeme altyapısı tamamlandıktan sonra yeni kullanıcılar için $25-30'a çıkmak — bu hem erken büyümeyi hızlandırır hem de gelecekteki fiyat artışına meşru bir gerekçe (iyileştirilmiş ürün) sağlar.

---

## 7. Öncelikli Aksiyon Listesi (Lansman Öncesi)

**Engelleyici (lansmandan önce şart):**
1. ~~Sunucu taraflı route gating~~ — ✅ tamamlandı (bu turda `/api/top100` guard'ı + 8 yeni `layout.tsx` eklendi, ayrıntı Bölüm 4).
2. Stripe (veya benzeri) ödeme/subscription entegrasyonu — şu an hiç yok. **Kalan tek engelleyici madde.**
3. ~~Backtest metodolojisine şeffaflık notu~~ — ✅ tamamlandı (2026-06-27). İki ayrı katmanda eklendi:
   - **Genel yatırım tavsiyesi uyarısı** — `components/Footer.tsx`'e `locale` prop'u eklendi, `/global` altındaki 12 sayfanın (en+tr) hepsinin footer'ında dilin sayfaya göre seçildiği bir uyarı gösteriliyor ("yatırım tavsiyesi değildir, veriler gecikmeli olabilir, kendi araştırmanızı yapın").
   - **Backtest metodoloji notu** — `components/SwingPerformanceDashboard.tsx`'e `locale` prop'u eklendi; "BAŞARI ORANI / ORTALAMA GETİRİ" istatistik bloğunun (satır 605-634) hemen altına, aynı `showStats` toggle'ı içinde, look-ahead bias (peak_price'a göre hesaplama) ve slipaj/komisyon ihmalini açıklayan bir metodoloji notu eklendi (satır 636-639). `/global/en/swingperformance/page.tsx`'e `locale="en"` geçildi; `/global/tr/swingperformance/page.tsx` ve diğer mevcut kullanım (`app/performance/page.tsx`) prop default'u (`"tr"`) sayesinde değişmeden kaldı.
   - Doğrulama: `npx tsc --noEmit` temiz. Sayfa Supabase üye girişi gerektirdiğinden (proxy.ts + layout.tsx gating) gerçek tarayıcıda kimlik doğrulamalı ekran görüntüsü alınamadı; değişiklik mevcut stat bloklarıyla birebir aynı JSX/class deseniyle eklendiği için yapısal olarak doğrulandı.

**Yüksek öncelik (lansmandan kısa süre sonra):**
4. In-memory rate limiter'ları Upstash Redis gibi dağıtık bir çözüme taşı (login + API abuse koruması için).
5. `yfinance` bağımlılığını değerlendir — resmi olmayan veri kaynağı, ücretli üründe risk; alternatif (Polygon.io, Alpha Vantage, IEX Cloud gibi resmi API) değerlendirilmeli.
6. Timezone-aware tarih işleme (`update_swing_performance.py`) ve resmi piyasa tatili takvimi entegrasyonu.

**Orta öncelik:**
7. Top100 API'sine `Cache-Control`/ISR ekle — 10k abone x 5dk polling yükünü azaltmak için.
8. `AccountView.tsx`'teki işlevsiz "Upgrade" butonunu kaldır veya Stripe checkout'a bağla.

---

## 8. Sonuç

- **Veri doğruluğu:** Sahte/mock veri yok, hesaplama formülü matematiksel olarak doğru. Metodolojik bias'lar (look-ahead, slipaj ihmali) raporlanan performansı optimistik gösteriyordu — bu "yanlış veri" değil, "açıklanmamış metodoloji" sorunuydu; artık hem genel yatırım tavsiyesi uyarısı hem de stat bloğunun yanındaki metodoloji notuyla kullanıcıya açıklanıyor.
- **Navigasyon/iş akışı:** Tutarlı ve çalışıyor; MemberHeader entegrasyonu sayfalar arası geçişi düzgün sağlıyor.
- **10k abone hedefi:** Mevcut teknik mimari (Vercel + Supabase + Next.js ISR) bu ölçeği kaldırabilir, mimari değişiklik gerekmez. **Gerçek engel ölçek değil, ödeme altyapısının eksikliği** — server-side gating zaten vardı (`proxy.ts`) ve bu turda API seviyesindeki tek gerçek boşluk (`/api/top100`) kapatıldı; ödeme sistemi olmadan ücretli model hâlâ başlayamaz.
- **Fiyat önerisi:** $20/ay, global sabit fiyat, early-bird $20 + gelecekte $25-30'a kademeli artış stratejisiyle.
