/**
 * SPY Engine V2 — Çekirdek (izomorfik)
 *
 * Bu dosya HEM sunucuda HEM tarayıcıda çalışır: saf fonksiyonlar, `fetch`
 * yok, `server-only` import yok. Amaç, göstergelerin ve zaman dilimi
 * toplamalarının iki tarafta da BİREBİR aynı sonucu vermesi — grafikte
 * gördüğünüz RSI ile motorun karar verirken kullandığı RSI aynı sayı olsun.
 *
 * Zaman: tüm zaman damgaları GERÇEK unix saniyesidir (UTC). Grafik ekseninde
 * New York saati göstermek için zaman damgası KAYDIRILMAZ; sadece
 * biçimlendirici (bkz. nyClock) New York'a çevirir. Böylece "zaman kayması"
 * (time drift) oluşmaz.
 */

// ── Tipler ────────────────────────────────────────────────────────

export interface Bar {
  time: number; // unix saniye (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** Ağ üzerinde taşınan sıkıştırılmış mum: [t, o, h, l, c, v] */
export type CompactBar = [number, number, number, number, number, number];

export type Timeframe = "1m" | "5m" | "15m";

export type SessionPhase = "PRE" | "RTH" | "POST" | "CLOSED";

export interface SessionInfo {
  /** Gösterilen seansın NY tarihi (YYYY-MM-DD) */
  date: string;
  phase: SessionPhase;
  /** Şu an gerçekten canlı veri akıyor mu (PRE/RTH/POST) */
  isLive: boolean;
  /** Kullanıcıya gösterilecek not (kapalıysa) */
  note: string | null;
  /** Seans açılış/kapanış epoch'ları (UTC saniye) */
  rthOpen: number;
  rthClose: number;
}

// ── New York zaman yardımcıları ───────────────────────────────────

const NY_TZ = "America/New_York";

const NY_PARTS_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: NY_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

export interface NyParts {
  ymd: string;
  hhmm: string;
  hhmmss: string;
  /** Gün başından itibaren dakika (ET) */
  minutes: number;
  weekday: number; // 0 = Pazar
}

const nyCache = new Map<number, NyParts>();

export function nyParts(unixSec: number): NyParts {
  const key = Math.floor(unixSec);
  const hit = nyCache.get(key);
  if (hit) return hit;

  const parts = NY_PARTS_FMT.formatToParts(new Date(key * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";

  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const second = Number(get("second"));

  const value: NyParts = {
    ymd: `${get("year")}-${get("month")}-${get("day")}`,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
    hhmmss: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`,
    minutes: hour * 60 + minute,
    weekday: WEEKDAY_INDEX[get("weekday")] ?? 0,
  };

  if (nyCache.size > 40000) nyCache.clear();
  nyCache.set(key, value);
  return value;
}

/** Grafik ekseni / saat göstergesi için NY saati (HH:mm) */
export function nyClock(unixSec: number, withSeconds = false): string {
  const p = nyParts(unixSec);
  return withSeconds ? p.hhmmss : p.hhmm;
}

/** ET dakika sınırları */
export const PRE_OPEN_MIN = 4 * 60;      // 04:00
export const RTH_OPEN_MIN = 9 * 60 + 30; // 09:30
export const RTH_CLOSE_MIN = 16 * 60;    // 16:00
export const POST_CLOSE_MIN = 20 * 60;   // 20:00
/** 0DTE zorunlu kapama saati (talimat §4.4) */
export const EOD_FORCE_MIN = 15 * 60 + 45; // 15:45
/**
 * Giriş sinyali üretilebilen pencere — açılış gürültüsü ve kapanış hariç.
 * 2026-09-06: bitiş 15:40 -> 15:30'a çekildi — 15:30 sonrası YENİ pozisyon
 * açılmaz (mevcut pozisyonlar 15:45 EOD_FORCE_MIN'e kadar yönetilmeye devam
 * eder, bkz. strategy.ts findExitSignal).
 */
export const ENTRY_START_MIN = 9 * 60 + 35;
export const ENTRY_END_MIN = 15 * 60 + 30;

/**
 * Bir NY tarihi (YYYY-MM-DD) + ET dakikası → unix saniye.
 * DST'yi doğru işlemek için önce UTC varsayımıyla bir aday üretip, o adayın
 * NY karşılığındaki sapmayı ölçüp düzeltiyoruz.
 */
export function nyDateTimeToEpoch(ymd: string, minutesEt: number): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0) / 1000 + minutesEt * 60;
  const p = nyParts(guess);
  const dayShift = p.ymd === ymd ? 0 : p.ymd < ymd ? -1440 : 1440;
  const guessMinutes = p.minutes + dayShift;
  return guess + (minutesEt - guessMinutes) * 60;
}

// ── Seans tespiti ─────────────────────────────────────────────────

/**
 * Verideki en son NY seans tarihini ve o an içinde bulunduğumuz fazı döndürür.
 * Uydurma yok: seans tarihi HER ZAMAN gerçekten mum bulunan bir günden gelir;
 * yalnızca "şu an canlı mıyız" sorusu duvar saatinden cevaplanır.
 */
export function detectSession(bars: Bar[], nowSec: number): SessionInfo {
  const now = nyParts(nowSec);
  const isWeekday = now.weekday >= 1 && now.weekday <= 5;
  const liveNow = isWeekday && now.minutes >= PRE_OPEN_MIN && now.minutes < POST_CLOSE_MIN;

  const lastYmd = bars.length ? nyParts(bars[bars.length - 1].time).ymd : null;
  const date = liveNow ? now.ymd : lastYmd ?? now.ymd;

  let phase: SessionPhase = "CLOSED";
  if (liveNow) {
    if (now.minutes < RTH_OPEN_MIN) phase = "PRE";
    else if (now.minutes < RTH_CLOSE_MIN) phase = "RTH";
    else phase = "POST";
  }

  const note =
    phase === "CLOSED"
      ? `Piyasa kapalı — ${date} seansı gösteriliyor. Yeni mum gelmeyecek.`
      : null;

  return {
    date,
    phase,
    isLive: phase !== "CLOSED",
    note,
    rthOpen: nyDateTimeToEpoch(date, RTH_OPEN_MIN),
    rthClose: nyDateTimeToEpoch(date, RTH_CLOSE_MIN),
  };
}

/** Belirli bir NY gününe (04:00–20:00 ET, pre + RTH + post) ait mumlar */
export function barsOfSessionDay(bars: Bar[], ymd: string): Bar[] {
  return bars.filter((b) => {
    const p = nyParts(b.time);
    return p.ymd === ymd && p.minutes >= PRE_OPEN_MIN && p.minutes < POST_CLOSE_MIN;
  });
}

export function isRthBar(b: Bar): boolean {
  const p = nyParts(b.time);
  return p.minutes >= RTH_OPEN_MIN && p.minutes < RTH_CLOSE_MIN;
}

// ── Toplama (aggregation) ─────────────────────────────────────────

/**
 * 1m mumları N dakikalık kovalara toplar. Kova sınırı EPOCH'a göre
 * hesaplanır (t - t % (N*60)); Yahoo'nun kendi 5m/15m mumları da aynı
 * hizaya oturduğu için iki kaynak arasında kayma olmaz.
 */
export function bucketAggregate(bars: Bar[], minutes: number): Bar[] {
  if (minutes <= 1) return bars.slice();
  const span = minutes * 60;
  const out: Bar[] = [];
  let cur: Bar | null = null;
  let curKey = -1;

  for (const b of bars) {
    const key = b.time - (b.time % span);
    if (key !== curKey) {
      if (cur) out.push(cur);
      curKey = key;
      cur = { time: key, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0 };
    } else if (cur) {
      cur.high = Math.max(cur.high, b.high);
      cur.low = Math.min(cur.low, b.low);
      cur.close = b.close;
      cur.volume += b.volume || 0;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * Yahoo'nun mum dizisindeki SON eleman, kova başlangıcı değil
 * `meta.regularMarketTime` damgasını taşır (örn. 1787961598 — 60'ın katı
 * değil). Bu ham hâliyle grafiğe verilirse mum kendi diliminin dışına düşer
 * ve "zaman kayması" olarak görünür; 5m/15m toplamalarında da ayrı bir
 * sahte kova açar.
 *
 * Burada her mum kendi kovasının başlangıcına indirilir ve aynı kovaya
 * düşenler birleştirilir (yüksek/düşük genişler, kapanış EN SON gelenden
 * alınır). Veri uydurulmaz — sadece doğru dilime yerleştirilir.
 */
export function snapToInterval(bars: Bar[], spanSec: number): Bar[] {
  if (spanSec <= 0) return bars;
  const out: Bar[] = [];
  for (const b of bars) {
    const t = b.time - (b.time % spanSec);
    const prev = out[out.length - 1];
    if (prev && prev.time === t) {
      prev.high = Math.max(prev.high, b.high);
      prev.low = Math.min(prev.low, b.low);
      prev.close = b.close;
      prev.volume = Math.max(prev.volume, b.volume || 0);
    } else {
      out.push({ ...b, time: t });
    }
  }
  return out;
}

/**
 * Yahoo'nun seans dışı (pre/after) verisi ara sıra BOZUK PRİNT içerir.
 * Gerçek örnekler (SPY, 2026-08-27/28):
 *   16:04 → H 771,29 · 17:06 → H 787,52 · 19:38–19:39 → C 775,20 / 775,09
 * hepsinin komşuları 769,3 civarında ve hepsinin HACMİ SIFIR — yani o
 * dakikalarda kayıtlı bir işlem yok, değerler bozuk bir kotasyon yansıması.
 * Ham hâlleriyle bırakıldıklarında grafiğin fiyat ölçeğini, "seans
 * zirve/dip" kartlarını ve ATR'yi tamamen yanlış gösterirler.
 *
 * Filtre "geri dönen sapma" (excursion) mantığıyla çalışır ve bilinçli
 * olarak dardır. Bir mum ancak şu üç koşulun HEPSİ sağlanırsa atılır:
 *   1. hacmi 0 (o dakikada kayıtlı işlem yok),
 *   2. O/H/L/C değerlerinden biri, son KORUNAN mumun kapanışından
 *      `tolerance` oranından fazla sapmış,
 *   3. fiyat en fazla `maxRun` mum içinde o seviyeye GERİ DÖNÜYOR.
 *
 * 3. koşul kritik: gerçek bir seans dışı hareket (haber, kazanç) yeni
 * seviyede KALIR, geri dönmez — bu yüzden korunur ve referans seviye yeni
 * fiyata taşınır. Yalnızca gidip hemen geri dönen sivri uçlar (tek ya da
 * birkaç mumluk) atılır.
 *
 * Atılan mumun yerine hiçbir şey konmaz — mum uydurulmaz, o dakika grafikte
 * boş kalır. Kaç mumun atıldığı arayüzde açıkça gösterilir.
 */
export function dropBadPrints(
  bars: Bar[],
  tolerance = 0.002,
  maxRun = 10
): { bars: Bar[]; dropped: number } {
  if (bars.length < 3) return { bars, dropped: 0 };
  const out: Bar[] = [];
  let dropped = 0;
  let i = 0;

  while (i < bars.length) {
    const b = bars[i];
    if ((b.volume || 0) > 0 || out.length === 0) {
      out.push(b);
      i++;
      continue;
    }

    const ref = out[out.length - 1].close;
    const dev = (v: number) => Math.abs(v - ref) / ref;
    const off = dev(b.open) > tolerance || dev(b.high) > tolerance || dev(b.low) > tolerance || dev(b.close) > tolerance;
    if (!off) {
      out.push(b);
      i++;
      continue;
    }

    // Sapma referans seviyeye geri dönüyor mu?
    let k = i;
    while (
      k < bars.length &&
      k - i < maxRun &&
      !(dev(bars[k].close) <= tolerance && dev(bars[k].high) <= tolerance && dev(bars[k].low) <= tolerance)
    ) {
      k++;
    }

    if (k < bars.length && k - i < maxRun) {
      dropped += k - i; // i..k-1 arası sivri uç — atılır
      i = k;
    } else {
      out.push(b); // geri dönmüyor → gerçek hareket, korunur
      i++;
    }
  }

  return { bars: out, dropped };
}

/** Aynı zaman damgalı tekrarları eler, artan sıraya dizer, bozukları atar */
export function normalizeBars(bars: Bar[]): Bar[] {
  const map = new Map<number, Bar>();
  for (const b of bars) {
    if (!b || !Number.isFinite(b.time)) continue;
    if (!Number.isFinite(b.open) || !Number.isFinite(b.high) || !Number.isFinite(b.low) || !Number.isFinite(b.close)) continue;
    map.set(b.time, b);
  }
  return Array.from(map.values()).sort((a, b) => a.time - b.time);
}

export function toCompact(bars: Bar[]): CompactBar[] {
  return bars.map((b) => [
    b.time,
    r2(b.open), r2(b.high), r2(b.low), r2(b.close),
    Math.round(b.volume || 0),
  ]);
}

export function fromCompact(rows: CompactBar[] | number[][] | undefined | null): Bar[] {
  const out: Bar[] = [];
  for (const r of rows || []) {
    if (!Array.isArray(r) || r.length < 5) continue;
    out.push({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4], volume: r[5] ?? 0 });
  }
  return out;
}

export function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Heikin Ashi ───────────────────────────────────────────────────

/**
 * Heikin Ashi dönüşümü. Görsel bir katmandır — motor kararlarını HER ZAMAN
 * ham (gerçek) mumlar üzerinden verir, çünkü HA kapanışı gerçek işlem
 * fiyatı değildir.
 */
export function heikinAshi(bars: Bar[]): Bar[] {
  const out: Bar[] = [];
  let prevOpen = 0;
  let prevClose = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const haClose = (b.open + b.high + b.low + b.close) / 4;
    const haOpen = i === 0 ? (b.open + b.close) / 2 : (prevOpen + prevClose) / 2;
    out.push({
      time: b.time,
      open: haOpen,
      high: Math.max(b.high, haOpen, haClose),
      low: Math.min(b.low, haOpen, haClose),
      close: haClose,
      volume: b.volume,
    });
    prevOpen = haOpen;
    prevClose = haClose;
  }
  return out;
}

// ── Göstergeler ───────────────────────────────────────────────────
// Hepsi giriş dizisiyle AYNI uzunlukta dizi döndürür; hesaplanamayan
// baştaki elemanlar null'dur (grafik onları boşluk olarak çizer).

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length < period) return out;
  const k = 2 / (period + 1);
  let seed = 0;
  for (let i = 0; i < period; i++) seed += values[i];
  let prev = seed / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** Wilder RSI */
export function rsi(values: number[], period = 14): Series {
  const out: Series = new Array(values.length).fill(null);
  if (values.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  hist: Series;
}

export function macd(values: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const line: Series = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? (emaFast[i] as number) - (emaSlow[i] as number) : null
  );
  // Sinyal çizgisi yalnızca MACD'nin tanımlı olduğu bölüm üzerinden hesaplanır
  const firstIdx = line.findIndex((v) => v != null);
  const signal: Series = new Array(values.length).fill(null);
  const hist: Series = new Array(values.length).fill(null);
  if (firstIdx >= 0) {
    const dense = line.slice(firstIdx).map((v) => v as number);
    const sig = ema(dense, signalPeriod);
    for (let i = 0; i < sig.length; i++) {
      const idx = firstIdx + i;
      signal[idx] = sig[i];
      if (sig[i] != null && line[idx] != null) hist[idx] = (line[idx] as number) - (sig[i] as number);
    }
  }
  return { macd: line, signal, hist };
}

export interface BollingerResult {
  upper: Series;
  mid: Series;
  lower: Series;
  /** %B — fiyatın bant içindeki göreli konumu (0 = alt, 1 = üst) */
  pctB: Series;
  /** Bant genişliği / orta bant */
  width: Series;
}

export function bollinger(values: number[], period = 20, mult = 2): BollingerResult {
  const mid = sma(values, period);
  const upper: Series = new Array(values.length).fill(null);
  const lower: Series = new Array(values.length).fill(null);
  const pctB: Series = new Array(values.length).fill(null);
  const width: Series = new Array(values.length).fill(null);

  for (let i = period - 1; i < values.length; i++) {
    const m = mid[i];
    if (m == null) continue;
    let acc = 0;
    for (let j = i - period + 1; j <= i; j++) acc += (values[j] - m) ** 2;
    const sd = Math.sqrt(acc / period);
    const u = m + mult * sd;
    const l = m - mult * sd;
    upper[i] = u;
    lower[i] = l;
    pctB[i] = u === l ? 0.5 : (values[i] - l) / (u - l);
    width[i] = m === 0 ? 0 : (u - l) / m;
  }
  return { upper, mid, lower, pctB, width };
}

/** Wilder ATR */
export function atr(bars: Bar[], period = 14): Series {
  const out: Series = new Array(bars.length).fill(null);
  if (bars.length <= period) return out;
  const tr: number[] = [0];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let sum = 0;
  for (let i = 1; i <= period; i++) sum += tr[i];
  let prev = sum / period;
  out[period] = prev;
  for (let i = period + 1; i < bars.length; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

/** Seans içi kümülatif VWAP — her yeni NY gününde sıfırlanır */
export function sessionVwap(bars: Bar[]): Series {
  const out: Series = new Array(bars.length).fill(null);
  let day = "";
  let pv = 0;
  let vol = 0;
  for (let i = 0; i < bars.length; i++) {
    const p = nyParts(bars[i].time);
    if (p.ymd !== day) {
      day = p.ymd;
      pv = 0;
      vol = 0;
    }
    const typical = (bars[i].high + bars[i].low + bars[i].close) / 3;
    const v = bars[i].volume || 0;
    pv += typical * v;
    vol += v;
    out[i] = vol > 0 ? pv / vol : null;
  }
  return out;
}

export function lastNum(s: Series): number | null {
  for (let i = s.length - 1; i >= 0; i--) if (s[i] != null) return s[i] as number;
  return null;
}
