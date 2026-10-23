/**
 * SPY Engine — TAKİP SİSTEMİ (saf, izomorfik — DOM/ağ yok).
 *
 * YAPI (kullanıcı, 2026-10-15 — gün içi işlem):
 *   • 15m = YÖN TEYİDİ: son kapanmış 15m mum VWAP ve EMA20'nin aynı tarafında mı (ikisinin üstü ▲ · altı ▼ · arası belirsiz).
 *   • 5m  = ANA ZAMAN VE TETİK: 5m kapanış VWAP ve EMA20'nin 15m yönündeki tarafında + hacim çubuğu ve/veya mum formasyonu aynı yönde.
 *   • Temel unsurlar: VWAP konumu · EMA20 konumu · hacim çubukları · mum formasyonları.
 *   • RVOL ve RSI(15m) yönü yalnız BELİRSİZLİKTE teyit (hacim/formasyon ikisi de yön vermediğinde ya da 15m karışıkken eğilim).
 *   • 30m / 1h / 4h yalnız BİLGİ — puana ve kararlara girmez.
 *   • Katı bariyer yok: düşük RVOL, testere, VWAP–POC arası, geniş stop yalnız "dikkat" notu olur, girişi engellemez.
 *   • Aynı yapı 09:50'den 15:00'e kadar her 5m kapanışında; 09:35–09:45 arası 15m mum yok → yalnız 5m okuma (işlem yok).
 *   • Her 5m okuması: yön · ne yap · 30 dk tahmini (hedef + iptal) · gerçekleşen. İşlemler ve uyarılar kayda girer
 *     (sunucu: trackerStore.ts — aynı fonksiyon; geriye dönük test: scripts/backtest_tracker.ts).
 *
 * Kurallar: yalnız KAPANMIŞ mumlar; gün her çağrıda baştan oynatılır (deterministik). Saat etiketi = mumun KAPANIŞ saati. ET.
 * RVOL = 5m hacim / son 20 seansın aynı saatteki MEDYAN hacmi.
 *
 * KALİBRASYON (2026-10-15, SPY 5m Yahoo, 45 seans 12 Ağu → 14 Eki, scripts/backtest_tracker.ts — canlıyla aynı fonksiyon):
 *   • TETİK (15m VWAP+EMA20 yönü · 5m kapanış VWAP+EMA20 o tarafta · hacim çubuğu ya da formasyon · taze hiza/geri çekilme),
 *     stop son 2 mumun ucu (≥ 0,3 puan), çıkış H1 = 1R'de tamamı, 15m yönü dönerse çık, zaman stopu YOK:
 *     155 işlem (3,4/gün) · %56 kazanç · +19,8R · yarılar +4,4R (%52) / +15,3R (%61).
 *   • v2.1 (14 Eki incelemesi — fiyat bütün gün EMA20 altında, EMA20'ye YAKLAŞIP düşüşe devam; tam değmediği için yeniden giriş yoktu):
 *     geri çekilme = mum EMA20/VWAP'a 0,25 ATR5 yaklaştı (değmesi şart değil) + 15m VWAP–EMA20 arasındayken 15m EMA20 yönünde
 *     hacim VE formasyon birlikte → 183 işlem (4,1/gün) %56 +23,2R, yarılar +10,1 / +13,0R (daha dengeli); 14 Eki 4 PUT +4R.
 *     EMA20 bozulana kadar taşıma ("trail") denendi: +20,7R ama %36 kazanç ve ilk yarı −4R (öğlen dönüşlerinde kârı geri veriyor) → seçilmedi;
 *     trend günleri 1R'de çıkıp her EMA20 yaklaşmasında yeniden girişle yakalanıyor.
 *   • v2.2 POZİSYON YÖNETİMİ (kullanıcı yöntemi, exitMode "half15"): 2 kontrat · 1R'de 1'i kapanır, stop girişe · kalan yarı her 15m
 *     kapanışında son 15m dip (CALL) / tepe (PUT) ∓ 0,25×ATR15'e taşınır (yalnız sıkılaşır), stop olana kadar; taşınırken yeni tetiklere girilir.
 *     190 işlem %54 +22,0R (yarılar −4,3 / +26,3R) — 1R'de tam çıkışla (+23,2R) toplamda eşit, ilk yarıda daha zayıf; tampon 0,1: +16,3R ·
 *     0,5: +20,8R · tampon yok: +14,2R · taşınırken yeni giriş YOKKEN: 156 işlem +13,1R. 14 Eki: 4 PUT +3,4R.
 *   • v2.3 POZİSYON BÜYÜKLÜĞÜ (kullanıcı: "kuvvetli momentum daha büyük pozisyon"): taban 2 kontrat, her işaret +1 (en çok 4) —
 *     hacim+formasyon birlikte · RVOL ≥ 1,5 · aynı yönde kârdaki taşınan pozisyon · 30 dk itki ≥ 2 ATR5 · gün içi yeni tepe/dip.
 *     2 kontrat birimiyle toplam: sabit 2 → +22,0R (−4,3 / +26,3) · öneriyle → +34,8R (−3,1 / +37,9); ≤3 kontrat +32,7R.
 *     Tek tek işaretlerin kenarı küçük/karışık (en tutarlısı 30 dk itki) — boyut bir öneridir, R hesabı kontrat başınadır.
 *   • v2.4 (kullanıcı kuralı): düşük hacimli sinyal (RVOL 5m < 0,7) → 1 kontrat; diğer kademeler aynı (2 taban, momentum işaretiyle 3–4).
 *     45 seans: RVOL < 0,7 olan 40 işlemin ortalaması ≈ 0R (−0,05 / −0,01R) — risk küçültmesi; kontrat ağırlıklı toplam 69,6 → 58,0
 *     (bu işlemlerin bir kısmı fiyat momentumu nedeniyle 3–4 kontrattı). Giriş/çıkış kuralları ve işlem listesi değişmedi.
 *   • v2.5 (16 Eki 09:45 CALL, 3 kontrat, stop): 15m kapanış VWAP+EMA20 üstünde ama 15m mumun kendisi kırmızıydı; açılışın doğal
 *     yüksek hacmi (RVOL 3,9) momentum sayıldı. Ölçüm (45 seans): zayıf 15m teyitli girişler (mum yöne ters renkte ya da aralığın ters
 *     yarısında kapanış) 57 işlem ≈ 0R. Kullanıcı kararı (v2.6): zayıf 15m teyidinde tetik mumunda GİRİLMEZ; bir sonraki 5m mum
 *     VWAP+EMA20'nin doğru tarafında ve tetik mumunun kapanışının ötesinde kapanırsa girilir, kapanmazsa tetik iptal (sonuç: bkz. v2.6 notu).
 *     v2.6 ölçüm (45 seans): işlem 188 → 166, kontrat başı +20,5R → +22,9R (yarılar −7,5/+28,1 → −2,0/+25,0), kazanç %53 → %55;
 *     teyitle giren 23 işlem %61 +6,3R. Teyit mumuna gövde şartı (≥%30–50) eklemek iyileştirmedi (+19,9…+23,4R, örnek az) → yalnız kapanış.
 *     16 Eki: 09:45 tetiği beklemeye alındı, 09:50 kapanışı 772,26 (> 772,20) teyit etti, 2 kontrat, 09:55 stop (−1R) — teyit zayıf bir mumdu.
 *     v2.7 (kullanıcı: "2 aynı yönde 5m kapanış olmadan tetikleme yapmasın"): zayıf 15m teyidinde tetikten sonra 2 adet aynı yönde
 *     5m kapanış (her biri öncekinin ötesinde + VWAP+EMA20 doğru tarafı) beklenir. 45 seans, 3 dönem: eski hemen-gir 188 işlem +20,5R
 *     (−8,1/22,0/6,6) · 1 teyit 166 +22,9R (−5,8/24,8/4,0) · 2 teyit 165 +21,8R (−2,2/21,9/2,1) SEÇİLDİ · her tetikte 1 teyit 115 +3,6R ·
 *     her tetikte 2 teyit 63 işlem %57 +12,5R (4,5/6,2/1,8 — en istikrarlı ama 1,4 işlem/gün). 16 Eki: 2 teyitte işlem yok (09:55 düştü).
 *     v2.8 (kullanıcı: "15m VWAP'ın net üstünde/altında kapanmazsa işlem arama"): 15m kapanış VWAP'tan ≥ 0,1 ATR15 uzak olmalı ve
 *     15m VWAP–EMA20 arasındayken giriş yok (mixedEntry kapalı). 45 seans: 165 → 159 işlem, +21,8R → +22,0R, %55, 3 dönem −1,7/19,8/3,9R.
 *     Eşik 0,15–0,3 ATR15 sonucu düşürdü (+20,9…+17,5R). Cuma günleri işlem uyarılarına "mübarek Cuma… gerekmedikçe işlem açma" notu.
 *     v2.9 (16 Eki 11:00 kaçan PUT): 15m kapanış VWAP'ın net altında ama 15m EMA20 üstündeydi → "VWAP–EMA20 arası" sayıldı, ekranda
 *     EMA20 tarafından gelen ters "eğilim ▲" yazıyordu. Eğilim artık 15m kapanışın NET VWAP tarafı (leadBy "vwap") — işlemler değişmedi.
 *     Bu bölgede girişi açan denemeler 45 seansta sonucu düşürdü: VWAP eğilimiyle giriş 179 işlem +8,5R · +RVOL≥1,5 167 +17,1R ·
 *     +güçlü 15m+RVOL≥1,5 166 +18,1R (kontrat-ağırlıklı 41,7 → 27,5) · 15m yön dönünce 3 mum taze 170 +14,9R. Hepsi KAPALI (varsayılan 0/false).
 *     Kullanıcı kuralı (seçildi): belirsiz 15m'de kırılım mumunda giriş YOK; sert hacimli (RVOL ≥ 1,5) 5m kırılım → sonraki 5m kapanış
 *     kırılım mumunun ortasının ötesinde, VWAP+EMA20 doğru tarafında, hacimli (RVOL ≥ 1) VE 15m yön teyidi gelmişse giriş. 45 seans:
 *     159 işlem +22,0R değişmedi (3 eşleşme zaten aynı mumda açılıyordu), 16 Eki 11:15 PUT eklendi; 3 mum bekleme 160 +21,0R (seçilmedi).
 *     v2.10 (16 Eki: 11:15 PUT'tan sonra VWAP+EMA20 altında süren düşüşte yeni giriş yok — "taze" yalnız hiza değişimi/geri çekilmeydi):
 *     5m kapanış son 4 mumun dibinin altında/tepesinin üstündeyse (trend devamı kırılımı) tetik taze sayılır. 45 seans: 159 → 202 işlem,
 *     +22,0R → +28,6R, kontrat-ağırlıklı 41,7 → 72,4, 3 dönem −4,9/30,6/3,0. 16 Eki: 11:15, 11:25, 12:00, 12:50 PUT.
 *     Seçilmeyen: taşınan stopu 5m kapanışta tetiklemek (18,4R — fitil stopu daha iyi), 2/3/5 mum pencere (26,7/27,6/24,4R).
 *     Giriş SL'i (kullanıcı: "dibinden/tepesinden tampon koyarak"): son 2 mumun dibi/tepesi + 0,1 ATR15 tampon → 174 işlem +25,3R,
 *     kontrat-ağırlıklı 70,6, 3 dönem −0,1/23,5/1,8 (tamponsuz +28,6R ama ilk dönem −4,9). Daha geniş: 2 mum+0,25 16,7R · 3 mum+0,1 11,2R ·
 *     4 mum+0,25 3,8R · 6 mum+0,25 −0,6R (seçilmedi).
 *     16 Eki 13:20 (kullanıcı: "5m mumlar yukarı yönlüydü"): önceki 5m mum ters yönde formasyon verdiyse kırılım taze sayılmaz →
 *     173 işlem +25,8R, kontrat-ağırlıklı 72,4 (önce 174 / +25,3R / 70,6). Kırılıma hacim şartı 17,2R, hacim+formasyon 20,7R (seçilmedi).
 *     v2.12 5m EMA20×VWAP kesişmesi (45 seans, 47 kesişme ≈ 1,1/gün): kesişme ANI yön vermiyor (30 dk %47, 60 dk %49 — gecikmeli), ama
 *     rejim kalıcı: ort. 30 mum sürüyor, %74'ü ≥ 1 saat (15m yönüyle aynıysa 34 mum, %83). Rejim yönündeki girişe +1 kontrat (öncelik):
 *     R aynı (+25,8), kontrat-ağırlıklı 72,4 → 75,9. Seçilmeyen: yalnız rejim yönünde giriş 127 işlem +12,2R · rejimde taşınan yarıyı
 *     EMA20 kapanışıyla taşımak 24,3R / +0,25 ATR5 23,7R / +0,5 ATR5 23,5R (15m izleyen stop daha iyi; runnerEma kapalı).
 *     v2.13 giriş mumu kapanış konumu (kullanıcı onayı): giriş mumu aralığının yön ucundaki %30'unda kapanmalı (PUT dibe, CALL tepeye
 *     yakın; kapanış yine 5m mum kapanışında). 45 seans: 173 işlem +25,8R → 151 işlem %58 +37,5R, 3 dönem 2,4/29,4/5,7, kontrat-ağırlıklı
 *     76 → 117. Trend günlerinde kapatmak (sonradan bilinse bile) daha kötü: 34,0R; anlık "açılıştan ≥0,3/0,5 ATR" istisnası 31,5/34,3R.
 *     %40: 36,3R · %20: 37,7R (134 işlem). 1m tetik filtreleri (22 seans) belirgin katkı vermedi.
 *     v2.14 DENENDİ, GERİ ALINDI (kullanıcı v2.13'ü seçti; istisnalar closePosBrkBypass/closePosBypassRvol ile KAPALI) ("net trend gününde işlemler açılsın, kuralı bozma"): kapanış konumu şartına iki istisna — (1) sert hacimli kırılım
 *     girişi, (2) giriş mumunda hacim yönde ve RVOL ≥ 2. 45 seans: 151 işlem +37,5R → 157 işlem %56 +32,5R, 3 dönem 3,0/26,9/2,7,
 *     kontrat-ağırlıklı 117 → 97,6 (hâlâ şartsız 173 / +25,8R / 75,9'dan iyi). 16 Eki: 11:15, 11:55, 12:05, 14:00 PUT'ların hepsi açılır.
 *     Yalnız kırılım istisnası 36,5R (12:05 açılmaz) · RVOL≥1,5 33,9R · RVOL≥3 32,5R.
 *     v2.15 giriş kuralları gözden geçirildi (kullanıcı eleştirileri, 45 seans, v2.13 = 151 işlem +37,5R):
 *     · Hacim çubuğu = mum yön renginde VE saat-normalize RVOL ≥ 1 (son 20 günün aynı 5 dk diliminin medyanı) — önceki "son 3 mum
 *       ortalaması" yerine: 147 işlem %59 +40,0R, 3 dönem 3,4/30,4/6,2 (üçü de iyileşti).
 *     · RSI/RVOL belirsizlik teyidi kaldırıldı (katkı −0,1R). EMA20 tarafı katkısız ama zararsız (−EMA20 +0,9R, 1. dönem kötüleşir) → kaldı.
 *       Hacim/formasyon şartı katkılı (−3,8R) → kaldı. Kapanış konumu en büyük katkı (çıkarılınca −11,7R).
 *     · Sert kırılım yolu kapatıldı: v2.13 kurallarıyla tek bir ayrı işlem üretmiyordu (açık/kapalı/3 mum bekleme aynı sonuç).
 *     · Denenip REDDEDİLEN: VWAP eğimi şartı (3/6/12 mum: 25,1/25,5/21,0R), kırılım-tazeliğine VWAP mesafe sınırı (≤1/1,5/2/3 ATR15:
 *       24,0/26,5/33,5/37,2R) — uzamış görünen kırılım girişleri veride kârlı.
 *     · Kontrat: momentum boyutu yerine SABİT DOLAR RİSKİ — kontrat = risk ÷ (stop × Δ0,45 × 100), düşük hacimde risk ×0,5.
 *       1 kontratın 1R riski işleme göre $16–185 (11 kat) değişiyor; momentum 4 kontrat girişleri 0,23R/işlem (2 kontrat 0,87R).
 *       $ bazında (Δ0,45): momentum boyutu getiri/ort.risk 23,8R, düşüş 10,7R · sabit risk 40,9R, 9,2R · sabit risk + düşük hacim ×0,5 44,4R, 8,7R.
 *     Denenip seçilmeyen: girişi 09:50'ye/10:00'a ertelemek (+20,5R → +6,4R / 0R — 09:45 girişleri 16 işlem %63 +13R, en iyi kısım),
 *     10:00 öncesi en çok 2 kontrat (56,4 → 46,2), açılışta RVOL işaretini saymamak (≈ aynı, 55,9).
 *   • Aynı tetik 30 dk zaman stopuyla: 191 işlem %41, −1,4R (kazananları erken kesiyordu) → kapatıldı.
 *     H1 1,5R: %47 +15,2R · "her hizalı mum" (taze değil): 257 işlem %52 +11,7R · stop VWAP/EMA ötesi: 117 işlem %57 +19,8R.
 *   • 15m teyidi yalnız VWAP: −8,5R; yalnız EMA20: +3,1R; ikisi birlikte en iyisi. RSI'yı ŞART yapmak işlem sayısını düşürüp kötüleştirdi
 *     → RSI/RVOL yalnız belirsizlikte (hacim ve formasyon yön vermediğinde) teyit.
 *   • 30 dk YÖN tahmini: 15m+5m hizalıyken sonraki 30 dk %47 (n=1874) — yönün devamı tek başına 30 dk'yı öngörmüyor;
 *     kenar tetik + stop/hedef yapısından geliyor (1R'ye stoptan önce ulaşma %52–56). Kullanıcının elle %70 gözlemi bu mekanik
 *     sürümde %56; fark büyük olasılıkla göz kararı süzgeçlerden (formasyon kalitesi, bağlam) — dürüstçe raporlandı.
 */

