/**
 * SPY Engine — Otomatik Günlük Tahmin Motoru (saf, izomorfik).
 *
 * En olası intraday senaryoyu 09:30–16:00 ET için saatlik/30dk noktalarla
 * üretir. Çoklu kaynak birleşimi:
 *   • ES=F gece hareketi → SPY açılış tahmini (gap proxy)
 *   • Kalshi ima edilen kapanış (SPX→SPY) → hedef çekim
 *   • SPY 15m EMA21 eğimi + VWAP konumu → yapısal yön
 *   • VIX + 15m ATR → günlük beklenen aralık (path genliği)
 *   • NASDAQ yönü → teyit oyu
 *
 * ÇIKTI BİR TAHMİNDİR, ölçüm değil — tek "en olası" yol (Monte Carlo değil).
 * Kaynaklar eksikse ilgili terim devre dışı kalır; hiçbir değer uydurulmaz.
 */

export interface ForecastInputs {
  spyPrevClose: number;
  /** ES=F gece % değişimi (önceki kapanışına göre) — SPY gap proxy */
  esChangePct: number | null;
  vix: number | null;
  /** NASDAQ (^IXIC) günlük/gece % değişimi — teyit oyu */
  nasdaqChangePct: number | null;
  /** Kalshi ima edilen kapanış, SPY cinsine çevrilmiş */
  kalshiImpliedCloseSpy: number | null;
  /** 15m yapı: EMA21 eğimi (puan/bar), VWAP üstünde mi, son kapanış */
  ema21Slope: number | null;
  aboveVwap: boolean | null;
  atr15m: number | null;
  /** Canlı spot (varsa açılış yerine kullanılabilir; seans içi güncelleme) */
  liveSpot: number | null;
  /** Hedef seansın açık olup olmadığı — açıksa açılış gerçekleşenden alınır */
  sessionOpenActual: number | null;
}

