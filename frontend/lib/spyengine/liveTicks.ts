/**
 * Canlı fiyat akışı (2026-11-10, kullanıcı isteği: "veriler 1 sn'de bir güncellenmeli").
 *
 * Ölçüm: Yahoo 1m grafik verisi son mumu ~10–12 sn'de bir güncelliyor (sayfa 1 sn'de yoklasa da fiyat aynı kalıyordu).
 * Yahoo'nun kendi sitesinin kullandığı akış (wss://streamer.finance.yahoo.com, protobuf PricingData) her sembol için
 * ~1 sn'de bir işlem fiyatı gönderiyor (gecikme ~1 sn). RESMİ BİR API DEĞİL — koparsa / biçim değişirse sistem
 * kendiliğinden eski 1m grafik verisine döner (overlayLiveTick hiçbir şey yapmaz).
 *
 * • Sunucu sürecinde TEK bağlantı (globalThis'te — dev HMR'da çoğalmaz), motor sembollerinin hepsine abone.
 * • Tembel başlar: ilk getLiveTick çağrısında bağlanır; 10 dk kimse okumazsa kapanır (sayfa açık değilken dinlemez).
 * • Kopunca artan bekleme ile yeniden bağlanır; 45 sn mesaj gelmezse (seans içinde) bağlantıyı yeniler.
 * • overlayLiveTick: taze tick (≤ 20 sn, son kapanıştan ≤ %3) son 1m/5m/15m mumun kapanış/tepe/dibini ve anlık fiyatı
 *   günceller; o dakikanın mumu Yahoo'da henüz yoksa yeni mum açar. Önbellekteki diziler DEĞİŞTİRİLMEZ (kopya döner).
 *   Motorun kararları yalnız KAPANMIŞ mumlarla verildiği için bu yalnız canlı fiyatı ve oluşan mumu hızlandırır.
 */
import WebSocket from "ws";
import type { Bar } from "./core";
import type { SpyBundle } from "./market";

const URL = "wss://streamer.finance.yahoo.com/?version=2";
const SYMBOLS = ["SPY", "QQQ", "IWM", "NVDA", "AAPL", "TSLA", "AMZN"];
const IDLE_CLOSE_MS = 10 * 60 * 1000;
const SILENT_RECONNECT_MS = 45 * 1000;
const MAX_TICK_AGE_SEC = 20;
const MAX_JUMP = 0.03;

export interface LiveTick { symbol: string; price: number; time: number; dayVolume: number | null; recvAt: number }

interface State {
  ws: WebSocket | null;
  ticks: Map<string, LiveTick>;
  lastRead: number;
  lastMsg: number;
  retry: number;
  timer: ReturnType<typeof setTimeout> | null;
  watchdog: ReturnType<typeof setInterval> | null;
}

const G = globalThis as unknown as { __bogaLiveTicks?: State };
const S: State = (G.__bogaLiveTicks ??= { ws: null, ticks: new Map(), lastRead: 0, lastMsg: 0, retry: 0, timer: null, watchdog: null });

// ── protobuf (PricingData) — yalnız gereken alanlar: 1 id · 2 price(float) · 3 time(ms, sint64) · 9 dayVolume(sint64) ──
/** varint (sayı olarak — alanlar 2^53'ün çok altında: zaman ms ~1,8e12, hacim < 1e12) */
function varint(b: Buffer, i: number): [number, number] {
  let r = 0, mul = 1;
  for (;;) {
    if (i >= b.length) throw new Error("varint");
    const x = b[i++];
    r += (x & 0x7f) * mul;
    if (!(x & 0x80)) break;
    mul *= 128;
  }
  return [r, i];
}
/** sint64 zigzag çözümü */
const unzig = (v: number) => (v % 2 === 0 ? v / 2 : -(v + 1) / 2);
function decode(buf: Buffer): { id?: string; price?: number; timeMs?: number; dayVolume?: number } {
  const out: { id?: string; price?: number; timeMs?: number; dayVolume?: number } = {};
  let i = 0;
  while (i < buf.length) {
    let key: number;
    [key, i] = varint(buf, i);
    const f = Math.floor(key / 8), wt = key % 8;
    if (wt === 0) {
      let v: number;
      [v, i] = varint(buf, i);
      if (f === 3) out.timeMs = unzig(v);
      else if (f === 9) out.dayVolume = unzig(v);
    } else if (wt === 5) {
      if (f === 2) out.price = buf.readFloatLE(i);
      i += 4;
    } else if (wt === 1) {
      i += 8;
    } else if (wt === 2) {
      let n: number;
      [n, i] = varint(buf, i);
      if (f === 1) out.id = buf.subarray(i, i + n).toString("utf8");
      i += n;
    } else {
      throw new Error(`wt ${wt}`);
    }
  }
  return out;
}

function onMessage(data: WebSocket.RawData) {
  S.lastMsg = Date.now();
  try {
    const raw = data.toString();
    let b64 = raw;
    if (raw.startsWith("{")) b64 = (JSON.parse(raw) as { message?: string }).message ?? "";
    if (!b64) return;
    const d = decode(Buffer.from(b64, "base64"));
    if (!d.id || d.price == null || !Number.isFinite(d.price) || d.price <= 0 || !d.timeMs) return;
    // float32 → 3 basamak (745.7698974 → 745.77)
    const price = Math.round(d.price * 1000) / 1000;
    const time = Math.floor(d.timeMs / 1000);
    const prev = S.ticks.get(d.id);
    if (prev && time < prev.time) return;
    S.ticks.set(d.id, { symbol: d.id, price, time, dayVolume: d.dayVolume ?? null, recvAt: Date.now() });
  } catch {
    // bozuk/beklenmeyen mesaj — yok sayılır
  }
}

