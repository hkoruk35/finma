# FinMA v5.0 — Detaylı Uygulama Planı
> Mevcut yapıyı bozmadan, katman katman geliştirme planı

---

## MEVCUT DURUM ÖZETI

**Tech Stack:** Next.js 14 + FastAPI + Supabase + Railway/Vercel
**Mevcut Sayfalar:** dashboard, portfolio, trades, signals, watchlists, market (charts/maps/performance/valuation), featured (backtest), news, insider, ai, stock-analysis, trends, operations, world-markets, settings, admin (users/bots/invites/settings)
**Mevcut Botlar:** swing112, news_bot, insider_bot, intelligence_bot
**Tier Sistemi:** free / pro / admin

---

## AŞAMA 0 — HAZIRLIK (Önce Bunlar)

Hiçbir geliştirme başlamadan tamamlanması zorunlu ön koşullar.

### ✅ A0-1: Ortam ve Altyapı Kontrolü
- [ ] Railway backend sağlıklı mı? `/api/health` çalışıyor mu?
- [ ] Supabase bağlantısı aktif mi?
- [ ] Polygon.io API key geçerli mi?
- [ ] Gemini Flash API key geçerli mi?
- [ ] Redis bağlantısı var mı? (Yoksa Upstash Redis kur)
- [ ] Vercel environment variables güncel mi?

### ✅ A0-2: swing113 Botu Hazırlığı
- [ ] `bots/swing113.py` oluştur — swing112'nin özelleştirilmiş versiyonu
- [ ] swing113 output formatı: JSON `{ "timestamp": "", "opportunities": [ {ticker, company_name, sector, price, score, entry, stop, target, reason} ] }`
- [ ] swing113'ü `bot_runner.py` BOT_CONFIGS'e ekle
- [ ] Schedule: NY saati 11:00, 13:00, 15:00 (3 kez/gün)
- [ ] Telegram mesajı GÖNDERMEYECEk — sadece JSON yaz
- [ ] Output dosyası: `bots/output/swing113_latest.json`

### ✅ A0-3: Veritabanı Şema Güncellemeleri
- [ ] `opportunities` tablosu oluştur (Supabase migration)
  ```sql
  id, run_timestamp, ticker, company_name, sector, price, score,
  entry_zone, stop_loss, target, potential_pct, reason, visible_to (free/pro), created_at
  ```
- [ ] `notifications` tablosu oluştur
  ```sql
  id, user_id, type, title, message, is_read, created_at
  ```
- [ ] `smart_watchlist` tablosu oluştur
  ```sql
  id, user_id, ticker, company_name, sector, added_at, alert_price, notes
  ```
- [ ] `screener_results` tablosu oluştur
  ```sql
  id, user_id, filter_params (JSONB), results (JSONB), created_at
  ```
- [ ] `user_portfolios` tablosu oluştur (çoklu portföy desteği)
  ```sql
  id, user_id, name, description, created_at
  ```
- [ ] `portfolio_holdings` tablosu oluştur
  ```sql
  id, portfolio_id, user_id, ticker, qty, avg_cost, created_at
  ```
- [ ] Mevcut `users` tablosuna `trial_start_date` alanı var mı kontrol et
- [ ] `users` tablosuna `scan_credits`, `watch_slots` alanları ekle

---

## AŞAMA 1 — ANA SAYFA YENİDEN DÜZENİ

**Dosyalar:** `frontend/app/(terminal)/dashboard/page.tsx`, `frontend/components/terminal/`

### ✅ A1-1: Üst Bar (TopBar) Düzenlemeleri
**Dosya:** `frontend/components/terminal/TopBar.tsx`

- [ ] **VIX uyarı bandını tamamen kaldır** — `dashboard/page.tsx` içindeki VIX alert bileşenini sil
- [ ] **Bildirim ikonu çalıştır:**
  - Backend: `GET /api/notifications` endpoint ekle (son 10 bildirim, user_id bazlı)
  - Backend: `PUT /api/notifications/{id}/read` endpoint ekle
  - Frontend: TopBar'da bell ikonu — unread count badge (kırmızı sayı)
  - Frontend: Tıklanınca dropdown panel (son 10 bildirim listesi)
  - Frontend: Her bildirime tıklayınca "okundu" işaretle
