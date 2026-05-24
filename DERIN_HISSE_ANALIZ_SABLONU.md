# 📊 DERİN HİSSE ANALİZ ŞABLONU
> **Versiyon:** 2.0 | **Format:** Options Premium Harvesting + Forecast + Checklist  
> **Kullanım:** `[TICKER]` alanlarını hedef hisseyle değiştir. Tarih ve fiyat verilerini güncelle.

---

## 🧬 BÖLÜM 1 — TEMEL KİMLİK VE MİMARİ KARAKTERİSTİK (DNA)

| Alan | Değer |
|------|-------|
| **Ticker / Şirket** | `[TICKER]` / `[Şirket Adı]` |
| **Borsa / Sektör** | `[NASDAQ / NYSE]` / `[Sektör]` |
| **Analiz Tarihi** | `[GG.AA.YYYY]` |
| **Güncel Fiyat** | `$[FIYAT]` |
| **Piyasa Değeri** | `$[Xb]` |

### 🏷️ Hisse Tipi
- [ ] Momentum / Breakout
- [ ] Spekülatif / Pre-Revenue
- [ ] Temettü Odaklı / Değer
- [ ] Büyüme / Teknoloji
- [ ] Siklik / Emtia Bağlı
- [ ] Haber Duyarlı / Katalizör

> **Açıklama:** `[Örn: "Solid-state batarya geliştirme aşamasında pre-revenue spekülatif; haber akışına aşırı duyarlı"]`

### 🔄 Piyasa Davranış Modeli
```
Yükseliş Karakteri : [Örn: "Ani pump, kısa süre yüksek IV kalır, hızlı geri döner"]
Düşüş Karakteri   : [Örn: "Destek kırılırsa uzun süreli yatay konsolidasyon"]
Hacim Tepkisi     : [Örn: "Yüksek hacimli günler %5+ salınım yaratır"]
Haber Etkisi      : [Örn: "Pozitif haberle %15-30 tek günde pump, sonra %50 geri verir"]
```

### 📐 Korelasyon Katsayıları (Beta)
| Endeks | Beta (β) | Yorum |
|--------|----------|-------|
| S&P 500 | `[X.XX]` | `[Yüksek/Düşük/Negatif korelasyon]` |
| NASDAQ | `[X.XX]` | `[Teknoloji duyarlılığı]` |
| VIX | `[X.XX]` | `[Korku endeksi ile ilişki]` |
| Sektör ETF | `[X.XX]` | `[Sektör ile uyum]` |

### 💧 Likidite Endeksi
| Metrik | Değer | Değerlendirme |
|--------|-------|---------------|
| Günlük Ortalama Hacim (30G) | `[XXM]` | `[Yeterli / Yetersiz]` |
| Kurumsal Sahiplik (Inst. Float %) | `[%XX]` | `[Yüksek = istikrar, Düşük = volatil]` |
| Short Interest (%) | `[%XX]` | `[Short squeeze potansiyeli: Var/Yok]` |
| Opsiyon Bid/Ask Spread | `[%X]` | `[< %5 = likit, > %10 = riskli]` |

---

## 📈 BÖLÜM 2 — ZAMAN SERİSİ VE TEKNİK VERİ SETİ

### ⚡ Kısa Vadeli Momentum — Son 15 Gün

| Tarih | Açılış | Kapanış | Günlük % | Hacim | ATR'nin %'si | Not |
|-------|--------|---------|----------|-------|--------------|-----|
| Gün 1 | `$X.XX` | `$X.XX` | `+X.X%` | `XXM` | `X.X%` | |
| Gün 2 | | | | | | |
| Gün 3 | | | | | | |
| Gün 4 | | | | | | |
| Gün 5 | | | | | | |
| Gün 6 | | | | | | |
| Gün 7 | | | | | | |
| Gün 8 | | | | | | |
| Gün 9 | | | | | | |
| Gün 10 | | | | | | |
| Gün 11 | | | | | | |
| Gün 12 | | | | | | |
| Gün 13 | | | | | | |
| Gün 14 | | | | | | |
| Gün 15 | | | | | | |
| **Özet** | | | **Toplam: `±X%`** | **Ort: `XXM`** | **Ort ATR: `X.X%`** | |

