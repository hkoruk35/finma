/**
 * QQQ Engine — karar merdiveni eşikleri (SPY ayarından FARKLI).
 *
 * SPY için kalibre edilen eşikler QQQ'da tutmadı (aynı ayarla 59 seansta +3,8R; görülmemiş
 * son 20 günde −1,7R; öğlen dönüşü −7,1R). QQQ için ayrı arama yapıldı ve büyük teknoloji
 * liderleri filtresi eklendi (işleme ters yönde liderler: 35 işlem −15,5R, %23 kazanç).
 *
 * KALİBRASYON (2026-10-09, QQQ 5m, 59 seans 07-17 → 10-08, spot fiyat, opsiyon spread'i hariç):
 *   350 rastgele ayar üç dönem bloğunda (19/19/21 gün) ölçüldü; seçim ölçütü "en kötü bloğun R'si"
 *   (rejime dayanıklılık). Seçilen ayar: üç blok ayrı ayrı +7,1R / +4,4R / +5,0R (toplam +16,5R, günde 1,5 işlem).
 *   Dürüst not: arama ve seçim aynı 59 günde yapıldı — gerçek bir "görülmemiş dönem" kalmadı; sonuçlar SPY'a göre
 *   daha zayıf ve daha az kanıtlı. Açılış yönü modu QQQ'da kenar vermedi (kapalı).
 */

import { LADDER_CFG, type LadderCfg } from "../spyengine/ladder";
import { TRACK_CFG, TRACK_VERSION, type TrackCfg } from "../spyengine/tracker";

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export const QQQ_LADDER_CFG: LadderCfg = (() => {
  const c: LadderCfg = clone(LADDER_CFG);
  c.plan.openOn = false;
  c.plan.fadeOn = true;
  c.plan.closeOn = true;
  c.plan.fadeK = 1.0;
  c.plan.fadeStart = 10 * 60 + 30;
  c.plan.fadeEnd = 13 * 60;
  c.plan.openEnd = 14 * 60;
  c.plan.closeStart = 13 * 60;
  c.trig.minBodyFrac = 0.5;
  c.trig.volRatio = 1.0;
  c.trig.closeTop = 0.65;
  c.trig.pair.on = true;
  c.tech = { on: true, minVw: -0.3, minMom: -0.3 };
  c.risk.rr = 1.5;
  c.risk.stopPadAtr = 0.3;
  c.risk.maxStopAtr = 2;
  c.risk.maxAttempts = 3;
  c.risk.cooldownBars = 5;
  c.risk.openLeg.maxStopAtr = 3.5;
  c.risk.openLeg.stopBars = 1;
  c.climax.on = true;
  // 2026-10-13 QQQ ölçümü (59 seans 07-21 → 10-09): SPY değişikliklerinden yalnız ERKEN UYARI temizliği uygulandı —
  // işlemler aynı (84 işlem %52 +20,6R), uyarı bölümleri 511 → 398 (açılış modu kapalıyken 09:35–09:55 "açılış hazırlanıyor"
  // ve izin yokken "öğlen hazırlanıyor" uyarıları anlamsızdı). Uygulanmayanlar (ölçümle): kapanış modunu kapatmak
  // (QQQ'da kârın yarısı: 65 işlem +9,9R — kapatınca günde 0,3 işlem, +10,7R); açılış modu + 15m RSI + 09:55 (25 işlem +2,2R, orta dönem eksi).
  c.rsi = { ...c.rsi, open: "off", close: "off", warnTrend: "off", warnFade: false, preOpen: "off", early955: false, warnGate: true };
  c.warn.preFade = false;
  c.warn.fadeReady = "base";
  // 2026-10-14 QQQ yönetim ölçümü (58 seans): hedefte yarıyı satıp kalanı EMA20'ye kadar taşımak SPY'da AÇILIŞ'ta kazandırdı
  // ama QQQ KAPANIŞ'ta kaybettirdi (65 işlem 6,8R → 5,6R, dönemler 5,2→3,3 / −1,2→−2,6 / 2,8→4,9) ve ÖĞLEN'de zaten tam çıkış —
  // taşıma kapalı; trend-bitişi uyarıları (UYARI/BİTTİ) ve pozisyon yönetimi metinleri açık kalır.
  c.manage.runner = {};
  // 2026-10-14: SPY'da "açılış eğilimine karşı öğlen dönüşü 13:00'e kadar aranmaz" kazandırdı, QQQ'da kaybettirdi
  // (58 seans: 85 işlem +16,0R → 73 işlem +9,3R; ÖĞLEN 20/+9,2R → 5/+2,2R) — QQQ'da kapalı.
  c.plan.fadeVsLean = 0;
  // 09:55 açılış trend uyarısı + ekstra işlem SPY'da +8,9R (31 işlem), QQQ'da 41 işlem −4,0R (58 seans) → QQQ'da kapalı.
  c.openTrend.on = false;
  // SPY'daki "trende karşı dönüş yok" engeli (plan.fadeTrend, warn.fadeGen) QQQ'da kârın çoğunu siliyor (58 seans +16,0R → +6,8R; ÖĞLEN 20/+9,2R → 2/+0,4R) — QQQ'da kapalı.
  c.plan.fadeTrend = { general: false, rsi30: "off", revMin: 0 };
  c.warn.fadeGen = false;
  return c;
})();

/**
 * QQQ Takip Sistemi — SPY kuralları (TRACK_CFG) + QQQ'nun kendi 5m dinamiğinden 3 fark (SPY'a bağlı kural yok):
 *   1) minEntryRvol 0,85: giriş mumunun saat-normalize RVOL'u ≥ 0,85 (RVOL < 1 girişler 57 işlem −9,2R; 1,5–2,5 her dönemde kârda)
 *   2) maxCrosses 6: gün içinde 5m kapanış VWAP'ı 6 kez kestiyse (testere gün) yeni giriş yok — trend günleri ≥1 ATR hareket +18R, testere günler eksi
 *   3) trailOnClose: 1R sonrası taşınan yarının 15m izleyen stopu fitilde değil 5m KAPANIŞTA tetiklenir (trend günü düzeltmede silkelenmez)
 * Ölçüm (2026-10-16, QQQ 5m 45 seans 08-14 → 10-16, üç 15'er günlük dönem; scripts/backtest_qqq_variants.ts):
 *   SPY kuralları: 140 işlem %50 +4,8R (−12,0 / +11,4 / +5,5) → QQQ kuralları: 82 işlem %60 +28,2R (0,0 / +20,4 / +7,8).
 *   Komşu değerler sağlam (RVOL 0,85–0,95: +25…+28R · kesişme 4–8: +25…+28R). Seçim aynı 45 günde yapıldı — görülmemiş dönem yok.
 *   16 Eki (−20 $ düşüş günü): +3,45R → +6,42R.
 */
export const QQQ_TRACK_CFG: TrackCfg = { ...TRACK_CFG, minEntryRvol: 0.85, maxCrosses: 6, trailOnClose: true };
/** QQQ kayıt sürümü (kurallar SPY'dan ayrıştı — değişince QQQ geriye dönük kayıtları yeniden üretilir) */
export const QQQ_TRACK_VERSION = `${TRACK_VERSION}-q2`;
