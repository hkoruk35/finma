/**
 * SPY Engine — opsiyon seviyeleri: call/put duvarları ve max pain (0DTE).
 *
 * YALNIZCA SEVİYE: yön kararına girmez (geçmiş opsiyon verisi olmadığı için
 * yön isabeti ölçülemedi). Harita ve hedef listesinde destek/direnç/mıknatıs
 * olarak görünür.
 *
 * Kaynak: Yahoo opsiyon zinciri (ücretsiz, 15 dk gecikmeli olabilir).
 * openInterest vade günü içinde DEĞİŞMEZ — bir önceki günün kapanış değeridir;
 * bu yüzden duvarlar "dünkü açık pozisyon"dur, gün içi yeni pozisyonu
 * göstermez. Hacim (volume) ayrıca raporlanır.
 *
 * Açılış ÖNCESİ Yahoo, bugün vadeli (0DTE) kontratlarda openInterest'i 0
 * gösterir (OI genellikle açılışla gelir). Bu durumda ağırlık olarak aynı
 * kontratların son işlem günündeki HACMİ kullanılır ve `basis: "hacim"`
 * olarak AÇIKÇA etiketlenir; OI gelince otomatik OI'ye döner.
 *
 * Uzak strike'lar (derin OTM koruma pozisyonları) duvarları ve max pain'i
 * bozar — yalnızca fiyatın ±WINDOW_PCT'i içindeki strike'lar kullanılır.
 */

export interface OptionRow {
  strike: number;
  openInterest: number;
  volume: number;
}

export interface OptionWall {
  strike: number;
  /** Ağırlık: basis "OI" ise açık pozisyon, "hacim" ise son işlem günü hacmi */
  openInterest: number;
  /** O strike'ın bugünkü hacmi */
  volume: number;
}

export interface OptionLevels {
  /** Vade (YYYY-MM-DD) — Yahoo vadeleri gece yarısı UTC'dir, bu tarih UTC'ye göredir */
  expiry: string;
  /** Vade bugünün (NY) tarihi mi — değilse en yakın vade ve 0DTE DEĞİL */
  isZeroDte: boolean;
  spot: number;
  /** En büyük OI'li call strike'ları (direnç eğilimi) — büyükten küçüğe */
  callWalls: OptionWall[];
  /** En büyük OI'li put strike'ları (destek eğilimi) */
  putWalls: OptionWall[];
  /** Vade sonunda opsiyon yazarlarının toplam kaybını en aza indiren fiyat (mıknatıs) */
  maxPain: number | null;
  /** Pencere içindeki toplam call/put oranı (>1 call ağırlıklı) — basis ağırlığıyla */
  callPutOi: number | null;
  /** Duvar/max pain ağırlığı: açık pozisyon (OI) ya da OI henüz yokken hacim */
  basis: "OI" | "hacim";
  /** Hesapta kullanılan pencere (strike aralığı) */
  window: { lo: number; hi: number };
  fetchedAt: number;
}

export const WINDOW_PCT = 0.03;

export function computeOptionLevels(input: {
  calls: OptionRow[];
  puts: OptionRow[];
  spot: number;
  expiry: string;
  isZeroDte: boolean;
  fetchedAt: number;
}): OptionLevels | null {
  const { spot } = input;
  if (!Number.isFinite(spot) || spot <= 0) return null;
  const lo = spot * (1 - WINDOW_PCT), hi = spot * (1 + WINDOW_PCT);
  const inWin = (r: OptionRow) => Number.isFinite(r.strike) && r.strike >= lo && r.strike <= hi;
  const calls = input.calls.filter(inWin), puts = input.puts.filter(inWin);
  const oiTotal = [...calls, ...puts].reduce((a, r) => a + (r.openInterest || 0), 0);
  const basis: OptionLevels["basis"] = oiTotal > 0 ? "OI" : "hacim";
  const w = (r: OptionRow) => (basis === "OI" ? r.openInterest || 0 : r.volume || 0);
  const totalCall = calls.reduce((a, r) => a + w(r), 0);
  const totalPut = puts.reduce((a, r) => a + w(r), 0);
  if (totalCall + totalPut <= 0) return null;

  // duvar: fiyatın ÜSTÜNDEKİ call'lar ve ALTINDAKİ put'lar (fiyat bunlara çarpar)
  const top = (rows: OptionRow[], pred: (r: OptionRow) => boolean): OptionWall[] =>
    rows
      .filter((r) => pred(r) && w(r) > 0)
      .sort((a, b) => w(b) - w(a))
      .slice(0, 2)
      .map((r) => ({ strike: r.strike, openInterest: w(r), volume: r.volume || 0 }));
  const callWalls = top(calls, (r) => r.strike > spot - 0.5);
  const putWalls = top(puts, (r) => r.strike < spot + 0.5);

  // max pain: her aday vade-sonu fiyatı için toplam içsel değer ödemesi
  const strikes = Array.from(new Set([...calls, ...puts].map((r) => r.strike))).sort((a, b) => a - b);
  let best: { pain: number; s: number } | null = null;
  for (const s of strikes) {
    const pain =
      calls.reduce((a, r) => a + w(r) * Math.max(0, s - r.strike), 0) +
      puts.reduce((a, r) => a + w(r) * Math.max(0, r.strike - s), 0);
    if (!best || pain < best.pain) best = { pain, s };
  }

  return {
    expiry: input.expiry,
    isZeroDte: input.isZeroDte,
    spot,
    callWalls,
    putWalls,
    maxPain: best ? best.s : null,
    callPutOi: totalPut > 0 ? Math.round((totalCall / totalPut) * 100) / 100 : null,
    basis,
    window: { lo: Math.round(lo * 100) / 100, hi: Math.round(hi * 100) / 100 },
    fetchedAt: input.fetchedAt,
  };
}

/** Harita / hedef listesi için seviye etiketleri (yön kararı DEĞİL) */
export function optionLevelList(o: OptionLevels | null): { price: number; label: string }[] {
  if (!o) return [];
  const tag = o.isZeroDte ? "0DTE" : `vade ${o.expiry}`;
  const b = o.basis === "OI" ? "OI" : "hacim";
  const out: { price: number; label: string }[] = [];
  o.callWalls.forEach((w, i) => out.push({ price: w.strike, label: `Call duvarı${i ? " 2" : ""} (${tag}, ${b} ${Math.round(w.openInterest / 1000)}K)` }));
  o.putWalls.forEach((w, i) => out.push({ price: w.strike, label: `Put duvarı${i ? " 2" : ""} (${tag}, ${b} ${Math.round(w.openInterest / 1000)}K)` }));
  if (o.maxPain != null) out.push({ price: o.maxPain, label: `Max pain (${tag}${o.basis === "hacim" ? ", hacim bazlı" : ""})` });
  return out;
}