> **ATR Yorumu:** `[Örn: "Günlük ortalama $0.45 hareket = mevcut fiyatın %5.5'i → Yüksek gün içi volatilite"]`

### 📏 Hareketli Ortalama Disiplini

| MA Periyodu | MA Değeri | Güncel Fiyat Mesafesi | Pozisyon | Yorum |
|-------------|-----------|----------------------|----------|-------|
| 7 Günlük MA | `$X.XX` | `+/- $X.XX (%X.X)` | Üstünde ✅ / Altında ❌ | |
| 21 Günlük MA | `$X.XX` | | | |
| 50 Günlük MA | `$X.XX` | | | Golden/Death Cross? |
| 200 Günlük MA | `$X.XX` | | | Uzun vadeli yön |
| 1 Yıllık Ort. | `$X.XX` | | | |
| 5 Yıllık Ort. | `$X.XX` | | | Tarihsel değerleme |

**EMA Durumu:**
```
EMA 9  : $X.XX  →  [Fiyat üstünde/altında]
EMA 20 : $X.XX  →  [Kısa vadeli trend]
EMA 50 : $X.XX  →  [Orta vadeli trend]
```

### 🧱 Destek / Direnç Dinamiği

| Seviye | Fiyat | Tür | Test Sayısı (6A) | Kırılım Hızı | Güç |
|--------|-------|-----|-----------------|-------------|-----|
| Kritik Direnç 3 | `$X.XX` | Tarihsel Tepe | `X kez` | — | ⭐⭐⭐ |
| Kritik Direnç 2 | `$X.XX` | | | | |
| Kritik Direnç 1 | `$X.XX` | Yakın Direnç | | Hızlı/Yavaş | |
| **GÜNCEL FİYAT** | **`$X.XX`** | | | | |
| Kritik Destek 1 | `$X.XX` | VWAP / EMA | | | ⭐⭐⭐ |
| Kritik Destek 2 | `$X.XX` | | | | |
| Kritik Destek 3 | `$X.XX` | 52H Dip | — | — | ⭐⭐⭐ |

> **Davranış Notu:** `[Örn: "Hisse $7.50'ı 5 kez destek olarak kullandı, her seferinde 3-5 günde tepki verdi → CSP için güvenilir seviye"]`

### 💹 Fiyat / Hacim Verimliliği

```
VWAP (7 Gün)   : $X.XX
VWAP (30 Gün)  : $X.XX
Güncel Fiyat   : $X.XX

Spot > VWAP(7G)  → Kısa vadede alıcılar hâkim ✅
Spot < VWAP(30G) → Kurumsal ortalama altında — potansiyel baskı ⚠️

RSI (14)  : XX  → [Aşırı Alım >70 / Nötr 40-60 / Aşırı Satım <30]
MACD      : [Pozitif/Negatif divergence]
Stoch RSI : XX  → [Sinyal]
BB Genişlik: [Daralıyor = kırılım yakın / Genişliyor = trend devam]
```

---

## 🔮 BÖLÜM 3 — 30 GÜNLÜK FORECAST ANALİZİ (GÜNLÜK TABLO)

> **Metodoloji:** 1H zaman dilimi son 60 günlük veri → İstatistiksel momentum + IV implied move + teknik yapı + katalizör takvimi birleştirilerek üretilir.

### 📊 İstatistiksel Temel (Girdi Parametreleri)

| Parametre | Değer | Kaynak |
|-----------|-------|--------|
| 60G Ortalama Günlük Hareket | `±$X.XX` | Tarihsel ATR |
| IV Implied 30G Hareket | `±%XX` | Opsiyon zinciri |
| 30G Olasılıklı Aralık (1 SD) | `$X.XX — $X.XX` | IV × √(30/252) |
| 30G Olasılıklı Aralık (2 SD) | `$X.XX — $X.XX` | 95% güven aralığı |
| Günlük Drift (Momentum Bias) | `+X.XX%` | Son 60G eğim |