import { atr as atrCalc, ema as emaCalc, nyClock, nyParts, r2, rsi as rsiCalc, type Bar } from "./core";
import type { RvolBase } from "./ladder";
import { barEnd, sessionAggregate } from "./setup15";
import { pivotFrames, pivotLevelsAt, type PivotFrames } from "./mtfPivots";
import { detectCandlePatterns } from "./candlePatterns";

/** Motor sürümü — değişince sunucu günlüğündeki geriye dönük kayıtlar yeniden üretilir */
export const TRACK_VERSION = "3.3";

export const TRACK_CFG = {
  /** ilk 15m kapanışı (yön teyidi bundan sonra var) ve son giriş */
  firstEntry: 9 * 60 + 45,
  lastEntry: 15 * 60,
  /** hacim çubuğu: mum hacmi ≥ önceki N mumun ortalaması × k */
  volLookback: 3,
  volK: 1.0,
  /** mum formasyonu yoksa gövde/kapanış konumu yön mumu sayılır */
  candleBody: 50,
  candleClosePos: 65,
  /** belirsizlikte RVOL teyidi */
  rvolConfirm: 1.0,
  /** tetik tazeliği: "cross" = 5m VWAP+EMA20 hizası bu mumda oluştu ya da son 2 mumda EMA20/VWAP'a geri çekilme vardı · "any" = hizalı her mum */
  fresh: "cross" as "cross" | "any",
  /** stop: "bar" = son 2 mumun ucu · "line" = VWAP/EMA20'nin (hangisi uzaksa) ötesi */
  stopMode: "bar" as "bar" | "line",
  stopPad: 0.03,
  /** giriş stopu: son N 5m mumun dibi (CALL) / tepesi (PUT) */
  stopBars: 2,
  /** dip/tepeye eklenen tampon (ATR15 x) — 15m izleyen stoptaki tamponla aynı mantık · 0 = yalnız stopPad */
  stopBufAtr15: 0.1,
  /** çok dar stop tabanı: ATR5 × k ya da sabit puan (büyük olanı) */
  minStopAtr5: 0.5,
  minStopPts: 0.3,
  /** "half" = H1'de yarısı + kalan EMA20/15m dönüşüne kadar · "full" = H1'de tamamı */
  exitMode: "half15" as "half" | "full" | "trail" | "half15",
  /** "half15" (kullanıcı yöntemi): 2 kontrat · 1R'de yarısı kapanır, stop girişe · sonra her 15m kapanışında stop son 15m mumun
   *  dibi (PUT'ta tepesi) ∓ tampon'a taşınır (yalnız sıkılaşır) · kalan yarı stop olana kadar taşınır */
  trailBufAtr15: 0.4,
  /** taşınan yarının 15m izleyen stopu fitilde değil 5m KAPANIŞTA tetiklenir (girişteki başabaş stop fitilde kalır) */
  trailOnClose: false,
  /** 5m EMA20–VWAP rejimi (EMA20 VWAP'ın altında = aşağı trend) sürerken taşınan yarı 15m izleyen stopla değil,
   *  5m kapanış EMA20'nin ters tarafına (± runnerEmaBufAtr5 · ATR5) geçince kapanır; rejim bitince 15m izleyen stopa döner */
  runnerEma: false,
  runnerEmaBufAtr5: 0,
  /** giriş önceliği: "off" · "require" = yalnız rejim yönünde giriş · "size" = rejim yönündeki girişe +1 kontrat */
  regimeEntry: "off" as "off" | "require" | "size",
  /** giriş mumu kapanışı yön ucuna yakın olmalı: CALL closePos ≥ bu, PUT ≤ 100 − bu (0–100) · 0 = kapalı */
  entryClosePos: 70,
  /** kapanış konumu istisnası (KAPALI — kullanıcı v2.13'ü seçti): sert hacimli kırılım girişi (brk) şarttan muaf */
  closePosBrkBypass: false,
  /** kapanış konumu istisnası: giriş mumunda hacim yönde ve RVOL ≥ bu ise muaf (0 = kapalı) */
  closePosBypassRvol: 0,
  /** half15'te kalan yarı 15m yön teyidi dönünce de kapansın mı */
  runnerFlip: false,
  /** half15'te 1R sonrası risksiz kalan yarı taşınırken yeni tetiklere girilebilir */
  runnerParallel: true,
  /** sizeMode "momentum" HAZIR / KAPALI (50 seans: +7.354 $ → +5.213 $, maxDD −1.687 $) · pozisyon büyüklüğü önerisi: taban kontrat + her kuvvetli momentum işareti için +1 (en çok sizeMax) */
  sizeBase: 2,
  /** kontrat hesabı: "risk" = sabit dolar riski ÷ (stop puanı × Δ × 100) · "momentum" = taban + momentum işaretleri (eski) */
  sizeMode: "risk" as "risk" | "momentum",
  /** işlem başı dolar riski (sayfadan değiştirilebilir) */
  riskUsd: 200,
  /** önerilen 0DTE kontratın yaklaşık deltası (strikeHint ≈0,45Δ) */
  optDelta: 0.45,
  /** düşük hacimli sinyalde risk çarpanı */
  sizeLowRvolMult: 0.5,
  /** risk modunda üst sınır (kontrat) */
  sizeRiskMax: 20,
  sizeMax: 4,
  /** düşük hacimli sinyal (RVOL 5m, medyan tabanlı, bu değerin altında) → yalnız 1 kontrat (kullanıcı kuralı, 2026-10-15) */
  sizeLowRvol: 0.7,
  /** zayıf 15m teyidi (son 15m mum yöne ters renkte ya da aralığının ters yarısında kapandı): tetik mumunda girilmez,
   *  bir sonraki 5m mum VWAP+EMA20'nin doğru tarafında VE tetik mumunun kapanışının ötesinde kapanırsa girilir; kapanmazsa iptal */
  weak15Confirm: true,
  /** teyit için gereken aynı yönde 5m kapanış sayısı (her biri öncekinin ötesinde + VWAP+EMA20 doğru tarafında) */
  confirmBars: 2,
  /** true: teyit her tetikte aranır · false: yalnız zayıf 15m teyidinde */
  confirmAll: false,
  /** 15m yön teyidi için 15m kapanış VWAP'tan en az bu kadar ATR15 uzakta olmalı (net kapanış); 0 = kapalı */
  net15Atr: 0.1,
  /** teyit mumu gerçek yön mumu olmalı: gövde ≥ %confirmBody ve kapanış yön tarafında (aralığın ≥ %confirmClosePos'i); 0 = yalnız kapanış */
  confirmBody: 0,
  confirmClosePos: 0,
  sizeRvol: 1.5,
  sizeImpulse: 2,
  sizeFactors: ["both", "rvol", "runner", "impulse", "ext"] as string[],
  /** "trail": 1R gelince stop girişe çekilir; pozisyon 5m kapanış EMA20'nin ters tarafına geçene (ya da 15m yön dönene) kadar taşınır */
  /** geri çekilme yakınlığı: mum EMA20/VWAP'a bu kadar ATR5 yaklaştıysa (değmese de) geri çekilme sayılır */
  touchAtr: 0.25,
  /** 15m VWAP–EMA20 arasındayken: 15m EMA20 tarafı yönünde, 5m VWAP+EMA20 + hacim VE formasyon birlikte ise tetik */
  /** KAPALI (v2.8, kullanıcı: 15m net VWAP üstü/altı değilse işlem arama) — 15m VWAP–EMA20 arasında giriş yok */
  mixedEntry: false,
  /** 15m VWAP–EMA20 arasında eğilim/tetik yönü: "vwap" = 15m kapanışın NET VWAP tarafı (≥ net15Atr) · "ema" = 15m EMA20 tarafı (eski) */
  leadBy: "vwap" as "vwap" | "ema",
  /** VWAP–EMA20 arası (mixed) girişte asgari 5m RVOL (sert hacim) · 0 = yok */
  mixedMinRvol: 0,
  /** mixed girişte 15m mum güçlü olmalı (renk yönde + aralığın yön yarısında kapanış) */
  mixedStrong15: false,
  /** 15m belirsizken (VWAP net tarafı ≠ EMA20 tarafı) sert hacimli 5m kırılım: o mumda giriş YOK; sonraki destek hacimli 5m kapanış
   *  (VWAP+EMA20 doğru tarafı, kırılım mumunun ortasının ötesi) + 15m yön teyidi gelirse giriş. brkRvol = kırılım mumunun asgari RVOL'u (0 = kapalı) */
  brkRvol: 0,
  /** destek mumunun asgari RVOL'u */
  brkSupRvol: 1,
  /** kırılımdan sonra teyit için beklenen en çok 5m mum */
  brkBars: 1,
  /** 15m yön yeni belirlendiyse (son N 5m mum içinde) 5m hizası eskiden kalsa da tetik "taze" sayılır · 0 = kapalı */
  fresh15Bars: 0,
  /** trend devamı: 5m kapanış son N mumun dibinin altında / tepesinin üstündeyse (yeni kırılım) tetik taze sayılır · 0 = kapalı */
  freshBreakBars: 4,
  /** kırılım-tazeliği için teyit: "none" · "vol" = hacim çubuğu yönde · "both" = hacim VE formasyon · "volOr" = hacim ya da RVOL≥1,5 */
  freshBreakConfirm: "none" as "none" | "vol" | "both" | "volOr",
  /** kırılım-tazeliği: önceki 5m mum ters yönde formasyon verdiyse (dönüş işareti) kırılım taze sayılmaz */
  freshBreakPrevCandle: true,
  /** kırılım-tazeliği yalnız 5m kapanış VWAP'tan en çok bu × ATR15 uzaktaysa (uzamış harekete giriş koruması) · 0 = sınırsız */
  freshBreakMaxVwapAtr15: 0,
  /** hacim çubuğu tanımı: "prev3" = yön renginde + hacim ≥ önceki 3 mumun ortalaması · "rvol" = yön renginde + saat-normalize RVOL ≥ volRvolMin */
  volMode: "rvol" as "prev3" | "rvol",
  volRvolMin: 1,
  /** belirsizlik teyidi (RVOL ≥ 1 + 15m RSI yönde) açık mı */
  useTiebreak: false,
  /** 5m EMA20 tarafı şartı */
  needEma5: true,
  /** hacim/formasyon/belirsizlik teyidi şartı */
  needVC: true,
  /** VWAP eğimi: VWAP son N 5m mumda giriş yönünde ilerlemiş olmalı · 0 = kapalı */
  vwapSlopeBars: 0,
  h1R: 0.5,
  h2R: 2,
  /** 0 = kapalı (ölçüm: 30 dk zaman stopu kazanan işlemleri erken kesiyordu, +19,8R → −1,4R) */
  timeStopBars: 0,
  /** 15m yönü tersine dönerse kalan pozisyondan çık */
  exitOn15Flip: true,
  /** "dikkat" notları (engellemez) */
  warnRvol: 0.5,
  warnChop: 4,
  warnStopAtr15: 1.0,
  /** günde en fazla işlem (çok yüksek — fiilen sınırsız, yalnız aşırı tekrar koruması) */
  maxTrades: 8,
  trackEnd: 15 * 60,
  forceExit: 15 * 60 + 45,
  predBars: 6,
  alertPrewarnSec: 60,
  eventDays: [] as string[],
  /** referans sembol (QQQ için SPY) kapanmış 15m yönü şartı: "off" · "same" = referans 15m aynı yönde · "notAgainst" = referans ters yönde değil.
   *  Referans yönü TrackInput.refSide15 ile verilir; verilmezse şart uygulanmaz */
  refAlign15: "off" as "off" | "same" | "notAgainst",
  /** 5m giriş süzgeçleri (0 = kapalı): stop mesafesi ≤ maxStopAtr5 × ATR5 · giriş mumu RVOL ≥ minEntryRvol · gün içi VWAP kesişmesi < maxCrosses */
  maxStopAtr5: 0,
  minEntryRvol: 0,
  maxCrosses: 0,
  /** ters yön kilidi: STOP ile kapanan işlemden sonra bu kadar dakika ters yönde giriş yok (aynı yön serbest) · 0 = kapalı.
   *  13 Eki: 12:30 PUT stopu → 12:45 CALL −1R, 13:00 CALL stopu → 13:20 PUT −1R. 45 seans: 42,5R → 46,7R, maxDD −6,35R → −4,67R */
  oppAfterStopMin: 0,
  /** VWAP testeresi: son 1 saatte (12 × 5m) VWAP kesişmesi ≥ chopCross iken alınan girişte risk × chopSizeMult (daha az kontrat),
   *  hedef H1 = chopH1R × R (daha yakın) ve chopExit "full" ise H1'de tamamı kapanır (taşınan yarı yok) · chopCross 0 = kapalı */
  /*  45 seans: testere girişleri 13 işlem +1,1R (8 kazanç) → 1R'de tam çıkışla +2,6R; toplam 46,7R → 47,0R (yarım pozisyon ağırlıklı 45,7R).
   *  Hedefi 0,75R'ye çekmek −1,6R kaybettirdi — hedef 1R kaldı, yalnız taşınan yarı kaldırıldı. */
  chopCross: 0,
  chopSizeMult: 0.5,
  chopH1R: 1,
  chopExit: "full" as "half15" | "full",
  /** erken çıkış (1R gelmeden): pozisyon en az earlyExitArmR kadar kâr gördükten sonra art arda earlyExitBars adet ters renkli 5m mum
   *  kapanırsa tamamı kapanır · earlyExitBars 0 = kapalı. 19 Eki: CALL +0,89R gördü, 770'te kırmızı mumlarla 1R'ye 0,25 kala döndü.
   *  45 seans: toplam 47,0R → 43,0R (bedeli), maxDD −5,85R → −4,68R, en kötü gün −2,67R → −2,06R (kullanıcı kararı 2026-10-19) */
  earlyExitArmR: 0.75,
  earlyExitBars: 2,
  /** ── v3.0 süzgeçleri (2026-10-20) — v3.1'de SPY için KAPALI: 50 seansta 5m teyit / %25 prim stopu / testere engeli / isimli formasyon
   *  şartı v2.18 çekirdeğinin kazancını eritiyordu (kod duruyor, değerler 0/false) ── */
  /** stop = yapısal stop (son 2 mumun ucu) ya da tahmini 0DTE priminin premStopPct'i — hangisi girişe yakınsa. Mum uzun olunca stop genişlemez.
   *  Tahmini prim ≈ premK × ATR5 × √(kapanışa kalan 5m mum sayısı); stop puanı = prim × premStopPct ÷ optDelta · 0 = kapalı */
  premStopPct: 0,
  premK: 0.35,
  /** testere: son chopBars 5m mumun VWAP'a mesafe medyanı ≤ chopDistAtr5 × ATR5 VE RVOL medyanı < chopRvolMax → yeni giriş yok (VWAP kesişme SAYISI aranmaz) */
  chopBlock: false,
  chopBars: 6,
  chopDistAtr5: 0.6,
  chopRvolMax: 1.0,
  /** hacim desteği = yön renginde RVOL ≥ volRvolMin · formasyon desteği = YALNIZ isimli formasyon (yutan, çekiç, yıldız…); genel "güçlü mum" sayılmaz */
  namedVC: false,
  /** tetik mumunun aralığı ≥ bu × ATR5 olmalı (30–40 sentlik gürültü mumuyla işlem önerilmez) · 0 = kapalı */
  minBarAtr5: 0,
  /** tetik mumunda yön tersi isimli formasyon (tuzak / sahte kırılım) varsa giriş yok */
  blockOpposeNamed: false,
  /** SIÇRAMA KIRILIMI (T5_BRK, kullanıcı kuralı 2026-10-20): sert ve hacimli 5m mum VWAP ile EMA20'yi (uzatılmış seri — grafikle aynı) keserse
   *  erken uyarı; SONRAKİ 5m mum aynı renkte ve sinyal kapanışının ötesinde kapanırsa 15m teyidi beklenmeden giriş. Stop sinyal mumunun dibi/tepesi.
   *  20 Eki 09:45: 764,50 → 766,12 (RVOL 1,5) VWAP + EMA20 üstü — 09:50 yeşil teyit → 772'ye giden trend */
  brkSpike: true,
  /** HAZIR / KAPALI (50 seans: +7.354 $ → +2.456 $, maxDD −2.400 $) — stop yalnız prim yüzdesinden (mum büyüklüğüne bakılmaz): stop puanı = tahmini prim × premStopPct ÷ optDelta (en az minStop) */
  stopPremOnly: false,
  /** 12:00 sonrası, net trend günü değilse tetik/giriş mumunda RVOL ≥ pmRvolMin · net trend günü = bugünkü 5m kapanışların ≥ trendDayShare'i işlem yönünde VWAP'ın doğru tarafında */
  pmRvolMin: 1.5,
  trendDayShare: 0.8,
  brkBodyPct: 60,
  brkRangeAtr5: 1.0,
  brkRvolMin: 1.5,
  /** 30 dk tahmini ve 30m bilgisi: kapalı (kullanıcı: "30 dk hiç bir şekilde bakma, yanıltıcı") */
  fc30: false,
  /** kontrat önerisi: vade etiketi ve strike adımı (SPY/QQQ/IWM her gün vadeli, 1 $ adım · hisselerde en yakın haftalık, 2,5 $ adım) */
  optLabel: "0DTE",
  strikeStep: 1,
};
export type TrackCfg = typeof TRACK_CFG;

/** SPY dışındaki motorlar (QQQ / IWM / NVDA / AAPL / TSLA / AMZN) v3.0 öncesi kurallarla çalışır: SPY'a özel yeni kurallar orada KAPALI */
export const NON_SPY_RULES: Partial<TrackCfg> = {
  oppAfterStopMin: 0, chopCross: 0, earlyExitBars: 0,
  confirmAll: false, confirmBars: 2, weak15Confirm: true, confirmBody: 0, minEntryRvol: 0,
  premStopPct: 0, sizeRiskMax: 20, chopBlock: false, namedVC: false, minBarAtr5: 0, blockOpposeNamed: false, alertPrewarnSec: 60,
  trailBufAtr15: 0.25, brkSpike: false, stopPremOnly: false, pmRvolMin: 0, sizeMode: "risk",
};

