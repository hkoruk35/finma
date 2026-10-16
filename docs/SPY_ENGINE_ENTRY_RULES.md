# SPY Engine — İşlem Açılma (Giriş) Kuralları (v2.13)

Kaynak: `frontend/lib/spyengine/tracker.ts` · giriş bloğu (≈ satır 960–1090) ve `TRACK_CFG`. Çıkış kuralları: `docs/SPY_ENGINE_EXIT_RULES.md`.
Motor yalnız **kapanmış** mumlara bakar; giriş her zaman bir 5m mumun kapanışında, kapanış fiyatından oluşur. Mum oluşurken işlem açılmaz.

## 1. Zaman ve durum şartları
- Giriş penceresi: **09:45 – 15:00 ET** (`firstEntry` 09:45 = ilk 15m kapanışı, `lastEntry` 15:00). Son 5 dk'da mum kapanışı 15:00'i aşıyorsa giriş yok.
- **Açık tam pozisyon yoksa** giriş aranır. 1R sonrası taşınan yarılar yeni girişi engellemez (`runnerParallel`).
- Günde en fazla **8** işlem (`maxTrades`, pratikte sınırsız).
- Eksik veri (VWAP/EMA20 hesaplanamıyor) ise yön 0 sayılır, giriş yok.

## 2. Ana yön: 15m teyidi (kesin kapı)
Son kapanmış 15m mumun kapanışı için:
- **Aşağı yön (PUT):** kapanış 15m VWAP'ın VE 15m EMA20'nin altında. **Yukarı (CALL):** ikisinin de üstünde.
- Kapanış VWAP'tan en az **0,1 × ATR15** uzakta olmalı ("net kapanış", `net15Atr`). Yakınsa 15m **"NET DEĞİL"** sayılır ve işlem aranmaz.
- Kapanış VWAP ile EMA20 arasındaysa yön **belirsiz**: normal tetikle giriş yok (`mixedEntry` kapalı). Tek istisna: sert hacimli kırılım yolu (bölüm 6).
- Tetik yönü her zaman 15m yönüdür; 5m tek başına ters yönde işlem açtırmaz.

## 3. 5m tetik (hepsi birlikte)
Tetik yönü d için, o 5m mumun kapanışında:
1. **VWAP:** 5m kapanış VWAP'ın doğru tarafında (PUT altında, CALL üstünde).
2. **EMA20:** 5m kapanış 5m EMA20'nin doğru tarafında.
3. **Hacim ya da formasyon (en az biri):**
   - hacim çubuğu: mum hacmi ≥ önceki 3 mumun ortalaması ve mum yönde (`volLookback` 3, `volK` 1,0), **veya**
   - mum formasyonu yönde: tanınan formasyon (doji/inside bar hariç) ya da gövde ≥ %50 ve kapanış aralığın ≥ %65'inde yön tarafında (`candleBody` 50, `candleClosePos` 65).
   - Hacim ya da formasyon tersi yönde değilse ve ikisi de yönsüzse **belirsizlik teyidi**: RVOL ≥ 1,0 VE 15m RSI yönde (yükselen > 50 / düşen < 50).
