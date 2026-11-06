/**
 * SPY Engine piyasa özeti (saf). Takip Sistemi okumasını başlıklara çevirir; yeni yön ya da işlem kararı üretmez.
 *
 * 44 seans ölçümü: trend, testere ve sıkışık etiketleri son saatin davranışını anlatır, sonraki saatin yönünü öngörmez.
 * Trend devam oranı dönemler arasında %62 ve %38 olabildi. İşlem talimatı yalnız TrackStep.headline/action alanından gelir.
 * Sonraki 6 mumun %80 hareket bandı ≈ ±1,7 ATR5; karşı dönem kapsamı %72–88.
 */

import { fmtR, type TrackStep } from "./tracker";

export type MarketTone = "bull" | "bear" | "warn" | "danger" | "neutral";
export type MarketRegime = "TREND_UP" | "TREND_DOWN" | "TESTERE" | "SIKISIK" | "YATAY" | "KARISIK" | "VERI_YOK";

export interface MarketTile { label: string; value: string; note: string; tone: MarketTone }
export interface MarketBrief { title: string; action: string; tone: MarketTone; regime: MarketRegime; tiles: MarketTile[] }

interface LevelOdds { up: { price: number; keys: string[] }; down: { price: number; keys: string[] }; upPct: number; downPct: number }

const WINDOW = 12;
const RANGE_K = 1.7;

export function marketRegime(steps: TrackStep[], compressed = false): { regime: MarketRegime; note: string } {
  const s = steps[steps.length - 1];
  if (!s || steps.length < WINDOW || !s.atr5 || s.vwap == null) return { regime: "VERI_YOK", note: "ilk saat verisi bekleniyor" };
  const w = steps.slice(-WINDOW);
  let path = 0, crosses = 0, prev = 0;
  w.forEach((x, i) => {
    if (i) path += Math.abs(x.price - w[i - 1].price);
    const side = x.vwap == null ? 0 : Math.sign(x.price - x.vwap);
    if (side && prev && side !== prev) crosses++;
    if (side) prev = side;
  });
  const net = s.price - w[0].price;
  const eff = path ? Math.abs(net) / path : 0;
  const side = Math.sign(s.price - s.vwap);
  const sideShare = w.filter((x) => x.vwap != null && Math.sign(x.price - x.vwap) === side).length / w.length;
  const last6 = w.slice(-6);
  const range6 = (Math.max(...last6.map((x) => x.high)) - Math.min(...last6.map((x) => x.low))) / s.atr5;
  const facts = `son 1 saat · VWAP kesişimi ${crosses} · verim %${Math.round(eff * 100)}`;
  if (crosses >= 3) return { regime: "TESTERE", note: facts };
  if (compressed || range6 <= 1.8) return { regime: "SIKISIK", note: `${facts} · son 6 mum ${range6.toFixed(1)} ATR5` };
  if (eff >= 0.3 && crosses <= 1 && sideShare >= 0.75) {
    const dir = Math.sign(net);
    if (s.side15 && s.side15 !== dir) return { regime: "KARISIK", note: `${facts} · 15m ters tarafta` };
    return { regime: dir > 0 ? "TREND_UP" : "TREND_DOWN", note: facts };
  }
  return { regime: "YATAY", note: facts };
}

const REGIME_TEXT: Record<MarketRegime, { value: string; title: string; action: string; tone: MarketTone }> = {
  TREND_UP: { value: "TREND YUKARI", title: "TREND YUKARI", action: "CALL tarafı izleniyor. Giriş için Takip tetiği bekle.", tone: "bull" },
  TREND_DOWN: { value: "TREND AŞAĞI", title: "TREND AŞAĞI", action: "PUT tarafı izleniyor. Giriş için Takip tetiği bekle.", tone: "bear" },
  TESTERE: { value: "TESTERE", title: "TESTERE", action: "Fiyat VWAP etrafında dönüyor. Acele etme, Takip tetiği yoksa işlem yok.", tone: "warn" },
  SIKISIK: { value: "SIKIŞIK", title: "SIKIŞIK", action: "Dar aralık. Kırılımı tahmin etme, Takip tetiğini bekle.", tone: "warn" },
  YATAY: { value: "YATAY", title: "YATAY", action: "Net yön yok. Seviyeleri izle, Takip tetiğini bekle.", tone: "neutral" },
  KARISIK: { value: "KARIŞIK", title: "YÖN KARIŞIK", action: "Son saat ve 15m aynı yönde değil. İşlem için teyit bekle.", tone: "warn" },
  VERI_YOK: { value: "BEKLENİYOR", title: "DURUM OLUŞUYOR", action: "İlk saatlik veri tamamlanınca piyasa durumu oluşur.", tone: "neutral" },
};

const toneOfDir = (d: number): MarketTone => (d > 0 ? "bull" : d < 0 ? "bear" : "neutral");