// ── Tipler ───────────────────────────────────────────────────────────

export type D = 1 | -1 | 0;
export type Side = "CALL" | "PUT";
export type TrackPhase = "PRE" | "AÇILIŞ" | "TAKİP" | "IN_TRADE" | "MANAGE" | "KAPANIŞ"
  // v1 kayıtları (geçmiş görüntüleme)
  | "K1" | "K2" | "K3" | "K4" | "DONE" | "VETO";
export type SetupTag = "T5_TREND" | "T5_PB" | "T5_BRK"
  // v1 kayıtları
  | "K1_ORB5" | "K2_TREND_CLOSE" | "K2_TREND_PB" | "K3_BREAK" | "K3_FAKEOUT" | "K4_PB_VWAP" | "K4_PB_EMA" | "T_PB_VWAP" | "T_PB_EMA" | "T_BRK";
export type VetoCode = "LOW_RVOL" | "VWAP_CHOP" | "VWAP_POC_ZONE" | "STOP_TOO_WIDE" | "DAILY_LOSS" | "MAX_TRADES" | "EVENT_K1";
export type DayClass = "TREND_CANDLE" | "INDECISION" | "NORMAL";
export type ExitReason = "STOP" | "H1" | "TRAIL_15M" | "H1_BE" | "EMA_EXIT" | "H2" | "TIME" | "FORCE_1545" | "TREND_FLIP" | "REV_2BAR";
export type AlertLevel = "HAZIRLAN" | "TETİK" | "İPTAL" | "YÖNET" | "ÇIKIŞ" | "KADEME";

export const TAG_TEXT: Record<SetupTag, string> = {
  T5_TREND: "5m tetik · 15m teyitli (yeni hiza)",
  T5_PB: "5m tetik · 15m teyitli (EMA20/VWAP geri çekilmesi sonrası)",
  T5_BRK: "sıçrama kırılımı · sert hacimli 5m mum VWAP+EMA20'yi kesti, sonraki 5m aynı yönde (15m beklenmez)",
  K1_ORB5: "OR5 kırılımı", K2_TREND_CLOSE: "09:45 trend mumu", K2_TREND_PB: "09:45 trend mumu · geri çekilme",
  K3_BREAK: "OR15 kırılımı", K3_FAKEOUT: "OR15 başarısız kırılım", K4_PB_VWAP: "VWAP geri çekilmesi", K4_PB_EMA: "EMA20 geri çekilmesi",
  T_PB_VWAP: "trend · VWAP geri çekilmesi", T_PB_EMA: "trend · EMA20 geri çekilmesi", T_BRK: "trend · 30 dk kırılım",
};

/** Engellemeyen "dikkat" notları */
export const VETO_TEXT: Record<VetoCode, string> = {
  LOW_RVOL: "hacim çok düşük (RVOL < 0,5) — hareket kolay geri dönebilir",
  VWAP_CHOP: "VWAP etrafında testere (çok kesişim) — küçük pozisyon",
  VWAP_POC_ZONE: "fiyat VWAP ile POC arasında — sıkışma bölgesi",
  STOP_TOO_WIDE: "stop geniş (> 1 ATR15) — boyutu küçült",
  DAILY_LOSS: "günlük zarar büyüdü",
  MAX_TRADES: "günlük işlem sayısı yüksek",
  EVENT_K1: "veri günü",
};

export const PHASE_TEXT: Record<TrackPhase, string> = {
  PRE: "Seans öncesi · bilgi",
  AÇILIŞ: "Açılış · 15m mum bekleniyor (yalnız 5m)",
  TAKİP: "5m tetik · 15m yön teyidi",
  IN_TRADE: "Pozisyon açık",
  MANAGE: "Pozisyon yönetimi (yarısı alındı)",
  KAPANIŞ: "Kapanış — yeni giriş yok",
  K1: "Kademe 1", K2: "Kademe 2", K3: "Kademe 3", K4: "Kademe 4", DONE: "Açılış modülü bitti", VETO: "Veto",
};

export interface Breakdown {
  /** 15m yön teyidi (VWAP + EMA20 tarafı) ±2 */
  m15: number;
  /** 5m kapanış VWAP tarafı ±1 */
  vwap5: number;
  /** 5m kapanış EMA20 tarafı ±1 */
  ema5: number;
  /** hacim çubuğu (ortalamanın üstünde hacimli yön mumu) ±1 */
  volume: number;
  /** mum formasyonu ±1 */
  candle: number;
  /** belirsizlik teyidi: 15m RSI(14) yönü ±0,5 */
  rsi: number;
}
export const BREAKDOWN_LABEL: Record<keyof Breakdown, string> = {
  m15: "15m VWAP+EMA20", vwap5: "5m VWAP", ema5: "5m EMA20", volume: "hacim çubuğu", candle: "mum formasyonu", rsi: "RSI 15m (teyit)",
};
/** Yön puanının en büyük mutlak değeri */
export const SCORE_MAX = 6.5;

export interface CheckItem { key: string; ok: boolean; text: string; price?: boolean }

export interface TrackSetup {
  tag: SetupTag;
  side: Side;
  status: "WATCH" | "ARMED" | "OPEN" | "CLOSED";
  trigger: number | null;
  triggerText: string;
  stop: number | null;
  missing: string[];
}

export interface TrackTrade {
  id: string;
  tag: SetupTag;
  reentry: boolean;
  side: Side;
  stage: TrackPhase;
  entryTime: number;
  entryClock: string;
  entry: number;
  stop: number;
  stop0: number;
  rPts: number;
  h1: number;
  h2: number;
  size: "half" | "full";
  confirm10: boolean | null;
  strike: string;
  exitTime: number | null;
  exitClock: string | null;
  exit: number | null;
  exitReason: ExitReason | null;
  resultR: number | null;
  mfeR: number;
  maeR: number;
  barsHeld: number;
  scoreEntry: number;
  rvolEntry: number | null;
  dayClass: DayClass | null;
  bias: Side | "NÖTR";
  gapType: "UP" | "DOWN" | "FLAT";
  eventDay: boolean;
  h1Hit: boolean;
  h1Clock: string | null;
  liveR: number | null;
  /** girişteki gerekçe (VWAP/EMA/hacim/formasyon/teyit) */
  why?: string;
  /** önerilen kontrat sayısı (taban 2; kuvvetli momentumda artar) ve nedenleri */
  contracts?: number;
  momWhy?: string[];
  /** girişteki momentum işaretleri (ölçüm için) */
  momF?: { both: boolean; rvol: boolean; runner: boolean; impulse: boolean; ext: boolean };
  /** VWAP testeresinde alındı: küçük pozisyon + yakın hedef */
  chop?: boolean;
  /** H1 hedefinin R katı (testerede chopH1R, normalde h1R) */
  h1RMult?: number;
  /** 1R öncesi art arda ters renkli 5m mum sayısı (erken çıkış) */
  againstBars?: number;
}

export interface TrackAlert { t: number; clock: string; level: AlertLevel; tag: SetupTag | null; side: Side | null; text: string; key: string }

/** 30 dk tahmin kuralları (ölçüm: CALIB). Eski anahtarlar geçmiş kayıtlar için. */
export type FcRule = "ALIGNED" | "PB_RESUME" | "OPEN_MOM" | "CHOP_FADE" | "TREND_DAY" | "STRUCT";
/** hit = 30 dk sonra yön isabeti · tHit = 30 dk içinde hedef seviyeye iptalden ÖNCE değme oranı */
export const FC_RULES: Record<FcRule, { label: string; hit: number; tHit?: number; n: number; avg: number; text: string }> = {
  ALIGNED: { label: "15m + 5m aynı yönde", hit: 47, tHit: 53, n: 2046, avg: -0.02, text: "15m VWAP+EMA20 tarafı ve 5m VWAP+EMA20 tarafı aynı → o yönde devam" },
  PB_RESUME: { label: "15m yönü, 5m geri çekilme", hit: 47, tHit: 51, n: 90, avg: -0.04, text: "15m yön veriyor, 5m geçici olarak ters tarafta → 15m yönüne dönüş" },
  OPEN_MOM: { label: "açılış ivmesi", hit: 54, n: 437, avg: 0.1, text: "v1 kuralı" },
  CHOP_FADE: { label: "testere → VWAP", hit: 55, n: 449, avg: 0.16, text: "v1 kuralı" },
  TREND_DAY: { label: "trend günü", hit: 56, n: 192, avg: 0.09, text: "v1 kuralı" },
  STRUCT: { label: "15m yapı", hit: 53, n: 312, avg: 0.15, text: "v1 kuralı" },
};

export interface TrackForecast {
  dir: D;
  target: number | null;
  targetLabel: string;
  invalid: number | null;
  invalidLabel: string;
  rule: FcRule | null;
  text: string;
}

export interface TrackOutcome { move: number; hit: boolean | null; targetHit: boolean; invalidHit: boolean; done: boolean }

export interface Momentum { impulse: number; newExt: D; struct: D; run: number; score: number }

export interface TrackStep {
  t: number;
  clock: string;
  min: number;
  pre: boolean;
  is15: boolean;
  phase: TrackPhase;
  stageLabel: string;
  price: number;
  open: number;
  high: number;
  low: number;
  vwap: number | null;
  poc: number | null;
  ema5: number | null;
  ema15: number | null;
  rvol5: number | null;
  rvol15: number | null;
  atr5: number | null;
  devAtr: number | null;
  crosses: number;
  body: number;
  closePos: number;
  score: number;
  breakdown: Breakdown;
  threshold: number;
  dir: D;
  strength: "ÇOK GÜÇLÜ" | "GÜÇLÜ" | "ORTA" | "ZAYIF";
  trend: string;
  mom: Momentum;
  /** 15m teyit + bilgi amaçlı 30m/1h/4h (fiyat EMA20 tarafı + eğim) */
  htf: { m15: D; m30: D; h1: D; h4: D };
  /** 15m ve 5m tarafları (VWAP+EMA20 birlikte) */
  side15: D;
  side5: D;
  /** formasyon adı (varsa) */
  pattern: string | null;
  rsi15: number | null;
  headline: string;
  action: string;
  tone: "bull" | "bear" | "neutral" | "warn";
  checklist: CheckItem[];
  /** v1 uyumu: artık her zaman null (bariyer yok) */
  veto: VetoCode | null;
  /** engellemeyen dikkat notları */
  warns: VetoCode[];
  setup: TrackSetup | null;
  pos: { tag: SetupTag; side: Side; entry: number; stop: number; h1: number; h2: number; liveR: number; h1Hit: boolean; contracts?: number } | null;
  /** 1R'den sonra taşınan yarılar (stop girişte / 15m izleyen stop) */
  runners: { side: Side; entryClock: string; entry: number; stop: number; liveR: number }[];
  fc: TrackForecast;
  out: TrackOutcome | null;
  c5: string;
  c15: string | null;
  events: string[];
}

export interface TrackK0 {
  bias: Side | "NÖTR";
  score: number;
  parts: { h4: number; h1: number; pmVsClose: number; pmBreak: number };
  pmHigh: number | null;
  pmLow: number | null;
  pmLast: number | null;
}

export interface TrackRead {
  date: string;
  prevClose: number | null;
  atrDaily: number | null;
  k0: TrackK0;
  gap: { pts: number | null; type: "UP" | "DOWN" | "FLAT" };
  eventDay: boolean;
  or5: { high: number; low: number } | null;
  or15: { high: number; low: number; mid: number; widthPct: number | null; squeeze: boolean; orbDisabled: boolean } | null;
  dayClass: DayClass | null;
  dirEstablished: D;
  confirm10: boolean | null;
  steps: TrackStep[];
  current: TrackStep | null;
  trades: TrackTrade[];
  alerts: TrackAlert[];
  realizedR: number;
  pred: { n: number; hit: number; tHit: number };
  nextCheck: string | null;
  armed: { tag: SetupTag; side: Side; trigger: number; stop: number | null } | null;
}

export interface TrackInput {
  date: string;
  m5: Bar[];
  nowSec: number;
  h1?: Bar[] | null;
  fine?: Bar[] | null;
  prevClose?: number | null;
  rvol?: RvolBase | null;
  /** v1 uyumu — artık kullanılmaz (opsiyon akışı puana girmez) */
  optSide?: D | null;
  eventDay?: boolean;
  /** işlem başı dolar riski (yoksa TRACK_CFG.riskUsd) */
  riskUsd?: number | null;
  cfg?: TrackCfg;
  /** referans sembolün (örn. SPY) kapanmış 15m yönü, 5m mum açılış zamanına göre (cfg.refAlign15 ile kullanılır) */
  refSide15?: Map<number, D> | null;
}

// ── Yardımcılar ──────────────────────────────────────────────────────

