# SPY Engine — İşlem Açılma (Giriş) Kuralları (v2.15)

Kaynak: `frontend/lib/spyengine/tracker.ts` · giriş bloğu ve `TRACK_CFG`. Çıkış kuralları: `docs/SPY_ENGINE_EXIT_RULES.md`.
Motor yalnız **kapanmış** mumlara bakar; giriş her zaman bir 5m mumun kapanışında, kapanış fiyatından oluşur.

## 1. Zaman ve durum
- Giriş penceresi **09:45 – 15:00 ET** (ilk 15m kapanışından sonra).
- Açık tam pozisyon yokken aranır; 1R sonrası taşınan yarılar yeni girişi engellemez. Günde en fazla 8 işlem.

## 2. Ana yön: kapanmış 15m mum (kesin kapı)
- **PUT:** son kapanmış 15m mumun kapanışı 15m VWAP'ın VE 15m EMA20'nin altında. **CALL:** ikisinin de üstünde.
- Kapanış VWAP'tan en az **0,1 × ATR15** uzakta olmalı; yakınsa "NET DEĞİL" → işlem aranmaz.
- VWAP ile EMA20 arasında kapanış → belirsiz → giriş yok.
- "15m" her yerde **kapanmış** 15m mumu demektir; oluşan 15m mumu hiçbir kararda kullanılmaz.

## 3. 5m tetik (hepsi birlikte, 5m mum kapanışında)
1. **VWAP:** 5m kapanış VWAP'ın doğru tarafında.
2. **EMA20:** 5m kapanış 5m EMA20'nin doğru tarafında.
3. **Hacim ya da formasyon (en az biri):**
   - **Hacim** = mum **yön renginde** (PUT kırmızı, CALL yeşil) **VE saat-normalize RVOL ≥ 1**. RVOL = mumun hacmi ÷ son 20 işlem gününün **aynı 5 dakikalık dilimindeki medyan** hacmi. Açılışın yüksek, öğlenin düşük hacmi böylece eşitlenir.
   - **Formasyon** = tanınan mum formasyonu yönde (doji/inside bar hariç) ya da gövde ≥ %50 ve kapanış aralığın yön tarafındaki %35'te.