export interface ForecastPoint {
  /** ET dakikası (gün başından) — route epoch'a çevirir */
  minutesEt: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface SourceVote {
  key: string;
  label: string;
  direction: "YUKARI" | "AŞAĞI" | "NÖTR";
  detail: string;
}

export interface DailyForecast {
  openEstimate: number;
  closeTarget: number;
  expectedRangePct: number;
  direction: "YUKARI" | "AŞAĞI" | "NÖTR";
  confidence: number; // 0-100
  narrative: string;
  votes: SourceVote[];
  path: ForecastPoint[];
}

const RTH_OPEN_MIN = 9 * 60 + 30; // 09:30
const RTH_CLOSE_MIN = 16 * 60;    // 16:00
const STEP_MIN = 30;              // 30dk çözünürlük

/** smoothstep — hafif S eğrisi (açılış/kapanışa yakın daha yavaş). */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

export function buildDailyForecast(inp: ForecastInputs): DailyForecast {
  const prev = inp.spyPrevClose;

  // ── Açılış tahmini: gerçekleşen açılış varsa onu, yoksa ES gap proxy'si ──
  const openEstimate =
    inp.sessionOpenActual ??
    (inp.esChangePct != null ? prev * (1 + inp.esChangePct) : inp.liveSpot ?? prev);

  // ── Yapısal drift (EMA21 eğimi, seans boyunca ~13 30dk barına ölçeklenir) ──
  const structuralDrift =
    inp.ema21Slope != null ? inp.ema21Slope * 13 : 0;

  // ── Kapanış hedefi: Kalshi (varsa) + yapı driftinin ağırlıklı ortalaması ──
  const structuralClose = openEstimate + structuralDrift + (inp.aboveVwap === true ? +0.1 * (inp.atr15m ?? 0) : inp.aboveVwap === false ? -0.1 * (inp.atr15m ?? 0) : 0);
  const closeTarget =
    inp.kalshiImpliedCloseSpy != null
      ? 0.6 * inp.kalshiImpliedCloseSpy + 0.4 * structuralClose
      : structuralClose;

  // ── Beklenen günlük aralık (%): VIX-ima ile ATR-ima'nın büyüğü ──
  const vixRangePct = inp.vix != null ? (inp.vix / 100) / Math.sqrt(252) * 1.4 : null;
  const atrRangePct = inp.atr15m != null && prev > 0 ? (inp.atr15m * Math.sqrt(26)) / prev : null;
  const expectedRangePct = Math.max(vixRangePct ?? 0, atrRangePct ?? 0) || 0.006; // taban %0.6

  // ── Kaynak oyları ──
  const votes: SourceVote[] = [];
  const dirOf = (x: number | null, eps = 0): "YUKARI" | "AŞAĞI" | "NÖTR" =>
    x == null ? "NÖTR" : x > eps ? "YUKARI" : x < -eps ? "AŞAĞI" : "NÖTR";

  votes.push({
    key: "es", label: "ES=F gece",
    direction: dirOf(inp.esChangePct, 0.0005),
    detail: inp.esChangePct == null ? "veri yok" : `${(inp.esChangePct * 100).toFixed(2)}%`,
  });
  votes.push({
    key: "kalshi", label: "Kalshi ima",
    direction: inp.kalshiImpliedCloseSpy == null ? "NÖTR" : dirOf(inp.kalshiImpliedCloseSpy - openEstimate, 0.05),
    detail: inp.kalshiImpliedCloseSpy == null ? "veri yok" : `kapanış ${inp.kalshiImpliedCloseSpy.toFixed(2)}`,
  });
  votes.push({
    key: "struct", label: "15m yapı (EMA21/VWAP)",
    direction: inp.aboveVwap == null && inp.ema21Slope == null ? "NÖTR" : dirOf(structuralDrift + (inp.aboveVwap ? 1 : inp.aboveVwap === false ? -1 : 0) * 0.01, 0.01),
    detail: inp.aboveVwap == null ? "veri yok" : inp.aboveVwap ? "VWAP üstü" : "VWAP altı",
  });
  votes.push({
    key: "nasdaq", label: "NASDAQ yönü",
    direction: dirOf(inp.nasdaqChangePct, 0.0005),
    detail: inp.nasdaqChangePct == null ? "veri yok" : `${(inp.nasdaqChangePct * 100).toFixed(2)}%`,
  });
  votes.push({
    key: "vix", label: "VIX rejimi",
    direction: "NÖTR",
    detail: inp.vix == null ? "veri yok" : `${inp.vix.toFixed(1)} — beklenen aralık %${(expectedRangePct * 100).toFixed(2)}`,
  });

  // ── Yön + güven: net drift işareti + oy mutabakatı ──
  const netDrift = closeTarget - openEstimate;
  const direction = dirOf(netDrift, prev * 0.0008);
  const directional = votes.filter((v) => v.direction !== "NÖTR");
  const agree = directional.filter((v) => v.direction === direction).length;
  const confidence =
    direction === "NÖTR"
      ? 35
      : Math.round(45 + (directional.length ? (agree / directional.length) * 45 : 0) + (inp.kalshiImpliedCloseSpy != null ? 10 : 0));

  // ── En olası yol: açılış → kapanış, S eğrili drift + bar-içi zarf ──
  const path: ForecastPoint[] = [];
  const nSteps = Math.round((RTH_CLOSE_MIN - RTH_OPEN_MIN) / STEP_MIN); // 13
  const perBarMove = (openEstimate * expectedRangePct) / Math.sqrt(nSteps + 1);
  let prevClose = openEstimate;
  for (let i = 0; i <= nSteps; i++) {
    const minutesEt = RTH_OPEN_MIN + i * STEP_MIN;
    const t = i / nSteps;
    const anchorClose = openEstimate + (closeTarget - openEstimate) * smooth(t);
    const o = i === 0 ? openEstimate : prevClose;
    const c = anchorClose;
    // Bar-içi genlik açılışa yakın daha büyük (sabah oynaklığı)
    const amp = perBarMove * (1.3 - 0.6 * t);
    const hi = Math.max(o, c) + amp * 0.5;
    const lo = Math.min(o, c) - amp * 0.5;
    path.push({ minutesEt, open: r2(o), high: r2(hi), low: r2(lo), close: r2(c) });
    prevClose = c;
  }

  const dirWord = direction === "YUKARI" ? "yukarı" : direction === "AŞAĞI" ? "aşağı" : "yatay";
  const narrative =
    `En olası senaryo ${dirWord}: açılış ~${openEstimate.toFixed(2)}, hedef kapanış ~${closeTarget.toFixed(2)} ` +
    `(${netDrift >= 0 ? "+" : ""}${netDrift.toFixed(2)} puan). Beklenen gün aralığı %${(expectedRangePct * 100).toFixed(2)}. ` +
    `${agree}/${directional.length} kaynak ${dirWord} yönünde` +
    (inp.kalshiImpliedCloseSpy != null ? " (Kalshi ima dahil)." : " (Kalshi verisi yok).");

  return { openEstimate: r2(openEstimate), closeTarget: r2(closeTarget), expectedRangePct, direction, confidence: Math.max(0, Math.min(100, confidence)), narrative, votes, path };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