- [ ] **Üye bilgileri dropdown çalıştır:**
  - Kullanıcı adı + plan tipi (Pro/Free/Admin) göster
  - Avatar/initials göster
  - Dropdown: Ayarlar linki + Çıkış yap butonu
  - Trial kalan gün göster (Free Trial ise)
- [ ] **Mobil üst bar:** hamburger menü, responsive layout
- [ ] **PWA "Ana Ekrana Ekle" butonu** — `components/shared/InstallPrompt.tsx` var, TopBar'a entegre et

### ✅ A1-2: Komuta Merkezi (HUD) Yeniden Tasarımı
**Dosya:** `frontend/components/terminal/HUDMetrics.tsx`

- [ ] **VIX bandının yerine HUD'u taşı** — sayfanın en üstünde, altında piyasa özeti
- [ ] **%30 daha küçük boyut:** font-size küçült, padding azalt, card yüksekliklerini düşür
- [ ] **Admin görünümü:** tüm üyelerin toplamları
  - Toplam Portföy Değeri (tüm üyeler)
  - Toplam Açık İşlem Sayısı
  - Toplam Üye: Free X | Pro Y | Admin Z
  - Bugünkü AI Analiz Sayısı
- [ ] **Üye görünümü:** sadece o üyeye ait
  - Portföy Net Değeri
  - Açık İşlem Sayısı
  - Günlük P&L
  - Takip Listesi Sayısı
- [ ] Backend: `GET /api/dashboard/summary?role=admin` → aggregate query
- [ ] Backend: `GET /api/dashboard/summary` → user-specific query
- [ ] HUD kartları: `ikon + büyük sayı + küçük başlık` formatı

### ✅ A1-3: Piyasa Özeti Küçültme
**Dosya:** `frontend/components/terminal/MarketContext.tsx` veya dashboard

- [ ] Piyasa özeti bölümünü HUD'un hemen altına taşı
- [ ] Dikey boyutu %30 küçült (yatay genişlik değişmez)
- [ ] Font boyutları orantılı olarak küçült
- [ ] FinMA AI Özeti bölümü yerinde kalsın (değişiklik yok)

### ✅ A1-4: Piyasa Hareketleri + Günün Fırsatları (Birleşik Bileşen)
**Yeni Dosya:** `frontend/components/terminal/MarketMovers.tsx`