4. **Taze tetik (aşağıdakilerden biri):**
   - 5m hizası (VWAP+EMA20'nin aynı tarafı) bu mumda oluştu (önceki mum aynı tarafta değildi), **veya**
   - son 3 mumdan biri EMA20 ya da VWAP'a değdi/yaklaştı (0,25 × ATR5 içinde) = geri çekilme, **veya**
   - **trend devamı kırılımı:** 5m kapanış son **4** mumun dibinin altında (PUT) / tepesinin üstünde (CALL), ve önceki 5m mum ters yönde formasyon vermemişse (`freshBreakBars` 4, `freshBreakPrevCandle`).
5. **Kapanış konumu:** giriş mumunun kapanışı aralığın yön ucundaki **%30**'da: PUT'ta dibe, CALL'da tepeye yakın (`entryClosePos` 70). Ortada ya da ters uçta kapanırsa giriş yok.

## 4. Zayıf 15m teyidinde ek bekleme
15m mumun kendisi yöne ters renkte ya da aralığının ters yarısında kapandıysa (örn. 15m kapanış VWAP altında ama mum yeşil) tetik mumunda **girilmez**:
- Ardışık **2 5m kapanış** gerekir (`confirmBars` 2): her biri öncekinin yön tarafında kapanmalı ve VWAP+EMA20 doğru tarafta kalmalı.
- Teyit gelmezse tetik **İPTAL** edilir. 2. teyitten sonra giriş son kapanıştan açılır.

## 5. Giriş sonrası: stop, hedef, kontrat
- Stop/hedef: bkz. `SPY_ENGINE_EXIT_RULES.md` (stop = son 2 mumun ucu ∓ tampon, H1 = +1R).
- **Kontrat önerisi:** RVOL (5m, medyan tabanlı) < 0,7 ise **1 kontrat**. Aksi halde taban 2; her momentum işareti +1 (en çok 4): hacim+formasyon birlikte, RVOL ≥ 1,5, aynı yönde kârdaki taşınan pozisyon, 30 dk itki ≥ 2, gün içi yeni dip/tepe, **5m EMA20 VWAP'ın giriş yönünde olması (trend rejimi)**.
- "Dikkat" notları girişi engellemez: RVOL < 0,5, VWAP çevresinde 4+ kesişme, VWAP–POC bölgesi, stop > 1 × ATR15, veri günü.
- Cuma günleri uyarılara "mübarek Cuma… gerekmedikçe işlem açma" notu eklenir (engellemez).

## 6. Sert hacimli kırılım yolu (15m belirsizken)
15m kapanış VWAP–EMA20 arasında/net değilken tek giriş yolu:
1. 5m mum VWAP+EMA20'nin kırılım yönünde kapandı, hacim çubuğu yönde, **RVOL ≥ 1,5**, mum yönde → o mumda giriş **yok**, "HAZIR" uyarısı.
2. Sonraki **1** 5m kapanış: kırılım mumunun ortasının ötesinde, VWAP+EMA20 doğru tarafta, **RVOL ≥ 1,0** VE bu arada **15m yön teyidi gelmişse** (net, bölüm 2) giriş.
3. Şartlardan biri bozulursa tetik İPTAL.
Bu yolda da kapanış konumu şartı (bölüm 3.5) geçerlidir.

## 7. Kapalı / seçilmeyen giriş seçenekleri
| Ayar | Durum | Neden |
|---|---|---|
| `mixedEntry` (VWAP–EMA20 arasında giriş) | kapalı | 45 seans +8,5…+18,1R, ana kurallara göre düşük |
| `fresh15Bars` (15m dönüşte taze sayma) | kapalı | +14,9R |
| `closePosBrkBypass` / `closePosBypassRvol` (kapanış konumu istisnaları) | kapalı | v2.14 denendi: +32,5R, kullanıcı v2.13'ü seçti (+37,5R) |
| `regimeEntry: "require"` (yalnız EMA20×VWAP rejim yönünde giriş) | kapalı | 127 işlem +12,2R |
| `confirmAll` (her tetikte teyit) | kapalı | 63 işlem +12,5R |
| `freshBreakConfirm` (kırılımda hacim/formasyon şartı) | kapalı | +17,2R / +20,7R |
| 1m tetik filtreleri | kullanılmıyor | 22 seansta belirgin katkı yok |

## 8. 45 seans özeti (v2.13)
151 işlem (≈ 3,4/gün) · %58 kazanç · +37,5R · 3 dönem +2,4 / +29,4 / +5,7R · kontrat ağırlıklı 117.
Ayarlar aynı 45 günde seçildi; canlı sonuçlarla karşılaştırılmalı.