### 📅 30 Günlük Günlük Forecast Tablosu

| Gün | Tarih | Bear Hedef | Base Hedef | Bull Hedef | IV Katalizör | Teknik Sinyal | Eylem Önerisi |
|-----|-------|-----------|-----------|-----------|-------------|--------------|---------------|
| G+1 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | — | `[EMA test / RSI dip]` | `[Bekle/Aç/Kapat]` |
| G+2 | | | | | | | |
| G+3 | | | | | | | |
| G+4 | | | | | | | |
| G+5 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | `[Haftalık opsiyon vade]` | | `[CSP / CC değerlendir]` |
| G+6 | | | | | | | |
| G+7 | | | | | | | |
| G+8 | | | | | | | |
| G+9 | | | | | | | |
| G+10 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | `[Bilanço var mı?]` | `[MA kırılımı?]` | |
| G+11 | | | | | | | |
| G+12 | | | | | | | |
| G+13 | | | | | | | |
| G+14 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | `[2 haftalık opsiyon vade]` | | `[Pozisyon yenile]` |
| G+15 | | | | | | | |
| G+16 | | | | | | | |
| G+17 | | | | | | | |
| G+18 | | | | | | | |
| G+19 | | | | | | | |
| G+20 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | `[3 haftalık opsiyon vade]` | | `[Aylık pozisyon gözden geçir]` |
| G+21 | | | | | | | |
| G+22 | | | | | | | |
| G+23 | | | | | | | |
| G+24 | | | | | | | |
| G+25 | | | | | | | |
| G+26 | | | | | | | |
| G+27 | | | | | | | |
| G+28 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | `[Aylık opsiyon vade]` | | `[Aylık kapanış değerlendir]` |
| G+29 | | | | | | | |
| G+30 | `AA/GG` | `$X.XX` | `$X.XX` | `$X.XX` | — | `[30G genel yapı]` | `[Sonraki dönem stratejisi]` |

### 🎯 30G Senaryo Özeti

| Senaryo | Hedef Fiyat | Olasılık | Tetikleyici | CSP Stratejisi |
|---------|------------|----------|-------------|----------------|
| 🐻 Bear | `$X.XX` | `%XX` | `[Negatif haber / sektör baskısı]` | Strike `$X.XX` altında tut |
| ⚖️ Base | `$X.XX` | `%XX` | `[Mevcut momentum devamı]` | Strike `$X.XX` — optimal zone |
| 🚀 Bull | `$X.XX` | `%XX` | `[Katalizör / kısa kapama]` | Strike `$X.XX` / CC aç |

### 📉 1H Grafik Analizi → 30G Forecast Metodolojisi

```
Kullanılan 1H veri penceresi : Son 60 gün = ~960 mum
Analiz Adımları:

ADIM 1 — Trend Tespit
  • EMA 20/50/100 hizalanması
  • Higher High / Lower Low yapısı
  • VWAP drift yönü

ADIM 2 — Momentum Ölçümü
  • RSI eğimi (yükselen / düşen)
  • MACD histogram değişimi
  • Volume Profile (hangi fiyat bölgesinde en çok işlem?)

ADIM 3 — Volatilite Kalibrasyon
  • Bollinger Band genişlik değişimi
  • ATR'nin 30G ortalaması
  • IV Rank ile karşılaştırma

ADIM 4 — İstatistiksel Projeksiyon
  • Günlük drift = (Son 60G kapanış ortalaması - 30G önce) / 30
  • 1 SD aralık = Spot × IV × √(DTE/252)
  • Her gün için Bear/Base/Bull bant hesabı

ADIM 5 — Katalizör Overlay
  • Bilanço tarihleri
  • Opsiyon vade tarihleri
  • Makro takvim (FOMC, CPI, vb.)
  • Şirkete özel haberler
```