const OPEN_MIN = 9 * 60 + 30;
const f2 = (n: number) => n.toFixed(2);
const sgnR = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}`;
const hm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const dOfSide = (s: Side): 1 | -1 => (s === "CALL" ? 1 : -1);
const arrow = (d: number) => (d > 0 ? "▲" : d < 0 ? "▼" : "◆");
const isRth = (t: number) => { const m = nyParts(t).minutes; return m >= OPEN_MIN && m < 16 * 60; };
const sideOf = (c: number, vwap: number | null, ema: number | null): D =>
  vwap == null || ema == null ? 0 : c > vwap && c > ema ? 1 : c < vwap && c < ema ? -1 : 0;

function mapOf(bars: Bar[], vals: (number | null)[]): Map<number, number> {
  const m = new Map<number, number>();
  bars.forEach((b, i) => { if (vals[i] != null) m.set(b.time, vals[i] as number); });
  return m;
}

function closedIdx(bars: Bar[], minutes: number, t: number): number {
  let lo = 0, hi = bars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (barEnd(bars[mid].time, minutes) <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

interface Tf { bars: Bar[]; ema: (number | null)[]; minutes: number }
function tfOf(bars: Bar[], minutes: number): Tf {
  return { bars, ema: emaCalc(bars.map((b) => b.close), 20), minutes };
}
/** bilgi amaçlı: fiyat EMA20'nin o tarafında ve EMA20 eğimi aynı yönde → ±1 */
function emaDir(tf: Tf, t: number, price: number): { d: D; e: number | null } {
  const i = closedIdx(tf.bars, tf.minutes, t);
  if (i < 1) return { d: 0, e: null };
  const e = tf.ema[i], ep = tf.ema[i - 1];
  if (e == null || ep == null) return { d: 0, e: e ?? null };
  const d: D = price > e && e >= ep ? 1 : price < e && e <= ep ? -1 : 0;
  return { d, e };
}

function candleOf(b: Bar) {
  const rng = b.high - b.low;
  const body = rng > 0 ? (Math.abs(b.close - b.open) / rng) * 100 : 0;
  const closePos = rng > 0 ? ((b.close - b.low) / rng) * 100 : 50;
  const upper = b.high - Math.max(b.open, b.close);
  const lower = Math.min(b.open, b.close) - b.low;
  return { rng, body, closePos, upper, lower };
}

function candleText(b: Bar, vwap: number | null, ema: number | null, rv: number | null, tf: string, pat: string | null): string {
  const c = candleOf(b);
  const kind = c.body < 15 ? "kararsız (doji)" : b.close > b.open ? (c.body >= 60 ? "güçlü alış mumu" : "alış mumu") : (c.body >= 60 ? "güçlü satış mumu" : "satış mumu");
  const pos = c.closePos >= 70 ? "kapanış tepede" : c.closePos <= 30 ? "kapanış dipte" : "kapanış ortada";
  const wick = c.upper > c.rng * 0.45 ? " · uzun üst fitil (yukarıda satıcı)" : c.lower > c.rng * 0.45 ? " · uzun alt fitil (aşağıda alıcı)" : "";
  const vw = vwap == null ? "" : b.close > vwap ? " · VWAP üstü" : " · VWAP altı";
  const em = ema == null ? "" : b.close > ema ? " · EMA20 üstü" : " · EMA20 altı";
  return `${tf}: ${kind}${pat ? ` (${pat})` : ""} · gövde %${Math.round(c.body)} · ${pos}${wick}${rv != null ? ` · RVOL ${rv.toFixed(2)}` : ""}${vw}${em}`;
}

class Profile {
  private bins = new Map<number, number>();
  add(b: Bar) {
    const v = b.volume || 0;
    if (v <= 0) return;
    const lo = Math.round(b.low / 0.05), hi = Math.round(b.high / 0.05);
    const n = Math.max(1, hi - lo + 1);
    for (let k = lo; k <= hi; k++) this.bins.set(k, (this.bins.get(k) ?? 0) + v / n);
  }
  poc(): number | null {
    let best = -1, bk = 0;
    for (const [k, v] of this.bins) if (v > best) { best = v; bk = k; }
    return best < 0 ? null : r2(bk * 0.05);
  }
}

function slotAvg(base: RvolBase | null | undefined, min: number): number | null {
  if (!base) return null;
  const k = Math.round((min - OPEN_MIN) / 5);
  const v = base.med?.[k] || base.slot[k];
  return v && v > 0 ? v : null;
}

/** 1R'de kapatılacak kontrat (yarısı; 3 kontratta 2) */
export function halfOf(contracts: number | null | undefined): number {
  return Math.max(1, Math.round((contracts ?? 2) / 2));
}

function strikeHint(side: Side, price: number, C: TrackCfg = TRACK_CFG): string {
  const k = Math.round(price / C.strikeStep) * C.strikeStep;
  return `${C.optLabel} ${side === "CALL" ? "C" : "P"} ${C.strikeStep < 1 || k % 1 ? k.toFixed(1) : k} (≈0,45Δ)`;
}

// ── Ana oynatma ──────────────────────────────────────────────────────

export function trackerRead(inp: TrackInput): TrackRead {
  const C = inp.cfg ?? TRACK_CFG;
  const { date, nowSec } = inp;

  const all5 = inp.m5.filter((b) => b.time + 300 <= nowSec);
  const rth5 = all5.filter((b) => isRth(b.time));
  const ema5Map = mapOf(rth5, emaCalc(rth5.map((b) => b.close), 20));
  /** grafikteki EMA20 (04:00'tan itibaren uzatılmış seri) — yalnız sıçrama kırılımı için */
  const emaExtMap = mapOf(all5, emaCalc(all5.map((b) => b.close), 20));
  const atr5Map = mapOf(rth5, atrCalc(rth5, 14));
  const tf15 = tfOf(sessionAggregate(rth5, 15), 15);
  const atr15Arr = atrCalc(tf15.bars, 14);
  const rsi15Arr = rsiCalc(tf15.bars.map((b) => b.close), 14);
  const tf30 = tfOf(sessionAggregate(rth5, 30), 30);
  const frames: PivotFrames = pivotFrames(rth5, inp.h1 ?? null);
  const tf60 = tfOf(frames.h1, 60);
  const tf240 = tfOf(frames.h4, 240);

  // günlük ATR (bilgi)
  const daily = new Map<string, { h: number; l: number; c: number }>();
  for (const b of frames.h1) {
    const ymd = nyParts(b.time).ymd;
    if (ymd >= date) continue;
    const d = daily.get(ymd);
    if (!d) daily.set(ymd, { h: b.high, l: b.low, c: b.close });
    else { d.h = Math.max(d.h, b.high); d.l = Math.min(d.l, b.low); d.c = b.close; }
  }
  const days = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  let atrDaily: number | null = null;
  if (days.length >= 5) {
    const tr = days.slice(1).map((d, i) => Math.max(d.h - d.l, Math.abs(d.h - days[i].c), Math.abs(d.l - days[i].c)));
    const last = tr.slice(-14);
    atrDaily = last.reduce((a, x) => a + x, 0) / last.length;
  }

  const prevRth = rth5.filter((b) => nyParts(b.time).ymd < date);
  const pd = prevRth.length ? nyParts(prevRth[prevRth.length - 1].time).ymd : null;
  const pdBars = pd ? prevRth.filter((b) => nyParts(b.time).ymd === pd) : [];
  const prevClose = inp.prevClose ?? (pdBars.length ? pdBars[pdBars.length - 1].close : null);
  const pdh = pdBars.length ? Math.max(...pdBars.map((b) => b.high)) : null;
  const pdl = pdBars.length ? Math.min(...pdBars.map((b) => b.low)) : null;

  const todayAll = all5.filter((b) => nyParts(b.time).ymd === date);
  const pmBars = todayAll.filter((b) => { const m = nyParts(b.time).minutes; return m >= 4 * 60 && m < OPEN_MIN; });
  const today = todayAll.filter((b) => isRth(b.time));
  const eventDay = inp.eventDay ?? C.eventDays.includes(date);
  /** Cuma: işlem uyarılarına not (kullanıcı isteği) */
  const fridayNote = new Date(`${date}T12:00:00Z`).getUTCDay() === 5 ? " 🕌 Bugün mübarek Cuma günü… Gerekmedikçe işlem açma." : "";

  const steps: TrackStep[] = [];
  const alerts: TrackAlert[] = [];
  const pushAlert = (t: number, level: AlertLevel, tag: SetupTag | null, side: Side | null, text: string) => {
    const key = `${date}|${level}|${tag ?? ""}|${side ?? ""}|${t}`;
    if (!alerts.some((a) => a.key === key)) alerts.push({ t, clock: nyClock(t + 300), level, tag, side, text, key });
  };

  // ── Seans öncesi (bilgi) ──
  const pmHigh = pmBars.length ? Math.max(...pmBars.map((b) => b.high)) : null;
  const pmLow = pmBars.length ? Math.min(...pmBars.map((b) => b.low)) : null;
  const k0At = (price: number, t: number, pmB: Bar[]): TrackK0 => {
    const h4 = emaDir(tf240, t, price).d;
    const h1 = emaDir(tf60, t, price).d;
    const pmVsClose = prevClose == null ? 0 : price > prevClose + 0.05 ? 1 : price < prevClose - 0.05 ? -1 : 0;
    const early = pmB.filter((b) => nyParts(b.time).minutes < 9 * 60);
    const eh = early.length ? Math.max(...early.map((b) => b.high)) : null;
    const el = early.length ? Math.min(...early.map((b) => b.low)) : null;
    const pmBreak = eh != null && el != null && nyParts(t).minutes >= 9 * 60 ? (price > eh ? 1 : price < el ? -1 : 0) : 0;
    // eğilim yalnız seans öncesi fiyat davranışından; 1h/4h bilgi
    const score = pmVsClose + pmBreak;
    return {
      bias: score >= 2 ? "CALL" : score <= -2 ? "PUT" : score > 0 ? "CALL" : score < 0 ? "PUT" : "NÖTR",
      score, parts: { h4, h1, pmVsClose, pmBreak },
      pmHigh: pmB.length ? Math.max(...pmB.map((b) => b.high)) : null,
      pmLow: pmB.length ? Math.min(...pmB.map((b) => b.low)) : null,
      pmLast: pmB.length ? pmB[pmB.length - 1].close : null,
    };
  };
  const zeroBd: Breakdown = { m15: 0, vwap5: 0, ema5: 0, volume: 0, candle: 0, rsi: 0 };
  for (const b of pmBars) {
    const m = nyParts(b.time).minutes;
    if (m < 9 * 60) continue;
    const upto = pmBars.filter((x) => x.time <= b.time);
    const k = k0At(b.close, b.time + 300, upto);
    const gapPts = prevClose != null ? r2(b.close - prevClose) : null;
    const gType = gapPts == null || atrDaily == null ? "FLAT" : Math.abs(gapPts) < 0.25 * atrDaily ? "FLAT" : gapPts > 0 ? "UP" : "DOWN";
    const d: D = k.score > 0 ? 1 : k.score < 0 ? -1 : 0;
    const cd = candleOf(b);
    steps.push({
      t: b.time, clock: nyClock(b.time + 300), min: m + 5, pre: true, is15: false, phase: "PRE", stageLabel: PHASE_TEXT.PRE,
      price: b.close, open: b.open, high: b.high, low: b.low, vwap: null, poc: null, ema5: null, ema15: null, rvol5: null, rvol15: null, atr5: null, devAtr: null, crosses: 0,
      body: cd.body, closePos: cd.closePos, score: k.score, breakdown: zeroBd, threshold: 2, dir: d,
      strength: Math.abs(k.score) >= 2 ? "ORTA" : "ZAYIF",
      trend: d > 0 ? "SEANS ÖNCESİ YUKARI" : d < 0 ? "SEANS ÖNCESİ AŞAĞI" : "SEANS ÖNCESİ NÖTR",
      mom: { impulse: 0, newExt: 0, struct: 0, run: 0, score: 0 },
      htf: { m15: 0, m30: emaDir(tf30, b.time + 300, b.close).d, h1: k.parts.h1 as D, h4: k.parts.h4 as D },
      side15: 0, side5: 0, pattern: null, rsi15: null,
      headline: `${arrow(d)} Seans öncesi ${d > 0 ? "yukarı" : d < 0 ? "aşağı" : "nötr"}`,
      action: `Bilgi — işlem yok. Gap ${gapPts != null ? sgnR(gapPts) : "—"} (${gType === "UP" ? "yukarı" : gType === "DOWN" ? "aşağı" : "yatay"} açılış).${k.pmHigh != null && k.pmLow != null ? ` PM aralığı ${f2(k.pmLow)}–${f2(k.pmHigh)}.` : ""} İlk 15m teyidi 09:45'te.`,
      tone: d > 0 ? "bull" : d < 0 ? "bear" : "neutral",
      checklist: [
        { key: "pm", ok: k.parts.pmVsClose !== 0, text: `PM fiyatı dünkü kapanışın ${k.parts.pmVsClose > 0 ? "üstünde" : k.parts.pmVsClose < 0 ? "altında" : "üzerinde"}` },
        { key: "pmb", ok: k.parts.pmBreak !== 0, text: `PM aralık kırılımı ${k.parts.pmBreak > 0 ? "yukarı" : k.parts.pmBreak < 0 ? "aşağı" : "yok"}` },
      ],
      veto: null, warns: [], setup: null, pos: null, runners: [],
      fc: { dir: 0, target: null, targetLabel: "", invalid: null, invalidLabel: "", rule: null, text: "Seans öncesi — tahmin 09:35'ten itibaren." },
      out: null, c5: candleText(b, null, null, null, "5m (PM)", null), c15: null, events: [],
    });
  }
  const k0 = k0At(pmBars.length ? pmBars[pmBars.length - 1].close : prevClose ?? 0, (today[0]?.time ?? nowSec), pmBars);
  const gapPts = prevClose == null ? null : today.length ? r2(today[0].open - prevClose) : k0.pmLast != null ? r2(k0.pmLast - prevClose) : null;
  const gapType: "UP" | "DOWN" | "FLAT" = gapPts == null || atrDaily == null ? "FLAT" : Math.abs(gapPts) < 0.25 * atrDaily ? "FLAT" : gapPts > 0 ? "UP" : "DOWN";

  // ── RTH ──
  const fine = (inp.fine ?? []).filter((b) => nyParts(b.time).ymd === date && isRth(b.time)).sort((a, b) => a.time - b.time);
  const prof = new Profile();
  let fineIdx = 0;
  let pv = 0, vv = 0;
  const vwaps: number[] = [];
  const vwapAtEnd = new Map<number, number>();
  let crossPrev = 0;
  const crossIdx: number[] = [];
  let crosses = 0;
  let or5: TrackRead["or5"] = null;
  let or15: TrackRead["or15"] = null;
  let dayClass: DayClass | null = null;
  const trades: TrackTrade[] = [];
  let pos: TrackTrade | null = null;
  /** zayıf 15m teyidinde bekleyen tetik (bir 5m kapanış teyidi aranıyor) */
  type PendingWeak = { side: D; close: number; clock: string; tag: SetupTag; what: string; left: number };
  let pendingWeak: PendingWeak | null = null;
  const runners: TrackTrade[] = [];
  let armedNext: TrackRead["armed"] = null;
  let prevArmed: { tag: SetupTag; side: Side } | null = null;
  let runSide = 0, runLen = 0;
  let prevSide15: D = 0;
  let side15Since = -99;
  /** sıçrama kırılımı: teyit bekleyen sinyal */
  let spike: { side: D; close: number; stop: number; clock: string } | null = null;
  /** önceki 5m mumun formasyon yönü */
  let candlePrev: D = 0;
  /** 15m belirsizken oluşan sert hacimli 5m kırılım (destek mumu + 15m teyidi bekleniyor) */
  type Brk = { side: D; clock: string; close: number; mid: number; left: number };
  let brk: Brk | null = null;
  const realized = () => trades.reduce((a, x) => a + (x.resultR ?? 0), 0);

  for (let i = 0; i < today.length; i++) {
    const b = today[i];
    const T = b.time + 300;
    const m = nyParts(b.time).minutes + 5;
    const c = b.close;
    const ev: string[] = [];

    const vol = b.volume || 0;
    pv += ((b.high + b.low + b.close) / 3) * vol;
    vv += vol;
    const vwap = vv > 0 ? pv / vv : null;
    vwaps.push(vwap ?? c);
    if (vwap != null) vwapAtEnd.set(T, vwap);
    if (fine.length) { while (fineIdx < fine.length && fine[fineIdx].time < T) prof.add(fine[fineIdx++]); }
    else prof.add(b);
    const poc = prof.poc();
    if (vwap != null) {
      const s = Math.sign(c - vwap);
      if (s && crossPrev && s !== crossPrev) { crosses++; crossIdx.push(i); }
      if (s) crossPrev = s;
    }

    const ema5 = ema5Map.get(b.time) ?? null;
    const atr5 = atr5Map.get(b.time) ?? null;
    const i15 = closedIdx(tf15.bars, 15, T);
    const b15 = i15 >= 0 ? tf15.bars[i15] : null;
    const today15 = !!b15 && nyParts(b15.time).ymd === date;
    const ema15 = i15 >= 0 ? tf15.ema[i15] : null;
    const atr15 = i15 >= 0 ? atr15Arr[i15] ?? null : null;
    const rsi15 = i15 >= 0 ? rsi15Arr[i15] ?? null : null;
    const rsi15p = i15 > 0 ? rsi15Arr[i15 - 1] ?? null : null;
    const vwap15 = today15 && b15 ? vwapAtEnd.get(barEnd(b15.time, 15)) ?? null : null;
    const is15 = (m - OPEN_MIN) % 15 === 0;

    const sa = slotAvg(inp.rvol, m - 5);
    const rvol5 = sa ? vol / sa : null;
    let rvol15: number | null = null;
    if (is15 && i >= 2 && inp.rvol) {
      const s3 = [0, 1, 2].map((k) => slotAvg(inp.rvol, m - 5 - k * 5) ?? 0).reduce((a, x) => a + x, 0);
      const v3 = today.slice(i - 2, i + 1).reduce((a, x) => a + (x.volume || 0), 0);
      rvol15 = s3 > 0 ? v3 / s3 : null;
    }
    const cd = candleOf(b);

    if (i === 0) { or5 = { high: b.high, low: b.low }; ev.push(`OR5 ${f2(b.low)}–${f2(b.high)}`); }
    if (i === 2) {
      const hi = Math.max(...today.slice(0, 3).map((x) => x.high)), lo = Math.min(...today.slice(0, 3).map((x) => x.low));
      const widthPct = atrDaily ? (hi - lo) / atrDaily : null;
      or15 = { high: hi, low: lo, mid: r2((hi + lo) / 2), widthPct, squeeze: widthPct != null && widthPct < 0.15, orbDisabled: false };
      const q = candleOf({ time: today[0].time, open: today[0].open, high: hi, low: lo, close: c, volume: 0 });
      dayClass = q.body >= 60 && (q.closePos >= 70 || q.closePos <= 30) ? "TREND_CANDLE" : q.body < 15 || q.upper + q.lower > Math.abs(c - today[0].open) ? "INDECISION" : "NORMAL";
      ev.push(`OR15 ${f2(lo)}–${f2(hi)} · ilk 15m mum ${dayClass === "TREND_CANDLE" ? "trend mumu" : dayClass === "INDECISION" ? "kararsız" : "normal"}`);
    }

    // ── 15m yön teyidi + 5m konum ──
    const rawSide15: D = today15 && b15 ? sideOf(b15.close, vwap15, ema15) : 0;
    // net kapanış: 15m kapanış VWAP'ın hemen yanında ise yön sayılmaz (belirsiz — yön her an dönebilir)
    const net15 = !rawSide15 || C.net15Atr <= 0 || (b15 != null && vwap15 != null && atr15 != null && Math.abs(b15.close - vwap15) >= C.net15Atr * atr15);
    const side15: D = net15 ? rawSide15 : 0;
    // 15m VWAP–EMA20 arasında eğilim: kapanış VWAP'ın net altında/üstündeyse o taraf (16 Eki 11:00: VWAP'ın net altı, EMA20 üstü → PUT eğilimi)
    const lead15: D = !today15 || !b15 ? 0
      : C.leadBy === "vwap"
        ? vwap15 != null && atr15 != null && Math.abs(b15.close - vwap15) >= Math.max(C.net15Atr, 0) * atr15 ? (b15.close > vwap15 ? 1 : b15.close < vwap15 ? -1 : 0) : 0
        : ema15 != null ? (b15.close > ema15 ? 1 : b15.close < ema15 ? -1 : 0) : 0;
    const side5: D = sideOf(c, vwap, ema5);
    const vSide: D = vwap == null ? 0 : c > vwap ? 1 : c < vwap ? -1 : 0;
    const eSide: D = ema5 == null ? 0 : c > ema5 ? 1 : c < ema5 ? -1 : 0;
    // hacim çubuğu: ortalamanın üstünde hacimli yön mumu
    const k0i = rth5.findIndex((x) => x.time === b.time);
    const prevV = k0i >= C.volLookback ? rth5.slice(k0i - C.volLookback, k0i).map((x) => x.volume || 0) : [];
    const avgV = prevV.length ? prevV.reduce((a, x) => a + x, 0) / prevV.length : null;
    const barDir: D = c > b.open ? 1 : c < b.open ? -1 : 0;
    const volUp = C.volMode === "rvol" ? rvol5 != null && rvol5 >= C.volRvolMin : avgV != null && vol >= avgV * C.volK;
    const volD: D = volUp ? barDir : 0;
    // mum formasyonu
    let pattern: string | null = null;
    let candleD: D = 0;
    /** yalnız isimli formasyon yönü (genel "güçlü alış/satış mumu" sayılmaz) */
    let namedD: D = 0;
    const hits = detectCandlePatterns(today, i, 10).filter((h) => h.key !== "doji" && h.key !== "insideBar");
    if (hits.length) {
      const best = hits.reduce((a, h) => (h.strength > a.strength ? h : a));
      pattern = best.label;
      candleD = best.direction === "LONG" ? 1 : -1;
      namedD = candleD;
    } else if (cd.body >= C.candleBody && (cd.closePos >= C.candleClosePos || cd.closePos <= 100 - C.candleClosePos)) {
      candleD = cd.closePos >= C.candleClosePos && barDir > 0 ? 1 : cd.closePos <= 100 - C.candleClosePos && barDir < 0 ? -1 : 0;
      if (candleD) pattern = candleD > 0 ? "güçlü alış mumu" : "güçlü satış mumu";
    }
    const prevCandleD: D = candlePrev;
    candlePrev = candleD;
    const rsiD: D = rsi15 == null ? 0 : rsi15 > 50 && (rsi15p == null || rsi15 >= rsi15p) ? 1 : rsi15 < 50 && (rsi15p == null || rsi15 <= rsi15p) ? -1 : 0;

    const breakdown: Breakdown = { m15: 2 * side15, vwap5: vSide, ema5: eSide, volume: volD, candle: candleD, rsi: 0.5 * rsiD };
    const score = r2(Object.values(breakdown).reduce((a, x) => a + x, 0));
    const absS = Math.abs(score);

    // bilgi: momentum + üst zaman dilimleri
    const back = today[Math.max(0, i - 6)];
    const impulse = atr5 ? r2((c - (i >= 6 ? back.close : today[0].open)) / atr5) : 0;
    const dayHiPrev = i > 2 ? Math.max(...today.slice(0, i - 2).map((x) => x.high)) : b.high;
    const dayLoPrev = i > 2 ? Math.min(...today.slice(0, i - 2).map((x) => x.low)) : b.low;
    const rec = today.slice(Math.max(0, i - 2), i + 1);
    const newExt: D = i >= 3 && Math.min(...rec.map((x) => x.low)) < dayLoPrev ? -1 : i >= 3 && Math.max(...rec.map((x) => x.high)) > dayHiPrev ? 1 : 0;
    if (eSide) { if (eSide === runSide) runLen++; else { runSide = eSide; runLen = 1; } }
    const mom: Momentum = { impulse, newExt, struct: 0, run: runSide * runLen, score: (impulse >= 1.5 ? 1 : impulse <= -1.5 ? -1 : 0) + newExt };
    const h4 = emaDir(tf240, T, c), h1 = emaDir(tf60, T, c), m30 = emaDir(tf30, T, c);

    // ── yön durumu ──
    const phaseBase: TrackPhase = m < C.firstEntry ? "AÇILIŞ" : m <= C.trackEnd ? "TAKİP" : "KAPANIŞ";
    let dir: D;
    let trend: string;
    if (side15) {
      dir = side15;
      const w = side15 > 0 ? "YUKARI" : "AŞAĞI";
      if (prevSide15 && prevSide15 === -side15) trend = `15m YÖN DÖNDÜ ${arrow(side15)}`;
      else if (side5 === side15) trend = `15m ${w} · 5m teyitli`;
      else if (side5 === -side15) trend = `15m ${w} · 5m geri çekiliyor`;
      else trend = `15m ${w} · 5m VWAP/EMA20 arasında`;
    } else {
      // 15m belirsiz (VWAP ile EMA20 arasında / henüz 15m yok): eğilim 5m + belirsizlik teyitleriyle
      // 15m VWAP–EMA20 arasında: eğilim = 15m EMA20 tarafı (tetik de bu yönde aranır); 5m puanı buna güçlü ters ise eğilim yok
      const l15: D = lead15;
      const lean: D = l15 ? (l15 * score > -2 ? l15 : 0) : absS >= 2 ? (Math.sign(score) as D) : 0;
      dir = lean;
      trend = phaseBase === "AÇILIŞ" ? `AÇILIŞ · 5m ${side5 > 0 ? "VWAP+EMA20 üstü" : side5 < 0 ? "VWAP+EMA20 altı" : "karışık"} (15m teyidi 09:45)` : rawSide15 && !net15 ? `15m NET DEĞİL (kapanış VWAP'a çok yakın)${lean ? ` · eğilim ${arrow(lean)}` : ""}` : `15m BELİRSİZ (VWAP–EMA20 arası)${lean ? ` · eğilim ${arrow(lean)}` : ""}`;
    }
    if (side15 && prevSide15 !== side15 && today15) side15Since = i;
    if (side15 && prevSide15 !== side15) {
      ev.push(`15m yön ${prevSide15 ? "değişti" : "belirlendi"}: ${side15 > 0 ? "▲ VWAP+EMA20 üstü" : "▼ VWAP+EMA20 altı"}`);
      if (phaseBase !== "KAPANIŞ") pushAlert(b.time, "KADEME", null, side15 > 0 ? "CALL" : "PUT", `15m yön ${side15 > 0 ? "▲ YUKARI" : "▼ AŞAĞI"} (VWAP ${vwap15 != null ? f2(vwap15) : "—"} · EMA20 ${ema15 != null ? f2(ema15) : "—"})`);
    } else if (!side15 && prevSide15 && today15) ev.push("15m kapanış VWAP–EMA20 arasına girdi — yön belirsizleşti");
    const strength: TrackStep["strength"] = absS >= 6 ? "ÇOK GÜÇLÜ" : absS >= 4.5 ? "GÜÇLÜ" : absS >= 3 ? "ORTA" : "ZAYIF";

    // seviyeler
    const dayHi = Math.max(...today.slice(0, i + 1).map((x) => x.high));
    const dayLo = Math.min(...today.slice(0, i + 1).map((x) => x.low));
    const lvls: { price: number; label: string }[] = [
      ...(vwap != null ? [{ price: vwap, label: "VWAP" }] : []),
      ...(or15 ? [{ price: or15.high, label: "OR15 tepe" }, { price: or15.low, label: "OR15 dip" }] : or5 ? [{ price: or5.high, label: "OR5 tepe" }, { price: or5.low, label: "OR5 dip" }] : []),
      ...(pdh != null ? [{ price: pdh, label: "dünkü tepe" }] : []), ...(pdl != null ? [{ price: pdl, label: "dünkü dip" }] : []),
      ...(prevClose != null ? [{ price: prevClose, label: "dünkü kapanış" }] : []),
      ...(pmHigh != null ? [{ price: pmHigh, label: "PM tepe" }] : []), ...(pmLow != null ? [{ price: pmLow, label: "PM dip" }] : []),
      ...(poc != null ? [{ price: poc, label: "POC" }] : []),
      { price: dayHi, label: "gün tepesi" }, { price: dayLo, label: "gün dibi" },
      ...pivotLevelsAt(frames, today.slice(0, i + 1), T).map((l) => ({ price: l.price, label: `pivot ${l.label}` })),
    ];
    const a15 = atr15 ?? (atr5 ? atr5 * 1.7 : 1);
    const nextLevel = (d: 1 | -1, from: number, minDist: number) =>
      lvls.filter((l) => d * (l.price - from) >= minDist).sort((x, y) => d * (x.price - y.price))[0] ?? null;

    // ── pozisyon yönetimi ──
    let entered: TrackTrade | null = null;
    let exited: TrackTrade | null = null;
    const manage = (p: TrackTrade): boolean => {
      let out = false;
      const d = dOfSide(p.side);
      p.barsHeld++;
      p.mfeR = Math.max(p.mfeR, r2((d > 0 ? b.high - p.entry : p.entry - b.low) / p.rPts));
      p.maeR = Math.max(p.maeR, r2((d > 0 ? p.entry - b.low : b.high - p.entry) / p.rPts));
      const h1R = r2((d * (p.h1 - p.entry)) / p.rPts);
      const close = (px: number, why: ExitReason) => {
        const rest = r2((d * (px - p.entry)) / p.rPts);
        p.exit = r2(px); p.exitTime = b.time; p.exitClock = nyClock(T); p.exitReason = why;
        p.resultR = r2(p.h1Hit && (C.exitMode === "half" || C.exitMode === "half15") ? 0.5 * h1R + 0.5 * rest : rest);
        p.liveR = null;
        exited = p;
        out = true;
      };
      const regimeOn = ema5 != null && vwap != null && d * (ema5 - vwap) > 0;
      if (C.exitMode === "half15" && p.h1Hit && C.runnerEma && regimeOn) {
        // EMA20–VWAP rejimi sürüyor: düzeltmeler EMA20'de karşılanır — çıkış yalnız 5m kapanış EMA20'nin ters tarafında (ya da başabaş stop)
        const lim = (ema5 as number) + d * (atr5 ?? 0) * C.runnerEmaBufAtr5;
        if (p.stop === p.entry && (d > 0 ? b.low <= p.stop : b.high >= p.stop)) close(p.stop, "H1_BE");
        else if (d * (c - lim) < 0) close(c, "EMA_EXIT");
        else if (is15 && b15 && today15) {
          const buf = (atr15 ?? (atr5 ? atr5 * 1.7 : 0.3)) * C.trailBufAtr15;
          const ns = r2(d > 0 ? b15.low - buf : b15.high + buf);
          // 15m izi kayıt olarak güncellenir (rejim biterse devreye girer)
          if (d * (ns - p.stop) > 0 && d * (c - ns) > 0) p.stop = ns;
        }
      } else if (C.exitMode === "half15" && p.h1Hit) {
        // kalan yarı: stop (giriş ya da son 15m dip/tepe izi) olana kadar taşı
        if (C.trailOnClose && p.stop !== p.entry ? d * (c - p.stop) <= 0 : d > 0 ? b.low <= p.stop : b.high >= p.stop) close(C.trailOnClose && p.stop !== p.entry ? c : p.stop, p.stop === p.entry ? "H1_BE" : "TRAIL_15M");
        else if (C.runnerFlip && side15 === -d) close(c, "TREND_FLIP");
        else if (is15 && b15 && today15) {
          const buf = (atr15 ?? (atr5 ? atr5 * 1.7 : 0.3)) * C.trailBufAtr15;
          const ns = r2(d > 0 ? b15.low - buf : b15.high + buf);
          if (d * (ns - p.stop) > 0 && d * (c - ns) > 0) {
            p.stop = ns;
            pushAlert(b.time, "YÖNET", p.tag, p.side, `15m kapanış: stopu ${f2(ns)}'e taşı (15m ${d > 0 ? "dibi" : "tepesi"} ${f2(d > 0 ? b15.low : b15.high)} ∓ tampon)`);
            ev.push(`stop 15m ${d > 0 ? "dibinin" : "tepesinin"} ötesine taşındı → ${f2(ns)}`);
          }
        }
      } else if (C.exitMode === "trail" && p.h1Hit) {
        if (d > 0 ? b.low <= p.stop : b.high >= p.stop) close(p.stop, "H1_BE");
        else if (C.exitOn15Flip && side15 === -d) close(c, "TREND_FLIP");
        else if (ema5 != null && d * (c - ema5) < 0) close(c, "EMA_EXIT");
      } else if (!p.h1Hit) {
        p.againstBars = d * (c - b.open) < 0 ? (p.againstBars ?? 0) + 1 : 0;
        const revExit = C.earlyExitBars > 0 && p.mfeR >= C.earlyExitArmR && p.againstBars >= C.earlyExitBars;
        if (d > 0 ? b.low <= p.stop : b.high >= p.stop) close(p.stop, "STOP");
        else if (revExit) close(c, "REV_2BAR");
        else if ((C.exitMode === "full" || (p.chop && C.chopExit === "full")) && (d > 0 ? b.high >= p.h1 : b.low <= p.h1)) { p.h1Hit = true; p.h1Clock = nyClock(T); close(p.h1, "H1"); }
        else if (C.exitMode === "trail" && (d > 0 ? b.high >= p.h1 : b.low <= p.h1)) {
          // taşıma: 1R'de stop girişe; hedef yok — trend 5m EMA20 bozulana kadar
          p.h1Hit = true; p.h1Clock = nyClock(T); p.stop = p.entry;
          pushAlert(b.time, "YÖNET", p.tag, p.side, `+1R ${f2(p.h1)} geldi: stopu girişe (${f2(p.entry)}) çek · trend sürüyor, 5m EMA20 ${d > 0 ? "altına" : "üstüne"} kapanışa kadar taşı`);
          ev.push(`+1R — stop girişe, taşınıyor`);
          if (ema5 != null && d * (c - ema5) < 0) close(c, "EMA_EXIT");
        }
        else if (d > 0 ? b.high >= p.h1 : b.low <= p.h1) {
          p.h1Hit = true; p.h1Clock = nyClock(T); p.stop = p.entry;
          pushAlert(b.time, "YÖNET", p.tag, p.side, C.exitMode === "half15" ? `${C.h1R}R ${f2(p.h1)} geldi: yarısını kapat (${halfOf(p.contracts)} / ${p.contracts ?? 2} kontrat), stopu girişe (${f2(p.entry)}) çek · kalanı her 15m kapanışında 15m ${d > 0 ? "dibi" : "tepesi"} ∓ tampona taşı` : `H1 ${f2(p.h1)} geldi: yarısını kapat, stopu girişe (${f2(p.entry)}) çek · kalan 5m EMA20 kırılınca ya da 15m yön dönünce`);
          ev.push(`H1 ${f2(p.h1)} — yarısı alındı, stop girişe`);
        } else if (C.exitOn15Flip && side15 === -d) close(c, "TREND_FLIP");
        else if (C.timeStopBars > 0 && p.barsHeld >= C.timeStopBars && d * (c - p.entry) < 0) close(c, "TIME");
      } else {
        if (d > 0 ? b.low <= p.entry : b.high >= p.entry) close(p.entry, "H1_BE");
        else if (d > 0 ? b.high >= p.h2 : b.low <= p.h2) close(p.h2, "H2");
        else if (C.exitOn15Flip && side15 === -d) close(c, "TREND_FLIP");
        else if (ema5 != null && d * (c - ema5) < 0) close(c, "EMA_EXIT");
      }
      if (!out && m >= C.forceExit) close(c, "FORCE_1545");
      if (out) {
        const x: TrackTrade = p;
        pushAlert(b.time, "ÇIKIŞ", x.tag, x.side, `ÇIKIŞ ${x.side} · ${x.exitReason} ${f2(x.exit as number)} · sonuç ${sgnR(x.resultR as number)}R`);
        ev.push(`ÇIKIŞ ${x.exitReason} ${f2(x.exit as number)} → ${sgnR(x.resultR as number)}R`);
      } else {
        const rest = r2((d * (c - p.entry)) / p.rPts);
        p.liveR = r2(p.h1Hit && (C.exitMode === "half" || C.exitMode === "half15") ? 0.5 * h1R + 0.5 * rest : rest);
      }
      return out;
    };
    // kalan yarılar (half15: 1R'den sonra stop girişte, 15m izleyen stop) — yeni girişleri engellemez
    for (const rn of [...runners]) if (manage(rn)) runners.splice(runners.indexOf(rn), 1);
    if (pos) {
      const p: TrackTrade = pos;
      if (manage(p)) pos = null;
      else if (C.exitMode === "half15" && C.runnerParallel && p.h1Hit) { runners.push(p); pos = null; }
    }

    // ── sıçrama kırılımı (T5_BRK): 15m teyidi beklenmez ──
    if (C.brkSpike) {
      const eX = emaExtMap.get(b.time) ?? null;
      // teyit: sinyalden sonraki ilk 5m kapanış
      if (spike) {
        const sp = spike;
        spike = null;
        const sd = sp.side;
        const okC = !pos && sd * (c - b.open) > 0 && sd * (c - sp.close) > 0 && vwap != null && eX != null && sd * (c - vwap) > 0 && sd * (c - eX) > 0
          && trades.length < C.maxTrades && m <= C.lastEntry;
        if (okC) {
          const s: Side = sd > 0 ? "CALL" : "PUT";
          const minStop = Math.max(atr5 ? C.minStopAtr5 * atr5 : 0.1, C.minStopPts);
          let stop = sp.stop;
          let premTxt = "";
          if (C.premStopPct > 0 && C.stopPremOnly && atr5) {
            const premEst = C.premK * atr5 * Math.sqrt(Math.max(1, (16 * 60 - m) / 5));
            stop = c - sd * Math.max(minStop, (C.premStopPct * premEst) / C.optDelta);
            premTxt = `stop: tahmini prim $${premEst.toFixed(2)} × %${Math.round(C.premStopPct * 100)}`;
          }
          if (sd * (c - stop) < minStop) stop = c - sd * minStop;
          stop = r2(stop);
          const rPts = r2(Math.abs(c - stop));
          const riskUsd = inp.riskUsd && inp.riskUsd > 0 ? inp.riskUsd : C.riskUsd;
          const perC = rPts * C.optDelta * 100;
          const momPts = [(rvol5 ?? 0) >= C.sizeRvol, atr5 != null && sd * impulse >= C.sizeImpulse, newExt === sd, runners.some((x) => dOfSide(x.side) === sd && (x.liveR ?? 0) > 0)];
          const contracts = C.sizeMode === "momentum"
            ? Math.min(C.sizeMax, C.sizeBase + momPts.filter(Boolean).length)
            : Math.max(1, Math.min(C.sizeRiskMax, Math.floor(riskUsd / Math.max(perC, 1))));
          const tp1 = r2(c + sd * C.h1R * rPts);
          const h2 = r2(c + sd * C.h2R * rPts);
          const why = `${sp.clock} sert hacimli mum VWAP+EMA20'yi kesti + ${nyClock(T)} aynı yönde 5m kapanış (15m beklenmedi)`;
          const momWhy = C.sizeMode === "momentum"
            ? [`momentum: taban ${C.sizeBase} + ${[momPts[0] && `RVOL ${(rvol5 ?? 0).toFixed(1)}`, momPts[1] && "30 dk itki", momPts[2] && `yeni gün ${sd > 0 ? "tepesi" : "dibi"}`, momPts[3] && "kârdaki taşınan pozisyon"].filter(Boolean).join(", ") || "ek işaret yok"} → ${contracts} kontrat`, ...(premTxt ? [premTxt] : [])]
            : [`risk $${Math.round(riskUsd)} ÷ (stop ${f2(rPts)} × Δ${C.optDelta} × 100 = $${Math.round(perC)}) → ${contracts} kontrat`];
          const tr: TrackTrade = {
            id: `${date}-${nyClock(T).replace(":", "")}-T5_BRK`, tag: "T5_BRK", reentry: trades.length > 0, side: s, stage: "TAKİP",
            entryTime: b.time, entryClock: nyClock(T), entry: r2(c), stop, stop0: stop, rPts, h1: tp1, h2, size: "full", confirm10: null, contracts, momWhy,
            strike: strikeHint(s, c, C), exitTime: null, exitClock: null, exit: null, exitReason: null, resultR: null, mfeR: 0, maeR: 0,
            chop: false, h1RMult: C.h1R, barsHeld: 0, scoreEntry: score, rvolEntry: rvol5 != null ? r2(rvol5) : null, dayClass, bias: k0.bias, gapType, eventDay, h1Hit: false, h1Clock: null, liveR: 0, why,
          };
          trades.push(tr);
          pos = tr;
          entered = tr;
          pushAlert(b.time, "TETİK", "T5_BRK", s, `TETİK · ${nyClock(T)} · ${s} ${contracts} kontrat · giriş ${f2(c)} · stop ${f2(stop)} · 1R ${f2(tp1)} · ${why} · ${momWhy.join(" · ")}${fridayNote}`);
          ev.push(`GİRİŞ ${s} ${f2(c)} · stop ${f2(stop)} · H1 ${f2(tp1)} — sıçrama kırılımı teyit edildi`);
        } else if (!pos) {
          ev.push(`${sp.clock} sıçrama kırılımı teyit edilmedi (${nyClock(T)} kapanışı ${f2(c)})`);
          pushAlert(b.time, "İPTAL", "T5_BRK", sd > 0 ? "CALL" : "PUT", `İPTAL · ${sp.clock} sıçrama kırılımı: sonraki 5m aynı yönde kapanmadı (${f2(c)})`);
        }
      }
      // sinyal: sert + hacimli mum VWAP ve EMA20'yi (uzatılmış) kesti
      const rngS = b.high - b.low;
      const dS: D = c > b.open ? 1 : c < b.open ? -1 : 0;
      if ((!pos || dOfSide((pos as TrackTrade).side) !== dS) && !entered && dS && vwap != null && eX != null && atr5 && rngS > 0 && m >= OPEN_MIN + 10 && m + 5 <= C.lastEntry) {
        const prev = i > 0 ? today[i - 1] : null;
        const prevVw = i > 0 ? vwaps[i - 1] : null;
        const prevE = prev ? emaExtMap.get(prev.time) ?? null : null;
        const beyondNow = dS * (c - vwap) > 0 && dS * (c - eX) > 0;
        const wasNot = dS * (b.open - vwap) <= 0 || dS * (b.open - eX) <= 0
          || (!!prev && prevVw != null && prevE != null && (dS * (prev.close - prevVw) <= 0 || dS * (prev.close - prevE) <= 0));
        const strong = (Math.abs(c - b.open) / rngS) * 100 >= C.brkBodyPct && rngS >= C.brkRangeAtr5 * atr5;
        const heavy = (rvol5 ?? 0) >= C.brkRvolMin;
        if (beyondNow && wasNot && strong && heavy) {
          spike = { side: dS, close: r2(c), stop: r2(dS > 0 ? b.low - C.stopPad : b.high + C.stopPad), clock: nyClock(T) };
          const sk: Side = dS > 0 ? "CALL" : "PUT";
          ev.push(`ERKEN UYARI: sert hacimli ${dS > 0 ? "yeşil" : "kırmızı"} mum VWAP ${f2(vwap)} + EMA20 ${f2(eX)} ${dS > 0 ? "üstüne" : "altına"} kapandı (RVOL ${(rvol5 as number).toFixed(2)}) — sonraki 5m aynı yönde ${f2(c)} ${dS > 0 ? "üstünde" : "altında"} kapanırsa ${sk}`);
          pushAlert(b.time, "KADEME", "T5_BRK", sk, `ERKEN UYARI · ${sk} sıçrama kırılımı: sert hacimli 5m mum VWAP + EMA20'yi kesti (${f2(c)}, RVOL ${(rvol5 as number).toFixed(2)}) — ${hm(m + 5)} mumu ${dS > 0 ? "yeşil ve " + f2(c) + " üstünde" : "kırmızı ve " + f2(c) + " altında"} kapanırsa giriş · stop ${f2(spike.stop)}${fridayNote}`);
        }
      }
    }

    // ── 5m tetik (15m yönünde) ──
    const warns: VetoCode[] = [];
    if (rvol5 != null && rvol5 < C.warnRvol) warns.push("LOW_RVOL");
    if (crossIdx.filter((k) => k > i - 12).length >= C.warnChop) warns.push("VWAP_CHOP");
    if (vwap != null && poc != null && Math.abs(vwap - poc) >= 0.05 && c > Math.min(vwap, poc) && c < Math.max(vwap, poc)) warns.push("VWAP_POC_ZONE");
    if (eventDay) warns.push("EVENT_K1");

    // tetik yönü = 15m yönü; 15m VWAP–EMA20 arasındaysa (mixedEntry) 15m EMA20 tarafı — o zaman hacim VE formasyon birlikte aranır
    const lean15: D = lead15;
    const mixed = !side15 && C.mixedEntry && !!lean15 && (C.mixedMinRvol <= 0 || (rvol5 ?? 0) >= C.mixedMinRvol)
      && (!C.mixedStrong15 || (!!b15 && lean15 * (b15.close - b15.open) > 0 && b15.high > b15.low && (lean15 > 0 ? b15.close - b15.low : b15.high - b15.close) / (b15.high - b15.low) >= 0.5));
    const d: D = side15 || (mixed ? lean15 : 0);
    // sert hacimli kırılım takibi (16 Eki 11:10: 15m VWAP'ın net altı/EMA20 üstü, sert hacimli kırmızı 5m → 11:15 destek mumu + 15m ▼)
    let brkOk: Brk | null = null;
    if (brk) {
      const k: Brk = brk;
      brk = null;
      const hold = vSide === k.side && eSide === k.side && k.side * (c - k.mid) > 0;
      const sup = (rvol5 ?? 0) >= C.brkSupRvol;
      if (!pos && hold && sup && side15 === k.side) brkOk = k;
      else if (!pos && hold && k.left > 1) brk = { ...k, left: k.left - 1 };
      else if (!pos) {
        const why = !hold ? `kapanış ${f2(c)} kırılımı tutmadı` : !sup ? `destek mumu hacimsiz (RVOL ${rvol5 != null ? rvol5.toFixed(2) : "—"} < ${C.brkSupRvol})` : "15m yön teyidi gelmedi";
        ev.push(`${k.clock} sert hacimli kırılım teyit edilmedi — ${why}`);
        pushAlert(b.time, "İPTAL", "T5_TREND", k.side > 0 ? "CALL" : "PUT", `İPTAL · ${k.clock} kırılımı: ${why}`);
      }
    }
    if (C.brkRvol > 0 && !pos && !brkOk && !side15 && lead15 && phaseBase === "TAKİP" && m >= C.firstEntry && m + 5 <= C.lastEntry && trades.length < C.maxTrades
      && vSide === lead15 && eSide === lead15 && volD === lead15 && (rvol5 ?? 0) >= C.brkRvol && lead15 * (c - b.open) > 0) {
      brk = { side: lead15, clock: nyClock(T), close: r2(c), mid: r2((b.open + c) / 2), left: C.brkBars };
      const sk: Side = lead15 > 0 ? "CALL" : "PUT";
      ev.push(`sert hacimli ${lead15 > 0 ? "yukarı" : "aşağı"} kırılım (RVOL ${(rvol5 as number).toFixed(2)}) — 15m belirsiz, bu mumda giriş yok; destek hacimli 5m kapanış + 15m ${arrow(lead15)} teyidi bekleniyor`);
      pushAlert(b.time, "KADEME", "T5_TREND", sk, `${sk} hazırlığı · sert hacimli kırılım ${f2(c)} — ${hm(m + 5)} kapanışı ${f2((b.open + c) / 2)} ${lead15 > 0 ? "üstünde" : "altında"}, hacimli ve 15m ${arrow(lead15)} teyitli olursa giriş${fridayNote}`);
    }
    let checklist: CheckItem[] = [];
    let setup: TrackSetup | null = null;
    armedNext = null;
    if (d && phaseBase === "TAKİP" && m >= C.firstEntry) {
      const s: Side = d > 0 ? "CALL" : "PUT";
      const prevB = i > 0 ? today[i - 1] : null;
      const prevSide5 = prevB ? sideOf(prevB.close, vwaps[i - 1] ?? null, ema5Map.get(prevB.time) ?? null) : 0;
      // geri çekilme: son 2 mumda EMA20 ya da VWAP'a dokunuş
      const near = (atr5 ?? 0) * C.touchAtr;
      const touched = today.slice(Math.max(0, i - 2), i + 1).some((x, k) => {
        const idx = Math.max(0, i - 2) + k;
        const e = ema5Map.get(x.time), vw = vwaps[idx];
        const hit = (lv: number) => (d > 0 ? x.low <= lv + near && x.high >= lv - near : x.high >= lv - near && x.low <= lv + near);
        return (e != null && hit(e)) || (vw != null && hit(vw));
      });
      const priorN = C.freshBreakBars > 0 && i >= C.freshBreakBars ? today.slice(i - C.freshBreakBars, i) : [];
      const brkConf = C.freshBreakConfirm === "none" ? true : C.freshBreakConfirm === "vol" ? volD === d : C.freshBreakConfirm === "both" ? volD === d && candleD === d : volD === d || (rvol5 ?? 0) >= 1.5;
      const brkCtx = (!C.freshBreakPrevCandle || prevCandleD !== -d);
      const brkNear = C.freshBreakMaxVwapAtr15 <= 0 || (vwap != null && atr15 != null && Math.abs(c - vwap) <= C.freshBreakMaxVwapAtr15 * atr15);
      const brokeOut = brkConf && brkCtx && brkNear && priorN.length > 0 && (d > 0 ? c > Math.max(...priorN.map((x) => x.high)) : c < Math.min(...priorN.map((x) => x.low)));
      const fresh = C.fresh === "any" || prevSide5 !== d || touched || brokeOut || (C.fresh15Bars > 0 && side15 === d && i - side15Since < C.fresh15Bars);
      const vcCandle: D = C.namedVC ? namedD : candleD;
      const confirmVC = mixed ? volD === d && vcCandle === d : volD === d || vcCandle === d;
      // gürültü mumu: aralık < minBarAtr5 × ATR5 → sinyal değil
      const barRangeOk = C.minBarAtr5 <= 0 || !atr5 || b.high - b.low >= C.minBarAtr5 * atr5;
      // sahte kırılım / ters isimli formasyon
      const opposeNamed = C.blockOpposeNamed && namedD === -d;
      // testere: fiyat VWAP etrafında VE hacim düşük (son chopBars mum, medyan)
      const chopNow = (() => {
        if (!C.chopBlock || !atr5 || !inp.rvol || i < C.chopBars - 1) return false;
        const ds: number[] = [], rs: number[] = [];
        for (let q = i - C.chopBars + 1; q <= i; q++) {
          const bq = today[q];
          const sq = slotAvg(inp.rvol, nyParts(bq.time).minutes);
          if (!sq) return false;
          ds.push(Math.abs(bq.close - (vwaps[q] ?? bq.close)));
          rs.push((bq.volume || 0) / sq);
        }
        const med = (xs: number[]) => { const y = [...xs].sort((u, v) => u - v); const n = y.length; return n % 2 ? y[(n - 1) / 2] : (y[n / 2 - 1] + y[n / 2]) / 2; };
        return med(ds) <= C.chopDistAtr5 * atr5 && med(rs) < C.chopRvolMax;
      })();
      // belirsizlikte (hacim ve formasyon yön vermiyorsa): RVOL ≥ 1 VE RSI 15m yönü
      const tiebreak = C.useTiebreak && !mixed && !confirmVC && volD !== -d && candleD !== -d && (rvol5 ?? 0) >= C.rvolConfirm && rsiD === d;
      checklist = [
        { key: "m15", ok: true, text: mixed ? `15m VWAP–EMA20 arasında, EMA20 ${ema15 != null ? f2(ema15) : "—"} ${d > 0 ? "üstünde" : "altında"} → hacim VE formasyon birlikte aranır` : `15m kapanış VWAP ${vwap15 != null ? f2(vwap15) : "—"} ve EMA20 ${ema15 != null ? f2(ema15) : "—"} ${d > 0 ? "üstünde" : "altında"}` },
        { key: "vwap5", ok: vSide === d, price: true, text: `5m kapanış VWAP ${vwap != null ? f2(vwap) : "—"} ${d > 0 ? "üstünde" : "altında"}` },
        { key: "ema5", ok: eSide === d, price: true, text: `5m kapanış EMA20 ${ema5 != null ? f2(ema5) : "—"} ${d > 0 ? "üstünde" : "altında"}` },
        { key: "volume", ok: volD === d, text: C.volMode === "rvol" ? `hacim: ${d > 0 ? "yeşil" : "kırmızı"} mum + RVOL ≥ ${C.volRvolMin} (saat-normalize, şu an ${rvol5 != null ? rvol5.toFixed(2) : "—"})` : `hacim çubuğu ${d > 0 ? "alış" : "satış"} yönünde (≥ son ${C.volLookback} mum ort.)` },
        { key: "candle", ok: vcCandle === d, text: `${C.namedVC ? "isimli mum formasyonu" : "mum formasyonu"} ${d > 0 ? "yukarı" : "aşağı"}${pattern && vcCandle === d ? ` — ${pattern}` : ""}` },
        ...(C.minBarAtr5 > 0 ? [{ key: "range", ok: barRangeOk, text: `mum aralığı ≥ ${C.minBarAtr5} ATR5 (şu an ${atr5 ? ((b.high - b.low) / atr5).toFixed(2) : "—"})` }] : []),
        ...(opposeNamed ? [{ key: "trap", ok: false, text: `tetik mumunda yön tersi formasyon (${pattern ?? "tuzak"}) — sahte kırılım riski` }] : []),
        ...(chopNow ? [{ key: "chop", ok: false, text: `testere: fiyat VWAP etrafında, hacim düşük (son ${C.chopBars} mum) — işlem yok` }] : []),
        ...(confirmVC ? [] : [{ key: "tiebreak", ok: tiebreak, text: `belirsizlik teyidi: RVOL ≥ ${C.rvolConfirm} (${rvol5 != null ? rvol5.toFixed(2) : "—"}) + RSI 15m ${d > 0 ? "yukarı" : "aşağı"} (${rsi15 != null ? rsi15.toFixed(0) : "—"})` }]),
        ...(C.entryClosePos > 0 ? [{ key: "closepos", price: true, ok: d > 0 ? cd.closePos >= C.entryClosePos : cd.closePos <= 100 - C.entryClosePos, text: `kapanış mumun ${d > 0 ? "tepesine" : "dibine"} yakın (aralığın yön ucundaki %${100 - C.entryClosePos}'i · şu an %${Math.round(d > 0 ? 100 - cd.closePos : cd.closePos)})` }] : []),
        { key: "fresh", ok: fresh, text: "taze tetik: 5m hizası bu mumda oluştu ya da EMA20/VWAP'a geri çekilme sonrası" },
      ];
      const regimeD: D = ema5 != null && vwap != null ? (ema5 > vwap ? 1 : ema5 < vwap ? -1 : 0) : 0;
      const slopeOk = C.vwapSlopeBars <= 0 || (i >= C.vwapSlopeBars && vwap != null && vwaps[i - C.vwapSlopeBars] != null && d * (vwap - (vwaps[i - C.vwapSlopeBars] as number)) > 0);
      const allOk = vSide === d && (!C.needEma5 || eSide === d) && (!C.needVC || confirmVC || tiebreak) && fresh && slopeOk && (C.regimeEntry !== "require" || regimeD === d) && barRangeOk && !opposeNamed && !chopNow;
      const tag: SetupTag = touched && prevSide5 === d ? "T5_PB" : "T5_TREND";
      // zayıf 15m teyidi: 15m kapanış VWAP/EMA20'nin doğru tarafında ama mumun kendisi yöne ters (16 Eki 09:45: kırmızı 15m mumla CALL)
      const weak15 = C.weak15Confirm && today15 && !!b15 && (() => {
        const rng = b15.high - b15.low;
        const colorAgainst = d * (b15.close - b15.open) < 0;
        const halfAgainst = rng > 0 && (d > 0 ? (b15.close - b15.low) / rng : (b15.high - b15.close) / rng) < 0.5;
        return colorAgainst || halfAgainst;
      })();
      const weakWhat = b15 && weak15 ? `15m mum ${d * (b15.close - b15.open) < 0 ? (d > 0 ? "kırmızı" : "yeşil") : "aralığının ters yarısında"} kapandı` : "";
      // bekleyen zayıf-teyit tetiği: bu 5m kapanış onaylıyor mu?
      let confirmed: { tag: SetupTag; clock: string; what: string } | null = null;
      if (pendingWeak) {
        const pw: PendingWeak = pendingWeak;
        pendingWeak = null;
        const dirBar = d * (c - b.open) > 0 && cd.body >= C.confirmBody && (d > 0 ? cd.closePos : 100 - cd.closePos) >= C.confirmClosePos;
        const ok = !pos && pw.side === d && vSide === d && eSide === d && d * (c - pw.close) > 0 && (C.confirmBody === 0 || dirBar);
        if (ok && pw.left <= 1) confirmed = { tag: pw.tag, clock: pw.clock, what: pw.what };
        else if (ok) {
          pendingWeak = { ...pw, close: r2(c), left: pw.left - 1 };
          ev.push(`${pw.clock} tetiği: 5m kapanış teyidi ${C.confirmBars - pw.left + 1}/${C.confirmBars} — bir kapanış daha bekleniyor`);
        } else if (!pos) {
          ev.push(`${pw.clock} tetiğinin 5m kapanış teyidi gelmedi — iptal`);
          pushAlert(b.time, "İPTAL", pw.tag, d > 0 ? "CALL" : "PUT", `İPTAL · ${pw.clock} tetiği teyit edilmedi (${C.confirmBars - pw.left + 1}. teyit kapanışı ${f2(c)} onaylamadı)`);
        }
      }
      // stop
      const two = today.slice(Math.max(0, i - C.stopBars + 1), i + 1);
      let stop = C.stopMode === "bar"
        ? (d > 0 ? Math.min(...two.map((x) => x.low)) : Math.max(...two.map((x) => x.high))) - d * (C.stopPad + (C.stopBufAtr15 > 0 ? (atr15 ?? (atr5 ? atr5 * 1.7 : 0.3)) * C.stopBufAtr15 : 0))
        : (d > 0 ? Math.min(vwap ?? c, ema5 ?? c) : Math.max(vwap ?? c, ema5 ?? c)) - d * C.stopPad;
      const minStop = Math.max(atr5 ? C.minStopAtr5 * atr5 : 0.1, C.minStopPts);
      if (d * (c - stop) < minStop) stop = c - d * minStop;
      // %25 prim sınırı: mum uzunsa yapısal stop genişler → tahmini primin %25'iyle kısıtlanır
      let premInfo = "";
      if (C.premStopPct > 0 && atr5) {
        const barsLeft = Math.max(1, (16 * 60 - m) / 5);
        const premEst = C.premK * atr5 * Math.sqrt(barsLeft);
        const capPts = Math.max(minStop, (C.premStopPct * premEst) / C.optDelta);
        if (C.stopPremOnly) {
          stop = c - d * capPts;
          premInfo = `stop: tahmini prim $${premEst.toFixed(2)} × %${Math.round(C.premStopPct * 100)} ≈ ${capPts.toFixed(2)} SPY puanı`;
        } else if (d * (c - stop) > capPts) {
          stop = c - d * capPts;
          premInfo = `stop: tahmini prim $${premEst.toFixed(2)} × %${Math.round(C.premStopPct * 100)} ≈ ${capPts.toFixed(2)} puan (yapısal stop daha genişti)`;
        }
      }
      stop = r2(stop);
      // zayıf 15m teyidinde tetik mumunda girme: bir sonraki 5m kapanış teyidini bekle
      const needConfirm = weak15 || C.confirmAll;
      if (!pos && !confirmed && !pendingWeak && allOk && needConfirm && trades.length < C.maxTrades && !exited && m + 5 <= C.lastEntry) {
        pendingWeak = { side: d, close: r2(c), clock: nyClock(T), tag, what: weak15 ? weakWhat : "teyit kuralı", left: C.confirmBars };
        ev.push(`${s} tetiği oluştu${weak15 ? ` ama 15m teyit zayıf (${weakWhat})` : ""} — ${C.confirmBars} adet aynı yönde 5m kapanış bekleniyor (her biri öncekinin ${d > 0 ? "üstünde" : "altında"} ve VWAP+EMA20 ${d > 0 ? "üstünde" : "altında"}); ilki ${hm(m + 5)} kapanışı ${f2(c)} ${d > 0 ? "üstünde" : "altında"}`);
        pushAlert(b.time, "KADEME", tag, s, `${s} tetiği${weak15 ? " · 15m teyit zayıf" : ""} — ${C.confirmBars} aynı yönde 5m kapanış (ilk 3 dk yönde) gelirse giriş (ilki ${hm(m + 5)}: ${f2(c)} ${d > 0 ? "üstünde" : "altında"})${fridayNote}`);
      }
      const brkHit = !!brkOk && brkOk.side === d;
      const closeOk = !!confirmed || C.entryClosePos <= 0 || (C.closePosBrkBypass && brkHit) || (C.closePosBypassRvol > 0 && volD === d && (rvol5 ?? 0) >= C.closePosBypassRvol) || (d > 0 ? cd.closePos >= C.entryClosePos : cd.closePos <= 100 - C.entryClosePos);
      const refD = inp.refSide15?.get(b.time) ?? 0;
      // sembol başına ek giriş süzgeçleri (SPY'da yalnız ters yön kilidi açık) — engellenen tetik olay olarak yazılır
      const blockWhy = [
        C.refAlign15 !== "off" && inp.refSide15 && !(C.refAlign15 === "same" ? refD === d : refD !== -d) && `referans 15m yönü ${refD > 0 ? "▲" : refD < 0 ? "▼" : "belirsiz"}`,
        C.maxStopAtr5 > 0 && atr5 && Math.abs(c - stop) > C.maxStopAtr5 * atr5 && `stop ${f2(Math.abs(c - stop))} > ${C.maxStopAtr5} ATR5`,
        C.minEntryRvol > 0 && (rvol5 ?? 0) < C.minEntryRvol && `hacim zayıf (RVOL ${rvol5 != null ? rvol5.toFixed(2) : "—"} < ${C.minEntryRvol})`,
        C.pmRvolMin > 0 && m > 12 * 60 && (rvol5 ?? 0) < C.pmRvolMin && (() => {
          let on = 0;
          for (let q = 0; q <= i; q++) if (d * (today[q].close - (vwaps[q] ?? today[q].close)) > 0) on++;
          return on / (i + 1) < C.trendDayShare;
        })() && `12:00 sonrası, net trend günü değil — hacim yetersiz (RVOL ${rvol5 != null ? rvol5.toFixed(2) : "—"} < ${C.pmRvolMin})`,
        C.maxCrosses > 0 && crosses >= C.maxCrosses && `testere gün (VWAP ${crosses} kez kesildi)`,
        (() => {
          if (C.oppAfterStopMin <= 0) return false;
          const ls = [...trades].reverse().find((t) => t.exitReason === "STOP" && t.exitTime != null);
          if (!ls || dOfSide(ls.side) !== -d || (b.time - (ls.exitTime as number)) / 60 > C.oppAfterStopMin) return false;
          return `${ls.exitClock} ${ls.side} stopundan sonra ${C.oppAfterStopMin} dk ters yön kilidi`;
        })(),
      ].filter(Boolean) as string[];
      const refOk = blockWhy.length === 0;
      if (!refOk && !pos && closeOk && (confirmed || brkHit || (allOk && !needConfirm)) && trades.length < C.maxTrades && !exited)
        ev.push(`${s} tetiği alınmadı — ${blockWhy.join(" · ")}`);
      if (!pos && refOk && closeOk && (confirmed || brkHit || (allOk && !needConfirm)) && trades.length < C.maxTrades && !exited) {
        const rPts = r2(Math.abs(c - stop));
        if (rPts > C.warnStopAtr15 * a15) warns.push("STOP_TOO_WIDE");
        const chopN = crossIdx.filter((k) => k > i - 12).length;
        const chop = C.chopCross > 0 && chopN >= C.chopCross;
        const h1Mult = chop ? C.chopH1R : C.h1R;
        const tp1 = r2(c + d * h1Mult * rPts);
        const h2R = r2(c + d * C.h2R * rPts);
        const nl = nextLevel(d, tp1, 0.05);
        const h2 = nl && d * (nl.price - h2R) < 0 ? r2(nl.price) : h2R;
        // kuvvetli momentum → daha büyük pozisyon önerisi (piyasa gerçeği: trend sürerken her geri çekilmede ekle)
        const momF = {
          both: volD === d && candleD === d,
          rvol: (rvol5 ?? 0) >= C.sizeRvol,
          runner: runners.some((x) => dOfSide(x.side) === d && (x.liveR ?? 0) > 0),
          impulse: atr5 != null && d * impulse >= C.sizeImpulse,
          ext: newExt === d,
        };
        const momWhy = [momF.both && "hacim + formasyon birlikte", momF.rvol && `RVOL ${rvol5 != null ? rvol5.toFixed(1) : ""}`, momF.runner && "aynı yönde kârdaki taşınan pozisyon", momF.impulse && "30 dk itki güçlü", momF.ext && `gün içi yeni ${d > 0 ? "tepe" : "dip"}`, C.regimeEntry === "size" && regimeD === d && `5m EMA20 VWAP'ın ${d > 0 ? "üstünde" : "altında"} (trend rejimi)`].filter(Boolean) as string[];
        const pts = C.sizeFactors.reduce((a, k) => a + (momF[k as keyof typeof momF] ? 1 : 0), 0) + (C.regimeEntry === "size" && regimeD === d ? 1 : 0);
        // düşük hacim → 1 kontrat; normal hacimde taban 2, her momentum işareti +1 (en çok 4)
        const lowVol = rvol5 != null && r2(rvol5) < C.sizeLowRvol; // gösterilen (2 basamak) değerle karşılaştır
        let contracts: number;
        if (C.sizeMode === "risk") {
          // sabit dolar riski: kontrat = risk ÷ (stop mesafesi × Δ × 100); düşük hacimde risk yarıya iner
          const riskUsd = inp.riskUsd && inp.riskUsd > 0 ? inp.riskUsd : C.riskUsd;
          const perC = rPts * C.optDelta * 100;
          const rk = riskUsd * (lowVol ? C.sizeLowRvolMult : 1) * (chop ? C.chopSizeMult : 1);
          contracts = Math.max(1, Math.min(C.sizeRiskMax, Math.floor(rk / Math.max(perC, 1))));
          momWhy.splice(0, momWhy.length,
            `risk $${Math.round(rk)}${lowVol ? ` (düşük hacim RVOL ${(rvol5 as number).toFixed(2)} → ×${C.sizeLowRvolMult})` : ""}${chop ? ` (VWAP testeresi: son 1 saatte ${chopN} kesişme → ×${C.chopSizeMult})` : ""} ÷ (stop ${f2(rPts)} × Δ${C.optDelta} × 100 = $${Math.round(perC)}) → ${contracts} kontrat`);
        } else {
          contracts = lowVol ? 1 : Math.min(C.sizeMax, C.sizeBase + pts);
          if (chop && !lowVol) contracts = Math.max(1, Math.floor(contracts * C.chopSizeMult));
          if (lowVol) momWhy.splice(0, momWhy.length, `düşük hacim (RVOL ${(rvol5 as number).toFixed(2)} < ${C.sizeLowRvol}) → 1 kontrat`);
        }
        if (chop) momWhy.push(`VWAP testeresi → hedef ${h1Mult}R${C.chopExit === "full" ? ", hedefte tamamı kapanır" : ""}`);
        if (premInfo) momWhy.push(premInfo);
        const why = brkHit && brkOk
          ? `${brkOk.clock} sert hacimli kırılım + destek hacimli 5m kapanış + 15m ${arrow(d)} teyidi · VWAP · EMA20`
          : confirmed
          ? `${confirmed.clock} tetiği + ${C.confirmBars} aynı yönde 5m kapanış teyidi${confirmed.what === "teyit kuralı" ? "" : ` (15m zayıftı: ${confirmed.what})`} · VWAP · EMA20`
          : [vSide === d && "VWAP", eSide === d && "EMA20", volD === d && "hacim", candleD === d && (pattern ?? "formasyon"), tiebreak && "RVOL+RSI teyidi"].filter(Boolean).join(" · ");
        const tagE: SetupTag = confirmed ? confirmed.tag : tag;
        const tr: TrackTrade = {
          id: `${date}-${nyClock(T).replace(":", "")}-${tagE}`, tag: tagE, reentry: trades.length > 0, side: s, stage: "TAKİP",
          entryTime: b.time, entryClock: nyClock(T), entry: r2(c), stop, stop0: stop, rPts, h1: tp1, h2, size: warns.length ? "half" : "full", confirm10: null, contracts, momWhy, momF,
          strike: strikeHint(s, c, C), exitTime: null, exitClock: null, exit: null, exitReason: null, resultR: null, mfeR: 0, maeR: 0,
          chop, h1RMult: h1Mult, barsHeld: 0, scoreEntry: score, rvolEntry: rvol5 != null ? r2(rvol5) : null, dayClass, bias: k0.bias, gapType, eventDay, h1Hit: false, h1Clock: null, liveR: 0, why,
        };
        trades.push(tr);
        pos = tr;
        entered = tr;
        pushAlert(b.time, "TETİK", tagE, s, `TETİK · ${nyClock(T)} · ${s} ${contracts} kontrat · giriş ${f2(c)} · stop ${f2(stop)} · ${h1Mult}R ${f2(tp1)}${chop && C.chopExit === "full" ? " (testere: hedefte tamamı)" : ""} · ${why}${momWhy.length ? ` · ${C.sizeMode === "risk" ? "boyut: " : contracts === 1 ? "" : "momentum: "}${momWhy.join(", ")}` : ""}${fridayNote}`);
        ev.push(`GİRİŞ ${s} ${f2(c)} · stop ${f2(stop)} · H1 ${f2(tp1)} · H2 ${f2(h2)} — ${why}`);
      }
      if (pos) {
        const p = pos as TrackTrade;
        setup = { tag: p.tag, side: p.side, status: "OPEN", trigger: null, triggerText: "", stop: p.stop, missing: [] };
        checklist = entered ? checklist : [];
      } else if (pendingWeak) {
        const pw: PendingWeak = pendingWeak;
        checklist = [...checklist, { key: "confirm5", ok: false, price: true, text: `${pw.what === "teyit kuralı" ? "5m kapanış teyidi bekleniyor" : `15m teyit zayıf (${pw.what})`} — aynı yönde 5m kapanış ${C.confirmBars - pw.left + 1}/${C.confirmBars}: sonraki kapanış ${f2(pw.close)} ${d > 0 ? "üstünde" : "altında"} olmalı` }];
        setup = { tag: pw.tag, side: s, status: "ARMED", trigger: pw.close, triggerText: `5m kapanış ${f2(pw.close)} ${d > 0 ? "üstünde" : "altında"} (VWAP+EMA20 ${d > 0 ? "üstünde" : "altında"}) — zayıf 15m teyidinin ${C.confirmBars - pw.left + 1}/${C.confirmBars}. 5m onayı`, stop, missing: [`aynı yönde 5m kapanış ${C.confirmBars - pw.left + 1}/${C.confirmBars} (${pw.what})`] };
        armedNext = { tag: pw.tag, side: s, trigger: pw.close, stop };
      } else {
        const missing = checklist.filter((x) => !x.ok && x.key !== "fresh" && x.key !== "tiebreak" && !(confirmVC && (x.key === "volume" || x.key === "candle")) && !(x.key === "volume" && candleD === d) && !(x.key === "candle" && volD === d));
        const line = d > 0 ? Math.max(vwap ?? -Infinity, ema5 ?? -Infinity) : Math.min(vwap ?? Infinity, ema5 ?? Infinity);
        const armed = m + 5 <= C.lastEntry && missing.length >= 1 && missing.every((x) => x.price) && Number.isFinite(line);
        setup = {
          tag: "T5_TREND", side: s, status: armed ? "ARMED" : "WATCH", trigger: Number.isFinite(line) ? r2(line) : null,
          triggerText: `5m kapanış ${Number.isFinite(line) ? f2(line) : "—"} (VWAP+EMA20) ${d > 0 ? "üstünde" : "altında"} + hacim çubuğu ya da formasyon`,
          stop, missing: missing.map((x) => x.text),
        };
        if (armed) armedNext = { tag: "T5_TREND", side: s, trigger: r2(line), stop };
      }
    }
    if (brk && !pos && !setup) {
      const k: Brk = brk;
      const sk: Side = k.side > 0 ? "CALL" : "PUT";
      checklist = [{ key: "brk", ok: false, price: true, text: `${k.clock} sert hacimli kırılım — sonraki 5m kapanış ${f2(k.mid)} ${k.side > 0 ? "üstünde" : "altında"} + hacimli (RVOL ≥ ${C.brkSupRvol}) + 15m ${arrow(k.side)} teyidi` }];
      setup = { tag: "T5_TREND", side: sk, status: "ARMED", trigger: k.mid, triggerText: `5m kapanış ${f2(k.mid)} ${k.side > 0 ? "üstünde" : "altında"} (hacimli) + 15m ${arrow(k.side)} teyidi — sert hacimli kırılımın onayı`, stop: null, missing: [`destek hacimli 5m kapanış + 15m ${arrow(k.side)} teyidi`] };
      armedNext = { tag: "T5_TREND", side: sk, trigger: k.mid, stop: null };
    }
    if (prevArmed && !entered && (!setup || setup.status !== "ARMED" || setup.side !== prevArmed.side)) {
      pushAlert(b.time, "İPTAL", prevArmed.tag, prevArmed.side, `İPTAL · ${prevArmed.side} hazırlığı kapanışta tutmadı`);
    }
    prevArmed = setup?.status === "ARMED" ? { tag: setup.tag, side: setup.side } : null;

    // ── 30 dk tahmini (aynı yapı: 15m yönü; 5m hizalıysa devam, geri çekiliyorsa 15m yönüne dönüş) ──
    let fdir: D = 0;
    let rule: FcRule | null = null;
    if (side15 && side5 === side15) { fdir = side15; rule = "ALIGNED"; }
    else if (side15 && side5 === -side15) { fdir = side15; rule = "PB_RESUME"; }
    let fc: TrackForecast;
    if (!C.fc30) { fdir = 0; rule = null; }
    if (fdir && rule) {
      const tgt = nextLevel(fdir as 1 | -1, c, 0.25 * a15);
      const target = tgt && Math.abs(tgt.price - c) <= 2.5 * a15 ? tgt : { price: r2(c + fdir * a15), label: "1 ATR15 hareket" };
      // iptal = 15m teyidinin bozulacağı çizgi (VWAP / EMA20'nin uzak olanı)
      const invP = fdir > 0 ? Math.min(vwap ?? c, ema15 ?? c, ema5 ?? c) : Math.max(vwap ?? c, ema15 ?? c, ema5 ?? c);
      const inv = fdir * (c - invP) > 0.05 ? { price: invP, label: "VWAP/EMA20" } : { price: r2(c - fdir * 0.6 * a15), label: "0,6 ATR15 ters" };
      const rs = FC_RULES[rule];
      fc = {
        dir: fdir, target: r2(target.price), targetLabel: target.label, invalid: r2(inv.price), invalidLabel: inv.label, rule,
        text: `30 dk: ${fdir > 0 ? "▲ yukarı" : "▼ aşağı"} (${rs.label}) → hedef ${f2(target.price)} (${target.label}) · iptal: ${f2(inv.price)} (${inv.label}) ${fdir > 0 ? "altı" : "üstü"} kapanış${rs.n ? ` · ölçüm %${rs.hit}` : ""}`,
      };
    } else {
      const up = nextLevel(1, c, 0.1), dn = nextLevel(-1, c, 0.1);
      fc = {
        dir: 0, target: null, targetLabel: "", invalid: null, invalidLabel: "", rule: null,
        text: `30 dk: ${side15 ? `15m ${side15 > 0 ? "yukarı" : "aşağı"} ama 5m VWAP–EMA20 arasında — net tahmin yok` : "15m yön vermiyor"}${up ? ` · ${f2(up.price)} (${up.label}) üstü ▲` : ""}${dn ? ` · ${f2(dn.price)} (${dn.label}) altı ▼` : ""}`,
      };
    }
    if (!C.fc30) fc = { dir: 0, target: null, targetLabel: "", invalid: null, invalidLabel: "", rule: null, text: "" };

    // ── metinler ──
    const P = pos as TrackTrade | null;
    let headline = `${arrow(dir)} ${dir > 0 ? "YUKARI" : dir < 0 ? "AŞAĞI" : "BELİRSİZ"}${dir ? ` · ${side15 ? strength : "ZAYIF EĞİLİM"}` : ""}`;
    let action: string;
    let tone: TrackStep["tone"] = dir > 0 ? "bull" : dir < 0 ? "bear" : "neutral";
    const warnTxt = warns.length ? ` Dikkat: ${warns.map((w) => VETO_TEXT[w]).join("; ")}.` : "";
    if (entered) {
      const e: TrackTrade = entered;
      headline = `${e.side === "CALL" ? "🟢 ▲ CALL GİR" : "🔴 ▼ PUT GİR"} · ${e.contracts ?? 2} kontrat`;
      action = `${e.contracts ?? 2} KONTRAT${e.contracts === 1 ? ` (${(e.momWhy ?? []).join(", ")})` : (e.momWhy ?? []).length ? ` (kuvvetli momentum: ${(e.momWhy ?? []).join(", ")})` : " (taban)"} · 5m tetik + 15m teyit (${e.why}) · giriş ${f2(e.entry)} · stop ${f2(e.stop)} · H1 ${f2(e.h1)} · H2 ${f2(e.h2)} · ${e.strike}.${warnTxt}${fridayNote}`;
      tone = e.side === "CALL" ? "bull" : "bear";
    } else if (exited) {
      const x: TrackTrade = exited;
      headline = `◼ ${x.side} KAPAT · ${sgnR(x.resultR as number)}R`;
      action = `${x.exitReason === "TRAIL_15M" ? "Taşınan yarı 15m izleyen stopta kapandı — trend dinlendi" : x.exitReason === "H1" ? `Hedef (${x.h1RMult ?? C.h1R}R) geldi — tamamı kapandı${x.chop ? " (VWAP testeresi: taşınan yarı yok)" : ""}` : x.exitReason === "STOP" ? "Stop oldu" : x.exitReason === "H2" ? "H2 hedefi geldi" : x.exitReason === "EMA_EXIT" ? "5m kapanış EMA20'nin ters tarafında — hareket bitti" : x.exitReason === "TREND_FLIP" ? "15m yön teyidi tersine döndü" : x.exitReason === "H1_BE" ? "Kalan yarı girişte (stop başabaş) kapandı" : x.exitReason === "REV_2BAR" ? `+${C.earlyExitArmR}R gördükten sonra ${C.earlyExitBars} ters 5m mum — 1R beklenmeden kapandı` : x.exitReason === "TIME" ? "30 dk'da H1 gelmedi, fiyat aleyhte" : "15:45 zorunlu kapanış"} (${f2(x.exit as number)}). ${side15 ? `15m yön ${side15 > 0 ? "yukarı" : "aşağı"}.` : "15m belirsiz."}`;
      tone = "warn";
    } else if (P) {
      const pd = dOfSide(P.side);
      headline = `${P.side === "CALL" ? "▲ CALL" : "▼ PUT"} AÇIK · ${P.liveR != null ? sgnR(P.liveR) : "0"}R`;
      action = P.h1Hit
        ? `Yarısı alındı, stop girişte (${f2(P.entry)}). Kalanı TUT — 5m EMA20 ${ema5 != null ? f2(ema5) : "—"} ${pd > 0 ? "altına" : "üstüne"} kapanış, 15m yön dönüşü ya da H2 ${f2(P.h2)}'de kapat.`
        : `TUT — stop ${f2(P.stop)} · hedef ${f2(P.h1)} (${P.h1RMult ?? C.h1R}R)${C.exitMode === "full" || (P.chop && C.chopExit === "full") ? `'de tamamını kapat${P.chop ? " (VWAP testeresi — küçük pozisyon, taşıma yok)" : ""}` : C.exitMode === "half15" ? `'de yarısını kapat (${halfOf(P.contracts)} / ${P.contracts ?? 2} kontrat), stopu girişe çek; kalanı her 15m kapanışında 15m dip/tepe ∓ tampona taşı` : "'de yarısını al"}. 15m yön dönerse çık.${side5 === -pd ? " ⚠ 5m VWAP/EMA20'nin ters tarafına geçti — stopu sıkılaştır." : ""}`;
      tone = side5 === -pd ? "warn" : P.side === "CALL" ? "bull" : "bear";
    } else if (setup?.status === "ARMED" && setup.trigger != null) {
      headline = `⚡ ${setup.side} HAZIR`;
      action = `${hm(m + 5)} kapanışı ${setup.triggerText} → GİR · stop ${setup.stop != null ? f2(setup.stop) : "—"}.${warnTxt}${fridayNote}`;
      tone = "warn";
    } else if (phaseBase === "AÇILIŞ") {
      action = `Açılış — 15m yön teyidi 09:45'te. 5m ${side5 > 0 ? "VWAP+EMA20 üstünde (CALL tarafı)" : side5 < 0 ? "VWAP+EMA20 altında (PUT tarafı)" : "VWAP ile EMA20 arasında"}; işlem 09:45 15m kapanışından sonra.`;
    } else if (phaseBase === "KAPANIŞ") {
      action = `Kapanış saatleri — yeni giriş yok. 15m ${side15 > 0 ? "yukarı" : side15 < 0 ? "aşağı" : "belirsiz"}.`;
    } else if (side15) {
      const line = side15 > 0 ? Math.max(vwap ?? -Infinity, ema5 ?? -Infinity) : Math.min(vwap ?? Infinity, ema5 ?? Infinity);
      const lt = Number.isFinite(line) ? f2(line) : "—";
      action = side5 === side15
        ? `${side15 > 0 ? "CALL" : "PUT"} tarafı — ${side15 > 0 ? "PUT" : "CALL"} arama. Tetik için hacimli yön mumu ya da formasyon bekle (5m ${side15 > 0 ? "üstünde" : "altında"} ${lt}).${warnTxt}`
        : `15m ${side15 > 0 ? "yukarı" : "aşağı"}, 5m geri çekiliyor — ${side15 > 0 ? "PUT" : "CALL"} arama. 5m kapanış ${lt} ${side15 > 0 ? "üstüne" : "altına"} dönünce ${side15 > 0 ? "CALL" : "PUT"} tetiği.`;
    } else {
      const top = Math.max(vwap ?? -Infinity, ema15 ?? -Infinity), bot = Math.min(vwap ?? Infinity, ema15 ?? Infinity);
      action = rawSide15 && !net15 && vwap15 != null
        ? `BEKLE — 15m kapanış VWAP'ın (${f2(vwap15)}) net ${rawSide15 > 0 ? "üstünde" : "altında"} değil (en az ${C.net15Atr} ATR15 ≈ ${atr15 != null ? f2(C.net15Atr * atr15) : "—"} uzak olmalı) — yön her an dönebilir, işlem aranmıyor.`
        : `BEKLE — 15m VWAP ile EMA20 arasında (${Number.isFinite(bot) ? f2(bot) : "—"}–${Number.isFinite(top) ? f2(top) : "—"}). 15m kapanış ${Number.isFinite(top) ? f2(top) : "—"} üstü ▲ CALL, ${Number.isFinite(bot) ? f2(bot) : "—"} altı ▼ PUT yönünü açar.${dir ? ` Şimdilik eğilim ${dir > 0 ? "yukarı" : "aşağı"} (15m EMA20 tarafı) — ${dir > 0 ? "CALL" : "PUT"} için 5m VWAP+EMA20 ${dir > 0 ? "üstünde" : "altında"} kapanış + hacim VE formasyon birlikte gerekir.` : " 5m ile 15m çelişiyor — bekle."}`;
    }

    if (runners.length) {
      const rt = runners.map((x) => `${x.side} ${x.entryClock} girişi ${f2(x.entry)} → stop ${f2(x.stop)} (${sgnR(x.liveR ?? 0)}R)`).join(" · ");
      action += ` Taşınan yarı: ${rt} — her 15m kapanışında stop 15m ${runners[0].side === "CALL" ? "dibinin altına" : "tepesinin üstüne"} çekilir.`;
      if (!P && !entered && !exited && setup?.status !== "ARMED") {
        headline = `${runners[0].side === "CALL" ? "▲ CALL" : "▼ PUT"} TAŞINIYOR · stop ${f2(runners[runners.length - 1].stop)}`;
        tone = runners[0].side === "CALL" ? "bull" : "bear";
      }
    }
    const shownPhase: TrackPhase = pos && !entered ? (P?.h1Hit ? "MANAGE" : "IN_TRADE") : phaseBase;
    let c15: string | null = null;
    if (is15 && i >= 2) {
      const g = today.slice(i - 2, i + 1);
      const bb: Bar = { time: g[0].time, open: g[0].open, high: Math.max(...g.map((x) => x.high)), low: Math.min(...g.map((x) => x.low)), close: c, volume: g.reduce((a, x) => a + (x.volume || 0), 0) };
      c15 = candleText(bb, vwap, ema15, rvol15, "15m", null) + ` · RSI ${rsi15 != null ? rsi15.toFixed(0) : "—"}`;
    }

    steps.push({
      t: b.time, clock: nyClock(T), min: m, pre: false, is15, phase: shownPhase, stageLabel: PHASE_TEXT[shownPhase],
      price: c, open: b.open, high: b.high, low: b.low, vwap: vwap != null ? r2(vwap) : null, poc, ema5: ema5 != null ? r2(ema5) : null, ema15: ema15 != null ? r2(ema15) : null,
      rvol5: rvol5 != null ? r2(rvol5) : null, rvol15: rvol15 != null ? r2(rvol15) : null, atr5: atr5 != null ? r2(atr5) : null,
      devAtr: atr5 && vwap != null ? r2((c - vwap) / atr5) : null, crosses, body: Math.round(cd.body), closePos: Math.round(cd.closePos),
      score, breakdown, threshold: 4.5, dir, strength, trend, mom,
      htf: { m15: side15, m30: m30.d, h1: h1.d, h4: h4.d }, side15, side5, pattern, rsi15: rsi15 != null ? r2(rsi15) : null,
      headline, action, tone, checklist, veto: null, warns, setup,
      pos: P && !exited ? { tag: P.tag, side: P.side, entry: P.entry, stop: P.stop, h1: P.h1, h2: P.h2, liveR: P.liveR ?? 0, h1Hit: P.h1Hit, contracts: P.contracts } : null,
      runners: runners.map((x) => ({ side: x.side, entryClock: x.entryClock, entry: x.entry, stop: x.stop, liveR: x.liveR ?? 0 })),
      fc, out: null, c5: candleText(b, vwap, ema5, rvol5, "5m", pattern), c15, events: ev,
    });
    if (today15) prevSide15 = side15;
  }

  // ── tahmin sonuçları ──
  const rthSteps = steps.filter((s) => !s.pre);
  rthSteps.forEach((s, k) => {
    const fut = today.slice(k + 1, k + 1 + C.predBars);
    if (!fut.length) return;
    const done = fut.length >= C.predBars;
    const move = r2(fut[fut.length - 1].close - s.price);
    let tHit = false, iHit = false;
    if (s.fc.dir && s.fc.target != null && s.fc.invalid != null) {
      for (const x of fut) {
        if (s.fc.dir > 0 ? x.close <= s.fc.invalid : x.close >= s.fc.invalid) { iHit = true; break; }
        if (s.fc.dir > 0 ? x.high >= s.fc.target : x.low <= s.fc.target) { tHit = true; break; }
      }
    }
    s.out = { move, hit: s.fc.dir ? Math.sign(move) === s.fc.dir && Math.abs(move) >= 0.05 : null, targetHit: tHit, invalidHit: iHit, done };
  });
  const scored = rthSteps.filter((s) => s.fc.dir && s.out?.done && s.min <= C.trackEnd);
  const pred = { n: scored.length, hit: scored.filter((s) => s.out?.hit).length, tHit: scored.filter((s) => s.out?.targetHit).length };

  const current = steps.length ? steps[steps.length - 1] : null;
  const lastMin = current ? current.min : null;
  const nextCheck = lastMin == null ? hm(OPEN_MIN + 5) : lastMin < 16 * 60 ? hm(lastMin + 5) : null;
  const lastSide = [...rthSteps].reverse().find((s) => s.side15)?.side15 ?? 0;
  return {
    date, prevClose, atrDaily: atrDaily != null ? r2(atrDaily) : null, k0, gap: { pts: gapPts, type: gapType }, eventDay,
    or5, or15, dayClass, dirEstablished: lastSide, confirm10: null, steps, current, trades, alerts,
    realizedR: r2(realized()), pred, nextCheck, armed: armedNext,
  };
}

