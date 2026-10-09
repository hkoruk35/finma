/**
 * SPY Engine V11 — TÜM eşikler burada. Koda gömülü sayı yok (belge: "Belgedeki
 * sayılar başlangıç değeridir; 60 günlük arşivle kalibre edilir").
 *
 * Her alanın yanındaki "§" notu talimat belgesindeki bölümü gösterir.
 * "EK:" ile başlayanlar belgede sayısı verilmemiş ama kodun ihtiyaç duyduğu
 * için eklenen değerlerdir — kalibrasyonda bunlar da gözden geçirilmeli.
 */

export const V11_CONFIG = {
  /** Karar zaman çizelgesi (ET dakikası, gün başından) */
  time: {
    /** §L1 AÇILIŞ: 09:30–10:00, işlem yok */
    openEndMin: 10 * 60,
    /** §L3–L5: bu saatten sonra yeni giriş yok (PAS — seans sonu) */
    lastEntryMin: 15 * 60 + 30,
    /** §L3–L5: bu saatte açık pozisyon için ÇIK — zaman */
    forceExitMin: 15 * 60 + 50,
    /** §L3–L5: zorunlu kapamayı kapatma anahtarı (0/1DTE için açık) */
    forceExitEnabled: true,
  },

  /** §L1 Rejim motoru */
  regime: {
    /** vwap_cross_2h penceresi: 24 × 5m = 2 saat */
    crossWindowBars5m: 24,
    /** va_inside_ratio penceresi: son 8 adet 15m kapanış */
    insideWindowBars15m: 8,
    /** EK: va_inside_ratio bu kadar 15m kapanıştan azsa YATAY için kullanılmaz (10:00'da 2 mumluk oran anlamsız) */
    insideMinBars15m: 4,
    /** va_acceptance: art arda kaç 15m kapanış VAH üstü / VAL altı */
    acceptanceCloses: 2,
    trend: {
      /** TREND: vwap_cross_2h ≤ bu değer */
      maxCrosses: 2,
      /** TREND ▲: htf_bias ≥ +bu değer (▼: ≤ −bu değer) */
      minHtfBias: 1,
    },
    range: {
      /** YATAY: vwap_cross_2h ≥ bu değer … */
      minCrosses: 4,
      /** … VEYA va_inside_ratio ≥ bu değer … */
      minInsideRatio: 0.75,
      /** … VE |15m skor| ≤ bu değer */
      maxAbsScore15m: 2,
    },
    hysteresis: {
      /** Yeni rejim için ardışık 15m kapanış sayısı */
      confirmCloses: 2,
      /** Rejim en az bu kadar dakika sabit kalır */
      minDwellMin: 30,
      /** TREND'den çıkış: bu kadar kapanış yeter, GEÇİŞ'e düşer */
      trendExitCloses: 1,
    },
    /** or_break: açılış aralığı kırılımında kırılım yönünde 15m kapanış sayısı */
    orBreakCloses: 2,
    /** range_vs_adr için ortalama gün aralığı penceresi (gün) */
    adrDays: 20,
  },

  /** §L2 Sadeleştirilmiş yön skoru (−4…+4) */
  score: {
    /** Ölü bölge: |kapanış − VWAP| < bu × ATR14(5m) iken Konum = 0 */
    deadZoneAtr: 0.15,
    atrPeriod: 14,
    emaPeriod: 20,
    /** Eğim: EMA20'nin son N mumluk değişimi */
    slopeBars: 3,
    /** |eğim/ATR| < bu ise 0 */
    slopeMinAtr: 0.05,
    volume: {
      /** Alıcı/satıcı hacim payı eşiği */
      minShare: 0.6,
      /** Son mum hacmi ≥ bu × ortalama */
      minRatio: 1.5,
      /** Ortalama için önceki mum sayısı (medyan) */
      avgBars: 10,
    },
    /** Yön ▲/▼: |15m skor| ≥ bu, art arda N 15m kapanışta */
    dirThreshold: 3,
    dirCloses: 2,
  },

  /** §L3–L5 Kurulum, tetik, yönetim */
  setup: {
    /** HAZIRLAN: yaklaşma mesafesi (× ATR) */
    approachAtr: 0.3,
    /** Stop payı (× ATR) */
    stopAtr: 0.25,
    /** Kırılım devamı tetiği: hacim ≥ bu × ortalama */
    breakoutVolRatio: 1.5,
    /** ATR kaynağı: 5m ATR14 (belge ölü bölge için 5m diyor; diğerleri belirtmiyor) */
    atrSource: "5m" as const,
    /** Tetik hacim ortalaması için önceki 5m mum sayısı */
    volAvgBars: 10,
    /** T1: giriş yönünde en az bu kadar R uzakta olmalı; daha yakınsa bir sonraki seviye */
    t1MinR: 1.0,
    /** R/R kapısı: T1'e göre R/R bu değerin altındaysa PAS */
    minRR: 1.0,
    /** Seviyeleri tek kümede birleştirme mesafesi (× ATR) */
    levelClusterAtr: 0.15,
    /** EK: kenar kurulumu için süpürme olayı en fazla kaç 5m mum eski olabilir */
    sweepLookbackBars: 3,
    /** EK: kenar tetiği için gereken asgari olay sınıfı (belge: A) */
    edgeTriggerMinGrade: "A" as "A" | "B",
    /** EK: hazırlık koşulu sağlandıktan sonra tetik için tanınan 5m mum sayısı (HAZIRLAN kalıcılığı = histerezis) */
    prepLookbackBars: 3,
    /** EK: çıkış sonrası yeniden giriş için beklenecek 5m mum sayısı */
    cooldownBars: 3,
  },

  /** §L3–L5 Yönetim (YÖNET) */
  manage: {
    /** T1'de kapanan pozisyon oranı */
    t1ClosePct: 0.5,
    /** MFE koruması: T1'e varmadan maksimum lehte hareketin bu oranını geri verirse çık */
    mfeGiveBack: 0.6,
    /** EK: MFE koruması en az bu kadar R lehte hareketten sonra devreye girer */
    mfeMinR: 0.5,
    /** Trend Stop Bölgesi payı (× ATR), son kapanmış 15m dip/tepe ± */
    trendStopAtr: 0.25,
    /** Rejim düşünce sıkı stop: son N × 5m dip/tepe */
    tightStopBars: 2,
    /** Stop, 5m KAPANIŞ ile mi tetiklenir (belge ilke 3: yalnızca kapanmış mum karar verir) */
    stopOnClose: true,
    /** EK: ÇIK durumu kaç 5m mum ekranda hüküm olarak kalır */
    exitShowBars: 1,
  },

  /** §Erken uyarı sistemi */
  events: {
    /** Önemli seviye yakınlığı (× ATR) */
    levelProximityAtr: 0.2,
    /** Hacim ölçütü */
    volRatio: 1.5,
    volAvgBars: 10,
    /** İtki için gövde / aralık */
    pushBodyFrac: 0.5,
    /** Sınıflar: A ≥ gradeA, B ≥ gradeB, aksi C (hiç gösterilmez) */
    gradeA: 4,
    gradeB: 2,
    /** EK: kümülatif delta uyumu için bakılan mum sayısı */
    deltaBars: 3,
    /** Strip'te kaç A sınıfı olay */
    stripCount: 3,
    /** A sınıfı olayda şerit yanıp sönme süresi (sn) */
    blinkSec: 60,
    /** Sonuç etiketleri: 15 ve 30 dk sonra, ≥ bu × ATR beklenen yönde gittiyse ✓ */
    outcomeHorizonsMin: [15, 30],
    outcomeMoveAtr: 0.5,
    /** EK: olay "geçersizlik" göstergesi için pay (× ATR) */
    invalidationPadAtr: 0.0,
  },

  /** §İlke 7 Ölçülmeyen şey gösterilmez */
  archive: {
    /** İsabet bu orandan düşükse metrik ana ekrandan kalkar, kanıt paneline "deneysel" iner */
    minHitRate: 0.5,
    /** Bu kadar olaydan azında oran "yetersiz örneklem" sayılır, ana ekrandan düşürülmez */
    minSample: 20,
    /** Hangi ufuktaki etiket isabet sayılır (dk) */
    horizonMin: 30,
    /** Arşiv penceresi (gün) — Yahoo 5m azami 60 gün */
    days: 60,
  },

  /** Sunucu önbelleği (sn) */
  serve: {
    archiveTtlSec: 6 * 60 * 60,
  },
};

export type V11Config = typeof V11_CONFIG;