---

## ⚙️ BÖLÜM 4 — OPSİYON VE YETKİNLİK MATRİSİ

### 📊 IV Analizi

| Metrik | Değer | Yorum |
|--------|-------|-------|
| IV (Güncel) | `%XX` | |
| IV Rank (52H) | `XX` | `[< 20 = ucuz, 20-50 = normal, > 50 = pahalı]` |
| IV Percentile | `%XX` | `[Son 1 yılın % kaçında bu seviyeden yüksek]` |
| HV (30G Tarihsel) | `%XX` | |
| IV/HV Oranı | `X.XX` | `[> 1.3 → prim sat, < 0.8 → opsiyon al]` |
| VIX Bağı | `[Güçlü/Zayıf]` | |

> **IV Trendi:** `[Yükseliyor / Düşüyor / Stabil]` → `[Bilanço öncesi yükselmesi beklenir / volatilite düşüşü prim erimesini hızlandırır]`

### 💰 Cash-Secured PUT (CSP) Matrisi

| Hafta | Strike | DTE | Bid | Prim Getirisi | Yıllık. Getiri | OTM Kal. % | Atanma $ | Yorum |
|-------|--------|-----|-----|--------------|----------------|------------|----------|-------|
| Hafta 1 | `$X.XX` | `X gün` | `$X.XX` | `%X.X` | `%XX.X` | `%XX` | `$X.XX/hisse` | `[OPTIMAL / İYİ / BEKLE]` |
| Hafta 2 | `$X.XX` | | | | | | | |
| Hafta 3 | `$X.XX` | | | | | | | |
| Aylık | `$X.XX` | `~30 gün` | | | | | | |

**CSP Kural Seti:**
```
✅ Aç  : IV Rank > 30 + Güçlü destek seviyesinde strike + Bilanço > 14 gün uzakta
⚡ İzle : IV Rank 20-30 arası + Fiyat MA üstünde ama destek belirsiz
❌ Bekle: IV Rank < 20 + Bilanço < 14 gün + Sektör zayıf
🛑 Kapat: Prim %50 eridi (erken çıkış) veya 2x prim kayıplandı (stop)
```

### 📞 Covered CALL (CC) Matrisi

| Hafta | Strike | DTE | Bid | CC Getirisi | Yıllık. Getiri | Kullan. % | Tepe Getiri | Yorum |
|-------|--------|-----|-----|------------|----------------|----------|-------------|-------|
| Hafta 1 | `$X.XX` | `X gün` | `$X.XX` | `%X.X` | `%XX.X` | `%XX` | `$X.XX + $X.XX` | |
| Hafta 2 | | | | | | | | |
| Aylık | | | | | | | | |

**Toplam Pasif Gelir Hesabı (Yıllık):**
```
Temettü Verimi      : %X.X (varsa)
Aylık CC Getirisi   : %X.X → Yıllık: %XX
Aylık CSP Getirisi  : %X.X → Yıllık: %XX
──────────────────────────────────────
Tahmini Yıllık Top. : %XX — %XX
```

### ⚠️ Atanma (Assignment) Risk Analizi

```
CSP Atanma Senaryosu:
  Strike          : $X.XX
  Alınan Prim     : $X.XX
  Efektif Maliyet : $X.XX (Strike - Prim)
  Güncel Fiyat    : $X.XX
  Kâra Geçiş      : Fiyat $X.XX üzerine çıkarsa kâr
  
  Pozisyon Stratejisi Atanma Sonrası:
  → Hisse elimde kalırsa: CC stratejisine geç ($X.XX strike, X hafta DTE)
  → CC priminden haftalık $X.XX topla
  → Atanma fiyatına geri dönüş süresi tahmini: X-XX hafta
```

---

## 🏛️ BÖLÜM 5 — MAKRO VE OPERASYONEL TETİKLEYİCİLER

### 📋 Bilanço Tepki Profili (Son 4 Çeyrek)