- [ ] **4 Sekme Sistemi:** Fırsatlar | Yükselenler | Düşenler | Yüksek Hacim
- [ ] **Her sekme:** 10 hisse satırı
- [ ] **Sütun başlıkları (büyük font):** Takibe Al | Hisse | Şirket Adı | Sektör | Canlı Fiyat | Saatlik Değişim
- [ ] **Zaman filtresi:** 1 Gün / 1 Hafta / 1 Ay / 1 Yıl (mevcut kalır)
- [ ] **Takibe Al butonu:** her satırın başında → tıklanınca Smart Watchlist'e ekle
- [ ] **Renk:** pozitif değişim yeşil, negatif kırmızı
- [ ] **Saat başı otomatik yenileme:** `setInterval(3600000)` veya SSE
- [ ] Backend: `GET /api/market/movers?tab=gainers|losers|volume|opportunities&period=1d`
- [ ] Backend: Polygon.io'dan saat başı veri çek, Redis'e yaz (`finma:movers:{tab}`)
- [ ] **Fırsatlar sekmesi:** swing113 çıktısından gelecek (A0-2'de hazırlanacak)
- [ ] Mobil: tab bar yatay scroll

### ✅ A1-5: Screener Önizlemesi (Ana Sayfada)
- [ ] Ana sayfada 2-3 satır kompakt kart olarak screener özeti göster
- [ ] "Detaylı Hisse Tarama →" butonu ile `/screener` sayfasına yönlendir
- [ ] Pro badge etiketi göster ("Katma Değerli Hizmet")
- [ ] Screener önizlemesi: son çalıştırılan en iyi 5 sinyal başlık olarak göster

### ✅ A1-6: Akıllı Para Akışı
- [ ] Ana sayfada sadece ilk satır göster (önizleme tablosu)
- [ ] "Tüm Para Akışı →" linki → `/market/flow` sayfasına yönlendir
- [ ] Yeni backend worker: `bots/money_flow_bot.py` — 7/24 saat başı çalışır
- [ ] Redis key: `finma:money_flow:latest` (TTL 2 saat)

### ✅ A1-7: Sektör Isı Haritası
- [ ] Mevcut ısı haritası yerinde kalsın
- [ ] "Detay için: Piyasa Haritaları →" linki ekle → `/market/maps`

### ✅ A1-8: Piyasa İstihbaratı (En Alta Taşı)
**Dosya:** Mevcut intelligence bileşeni

- [ ] Sektör haritasının altına taşı
- [ ] Saat başı güncelleme (7/24 bot)
- [ ] **Üst 4 metrik kartı** aynen kalsın (VIX, SPY, Rejim, Para Akışı)
- [ ] **3 sütun düzeni:**
  - **Sütun 1:** Günün Özeti + FinMA Analiz Özeti (birleşik)
  - **Sütun 2:** Global Ekonomik Takvim — Tarih | Saat | Olay | Etki (max 10 satır, ayrı hücreler)
  - **Sütun 3:** Önemli Teknik Seviyeler — S&P500, NASDAQ, DJI destek/direnç
- [ ] Max 10 satır per sütun
- [ ] Font boyutu okunabilir (min 13px başlık, 12px içerik)
- [ ] Tablo çizgileri belirgin

---

## AŞAMA 2 — PİYASA SAYFALARI

### ✅ A2-1: /market Sayfası Güncellemesi
**Dosya:** `frontend/app/(terminal)/market/page.tsx`

- [ ] Grafik zaman seçenekleri: **1G / 1H / 1A / 1Y / 5Y / 10Y**
- [ ] Sektörel performans sistemi aynen kalsın
- [ ] Her sektörün altına **Top 3 firma ismi** ekle (dinamik, yfinance'den)
- [ ] Firma adına tıklanınca o hissenin grafiği açılsın (grafik motoru ile)
- [ ] Her hisse için **"Takip Et" butonu**
- [ ] Backend: `GET /api/market/sectors/top-stocks?sector=XLK&limit=3`

### ✅ A2-2: /news Sayfası — AI Haber Boru Hattı
**Dosya:** `frontend/app/(terminal)/news/page.tsx`
**Backend:** `backend/bots/news_worker.py` (yeni)

- [ ] Eski Yahoo RSS kazıyıcısını tamamen sil (`market_data.py`'de `get_ticker_news`)
- [ ] `news_worker.py` oluştur:
  - Polygon.io Ticker News API (`httpx` ile async)
  - Yedek: Finnhub Market News API
  - Saat başı son 15 haberi çek
  - Gemini Flash: her haberi Türkçe 1 cümle özete çevir
  - Format: `{ title, impact_summary, ticker, published_at, source }`
  - Redis'e yaz: `finma:news:latest` (List, TTL 24 saat)
  - Supabase `market_news` tablosuna dual-write
- [ ] Backend: `GET /api/news/latest` → Redis'ten `<50ms`
- [ ] Frontend kartları: Hisse Etiketi | Başlık | Tarih+Saat | AI Özeti
- [ ] Tıklanınca orijinal habere link

### ✅ A2-3: /market/insider Sayfası
**Dosya:** `frontend/app/(terminal)/insider/page.tsx`

- [ ] `insider_worker.py` SEC EDGAR Atom RSS okuyucusu
- [ ] User-Agent header: `'FinMA Data Engine (contact@finmasmart.com)'`
- [ ] Form 4 parse: Ticker / İnisiyat Sahibi / İlişki / Tarih / İşlem / Fiyat / Lot / Değer / Toplam / Link
- [ ] 5 dakikada bir async worker
- [ ] Redis key: `finma:insider:latest`
- [ ] Filtreleme: Alım/Satım, Miktar, Sektör

### ✅ A2-4: /market/world Sayfası
- [ ] `world_markets_worker.py` — 15 dakikada bir async
- [ ] Bölgesel sıralama: Asya → Ortadoğu → Avrupa → Amerika
- [ ] Açık borsalar aktif renkli, kapalılar gri/soluk
- [ ] Redis: `finma:world_markets:latest`
- [ ] `GET /api/world-markets/latest` endpoint (< 50ms)
- [ ] AI Global özet (Gemini): Güçlü/Zayıf/Risk/Fırsat

---

## AŞAMA 3 — FEATURED & OPPORTUNITIES SİSTEMİ

**En kritik iş akışı değişikliği**

### ✅ A3-1: swing113 Botu
**Dosya:** `backend/bots/swing113.py`

- [ ] swing112 tabanlı, Fırsatlar için optimize edilmiş
- [ ] Çalışma zamanı: NY 11:00, 13:00, 15:00
- [ ] **Telegram mesajı YOK**
- [ ] Output: `bots/output/swing113_YYYYMMDD_HHMM.json`
- [ ] Her çalıştırmada yeni JSON dosyası
- [ ] Format:
  ```json
  {
    "run_timestamp": "2026-03-21T11:00:00",
    "opportunities": [
      { "rank": 1, "ticker": "AAPL", "company_name": "Apple Inc", "sector": "Technology",
        "price": 185.5, "score": 87, "entry_zone": "183-186", "stop_loss": 179,
        "target": 195, "potential_pct": 5.1, "reason": "EMA20 breakout, volume spike" }
    ]
  }
  ```
- [ ] Supabase `opportunities` tablosuna kaydet

### ✅ A3-2: /featured Sayfası Yeniden Yapılandırma
**Dosya:** `frontend/app/(terminal)/featured/page.tsx`

- [ ] **Erişim kontrolü:** Pro üyelere açık; Free Trial sadece 1 numaralı fırsatı görebilir
- [ ] Sol tarafta: **Güncelleme geçmişi listesi** (son 10 çalıştırma)
  - Her çalıştırma için: Tarih (ayrı hücre) | Saat (ayrı hücre) | Fırsat Sayısı
  - Tıklanınca o çalıştırmanın detayları ana panele gelsin
- [ ] **Sağ panel:** Seçili çalıştırmanın fırsat listesi (max 10 hisse)
- [ ] **Pro sayfası:** son 10 liste birikimlisi, toplam 30'u geçmesin
- [ ] **Her saat grafikler otomatik yenilenir**
- [ ] **Admin:** tüm sayfalar sınırsız

### ✅ A3-3: /featured/backtest Sayfası
**Dosya:** `frontend/app/(terminal)/featured/backtest/page.tsx`

- [ ] **Sadece admin erişimi** — `require_admin` dependency
- [ ] Sol sidebar menüde **sadece admin sayfasında** görünsün
- [ ] Frontend middleware'de `/featured/backtest` → admin only kontrol
- [ ] Backtest arayüzü: hisse seç, tarih aralığı, strateji parametreleri gir, sonuç grafiği

---

## AŞAMA 4 — STOK ANALİZ & İŞLEMLER & PORTFÖY

### ✅ A4-1: /stock-analysis Sayfası İyileştirme
**Dosya:** `frontend/app/(terminal)/stock-analysis/page.tsx`

- [ ] Tablo çizgileri ekle (border-collapse, belirgin grid çizgileri)
- [ ] Font boyutları artır (başlıklar min 14px, değerler 13px)
- [ ] Temel metrikler: Piyasa Değeri, F/K, FD/FAVÖK, Temettü Verimi, Beta, 52H Yüksek/Düşük
- [ ] Teknik metrikler: RSI, EMA20/50/200, MACD, ADX, Bollinger
- [ ] Grafik motoru entegrasyonu (Aşama 6'da yapılacak)
- [ ] AI analiz kısmı daha okunabilir hale getir

### ✅ A4-2: /trades (İşlemler) Sayfası
**Dosya:** `frontend/app/(terminal)/trades/[id]?/page.tsx`

- [ ] **Tier limitleri:**
  - Free Trial: Max 5 işlem
  - Pro: Max 20 işlem
- [ ] **Ürün tipi alanı ekle:**
  - Hisse Senedi / ETF / Call / Put / Döviz / Oil / Bitcoin / Ethereum
  - Supabase `trades` tablosuna `product_type` alanı ekle
- [ ] Ürün tipine göre ikon/renk
- [ ] Backend: `POST /api/portfolio/trades` → limit kontrolü ekle
- [ ] **Admin yönetim sayfası:**
  - `/admin/trades-config` yeni sayfası
  - Tier limitlerini admin'den ayarlayabilme
  - Tüm kullanıcıların işlemlerini görme

### ✅ A4-3: /portfolio Sayfası
**Dosya:** `frontend/app/(terminal)/portfolio/page.tsx`

- [ ] **Tier limitleri:**
  - Free Trial: 1 portföy, max 20 hisse/ürün
  - Pro: 10 portföy, her birine isim verilebilir
- [ ] **Çoklu portföy sekmesi:** üstte portföy adları tab olarak
- [ ] **Portföy oluştur/sil/yeniden adlandır** butonu
- [ ] **Her hissenin yanına "Takip Et" butonu** → Smart Watchlist'e ekle
- [ ] Backend: Yeni portföy CRUD endpoints
  - `GET /api/portfolios` → kullanıcının portföyleri
  - `POST /api/portfolios` → yeni portföy oluştur
  - `DELETE /api/portfolios/{id}` → portföy sil
  - `PUT /api/portfolios/{id}` → yeniden adlandır
  - `GET /api/portfolios/{id}/holdings` → portföy içindeki hisseler
  - `POST /api/portfolios/{id}/holdings` → hisse ekle
  - `DELETE /api/portfolios/{id}/holdings/{ticker}` → hisse çıkar

---

## AŞAMA 5 — AKILLI TAKİP LİSTESİ (Smart Watchlist)

### ✅ A5-1: Akıllı Takip Sayfası
**Yeni Dosya:** `frontend/app/(terminal)/watchlist/page.tsx`
**Sol sidebar'a ekle**

- [ ] **Tier limitleri:**
  - Free Trial: 1 hisse takibi
  - Pro: 10 hisse takibi (+ add-on: +10 takip $19)
- [ ] **Liste görünümü:** Hisse | Şirket | Sektör | Anlık Fiyat | Giriş Fiyatı | Değişim | Durum
- [ ] **Alarm özelliği:** fiyat alarmı kurma (opsiyonel)
- [ ] **Ekle/Çıkar** işlemleri
- [ ] **Her hisse için mini grafik** (sparkline — Aşama 6 grafik motoru)
- [ ] **Backend endpoints:**
  - `GET /api/watchlist` → kullanıcının takip listesi
  - `POST /api/watchlist` → hisse ekle (limit kontrolü)
  - `DELETE /api/watchlist/{ticker}` → hisse çıkar
  - `PUT /api/watchlist/{ticker}/alert` → alarm güncelle

### ✅ A5-2: Sol Sidebar Güncellemesi
**Dosya:** `frontend/components/terminal/Sidebar.tsx`

- [ ] **"Akıllı Takip"** menü öğesi ekle → `/watchlist`
- [ ] **"Screener / Hisse Tarama"** menü öğesi ekle → `/screener`
- [ ] Admin sidebar'a **"/featured/backtest"** ekle (sadece admin görebilir)
- [ ] `/market/flow` linki ekle (Akıllı Para Akışı)

---

## AŞAMA 6 — SCREENER / HİSSE TARAMA SAYFASI

**Dosya:** `frontend/app/(terminal)/screener/page.tsx` (yeni)

### ✅ A6-1: Screener Backend
- [ ] **Tier limitleri:**
  - Free Trial: Haftada 2 tarama
  - Pro: Haftada 10 tarama (+ add-on: +10 tarama $9)
- [ ] Backend: `POST /api/screener/run` → sinyal motoru çalıştır
  ```json
  { "filters": { "min_price": 5, "max_price": 1000, "min_market_cap": 300000000,
    "min_rvol": 1.2, "min_rsi": 40, "max_rsi": 70, "ema_trend": "above",
    "sector": ["Technology", "Healthcare"], "min_adx": 18 } }
  ```
- [ ] Backend: Scoring Engine (0-100 puan)
  ```
  score = (trend*0.30 + volume*0.25 + momentum*0.32 + context*0.13)
  ```
- [ ] Score sınıflandırma: 90+=STRONG BUY, 75-89=BUY, 60-74=WATCH, <60=IGNORE
- [ ] Sonuçları `screener_results` tablosuna kaydet (kredi düşür)
- [ ] `GET /api/screener/credits` → kalan tarama hakkı
- [ ] `GET /api/screener/history` → geçmiş taramalar

### ✅ A6-2: Screener Frontend
- [ ] **Filtre paneli (sol):** Fiyat, Piyasa Değeri, Hacim, RSI, EMA, ADX, Sektör, Puan
- [ ] **Sonuç tablosu (sağ):** Hisse | Şirket | Sektör | Puan | Fiyat | RSI | Volume | Sinyal
- [ ] Puan badge'i (yeşil/sarı/kırmızı)
- [ ] Her satır için: **Takibe Al** + **Grafik** + **AI Analiz** butonları
- [ ] Tarama hakkı göstergesi (kalan hak)
- [ ] Sonuç CSV export

---

## AŞAMA 7 — GRAFİK MOTORU (Native Chart Engine)

**En büyük teknik çalışma — tüm diğer aşamalar grafiğe bağımlı**

### ✅ A7-1: Backend Grafik Veri API
- [ ] `GET /api/charts/{ticker}?timeframe=5m|15m|1h|1d|1w&from=&to=` endpoint
  - yfinance'den OHLCV verisi
  - Teknik indikatörler hesaplanmış olarak döndür
  - Redis cache: `finma:chart:{ticker}:{timeframe}` (TTL: 5m→5dk, 1d→1saat)
- [ ] Döndürülen format:
  ```json
  { "ticker": "AAPL", "timeframe": "1d",
    "candles": [{"t":1711234567, "o":180, "h":185, "l":179, "c":183, "v":50000000}],
    "indicators": { "ema20":[], "ema50":[], "ema200":[], "bb_upper":[], "bb_lower":[], "bb_mid":[], "rsi":[], "macd":[], "signal":[], "histogram":[], "adx":[], "obv":[] }
  }
  ```
- [ ] Formasyonlar API: `GET /api/charts/{ticker}/patterns`
  - Hammer, Doji, Engulfing, Shooting Star tespit
  - Bayrak, Flama, Üçgen, Baş-Omuz tespit

### ✅ A7-2: Frontend Grafik Bileşeni
**Yeni Dosya:** `frontend/components/charts/FinMAChart.tsx`

- [ ] **Kütüphane:** `lightweight-charts` (zaten var — `TradingViewWidget.tsx`'i kaldır/yerini al)
- [ ] **Standart görünüm:**
  - Mum grafiği (Candlestick)
  - Hacim çubukları (Volume bars)
  - Bollinger Bands
  - EMA 20, EMA 50, EMA 200
- [ ] **Opsiyonel indikatörler (açma/kapama toggle):**
  - RSI (alt panel)
  - MACD (alt panel)
  - ADX (alt panel)
  - OBV (alt panel)
  - Stochastic, ATR (opsiyonel)
- [ ] **Zaman dilimleri:** 5m / 15m / 1h / 1d / 1w (butonlar)
- [ ] **Formasyon gösterimi:**
  - Bilinen mum formasyonları (Hammer, Doji vb.) → ikon ile işaretle
  - Grafik hareketleri (Bayrak, Flama) → renkli bölge overlay
  - Tespit edildiğinde modern tooltip ile açıkla
- [ ] **Crosshair** ile anlık fiyat/tarih bilgisi
- [ ] **Fullscreen modu**
- [ ] **Export** (PNG)

### ✅ A7-3: Grafik Motorunu Entegre Et
- [ ] `stock-analysis` sayfasına entegre et
- [ ] `watchlist` sayfasına mini sparkline olarak entegre et
- [ ] `portfolio` sayfasına mini sparkline ekle
- [ ] `featured` sayfasına entegre et
- [ ] `screener` sayfasına entegre et
- [ ] `market` sayfasına entegre et

---

## AŞAMA 8 — ADMİN PANEL GELİŞTİRME

**Mevcut admin paneli genişletilecek**

### ✅ A8-1: Admin Dashboard Güncellemesi
**Dosya:** `frontend/app/(admin)/admin/page.tsx`

- [ ] **Toplam üye sayısı** büyük göster: Free | Pro | Admin ayrımıyla
- [ ] Komuta merkezi verileri (tüm üyelerin toplam istatistikleri)
- [ ] Sistem sağlığı kartları (Gemini, Polygon, Supabase, Redis)
- [ ] Son 24 saat aktivite özeti

### ✅ A8-2: Bot Yönetimi Güncellemesi
**Dosya:** `frontend/app/(admin)/admin/bots/page.tsx`

- [ ] **swing113** botunu listeye ekle
- [ ] **money_flow_bot** botunu listeye ekle
- [ ] **news_worker** botunu listeye ekle
- [ ] **insider_worker** botunu listeye ekle
- [ ] **world_markets_worker** botunu listeye ekle
- [ ] Her bot için: Son Çalışma | Sonraki Çalışma | Durum | Log | Manuel Tetikle

### ✅ A8-3: Sayfa Yönetimi (Yeni)
**Yeni Dosya:** `frontend/app/(admin)/admin/pages/page.tsx`

Her sayfa için admin kontrol paneli:
- [ ] **Ana Sayfa:** Komuta merkezi alanı seç/gizle toggle
- [ ] **Featured:** Görünürlük ayarları (Pro only / Free 1 item)
- [ ] **Screener:** Tier limitleri ayarla (haftalık tarama sayısı)
- [ ] **İşlemler:** Tier limitleri (Free max X, Pro max Y)
- [ ] **Portföy:** Tier limitleri (portföy sayısı, hisse sayısı)
- [ ] **Takip Listesi:** Tier limitleri (takip slot sayısı)
- [ ] Her sayfa için "Aktif/Pasif" toggle

### ✅ A8-4: İşlem Yönetimi Admin
**Yeni Dosya:** `frontend/app/(admin)/admin/trades-config/page.tsx`

- [ ] Tüm kullanıcıların işlemlerini görme
- [ ] Ürün tiplerini yönetme (Hisse/ETF/Call/Put/Döviz/Oil/BTC/ETH)
- [ ] Limit konfigürasyonu

### ✅ A8-5: Backtest Linki Admin Sidebar'a
- [ ] Admin sidebar'a `/featured/backtest` linki ekle
- [ ] Middleware: bu sayfaya sadece admin erişebilir

---

## AŞAMA 9 — MOBİL & PWA

**Tüm geliştirmeler mobile-first prensiple yapılmalı**

### ✅ A9-1: Responsive Kontrol Listesi
- [ ] Dashboard → mobil single-column layout
- [ ] Sidebar → bottom tab bar (mobilde)
- [ ] HUD kartları → 2x2 grid (mobilde)
- [ ] Tablolar → horizontal scroll (mobilde)
- [ ] Grafik motoru → full-width (mobilde)
- [ ] TopBar → hamburger menu (mobilde)

### ✅ A9-2: PWA Yapılandırması
- [ ] `next.config.js`'de PWA config (next-pwa paketi)
- [ ] `manifest.json` güncelle (ikon, renk, ad)
- [ ] Service Worker offline cache
- [ ] "Ana Ekrana Ekle" prompt → TopBar'da göster
- [ ] Push notification desteği (opsiyonel, Aşama 2)

---

## AŞAMA 10 — GÜVENLİK & PERFORMANS

### ✅ A10-1: Tier Erişim Güvenlikleri
- [ ] Tüm Pro endpoint'leri `require_pro` dependency ile koru
- [ ] Featured sayfasında Free kullanıcı: sadece 1. fırsat görünür, diğerleri blur overlay
- [ ] `/featured/backtest` → `require_admin` ile koru
- [ ] Screener kredi sistemi Redis atomik DECR
- [ ] Rate limit: 100 req/dk Redis sayaçları

### ✅ A10-2: Redis Yapılandırması
- [ ] Redis key mimarisi:
  ```
  finma:movers:{tab}          → Piyasa hareketleri
  finma:news:latest           → Haberler
  finma:opportunities:latest  → swing113 fırsatları
  finma:world_markets:latest  → Dünya borsaları
  finma:money_flow:latest     → Para akışı
  finma:insider:latest        → Insider işlemler
  finma:chart:{ticker}:{tf}   → Grafik verileri
  finma:user:{id}:profile     → Kullanıcı profili cache
  finma:rate:{user_id}        → Rate limit sayacı
  ```
- [ ] Her key için uygun TTL değerleri
- [ ] Upstash Redis (production) bağlantısı

---

## UYGULAMA ÖNCELİK SIRASI

```
Önce → Sonra mantığı:

1. A0 (Hazırlık)          → Tüm aşamalar için zorunlu
2. A1-1, A1-2 (TopBar, HUD)   → Görünür değişiklik, hızlı etki
3. A1-4 (Piyasa Hareketleri)  → Kritik UI değişikliği
4. A2-2 (/news pipeline)      → Çalışmayan kısım düzeltmesi
5. A3 (Featured/swing113)     → Para kazandıran kısım
6. A4 (Trades/Portfolio)      → Üye deneyimi
7. A5 (Smart Watchlist)       → Yeni özellik
8. A6 (Screener)              → Büyük yeni özellik
9. A7 (Grafik Motoru)         → En büyük teknik çalışma
10. A8 (Admin)                → Yönetim
11. A9 (Mobil/PWA)            → Kaplama geliştirme
12. A10 (Güvenlik/Perf)       → Sürekli
```

---

## DOSYA DEĞİŞİKLİK HARİTASI

### Backend — Yeni Dosyalar
```
backend/bots/swing113.py                    (A0-2)
backend/bots/news_worker.py                 (A2-2)
backend/bots/insider_worker.py              (A2-3)
backend/bots/world_markets_worker.py        (A2-4)
backend/bots/money_flow_bot.py              (A1-6)
backend/app/routers/notifications.py        (A1-1)
backend/app/routers/watchlist.py            (A5-1)
backend/app/routers/screener.py             (A6-1)
backend/app/routers/charts.py               (A7-1)
backend/app/routers/portfolios.py           (A4-3 - çoklu portföy)
backend/app/services/screener_engine.py     (A6-1)
backend/app/services/chart_service.py       (A7-1)
backend/app/services/pattern_detector.py    (A7-1)
```

### Backend — Değiştirilecek Dosyalar
```
backend/app/main.py                         (yeni router ekle, yeni botlar)
backend/app/routers/market.py               (movers endpoint güncelle)
backend/app/routers/portfolio.py            (limit kontrolleri, çoklu portföy)
backend/app/routers/signals.py              (swing113 ekle)
backend/app/services/bot_runner.py          (yeni botlar)
backend/app/services/market_data.py         (RSS kaldır, Polygon news)
backend/app/database.py                     (yeni tablolar için CRUD)
backend/supabase_migration.sql              (yeni tablolar)
```

### Frontend — Yeni Dosyalar
```
frontend/app/(terminal)/screener/page.tsx
frontend/app/(terminal)/watchlist/page.tsx
frontend/app/(terminal)/market/flow/page.tsx
frontend/app/(admin)/admin/pages/page.tsx
frontend/app/(admin)/admin/trades-config/page.tsx
frontend/components/charts/FinMAChart.tsx
frontend/components/terminal/MarketMovers.tsx
frontend/components/terminal/NotificationPanel.tsx
frontend/components/terminal/UserDropdown.tsx
frontend/hooks/useWatchlist.ts
frontend/hooks/useScreener.ts
frontend/hooks/useCharts.ts
```

### Frontend — Değiştirilecek Dosyalar
```
frontend/app/(terminal)/dashboard/page.tsx   (VIX kaldır, HUD yeniden düzen)
frontend/components/terminal/TopBar.tsx      (bildirim + üye bilgisi)
frontend/components/terminal/HUDMetrics.tsx  (admin/user split, küçültme)
frontend/components/terminal/Sidebar.tsx     (yeni menü öğeleri)
frontend/app/(terminal)/news/page.tsx        (yeni pipeline)
frontend/app/(terminal)/featured/page.tsx    (swing113 entegrasyon)
frontend/app/(terminal)/portfolio/page.tsx   (çoklu portföy, takip butonu)
frontend/app/(terminal)/trades/page.tsx      (limitler, ürün tipi)
frontend/app/(terminal)/stock-analysis/page.tsx (tablo iyileştirme)
frontend/app/(admin)/admin/bots/page.tsx     (yeni botlar)
frontend/app/(admin)/admin/page.tsx          (toplam üye, komuta)
frontend/components/terminal/Sidebar.tsx     (admin backtest link)
```

---

## KRİTİK TEKNİK NOTLAR

1. **swing113 ≠ Telegram:** swing113 çıktısı ASLA Telegram'a gitmeyecek
2. **Featured erişim:** Pro = tümünü görür; Free = sadece rank 1 görür (blur overlay)
3. **Backtest sayfası:** Sadece admin menüsünde, sadece admin erişir
4. **Grafik motoru:** TradingView widget kaldırılacak, kendi `lightweight-charts` motoru
5. **Redis zorunlu:** Tüm saat-başı güncellenen veriler Redis'ten gelecek (< 50ms)
6. **Çoklu portföy:** Mevcut `portfolio` tablosu ve `trades` tablosu birbirinden ayrılacak
7. **Screener kredileri:** Redis atomik DECR ile thread-safe kredi düşümü
8. **Formasyon detection:** Python `pandas-ta` veya manuel kurallarla tespit

---

## TOPLAM GÖREV SAYISI: ~180 alt görev
## TAHMİNİ FAZA BÖLÜNMÜŞ ÇALIŞMA: 10 aşama