/** Canlı ön uyarı (HAZIRLAN): kapanışa ≤ 60 sn kala oluşan mum, hazır kurulumun tetik fiyatını geçmişse */
/** Referans sembolün (QQQ için SPY) kapanmış 15m yönü, 5m mum zamanına göre — kendi TRACK_CFG kurallarıyla (yalnız 5m veriden) */
export function refSide15Of(m5: Bar[], date: string, nowSec: number): Map<number, D> {
  const r = trackerRead({ date, m5, nowSec });
  return new Map(r.steps.filter((s) => !s.pre).map((s) => [s.t, s.side15]));
}

/**
 * Erken uyarı (ön okuma): kapanışa ≤ alertPrewarnSec kala OLUŞAN 5m mum şu anki haliyle kapanmış sayılıp motor yeniden okunur —
 * bu mumda giriş çıkıyorsa "böyle kapanırsa TETİK" HAZIRLAN uyarısı verilir. trackPrewarn yalnız fiyat şartı eksik hazırlıkları
 * kapsar; hacim/formasyon/kapanış konumu ancak kapanışta belli olduğundan girişlerin çoğu ön uyarısız geliyordu (SPY 5 günde 4/17).
 * Anahtar trackPrewarn ile aynı biçimde — aynı mum için iki kez çalmaz.
 */