| Çeyrek | Beklenti | Gerçek | Sürpriz % | Hisse Tepkisi | Haber Öncesi Yapı | Alınacak Ders |
|--------|----------|--------|-----------|--------------|-------------------|---------------|
| Q1 2026 | `EPS: -$X.XX` | `EPS: -$X.XX` | `+/-%XX` | `+/-XX% (X gün)` | `[Yükseliyordu/Düşüyordu]` | |
| Q4 2025 | | | | | | |
| Q3 2025 | | | | | | |
| Q2 2025 | | | | | | |

> **Beklenti Davranışı:** `[Örn: "Son 3 çeyrekte şirket beklentiyi 'satın aldı' — bilanço öncesi yükselip sonra %10-15 düştü → bilanço öncesi CSP AÇMA"]`

**Sonraki Bilanço:** `[Tarih]` → `[X gün kaldı]` → Strateji: `[Bekle / Poz. Kapat]`

### 💸 Temettü Döngüsü (Varsa)

```
Yıllık Temettü     : $X.XX / hisse
Temettü Verimi     : %X.X
Ex-Dividend Tarihi : [GG.AA.YYYY]
Ödeme Tarihi       : [GG.AA.YYYY]

Ex-Div Öncesi Davranış  : [Örn: "10 gün öncesinden ortalama +%3 yükselme"]
Ex-Div Sonrası Düzeltme : [Örn: "Temettü miktarı kadar (-$X.XX) düzeltme, X günde kapanıyor"]

CSP Stratejisi: Ex-Div tarihinden X gün önce, temettü artı primleri hedefleyerek CSP aç.
```

### 🏢 Insider & Kurumsal Akış (Son 90 Gün)

| Tarih | İşlem Yapan | Pozisyon | Alım/Satım | Miktar | Fiyat | Toplam $ | Yorum |
|-------|-------------|----------|------------|--------|-------|----------|-------|
| `AA.GG` | `[İsim]` | `[CEO/CFO/Dir.]` | `[Alım/Satım]` | `[X hisse]` | `$X.XX` | `$XXX,XXX` | `[Açık piyasa / Plan]` |
| | | | | | | | |

**Kurumsal Pozisyon Değişimleri (13F):**
```
BlackRock  : [Artış/Azalış/Sabit] — [X,XXX,XXX hisse] — Son değişim: [tarih]
Vanguard   : [Artış/Azalış/Sabit] — ...
Fidelity   : ...
[Büyük Fon]: ...

Genel Kurumsal Akış : [Net Alıcı / Net Satıcı] → [Yorumu]
```

### 💵 Nakit Akışı ve Bilanço Sağlığı

```
Serbest Nakit Akışı (FCF TTM) : $[X]M / $[X]B
FCF Verimi                    : %X.X
Net Nakit / Borç              : $[X]M nakit — $[X]M borç = Net [nakit/borç]
Cash Burn Rate (aylık)        : $[X]M (Pre-revenue şirketler için kritik)
Çalışma Kapasitesi            : [X yıl / ay çalışabilir]

Fiyat Desteği: [Örn: "Bilanço başına $3.20 nakit var, fiyatın %40'ı nakit → aşırı satımlarda zemin güçlü"]
```

---

## 📋 HİSSE İNCELEME ÇEK LİSTESİ

> Tarama sonrası her hisse için doldur. **✅ Evet / ❌ Hayır / 🔍 Analiz Edilmeli**

### 🔵 TREND & YAPI KONTROLLERİ
| # | Kontrol | Sonuç | Notlar |
|---|---------|-------|--------|
| 1 | 1W grafikte 50G MA üzerinde mi? | `[✅/❌/🔍]` | |
| 2 | EMA 20 > EMA 50 (Golden Cross)? | `[✅/❌/🔍]` | |
| 3 | Son 2 haftada Higher High & Higher Low yapısı var mı? | `[✅/❌/🔍]` | |
| 4 | Hacim trend yönünde artıyor mu? | `[✅/❌/🔍]` | |
| 5 | VWAP (30G) üzerinde mi? | `[✅/❌/🔍]` | |