function schedule(ms: number) {
  if (S.timer) clearTimeout(S.timer);
  S.timer = setTimeout(() => { S.timer = null; connect(); }, ms);
}

function connect() {
  if (S.ws) return;
  if (Date.now() - S.lastRead > IDLE_CLOSE_MS) return; // kimse bakmıyor
  let ws: WebSocket;
  try {
    ws = new WebSocket(URL, { headers: { Origin: "https://finance.yahoo.com", "User-Agent": "Mozilla/5.0" } });
  } catch {
    schedule(Math.min(60000, 2000 * 2 ** S.retry++));
    return;
  }
  S.ws = ws;
  S.lastMsg = Date.now();
  ws.on("open", () => {
    S.retry = 0;
    ws.send(JSON.stringify({ subscribe: SYMBOLS }));
  });
  ws.on("message", onMessage);
  const drop = () => {
    if (S.ws !== ws) return;
    S.ws = null;
    schedule(Math.min(60000, 2000 * 2 ** S.retry++));
  };
  ws.on("close", drop);
  ws.on("error", () => { try { ws.terminate(); } catch { /* zaten kapalı */ } drop(); });

  if (!S.watchdog) {
    S.watchdog = setInterval(() => {
      const now = Date.now();
      if (now - S.lastRead > IDLE_CLOSE_MS) {
        // boşta: bağlantıyı kapat, yeniden bağlanma (bir sonraki okuma açar)
        const w = S.ws;
        S.ws = null;
        if (S.timer) { clearTimeout(S.timer); S.timer = null; }
        try { w?.close(); } catch { /* yok say */ }
        if (S.watchdog) { clearInterval(S.watchdog); S.watchdog = null; }
        return;
      }
      if (S.ws && now - S.lastMsg > SILENT_RECONNECT_MS) {
        // seans dışında Yahoo susabilir; sessiz bağlantıyı yine de tazele (zararsız)
        const w = S.ws;
        S.ws = null;
        try { w.terminate(); } catch { /* yok say */ }
        schedule(1000);
      }
    }, 15000);
  }
}

/** Sembolün son canlı tick'i (taze değilse null). İlk çağrı akışı başlatır. */
export function getLiveTick(symbol: string, nowSec = Math.floor(Date.now() / 1000)): LiveTick | null {
  S.lastRead = Date.now();
  if (!S.ws && !S.timer) connect();
  const t = S.ticks.get(symbol.toUpperCase());
  if (!t || nowSec - t.time > MAX_TICK_AGE_SEC) return null;
  return t;
}

/** Bir mum dizisinin son mumunu tick ile güncelle; tick yeni bir kovaya düşüyorsa yeni mum aç. Diziyi kopyalar. */
function patchSeries(bars: Bar[], tick: LiveTick, sec: number): Bar[] {
  if (!bars.length) return bars;
  const bucket = Math.floor(tick.time / sec) * sec;
  const last = bars[bars.length - 1];
  if (bucket < last.time) return bars; // tick eski bir kovaya ait — dokunma
  if (bucket === last.time) {
    const nb: Bar = { ...last, close: tick.price, high: Math.max(last.high, tick.price), low: Math.min(last.low, tick.price) };
    return [...bars.slice(0, -1), nb];
  }
  // yalnız bir sonraki kova açılır (aradaki boşluk uydurulmaz)
  if (bucket !== last.time + sec) return bars;
  return [...bars, { time: bucket, open: tick.price, high: tick.price, low: tick.price, close: tick.price, volume: 0 }];
}

/**
 * Taze tick varsa paketi güncellenmiş KOPYA olarak döndürür (canlı fiyat + oluşan 1m/5m/15m mum).
 * Tick yoksa / eskiyse / son kapanıştan %3'ten fazla sapıyorsa paketi aynen döndürür.
 */
export function overlayLiveTick(symbol: string, bundle: SpyBundle, nowSec = Math.floor(Date.now() / 1000)): SpyBundle & { liveTick: LiveTick | null } {
  const tick = getLiveTick(symbol, nowSec);
  const ref = bundle.m1.length ? bundle.m1[bundle.m1.length - 1].close : bundle.marketPrice;
  if (!tick || ref == null || Math.abs(tick.price - ref) / ref > MAX_JUMP) return { ...bundle, liveTick: null };
  const lastM1 = bundle.m1.length ? bundle.m1[bundle.m1.length - 1].time : 0;
  // Yahoo 1m verisi tick'ten daha yeni bir dakikayı zaten taşıyorsa (nadiren) dokunma
  if (Math.floor(tick.time / 60) * 60 < lastM1) return { ...bundle, liveTick: null };
  return {
    ...bundle,
    m1: patchSeries(bundle.m1, tick, 60),
    m5: patchSeries(bundle.m5, tick, 300),
    m15: patchSeries(bundle.m15, tick, 900),
    marketPrice: tick.price,
    marketTime: tick.time,
    liveTick: tick,
  };
}
