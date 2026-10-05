/**
 * SPY Engine — Açılış Tahmini (04:00 Londra → 09:30 New York). Saf, izomorfik.
 *
 * MERKEZ: ES fair value = dünkü SPY kapanışı × (ES şimdi / ES dün 16:00 ET).
 * 58 seanslık ölçüm (2026-07 → 10, Yahoo 5m): ES tek başına NQ/RTY/YM
 * ortalamasından daha isabetli; diğer üç vadeli yalnızca UYUM/GÜVEN için.
 *
 *   saat    ort. hata   %80 aralık   gap yönü
 *   04:00   1,79 puan   ±2,71        %74
 *   07:00   1,41        ±2,59        %78
 *   08:30   0,79        ±1,30        %93
 *   09:00   0,50        ±0,74        %98
 *   09:25   0,31        ±0,48        %100
 *
 * Gap yönü güveni (ölçülen): 4 vadeli aynı yönde → %92–100; ES hareketi
 * ≥ %0,3 → %93–100; ES hareketi < %0,3 → %63–87; ES·NQ ters → %43–82.
 *
 * SINIR: açılıştan sonraki ilk 30 dk, gap yönünde devam yalnızca %49 —
 * açılış yönü ilk yarım saatin yönünü SÖYLEMEZ (o iş 09:55 kuralının).
 * 08:30 makro veri günleri ayrıca bilinmiyor (takvim kaynağı yok); 08:30
 * öncesi tahmin veri saatinde bozulabilir. ES kontrat devri (roll) günlerinde
 * oran kayabilir.
 */

export type GapDir = "UP" | "DOWN" | "FLAT";

/** Kontrol noktaları: açılışa kalan dakika → ölçülmüş %80 hata (puan, SPY ≈ 765'te) */
const BAND80: [number, number][] = [
  [330, 2.71], // 04:00
  [150, 2.59], // 07:00
  [60, 1.3], // 08:30
  [30, 0.74], // 09:00
  [5, 0.48], // 09:25
  [0, 0.4],
];
const BAND_REF_PRICE = 765;

/** Kontrol noktası başına ölçülmüş %80 hata (puan) — günlük kayıttaki gerçekleşenle kıyas için */
export const BAND80_BASE: Record<string, number> = { "04:00": 2.71, "07:00": 2.59, "08:30": 1.3, "09:25": 0.48 };

export const CHECKPOINTS: { label: string; minutes: number; name: string }[] = [
  { label: "04:00", minutes: 240, name: "Londra açılışı" },
  { label: "07:00", minutes: 420, name: "Avrupa teyidi" },
  { label: "08:30", minutes: 510, name: "ABD makro saati" },
  { label: "09:25", minutes: 565, name: "Açılış öncesi son" },
];

/** Açılışa kalan dakikaya göre %80 bant (puan) — kontrol noktaları arasında doğrusal */
export function band80(minutesToOpen: number, price: number): number {
  const m = Math.max(0, minutesToOpen);
  let v = BAND80[0][1];
  if (m <= BAND80[0][0]) {
    for (let i = 0; i < BAND80.length - 1; i++) {
      const [m1, b1] = BAND80[i], [m2, b2] = BAND80[i + 1];
      if (m <= m1 && m >= m2) { v = b2 + ((b1 - b2) * (m - m2)) / (m1 - m2); break; }
    }
  } else {
    // 04:00'ten önce (gece): ölçülmedi — 04:00 bandının %25 fazlası
    v = BAND80[0][1] * 1.25;
  }
  return Math.round(((v * price) / BAND_REF_PRICE) * 100) / 100;
}

export interface FutQuote {
  /** dün 16:00 ET'deki son fiyat */
  ref: number | null;
  now: number | null;
}

export interface OpenForecast {
  /** Hesap anı (unix sn) ve açılışa kalan dakika */
  at: number;
  minutesToOpen: number;
  prevClose: number;
  center: number;
  lo: number;
  hi: number;
  gap: number;
  gapPct: number;
  dir: GapDir;
  confidence: "YÜKSEK" | "ORTA" | "DÜŞÜK";
  /** Ölçülmüş gap yönü isabeti (bu güven sınıfı için) */
  dirHitPct: number;
  /** Vadelilerin dünkü kapanıştan bu yana % değişimi */
  changes: { ES: number | null; NQ: number | null; RTY: number | null; YM: number | null; VIX: number | null };
  /** ES ile aynı yöndeki diğer vadeli sayısı (NQ/RTY/YM) */
  agree: number;
  /** SPY premarket son fiyatı ve fair value'ya göre farkı (çapraz kontrol) */
  spyPre: number | null;
  spyPrePremium: number | null;
  notes: string[];
}