### 🟡 VOLATİLİTE & PRİM KONTROLLERİ
| # | Kontrol | Sonuç | Notlar |
|---|---------|-------|--------|
| 6 | IV Rank > 30? (Prim toplamaya uygun) | `[✅/❌/🔍]` | IV Rank: `[XX]` |
| 7 | IV/HV Oranı > 1.2? (IV pahalı → sat) | `[✅/❌/🔍]` | |
| 8 | Opsiyon Bid/Ask spread < %5? | `[✅/❌/🔍]` | |
| 9 | Yeterli açık pozisyon (OI) var mı? | `[✅/❌/🔍]` | |

### 🟢 STRATEJİK UYGUNLUK KONTROLLERİ
| # | Kontrol | Sonuç | Notlar |
|---|---------|-------|--------|
| 10 | Bilanço 15 günden uzakta mı? | `[✅/❌/🔍]` | Bilanço: `[tarih]` |
| 11 | Sektör endeksi yükseliş trendinde mi? | `[✅/❌/🔍]` | |
| 12 | Güncel fiyat 1Y güçlü destek üzerinde mi? | `[✅/❌/🔍]` | Destek: `$[X.XX]` |
| 13 | Insider satışı fiyatı baskılıyor mu? (Hayır = iyi) | `[✅/❌/🔍]` | |
| 14 | **"Hisse elimde kalsa 1 ay bekler miyim?"** → EVET mi? | `[✅/❌]` | CSP için ZORUNLU |
| 15 | CSP atanma fiyatı savunulabilir maliyet mi? | `[✅/❌/🔍]` | Efektif: `$[X.XX]` |

### 🔴 RİSK KONTROLLERİ
| # | Kontrol | Sonuç | Notlar |
|---|---------|-------|--------|
| 16 | Pozisyon portföyün max %5'i içinde mi? | `[✅/❌]` | |
| 17 | Stop-loss seviyesi belirlendi mi? | `[✅/❌]` | Stop: `$[X.XX]` |
| 18 | Katalizör takvimi kontrol edildi mi? | `[✅/❌]` | |
| 19 | Makro risk (FOMC, CPI) değerlendirildi mi? | `[✅/❌/🔍]` | |
| 20 | Bu pozisyon için "worst case" senaryosu yazıldı mı? | `[✅/❌]` | |

---

## 🗓️ HAFTALIK PRİM HASAT TAKVİMİ

| Hafta | Strateji | Strike | DTE | Tahmini Prim | Yıll. Getiri | Durum | Notlar |
|-------|----------|--------|-----|-------------|-------------|-------|--------|
| Hafta 1 | Cash-Secured PUT | `$X.XX` | `X gün` | `$X.XX` | `%XX` | `[AÇ / BEKLE / KAPAT]` | |
| Hafta 2 | Cash-Secured PUT | `$X.XX` | | | | | |
| Hafta 3 | Covered CALL | `$X.XX` | | | | `[Atandıysa]` | |
| Hafta 4 | CSP veya CC | `$X.XX` | | | | | |
| **Aylık Toplam** | | | | **`$X.XX`** | **`%XX`** | | |

---

## ⚙️ EVRENSEL FORMÜLASYON (TÜM HİSSELER İÇİN)

### 📐 Strike Seçim Formülü

```
CSP İdeal Strike  = Güçlü Destek × (1 - 0.02)
                  [Güçlü destek bölgesinin hemen altı, ek %2 tampon]

CC İdeal Strike   = Kritik Direnç × (1 + 0.01)  
                  [Kritik direnç biraz üstü, geçme ihtimali düşük]

Delta Filtresi    : CSP için Δ 0.20-0.30 (OTM, güvenli)
                  CC için  Δ 0.25-0.35 (OTM ama iyi prim)
```

### ⏱️ DTE Seçim Formülü

