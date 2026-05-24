# 📊 Ichimoku Kinko Hyo — Kapsamlı Teknik Analiz Rehberi

**Hazırlayan:** BOGA AI Analiz Modülü  
**Tarih:** 23 Mayıs 2026  
**Kapsam:** Bileşen mimarisi · Zaman dilimi optimizasyonu · Forecast kumo · Sinyal kataloğu · Uygulama stratejileri

---

## 1. İndikatörün Kökeni ve Felsefesi

Goichi Hosoda (Ichimoku Sanjin), 1930'larda Japonya'da gazete editörü olarak çalışırken bu sistemi geliştirdi. Yaklaşık 30 yıllık araştırmanın ardından 1969'da kamuoyuyla paylaştı. Sistemin adı Japonca'da **"tek bakışta denge grafiği"** anlamına gelir.

Standart parametre seti **(9, 26, 52)**, o dönemde altı gün çalışan Japon piyasa takviminden türetilmiştir:

| Parametre | Değer | Döngü Mantığı |
|-----------|-------|---------------|
| Tenkan periyodu | 9 | ~1,5 haftalık kısa döngü |
| Kijun periyodu | 26 | ~1 aylık (4,3 hafta) |
| Senkou Span B | 52 | ~2 aylık (8,7 hafta) |
| Displacement | 26 | Kumo'yu ileri taşıma |
| Chikou Span | 26 | Lagging span geriye taşıma |

Modern piyasalarda (5 günlük takvim) bu değerleri **(7, 22, 44)** olarak güncelleme tartışması sürmekte; ancak kurumsal analistlerin büyük çoğunluğu orijinal ayarlarda kalmayı tercih etmektedir.

---

## 2. Bileşen Mimarisi

### 2.1 Tenkan-sen (転換線) — Dönüşüm Çizgisi

```
Tenkan-sen = (Son 9 mumun En Yüksek + En Düşük) / 2
```

- **Görev:** Kısa vadeli momentum göstergesi ve dinamik destek/direnç
- **Yorum:**
  - Fiyat Tenkan üzerinde → kısa vadeli yükseliş baskısı
  - Yatay seyreden Tenkan → momentum kaybı, dar bant piyasası
  - Tenkan eğimi arttıkça hareket gücü artar

### 2.2 Kijun-sen (基準線) — Standart Çizgi

```
Kijun-sen = (Son 26 mumun En Yüksek + En Düşük) / 2
```

- **Görev:** Orta vadeli denge ekseni, trend onayı
- **Yorum:**
  - Fiyatın Kijun'a "manyetik çekim" etkisi → ortalamaya dönüş güçlüdür
  - Kijun yatay → piyasa kararsız
  - Kijun eğimi netleştikçe kurumsal yön belirleniyor demektir
- **Pratik:** Stop-loss referansı olarak sıklıkla kullanılır

### 2.3 Senkou Span A (先行スパンA) — İlk Öncü Çizgi

```
Senkou Span A = (Tenkan-sen + Kijun-sen) / 2    [26 bar ileri çizilir]
```

- Bulutun hızlı tepki veren, dinamik kenarını oluşturur
- Yukarı eğim → yükseliş ivmesi kazanıyor

### 2.4 Senkou Span B (先行スパンB) — İkinci Öncü Çizgi

```
Senkou Span B = (Son 52 mumun En Yüksek + En Düşük) / 2    [26 bar ileri çizilir]
```

- Bulutun yavaş, güçlü destek/direnç duvarını oluşturur
- Uzun vadeli kurumsal hafıza seviyesi

### 2.5 Kumo (雲) — Bulut

**Span A > Span B → Yeşil/Pozitif Bulut** (yükseliş teyidi)  
**Span A < Span B → Kırmızı/Negatif Bulut** (düşüş teyidi)

| Bulut Özelliği | Anlam |
|----------------|-------|
| Kalın bulut | Güçlü destek/direnç bölgesi, kırılması zor |
| İnce bulut | Zayıf bariyer, kolayca aşılabilir |
| Büküm noktası (kumo twist) | Olası yön değişimi sinyali |
| Fiyat bulut içinde | Belirsizlik bölgesi, sinyal zayıflar |