export function trackPrewarnLive(inp: TrackInput, forming: Bar | null, nowSec: number): TrackAlert | null {
  const C = inp.cfg ?? TRACK_CFG;
  if (!forming) return null;
  const left = forming.time + 300 - nowSec;
  if (left > C.alertPrewarnSec || left < 0) return null;
  // oluşan mumun hacmi geçen süreye göre yıllandırılır (3. dakikada %60 → /0,6) — yoksa RVOL zemini hep tutmazdı
  const frac = Math.min(1, Math.max(0.2, (300 - left) / 300));
  const m5 = inp.m5.filter((b) => b.time < forming.time).concat({ ...forming, volume: (forming.volume || 0) / frac });
  const r = trackerRead({ ...inp, m5, nowSec: forming.time + 300 });
  const t = r.trades.find((x) => x.entryTime === forming.time);
  if (!t) return null;
  const clock = nyClock(forming.time + 300);
  return {
    t: forming.time, clock, level: "HAZIRLAN", tag: t.tag, side: t.side,
    text: `HAZIRLAN · ${clock} · ${t.side} · 5m şu anki haliyle kapanırsa TETİK — giriş ≈${t.entry.toFixed(2)} · stop ${t.stop0.toFixed(2)} · ${left} sn kaldı`,
    key: `${r.date}|HAZIRLAN|${t.tag}|${t.side}|${forming.time}`,
  };
}