export function marketBrief(input: {
  steps: TrackStep[];
  prewarn: { side: string | null; text: string } | null;
  compressed: boolean;
  odds: LevelOdds | null;
  stale: { ageSec: number; lastClock: string } | null;
  h1R: number;
}): MarketBrief | null {
  const steps = input.steps.filter((s) => !s.pre);
  const cur = steps[steps.length - 1] ?? null;
  if (!cur) return null;
  const regime = marketRegime(steps, input.compressed);
  const base = REGIME_TEXT[regime.regime];
  const block = cur.checklist.find((c) => c.key === "block");
  const tradeLive = !!cur.pos || /GİR|KAPAT/.test(cur.headline);
  const armed = cur.setup?.status === "ARMED";

  let title = base.title, action = base.action, tone = base.tone;
  if (input.stale) {
    title = "VERİ BAYAT · İŞLEM AÇMA";
    action = `Son mum ${input.stale.lastClock} ET. Veri kaynağı yeni mum vermiyor; ekrandaki karar güncel değil.`;
    tone = "danger";
  } else if (tradeLive) {
    title = cur.headline;
    action = cur.action;
    tone = cur.tone === "bull" ? "bull" : cur.tone === "bear" ? "bear" : "warn";
  } else if (input.prewarn) {
    title = `ERKEN UYARI · POZİSYONA HAZIRLAN${input.prewarn.side ? ` · ${input.prewarn.side}` : ""}`;
    action = input.prewarn.text;
    tone = "warn";
  } else if (cur.earlyWarn) {
    title = "ERKEN UYARI · SIÇRAMA KIRILIMI";
    action = cur.earlyWarn;
    tone = "warn";
  } else if (armed && !block) {
    title = cur.headline;
    action = cur.action;
    tone = "warn";
  } else if (cur.runners.length) {
    title = cur.headline;
    action = cur.action;
    tone = cur.tone === "bull" ? "bull" : cur.tone === "bear" ? "bear" : "warn";
  } else if (block) {
    title = "GİRİŞ KAPALI";
    action = block.text.replace(/^giriş kapalı: /, "");
    tone = "warn";
  } else if (cur.phase === "KAPANIŞ") {
    title = "YENİ GİRİŞ YOK";
    action = "15:00 sonrası yalnız açık pozisyon yönetilir.";
    tone = "neutral";
  } else if (cur.phase === "AÇILIŞ") {
    title = "AÇILIŞ · 15m TEYİDİ BEKLENİYOR";
    action = cur.action;
    tone = "neutral";
  }

  const early = input.stale ? "VERİ BEKLENİYOR" : input.prewarn ? "HAZIRLAN" : cur.earlyWarn ? "SIÇRAMA" : armed && !block ? "HAZIR" : "YOK";
  const earlyNote = input.stale ? "veri gelmeden uyarı üretilmez" : input.prewarn?.text ?? cur.earlyWarn ?? (armed && !block ? cur.setup?.triggerText ?? "" : "tetik yakın değil");
  const pos = cur.pos;
  const band = cur.atr5 ? RANGE_K * cur.atr5 : null;

  return {
    title, action, tone, regime: regime.regime,
    tiles: [
      { label: "Durum", value: base.value, note: regime.note, tone: base.tone },
      { label: "15m Yön", value: cur.side15 > 0 ? "YUKARI" : cur.side15 < 0 ? "AŞAĞI" : "BELİRSİZ", note: cur.trend, tone: toneOfDir(cur.side15) },
      { label: "Erken Uyarı", value: early, note: earlyNote, tone: early === "YOK" ? "neutral" : "warn" },
      { label: "Pozisyon", value: pos ? `${pos.side} AÇIK` : cur.runners.length ? "TAŞINIYOR" : block ? "GİRİŞ KAPALI" : "YOK", note: pos ? `stop ${pos.stop.toFixed(2)} · ${fmtR(pos.h1RMult ?? input.h1R)} hedef ${pos.h1.toFixed(2)}` : block?.text.replace(/^giriş kapalı: /, "") ?? "Takip tetiği bekleniyor", tone: pos ? (pos.side === "CALL" ? "bull" : "bear") : block ? "warn" : "neutral" },
      { label: "Önce Hangi Seviye", value: input.odds ? `▲ %${input.odds.upPct} · ▼ %${input.odds.downPct}` : "—", note: input.odds ? `${input.odds.up.price.toFixed(2)} ${input.odds.up.keys[0]} · ${input.odds.down.price.toFixed(2)} ${input.odds.down.keys[0]} · yön tahmini değil` : "seviye bekleniyor", tone: "neutral" },
      { label: "Olası Hareket", value: band != null ? `±${band.toFixed(2)} puan` : "—", note: "sonraki 6 mum, hedef %80 · ölçüm %72–88", tone: "neutral" },
    ],
  };
}
