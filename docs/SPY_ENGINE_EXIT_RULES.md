# SPY Engine — İşlem Kapanış (Çıkış) Kuralları (v2.13)

Kaynak: `frontend/lib/spyengine/tracker.ts` · `manage()` fonksiyonu (≈ satır 849) ve `TRACK_CFG` ayarları.
Her 5m mum için çalışır; mumun tepe/dip değerleri (fitil) stop ve hedef kontrolünde kullanılır, 15m kontrolleri yalnız 15m kapanışında yapılır.

## 1. Giriş stopu (hesaplanış)
- CALL: son **2** 5m mumun en düşüğü − (0,03 + 0,1 × ATR15) · PUT: son 2 mumun en yükseği + aynı tampon (`stopBars` 2, `stopPad` 0,03, `stopBufAtr15` 0,1).
- Stop mesafesi en az 0,5 × ATR5 ve en az 0,30 puan olur (`minStopAtr5`, `minStopPts`).
- 1R = giriş ile stop arası mesafe (R). Hedefler: **H1 = +1R**, **H2 = +2R** (ya da sıradaki seviye).

## 2. Aşama 1 — 1R'ye ulaşmadan (tam pozisyon açık)
Kontrol sırası (aynı mumda ilk sağlanan geçerli olur):
1. **STOP** — mumun fitili stopa değerse stop fiyatından kapanır (−1R).
2. **1R hedefi** — mumun fitili 1R'ye değerse: **yarısı kapanır** (4 kontratta 2, 3 kontratta 2, 2 kontratta 1), **stop girişe çekilir**. Pozisyonun kalan yarısı "taşınan yarı" olur.
3. **TREND_FLIP** — 15m yön teyidi pozisyonun tersine dönerse (15m kapanış VWAP+EMA20'nin ters tarafında, net) 5m kapanış fiyatından tamamı kapanır (`exitOn15Flip`).
4. **TIME** — kapalı (`timeStopBars` = 0).

## 3. Aşama 2 — 1R sonrası taşınan yarı
Kontrol sırası:
1. **H1_BE** — stop hâlâ girişteyse ve fitil girişe değerse giriş fiyatından kapanır (yarı +1R, kalan 0R).
2. **TRAIL_15M** — stop 15m izleyen stoba taşındıysa ve fitil ona değerse o stop fiyatından kapanır.
3. **15m izleyen stop güncellemesi** — her 15m kapanışında: CALL için `15m dibi − 0,25 × ATR15`, PUT için `15m tepesi + 0,25 × ATR15`. Stop yalnız lehe yönde ilerler, geri gelmez; yeni stop 5m kapanışın doğru tarafında olmalı (`trailBufAtr15` 0,25).
4. **TREND_FLIP** — taşınan yarıda kapalı (`runnerFlip` false); yani 15m yön dönse bile yarı yalnız stopla çıkar.
5. Taşınan yarı paralel yürür (`runnerParallel`): yeni giriş açılabilir.

## 4. Gün sonu
- **FORCE_1545** — 15:45 ET'de açık kalan her pozisyon 5m kapanış fiyatından kapanır (`forceExit`).
- 15:00'ten sonra yeni giriş yok (`lastEntry` 900 dk).

## 5. Sonuç (R) hesabı
- 1R'ye ulaşmadan kapanan: tam R (örn. stop −1R).
- 1R sonrası: `0,5 × (+1R) + 0,5 × (kalanın R'si)`.
- Örnek: yarı +1R'de, kalan 15m stopta +1,1R → +1,05R.

## 6. Kapalı / denenmiş ama seçilmeyen çıkışlar
| Ayar | Durum | Neden |
|---|---|---|
| `trailOnClose` (stop 5m kapanışta tetiklensin) | kapalı | 45 seans +18,4R (fitil stopu +22,0R) |
| `runnerEma` (rejimde EMA20 kapanışıyla taşı) | kapalı | 45 seans +23,5–24,3R (15m izleyen stop +25,8R) |
| `runnerFlip` (taşınan yarı 15m dönüşte kapansın) | kapalı | önceki testlerde sonucu düşürdü |
| `timeStopBars` (süre stopu) | kapalı | önceki testlerde fayda yok |
| `exitMode: "full"/"half"/"trail"` | kullanılmıyor | `half15` en iyi sonuç verdi |

## 7. Görülen çıkış nedenleri
`STOP` · `H1_BE` · `TRAIL_15M` · `TREND_FLIP` · `FORCE_1545` (ayrıca kodda kullanılmayan modlar için `H1`, `H2`, `EMA_EXIT`, `TIME`).