const pct = (q: FutQuote) => (q.ref && q.now ? (q.now / q.ref - 1) * 100 : null);

export function openForecast(input: {
  at: number;
  minutesToOpen: number;
  prevClose: number;
  es: FutQuote;
  nq: FutQuote;
  rty: FutQuote;
  ym: FutQuote;
  vix: FutQuote;
  spyPre: number | null;
  /** Günlük kayıttan öğrenilen bant ölçeği (gerçekleşen %80 hata / ölçülmüş %80 hata); null: sabit tablo */
  bandScale?: number | null;
}): OpenForecast | null {
  const { prevClose, es } = input;
  if (!es.ref || !es.now || !Number.isFinite(prevClose)) return null;
  const esPct = pct(es) as number;
  const center = Math.round(prevClose * (es.now / es.ref) * 100) / 100;
  const scale = input.bandScale != null && Number.isFinite(input.bandScale) ? Math.min(2, Math.max(0.5, input.bandScale)) : 1;
  const b = Math.round(band80(input.minutesToOpen, center) * scale * 100) / 100;
  const gap = Math.round((center - prevClose) * 100) / 100;
  const gapPct = Math.round((gap / prevClose) * 10000) / 100;
  const dir: GapDir = Math.abs(gapPct) < 0.05 ? "FLAT" : gap > 0 ? "UP" : "DOWN";

  const changes = { ES: esPct, NQ: pct(input.nq), RTY: pct(input.rty), YM: pct(input.ym), VIX: pct(input.vix) };
  const others = [changes.NQ, changes.RTY, changes.YM];
  const agree = others.filter((c) => c != null && Math.sign(c) === Math.sign(esPct) && esPct !== 0).length;
  // çelişki yalnızca iki hareket de anlamlıysa (≥ %0,1) — sıfır civarı gürültü çelişki sayılmaz
  const nqConflict = changes.NQ != null && Math.abs(changes.NQ) >= 0.1 && Math.abs(esPct) >= 0.1 && Math.sign(changes.NQ) !== Math.sign(esPct);
  const big = Math.abs(esPct) >= 0.3;

  // ölçülmüş isabetlere göre güven (bkz. dosya başı tablo)
  const late = input.minutesToOpen <= 60; // 08:30 sonrası
  let confidence: OpenForecast["confidence"];
  let dirHitPct: number;
  if (nqConflict) { confidence = late ? "ORTA" : "DÜŞÜK"; dirHitPct = late ? 82 : 43; }
  else if (agree === 3 && big) { confidence = "YÜKSEK"; dirHitPct = late ? 100 : 95; }
  else if (agree === 3 || big) { confidence = late ? "YÜKSEK" : "ORTA"; dirHitPct = late ? 97 : 92; }
  else { confidence = late ? "ORTA" : "DÜŞÜK"; dirHitPct = late ? 87 : 65; }

  const spyPrePremium = input.spyPre != null ? Math.round((input.spyPre - center) * 100) / 100 : null;
  const notes: string[] = [];
  if (nqConflict) notes.push("ES ile NQ ters yönde — teknoloji ile geniş piyasa ayrışıyor, yön güvenilmez.");
  if (changes.VIX != null && changes.VIX >= 5 && esPct > 0) notes.push(`VIX ${changes.VIX.toFixed(1)}% yükseliyor ama ES yukarıda — risk iştahı çelişkili.`);
  if (changes.VIX != null && changes.VIX <= -5 && esPct < 0) notes.push(`VIX ${changes.VIX.toFixed(1)}% düşüyor ama ES aşağıda — satış derin değil olabilir.`);
  if (spyPrePremium != null && Math.abs(spyPrePremium) >= Math.max(0.3, b * 0.5))
    notes.push(`SPY premarket (${input.spyPre!.toFixed(2)}) ES fair value'dan ${spyPrePremium > 0 ? "+" : ""}${spyPrePremium.toFixed(2)} sapıyor — ince likidite; ölçümde ES daha isabetli.`);
  if (input.minutesToOpen > 60) notes.push("08:30 ET makro veri saati henüz geçmedi — veri günüyse tahmin o anda bozulabilir.");
  notes.push("Açılış yönü ilk 30 dk'nın yönünü söylemez (ölçüm: gap yönünde devam %49) — gün yönü 09:55 kuralıyla belirlenir.");

  return {
    at: input.at, minutesToOpen: input.minutesToOpen, prevClose, center,
    lo: Math.round((center - b) * 100) / 100, hi: Math.round((center + b) * 100) / 100,
    gap, gapPct, dir, confidence, dirHitPct, changes, agree,
    spyPre: input.spyPre, spyPrePremium, notes,
  };
}