export function trackPrewarn(r: TrackRead | null, forming: Bar | null, nowSec: number, cfg: TrackCfg = TRACK_CFG): TrackAlert | null {
  if (!r?.armed || !forming) return null;
  const left = forming.time + 300 - nowSec;
  if (left > cfg.alertPrewarnSec || left < 0) return null;
  const d = r.armed.side === "CALL" ? 1 : -1;
  if (d * (forming.close - r.armed.trigger) <= 0) return null;
  const clock = nyClock(forming.time + 300);
  return {
    t: forming.time, clock, level: "HAZIRLAN", tag: r.armed.tag, side: r.armed.side,
    text: `HAZIRLAN · ${clock} · ${r.armed.side} · 5m ${r.armed.trigger.toFixed(2)} ${d > 0 ? "üstünde" : "altında"} kapanırsa tetik · stop ${r.armed.stop != null ? r.armed.stop.toFixed(2) : "—"} · ${left} sn kaldı`,
    key: `${r.date}|HAZIRLAN|${r.armed.tag}|${r.armed.side}|${forming.time}`,
  };
}

// ── Özet istatistikler ──

export interface TagStat { tag: SetupTag; n: number; win: number; avgR: number; medR: number; pf: number | null; avgMfe: number; avgMae: number; maxConsecLoss: number; totalR: number; status: "LIVE_OK" | "OBSERVE" }

