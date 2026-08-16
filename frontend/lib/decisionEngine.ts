export interface DecisionContext {
  state: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  action: string;
  actionColor: string;
  confirmationCondition: string;
  invalidationCondition: string;
  triggerLevelName: string;
  triggerLevelValue: string;
  statusBadge: string;
  statusColor: string;
  statusStrength: string;
  candleStyle: "BULLISH" | "BEARISH" | "NEUTRAL";
  whySupported: string[];
  whyConflicted: string[];
}

export function getDecisionContext(
  state: string,
  netScore: number,
  spxPrice: number = 7786.01,
  esVwap: number = 7811.17,
  orh: number = 7807.71,
  orl: number = 7801.46
): DecisionContext {
  const s = state || "NEUTRAL";

  if (s === "WATCH_SHORT") {
    return {
      state: "WATCH_SHORT",
      direction: "SHORT",
      action: "Short Hazırlığı / Bekle (İşlem Yok)",
      actionColor: "#f97316",
      confirmationCondition: "ORL (7801.46) kırılımı + 5m downside acceptance",
      invalidationCondition: "ES tekrar VWAP üstü (7811.17) + NetScore toparlanması",
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "ORL DOWNSIDE ACCEPTANCE (BEKLEMEDE)",
      statusColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      statusStrength: "1m izleniyor, 5m kırılım teyidi bekleniyor",
      candleStyle: "BEARISH",
      whySupported: [
        `ES seans VWAP (${esVwap.toFixed(2)}) altında`,
        `Short skoru (${Math.abs(netScore).toFixed(1)}) Long skorunun üzerinde`,
        "Aşağı yönlü likidite baskısı oluşuyor",
      ],
      whyConflicted: [
        `ORL (${orl.toFixed(2)}) henüz kırılmadı`,
        "5m bar kapanış teyidi (Acceptance) eksik",
      ],
    };
  }

  if (s === "EARLY_SHORT") {
    return {
      state: "EARLY_SHORT",
      direction: "SHORT",
      action: "Agresif Giriş Düşünülebilir (Küçük Boyut)",
      actionColor: "#f87171",
      confirmationCondition: "5m bar kapanışı ORL altında kalıcılık",
      invalidationCondition: "VWAP veya ORL üstüne geri dönüş (Bear Trap)",
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "BEARISH ACCEPTANCE (ERKEN)",
      statusColor: "bg-rose-400/20 text-rose-400 border-rose-400/30",
      statusStrength: "1m accepted, 5m kapanış bekleniyor",
      candleStyle: "BEARISH",
      whySupported: [
        `ORL (${orl.toFixed(2)}) altına ilk sarkma gerçekleşti`,
        "ES satıcılı seyrini koruyor",
      ],
      whyConflicted: [
        "5m bar henüz tamamlanmadı",
        "Tuzak kırılım riski mevcut",
      ],
    };
  }

  if (s === "CONFIRMED_SHORT") {
    return {
      state: "CONFIRMED_SHORT",
      direction: "SHORT",
      action: "Short Giriş Uygun (Normal Boyut)",
      actionColor: "#ef4444",
      confirmationCondition: "Trend devamı & Satış hacminin korunması",
      invalidationCondition: `ES VWAP (${esVwap.toFixed(2)}) reclaim (üstüne çıkış)`,
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "BEARISH ACCEPTANCE (ONAYLI)",
      statusColor: "bg-rose-500/20 text-rose-500 border-rose-500/30",
      statusStrength: "1m & 5m accepted, teyitli trend",
      candleStyle: "BEARISH",
      whySupported: [
        `ORL (${orl.toFixed(2)}) altında 5m mum kabul edildi`,
        "NetScore güçlü negatif bölgede",
        "Satış hacmi ortalama üzerinde",
      ],
      whyConflicted: ["Aşırı satım bölgesine yaklaşılıyor"],
    };
  }

  if (s === "STRONG_SHORT") {
    return {
      state: "STRONG_SHORT",
      direction: "SHORT",
      action: "Short Teyit Güçlü / Pozisyonu Koru",
      actionColor: "#dc2626",
      confirmationCondition: "Trailing stop ile runner modelleri izle",
      invalidationCondition: "Dip dönüş formasyonu veya ani hacimli tepki",
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "STRONG BEARISH BREAKOUT",
      statusColor: "bg-red-600/20 text-red-400 border-red-500/40",
      statusStrength: "Tam momentum satışı, tüm zaman dilimleri hizalı",
      candleStyle: "BEARISH",
      whySupported: [
        "Tüm vadeli endeksler (ES, NQ) senkronize düşüşte",
        "NetScore maksimum satış baskısında (-5.0+)",
        "VWAP altında temiz kırılım kabulü",
      ],
      whyConflicted: [],
    };
  }

  if (s === "SHORT_WEAKENING") {
    return {
      state: "SHORT_WEAKENING",
      direction: "SHORT",
      action: "Yeni Giriş Yapma / Pozisyon Koru veya Küçült",
      actionColor: "#f59e0b",
      confirmationCondition: "Destek seviyelerinde kademeli kâr al",
      invalidationCondition: "NetScore negatife dönüp VWAP test edilirse",
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "BEARISH MOMENTUM WEAKENING",
      statusColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      statusStrength: "Satış ivmesi yavaşlıyor, tepki alımı riski",
      candleStyle: "BEARISH",
      whySupported: ["Ana trend hala aşağı yönlü"],
      whyConflicted: ["Satış hacmi düşüyor", "Destek bölgesinde yavaşlama"],
    };
  }

  if (s === "FAILED_SHORT") {
    return {
      state: "FAILED_SHORT",
      direction: "SHORT",
      action: "Çık / Short Senaryo İptal (Bear Trap)",
      actionColor: "#f43f5e",
      confirmationCondition: "N/A - Senaryo geçersiz",
      invalidationCondition: "Fiyat ORL üstüne geri sıçradı",
      triggerLevelName: `ORL ${orl.toFixed(2)}`,
      triggerLevelValue: orl.toFixed(2),
      statusBadge: "FAILED SHORT (BEAR TRAP)",
      statusColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      statusStrength: "Kırılım başarısız oldu, tersine dönüş riski",
      candleStyle: "NEUTRAL",
      whySupported: [],
      whyConflicted: [
        `Fiyat ${orl.toFixed(2)} ORL seviyesi üzerine hızla geri döndü`,
        "Ayı tuzağı oluştu, acil stop gerekli",
      ],
    };
  }

  // ── LONG STATES ──
  if (s === "WATCH_LONG") {
    return {
      state: "WATCH_LONG",
      direction: "LONG",
      action: "Long Hazırlığı / Bekle (İşlem Yok)",
      actionColor: "#fbbf24",
      confirmationCondition: "ORH (7807.71) kırılımı + 5m upside acceptance",
      invalidationCondition: "ES tekrar VWAP altı (7811.17) + NetScore düşüşü",
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "ORH UPSIDE ACCEPTANCE (BEKLEMEDE)",
      statusColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      statusStrength: "1m izleniyor, 5m kırılım teyidi bekleniyor",
      candleStyle: "BULLISH",
      whySupported: [
        `ES seans VWAP (${esVwap.toFixed(2)}) üstünde`,
        `Long skoru (${netScore.toFixed(1)}) Short skorundan yüksek`,
        "Alıcılar açılış seviyelerini savunuyor",
      ],
      whyConflicted: [
        `ORH (${orh.toFixed(2)}) henüz kırılmadı`,
        "5m bar kapanış teyidi eksik",
      ],
    };
  }

  if (s === "EARLY_LONG") {
    return {
      state: "EARLY_LONG",
      direction: "LONG",
      action: "Agresif Giriş Düşünülebilir (Küçük Boyut)",
      actionColor: "#34d399",
      confirmationCondition: "5m bar kapanışı ORH üzerinde kalıcılık",
      invalidationCondition: "VWAP veya ORH altına geri çekilme (Bull Trap)",
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "BULLISH ACCEPTANCE (ERKEN)",
      statusColor: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
      statusStrength: "1m accepted, 5m kapanış bekleniyor",
      candleStyle: "BULLISH",
      whySupported: [
        `ORH (${orh.toFixed(2)}) üzerine ilk kırılım gerçekleşti`,
        "Alıcılar agresif teklif veriyor",
      ],
      whyConflicted: ["5m bar tamamlanmadı, boğa tuzağı riski"],
    };
  }

  if (s === "CONFIRMED_LONG") {
    return {
      state: "CONFIRMED_LONG",
      direction: "LONG",
      action: "Long Giriş Uygun (Normal Boyut)",
      actionColor: "#22c55e",
      confirmationCondition: "Trend devamı & Alış hacminin korunması",
      invalidationCondition: `ES VWAP (${esVwap.toFixed(2)}) kaybı (altına iniş)`,
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "BULLISH ACCEPTANCE (ONAYLI)",
      statusColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
      statusStrength: "1m & 5m accepted, teyitli yükseliş",
      candleStyle: "BULLISH",
      whySupported: [
        `ORH (${orh.toFixed(2)}) üzerinde 5m kabulü gerçekleşti`,
        "NetScore güçlü pozitif bölgede",
        "Hacimli yükseliş teyidi var",
      ],
      whyConflicted: ["Direnç bölgelerine yaklaşım kontrol edilmeli"],
    };
  }

  if (s === "STRONG_LONG") {
    return {
      state: "STRONG_LONG",
      direction: "LONG",
      action: "Long Teyit Güçlü / Pozisyonu Koru",
      actionColor: "#4ade80",
      confirmationCondition: "Trailing stop ile runner modelleri izle",
      invalidationCondition: "Tepe dönüş formasyonu veya NetScore çöküşü",
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "STRONG BULLISH BREAKOUT",
      statusColor: "bg-emerald-400/20 text-emerald-300 border-emerald-400/40",
      statusStrength: "Tam momentum yükselişi, tüm zaman dilimleri hizalı",
      candleStyle: "BULLISH",
      whySupported: [
        "ES ve NQ vadeli endeksleri yeni zirvelere koşuyor",
        "NetScore maksimum alım baskısında (+5.0+)",
        "VWAP üzerinde temiz kırılım kabulü",
      ],
      whyConflicted: [],
    };
  }

  if (s === "LONG_WEAKENING") {
    return {
      state: "LONG_WEAKENING",
      direction: "LONG",
      action: "Yeni Giriş Yapma / Pozisyon Koru veya Küçült",
      actionColor: "#f59e0b",
      confirmationCondition: "Direnç seviyelerinde kâr al",
      invalidationCondition: "NetScore düşüşü & VWAP altına kırılım",
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "BULLISH MOMENTUM WEAKENING",
      statusColor: "bg-amber-400/20 text-amber-400 border-amber-400/30",
      statusStrength: "Alım ivmesi zayıflıyor, kâr satışı riski",
      candleStyle: "BULLISH",
      whySupported: ["Ana trend hala yukarı"],
      whyConflicted: ["Hacim zayıflıyor", "Dirençte zorlanma"],
    };
  }

  if (s === "FAILED_LONG") {
    return {
      state: "FAILED_LONG",
      direction: "LONG",
      action: "Çık / Long Senaryo İptal (Bull Trap)",
      actionColor: "#f43f5e",
      confirmationCondition: "N/A - Senaryo geçersiz",
      invalidationCondition: "Fiyat ORH altına geri döndü",
      triggerLevelName: `ORH ${orh.toFixed(2)}`,
      triggerLevelValue: orh.toFixed(2),
      statusBadge: "FAILED LONG (BULL TRAP)",
      statusColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
      statusStrength: "Kırılım başarısız oldu, sert geri çekilme riski",
      candleStyle: "NEUTRAL",
      whySupported: [],
      whyConflicted: [
        `Fiyat ${orh.toFixed(2)} ORH seviyesi altına hızla indi`,
        "Boğa tuzağı teyit edildi, acil çıkış gerekli",
      ],
    };
  }

  // ── NEUTRAL / CHOP / NO TRADE ──
  return {
    state: s,
    direction: "NEUTRAL",
    action: s === "CHOP" ? "İşlem Yapma / Testere Piyasası" : "Bekle / Piyasa Açılış Aralığını İzle",
    actionColor: s === "CHOP" ? "#64748b" : "#94a3b8",
    confirmationCondition: "ORH (7807.71) veya ORL (7801.46) kırılımı + 5m acceptance",
    invalidationCondition: "Aşırı volatilite / Belirsiz bant hareketi",
    triggerLevelName: `OR Range (${orl.toFixed(2)} - ${orh.toFixed(2)})`,
    triggerLevelValue: `${orl.toFixed(2)} - ${orh.toFixed(2)}`,
    statusBadge: s === "CHOP" ? "CHOP / NO TRADE ZONE" : "INSIDE RANGE (NÖTR)",
    statusColor: "bg-slate-500/20 text-slate-400 border-slate-500/30",
    statusStrength: "Fiyat açılış aralığı içinde sıkışık, yön bekleniyor",
    candleStyle: "NEUTRAL",
    whySupported: [
      "Fiyat denge bölgesinde işlem görüyor",
      "İki yönlü likidite oluşumu mevcut",
    ],
    whyConflicted: [
      "Net yönsel sapma (arbitraj skoru) oluşmadı",
      "Kırılım teyidi yok",
    ],
  };
}