### 2.6 Chikou Span (遅行スパン) — Gecikme Çizgisi

```
Chikou Span = Kapanış fiyatı    [26 bar geriye kaydırılır]
```

- **Yorum:**
  - Chikou mevcut fiyat barlarının **üzerinde** → güçlü boğa onayı
  - Chikou mevcut fiyat barlarının **altında** → güçlü ayı onayı
  - Chikou fiyat barlarına **dokunan** bölgeler → kritik tarihsel direnç

---

## 3. Sinyal Kataloğu

### 3.1 Tenkan-Kijun Kesişimleri (TK Cross)

| Sinyal | Koşul | Güç |
|--------|-------|-----|
| **Altın Kesişim** (güçlü) | Tenkan Kijun'u yukarı keser, fiyat bulutun üzerinde | ★★★★★ |
| **Altın Kesişim** (nötr) | Tenkan Kijun'u yukarı keser, fiyat bulutun içinde | ★★★ |
| **Altın Kesişim** (zayıf) | Tenkan Kijun'u yukarı keser, fiyat bulutun altında | ★★ |
| **Ölüm Kesişimi** (güçlü) | Tenkan Kijun'u aşağı keser, fiyat bulutun altında | ★★★★★ |

### 3.2 Kumo Kırılımları (Kumo Breakout)

- **Bullish Breakout:** Fiyat bulutun üzerine çıkar + Chikou onaylar → en güçlü trend başlangıç sinyali
- **Bearish Breakout:** Fiyat bulutun altına iner + Chikou onaylar → güçlü düşüş sinyali
- **Kumo Bounce:** Fiyat bulutun üst kenarından (Span A/B) sekme yapar → trend içi giriş

### 3.3 Chikou Span Sinyalleri

- Chikou fiyat serisi barlarını yukarı geçerse → ek boğa onayı
- Chikou kumo içinden geçiyorsa → sinyal gecikmeli ve zayıf

### 3.4 Forecast Kumo (Gelecek Bulut)

Ichimoku'nun benzersiz özelliği: Senkou Span A ve B 26 bar ileriye çizildiğinden, grafik üzerinde **henüz oluşmamış gelecek bulut** görünür.

- Yeşil forecast kumo → piyasa yükseliş bekliyor
- Kırmızı forecast kumo → piyasa düşüş bekliyor
- **Kumo twist:** Forecast bölgesinde Span A ve B'nin kesişeceği nokta → kritik yön değişim bölgesi

---

## 4. Zaman Dilimi Optimizasyonu

### 4.1 Öneri Matrisi

| Zaman Dilimi | Trading Stili | Başarı Oranı | Notlar |
|--------------|---------------|--------------|--------|
| **1W (Haftalık)** | Pozisyon trading | ★★★★★ | Kurumsal düzey, gürültüsüz |
| **1D (Günlük)** | Swing trading | ★★★★★ | Hosoda'nın orijinal tasarımı |
| **4H** | Swing / Kripto | ★★★★☆ | 7/24 piyasalar için ideal |
| **1H** | Day trading | ★★★☆☆ | Yalnızca üst zaman dilimiyle kombine |
| **15m** | Scalping | ★★☆☆☆ | Gürültü fazla, sahte sinyal artar |
| **5m** | Scalping | ★☆☆☆☆ | Önerilmez |

### 4.2 Multi-Timeframe (MTF) Analiz Çerçevesi

```
ADIM 1: Günlük (1D) grafik → Makro yönü belirle
         - Fiyat bulut üzerinde mi? → Yalnızca LONG sinyalleri değerlendir
         - Fiyat bulut altında mı? → Yalnızca SHORT sinyalleri değerlendir

ADIM 2: 4H grafik → Trend kalitesini ölç
         - Chikou konumu, Tenkan-Kijun hizası

ADIM 3: 1H grafik → Giriş tetikleyicisini bekle
         - TK cross, kumo kırılımı, kumo bounce

ADIM 4: Kijun-sen → Stop-loss referansı
ADIM 5: Forecast kumo → Hedef bölgesi tahmini
```

---

## 5. Piyasa Koşullarına Göre Ichimoku Kullanımı