4. **Taze tetik (biri):**
   - 5m hizası (VWAP+EMA20'nin aynı tarafı) bu mumda oluştu, **veya**
   - son 3 mumdan biri EMA20 ya da VWAP'a değdi/0,25 × ATR5 yaklaştı (**geri çekilme**), **veya**
   - **trend devamı kırılımı:** kapanış son 4 mumun dibinin altında/tepesinin üstünde ve önceki mum ters yönde formasyon vermemiş.
5. **Kapanış konumu:** giriş mumunun kapanışı aralığın yön ucundaki **%30**'da (PUT dibe, CALL tepeye yakın).

## 4. Zayıf 15m teyidinde ek bekleme (zaman aşımı sabit)
15m mum yöne ters renkte ya da aralığının ters yarısında kapandıysa tetik mumunda girilmez:
- Tetikten sonraki **ilk 2 ardışık 5m kapanış** teyit vermeli: her biri öncekinin yön tarafında ve VWAP+EMA20 doğru tarafta.
- Bu iki mumdan **herhangi biri** teyit vermezse tetik **o anda İPTAL** olur. Bekleme en çok 2 mum (10 dk) sürer, uzamaz.

## 5. Kontrat sayısı = sabit dolar riski
- **kontrat = işlem başı risk ÷ (stop mesafesi × Δ0,45 × 100)**, aşağı yuvarlanır, en az 1, en çok 20.
- İşlem başı risk sayfadaki **"risk $"** kutusundan ayarlanır (varsayılan $200, tarayıcıda hatırlanır).
- **Düşük hacimli sinyalde** (RVOL < 0,7) risk **×0,5**.
- Momentum kontrat sayısını **artırmaz**.
- Δ0,45 sabit bir yaklaşımdır (önerilen ≈ATM 0DTE). Gerçek delta ve prim saatle değişir; gerçek riski kontrat fiyatıyla kontrol et.
- "Dikkat" notları girişi engellemez: RVOL < 0,5, VWAP çevresinde 4+ kesişme, VWAP–POC bölgesi, stop > 1 × ATR15. Cuma notu da engellemez.

## 6. Eleştirilerin değerlendirmesi (45 seans, v2.13 tabanı: 151 işlem %58 +37,5R)
| Eleştiri | Ölçüm | Karar |
|---|---|---|
| "Hacim çubuğu yönde" belirsiz | yön rengi + saat-normalize RVOL ≥ 1: 147 işlem %59 **+40,0R**, 3 dönem 3,4/30,4/6,2 (üçü de iyileşti) · RVOL ≥ 0,8: +35,5R | **Uygulandı** |
| RVOL saat bazlı normalize olmalı | Zaten öyleydi (son 20 günün aynı 5 dk dilimi, medyan). Artık hacim tanımında da kullanılıyor | Doğrulandı + genişletildi |
| Koşullar aynı şeyi ölçüyor | Tek tek çıkarma: RSI teyidi −0,1R (katkısız) · 5m EMA20 +0,9R (katkısız, 1. dönem kötüleşiyor) · hacim/formasyon −3,8R · kapanış konumu −11,7R | **RSI teyidi kaldırıldı**, EMA20 kaldı, diğerleri kaldı |
| "Son 4 mum kırılımı" çok gevşek, VWAP mesafe sınırı koy | Sınır ≤1 / 1,5 / 2 / 3 ATR15: +24,0 / +26,5 / +33,5 / +37,2R · tazelik kapalı: +24,0R | **Reddedildi**: uzamış görünen kırılım girişleri veride kârlı |
| Kural 4'te zaman aşımı yok | Kodda zaten 2 ardışık mum; ilk başarısız kapanışta iptal | Doküman netleştirildi |
| Kırılım yolunda zamanlama çelişkisi | Doğru: yol yalnız kırılım mumu 15m bloğunun 2. mumuysa tetiklenebiliyordu. v2.13 kurallarıyla tek bir ayrı işlem üretmedi (açık / kapalı / 3 mum bekleme aynı sonuç) | **Yol kapatıldı** |
| Momentumla kontrat artırmak riskli | 4 kontrat girişleri 0,23R/işlem, 2 kontrat 0,87R. 1 kontratın 1R riski $16–185 (11 kat) | Momentum boyutu kaldırıldı |
| Kontrat sayısı risk ölçüsü değil | $ bazında, getiri ÷ ortalama risk: momentum boyutu **23,8R** (düşüş 10,7R) · sabit 2 kontrat 25,2R · sabit risk **40,9R** (9,2R) · sabit risk + düşük hacim ×0,5 **44,4R** (8,7R) | **Sabit risk + düşük hacim ×0,5 uygulandı** |
| VWAP eğimi büyük fark yaratır | Eğim şartı (3 / 6 / 12 mum): +25,1 / +25,5 / +21,0R | **Reddedildi**: VWAP+EMA20 kapısı eğimi zaten içeriyor |

## 7. Kapalı / seçilmeyen giriş seçenekleri
| Ayar | Durum | Sonuç |
|---|---|---|
| `mixedEntry` (VWAP–EMA20 arasında giriş) | kapalı | +8,5…+18,1R |
| `brkRvol` (sert kırılım yolu) | kapalı (v2.15) | ayrı işlem üretmiyor |
| `useTiebreak` (RVOL+RSI belirsizlik teyidi) | kapalı (v2.15) | katkı −0,1R |
| `vwapSlopeBars` (VWAP eğimi) | kapalı | +21–25,5R |
| `freshBreakMaxVwapAtr15` (kırılım mesafe sınırı) | kapalı | +24–37,2R |
| `closePosBrkBypass` / `closePosBypassRvol` | kapalı | v2.14: +32,5R |
| `regimeEntry` (EMA20×VWAP rejimi) | kapalı | "require" +12,2R; boyut artık riskten |
| `sizeMode: "momentum"` (eski boyut) | kapalı | getiri/risk 23,8R |
| 1m tetik filtreleri | kullanılmıyor | 22 seansta belirgin katkı yok |

## 8. Özet (v2.15, 45 seans)
147 işlem (≈ 3,3/gün) · %59 kazanç · +39,9R · 3 dönem +3,3 / +30,4 / +6,2R.
Ayarlar aynı 45 günde seçildi; canlı sonuçlarla karşılaştırılmalı.