export function summarizeTrades(trades: TrackTrade[]): TagStat[] {
  const by = new Map<SetupTag, TrackTrade[]>();
  for (const t of trades) if (t.resultR != null) (by.get(t.tag) ?? by.set(t.tag, []).get(t.tag)!).push(t);
  const out: TagStat[] = [];
  for (const [tag, xs] of by) {
    const rs = xs.map((x) => x.resultR as number);
    const sorted = [...rs].sort((a, b) => a - b);
    const gains = rs.filter((x) => x > 0).reduce((a, x) => a + x, 0);
    const losses = -rs.filter((x) => x < 0).reduce((a, x) => a + x, 0);
    let streak = 0, maxStreak = 0;
    for (const r of rs) { if (r < 0) { streak++; maxStreak = Math.max(maxStreak, streak); } else streak = 0; }
    const avgR = rs.reduce((a, x) => a + x, 0) / rs.length;
    out.push({
      tag, n: rs.length, win: Math.round((100 * rs.filter((x) => x > 0).length) / rs.length), avgR: r2(avgR), medR: r2(sorted[Math.floor(sorted.length / 2)]),
      pf: losses > 0 ? r2(gains / losses) : null, avgMfe: r2(xs.reduce((a, x) => a + x.mfeR, 0) / xs.length), avgMae: r2(xs.reduce((a, x) => a + x.maeR, 0) / xs.length),
      maxConsecLoss: maxStreak, totalR: r2(rs.reduce((a, x) => a + x, 0)), status: rs.length >= 100 && avgR >= 0.2 ? "LIVE_OK" : "OBSERVE",
    });
  }
  return out.sort((a, b) => a.tag.localeCompare(b.tag));
}