### 5.1 Güçlü Trend (En İyi Senaryo)

- Fiyat bulutun üstünde / altında net konum
- Kumo genişliyor (bariyer güçleniyor)
- Chikou fiyat barlarının üstünde/altında net konumda
- Tenkan ve Kijun aynı yönde eğimli
→ **Tüm sinyaller aktif, güven yüksek**

### 5.2 Yatay/Konsolidasyon Piyasası (En Kötü Senaryo)

- Fiyat bulutun içinde veya sürekli girip çıkıyor
- Kumo ince ve yatay
- TK crosslar sürekli birbirini geçiyor
→ **İndikatörü devre dışı bırak, farklı araçlara geç (RSI divergence, Bollinger sıkışması)**

### 5.3 Trend Dönüşü Tespiti

1. Forecast kumo'da renk değişimi (twist)
2. Kijun yataylaşır ve fiyat altına iner
3. Chikou mevcut fiyatları aşağı kırar
4. Tenkan-Kijun ölüm kesişimi bulutun yakınında gerçekleşir

---

## 6. Diğer İndikatörlerle Kombinasyon

| Kombinasyon | Amaç | Etkinlik |
|-------------|------|----------|
| **Ichimoku + RSI** | Momentum aşırılıklarını filtrele | ★★★★★ |
| **Ichimoku + Hacim** | Kırılımların gerçekliğini test et | ★★★★★ |
| **Ichimoku + MACD** | Trend değişim erken uyarısı | ★★★★☆ |
| **Ichimoku + Bollinger** | Volatilite + trend | ★★★☆☆ |
| **Ichimoku + Destek/Direnç** | Güçlü yatay seviyeleri teyit et | ★★★★★ |

---

## 7. Pratik Uygulama Kuralları

### 7.1 Giriş Koşulları (Bullish)

1. ✅ Fiyat bulutun üzerinde
2. ✅ Tenkan > Kijun (veya yeni kesti)
3. ✅ Chikou fiyat barlarının üzerinde
4. ✅ Chikou bulutun üzerinde (ekstra onay)
5. ✅ Forecast kumo yeşil
6. ✅ Hacim kırılımı teyit ediyor

### 7.2 Risk Yönetimi

- **Stop-loss:** Kijun-sen altına yerleştir
- **Hedef:** Bir sonraki anlamlı direnç seviyesi veya forecast kumo'nun üst kenarı
- **Pozisyon kapatma sinyali:** Tenkan Kijun'u aşağı keser + Chikou bozulur

### 7.3 Sık Yapılan Hatalar

| Hata | Doğrusu |
|------|---------|
| Sadece TK cross'a bakmak | Bulut konumu + Chikou ile teyit şart |
| Ince kumo kırılımını güçlü saymak | Kalın kumo kırılımları çok daha değerli |
| Yatay piyasada sinyal aramak | Piyasa koşulunu önce tanımla |
| 5m-15m gibi kısa dilimde kullanmak | Minimum 1H, ideal 4H veya 1D |
| Forecast kumouyu görmezden gelmek | Gelecek beklentiyi yakalamanın tek yolu bu |

---

## 8. Özet: Ichimoku Kontrol Listesi

```
□ Fiyat konumu: Bulut üstü / içi / altı?
□ Kumo rengi: Yeşil (bullish) / Kırmızı (bearish)?
□ Kumo kalınlığı: Güçlü bariyer mi, zayıf mı?
□ Tenkan-Kijun ilişkisi: Hangisi üstte, eğimler ne yönde?
□ TK kesişimi: Son kesişim ne zaman, nerede?
□ Chikou konumu: Fiyat barlarının üstünde mi?
□ Chikou-kumo ilişkisi: Engel var mı?
□ Forecast kumo: Renk, kalınlık, twist var mı?
□ Üst zaman dilimi onayı: 1D → 4H → 1H hizası?
□ Hacim teyidi: Kırılım hacimli mi?
```

---

*Bu rehber, Ichimoku Bulutu'nu swing trading stratejisiyle birleştiren BOGA AI sistemi için hazırlanmıştır.*  
*Kaynak görsel: Ichimoku Kinko Hyo Türkçe Kullanım Kılavuzu (infografik analizi)*