```
Theta Decay Kuralı:
  DTE 45 → 21 gün  : Theta artışı hızlanır → EN VERİMLİ BÖLGE
  DTE 21 → 7 gün   : Gamma riski artar, dikkatli ol
  DTE < 7 gün      : Yalnızca deneyimli için (haftalık plays)

Öneri: 14-21 DTE ile aç, 7-10 DTE'ye gelince %50 kâr alarak kapat.
Kalanı tutarsan Gamma riskini kucaklarsın.
```

### 📊 IV Rank ile Pozisyon Kararı

```
IV Rank > 50  → Agresif prim sat (her iki strateji de aç)
IV Rank 30-50 → Normal prim sat (CSP ağırlıklı)
IV Rank 20-30 → Seçici ol, sadece mükemmel setupta aç
IV Rank < 20  → SAT KAÇIN — primler değmez, IV artışı bekle

Bilanço öncesi IV spike'ı:
  → Bilanço'dan 2 hafta önce IV yükselir → CSP primini maksimize et
  → Bilanço'dan 3-5 gün önce KAPAT (IV crush riski)
```

### 💰 Kâr Alma ve Stop-Loss Kuralları

```
KÂR ALMA:
  Seçenek A (Hızlı): Prim %50 eriyince kapat → Günler içinde olabilir
  Seçenek B (Standart): 21 DTE'ye gelince değerlendir
  Seçenek C (Theta): Vadeye kadar tut (yalnızca çok güvenli setuplar)

STOP-LOSS:
  CSP stop  = Aldığın primin 2x'i
  Örn: $0.20 prim aldıysan, $0.40'a gelince kapat
  
  Alternatif: Strike seviyesinin %5 altı kırılırsa KAPAT
  Örn: $7.50 strike için $7.13 kırılırsa pozisyonu kapat

PORTFÖY RİSK KURALI:
  Tek pozisyon max = Toplam portföyün %5'i
  Aynı sektörde max = Toplam portföyün %15'i
  Açık pozisyon sayısı = Max 5-7 (yönetilebilir)
```

### 🔁 Wheel Stratejisi Döngüsü

```
WHEEL (Çark) STRATEJİSİ:

     [1. CSP SAT]
          ↓
    Prim alındı. 
    İki olasılık:
          ↓                    ↓
   [ATANMADI]           [ATANDI]
   Prim kâr.         Hisse alındı.
   Tekrar CSP.             ↓
                    [2. CC SAT]
                          ↓
                    Prim alındı.
                    İki olasılık:
                          ↓              ↓
                   [KULLANILMADI]  [KULLANILDI]
                   Tekrar CC.      Hisse satıldı.
                                   Tekrar CSP'ye dön. →
```

---

## 📝 SONUÇ VE KARAR ÖZETİ

| Alan | Değer |
|------|-------|
| **Genel Puan (1-10)** | `[X.X / 10]` |
| **CSP Uygunluğu** | `[✅ GÜÇLÜ / ⚠️ ORTA / ❌ ZAYIF]` |
| **CC Uygunluğu** | `[✅ GÜÇLÜ / ⚠️ ORTA / ❌ ZAYIF]` |
| **Önümüzdeki 30G Görünüm** | `[YUKSELIŞ / YATAY / DÜŞÜŞ]` |
| **En İyi CSP Setup'ı** | `Strike $X.XX, DTE X gün, Prim $X.XX` |
| **En İyi CC Setup'ı** | `Strike $X.XX, DTE X gün, Prim $X.XX` |
| **Kritik Risk** | `[Bilanço tarihi / Makro / Haber]` |
| **Öneri** | `[Pozisyon aç / Bekle / Kaçın]` |

---

> **⚠️ YASAL UYARI:** Bu şablon yalnızca eğitim ve kişisel analiz amaçlıdır. Yatırım tavsiyesi değildir. Tüm opsiyon stratejileri risk içerir. Kendi araştırmanı yap, profesyonel danışmanlık al.

---
*Şablon Versiyonu: 2.0 | Son Güncelleme: Mayıs 2026*
