/**
 * SPY gamma kaydı: Cboe gecikmeli opsiyon zincirinden model tabanlı GEX özeti (saf, DOM/ağ yok).
 *
 * YALNIZ GÖZLEM: tracker.ts kararlarına girmez. Sayılar dealer'ların call'da uzun, put'ta kısa olduğu varsayımına
 * dayanır; zincir gerçek işlem tarafını vermez. Açık pozisyon önceki güne aittir, gün içi 0DTE akışını göstermez.
 * Aynı veride vade kapsamı ve gamma kaynağı net GEX işaretini değiştirebildiği için her kapsam ayrı ve iki hesapla saklanır:
 *   cboeM = Cboe'nin yuvarlanmış gamma alanı · ownM = kontratın IV'si ile Black-Scholes gamma'sı.
 * Birim: fiyatta %1 hareket başına milyon dolar gamma; call +, put −.
 */

import { nyDateTimeToEpoch, r2 } from "./core";

export interface GexScope {
  /** hesaba giren kontrat */
  n: number;
  cboeM: number;
  ownM: number;
  /** kendi gamma'mızla spot ±%5 içinde net GEX'in işaret değiştirdiği, spota en yakın fiyat */
  flip: number | null;
  /** spot üstünde en büyük call gamma strike'ı / spot altında en büyük put gamma strike'ı */
  callWall: number | null;
  putWall: number | null;
  /** mutlak gamma'sı en büyük strike'lar: [strike, milyon $] */
  top: [number, number][];
}

export interface GexRead {
  /** okuma anı (unix sn) */
  at: number;
  /** Cboe veri zamanı (kaynak metni) */
  source: string;
  spot: number;
  atmIv: number | null;
  quality: { contracts: number; oiPos: number; ivOk: number };
  /** ilk vadenin açık pozisyonu ve kayıtlı hacmi */
  firstExpiry: string | null;
  firstOi: number;
  firstVolume: number;
  d0: GexScope | null;
  d7: GexScope | null;
  d45: GexScope | null;
}

interface Row { k: number; oi: number; vol: number; iv: number; g: number; cp: 1 | -1; t: number; exp: string }

const YEAR_SEC = 365 * 86400;
const RATE = 0.04;
const MIN_T = 900 / YEAR_SEC;
const IV_OK = (iv: number) => iv > 0.03 && iv < 3;
const pdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

function bsGamma(s: number, k: number, t: number, iv: number): number {
  const d1 = (Math.log(s / k) + (RATE + (iv * iv) / 2) * t) / (iv * Math.sqrt(t));
  return pdf(d1) / (s * iv * Math.sqrt(t));
}

/** %1 hareket başına dolar gamma (işaretli) */
const dollars = (r: Row, gamma: number, s: number) => r.cp * gamma * r.oi * 100 * s * s * 0.01;
const netAt = (rows: Row[], s: number) => rows.reduce((a, r) => a + dollars(r, bsGamma(s, r.k, r.t, r.iv), s), 0);
const millions = (v: number) => Math.round(v / 1e6);

function flipOf(rows: Row[], spot: number): number | null {
  const step = 0.25;
  let prevS = spot * 0.95;
  let prev = netAt(rows, prevS);
  const found: number[] = [];
  for (let s = prevS + step; s <= spot * 1.05; s += step) {
    const v = netAt(rows, s);
    if (prev !== 0 && Math.sign(v) !== Math.sign(prev)) found.push(r2((prevS + s) / 2));
    prev = v;
    prevS = s;
  }
  return found.sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot))[0] ?? null;
}

function scopeOf(rows: Row[], spot: number): GexScope | null {
  if (!rows.length) return null;
  const byStrike = new Map<number, number>();
  const callBy = new Map<number, number>();
  const putBy = new Map<number, number>();
  let cboe = 0, own = 0;
  for (const r of rows) {
    const v = dollars(r, bsGamma(spot, r.k, r.t, r.iv), spot);
    cboe += dollars(r, r.g, spot);
    own += v;
    byStrike.set(r.k, (byStrike.get(r.k) ?? 0) + v);
    const side = r.cp > 0 ? callBy : putBy;
    side.set(r.k, (side.get(r.k) ?? 0) + Math.abs(v));
  }
  const best = (m: Map<number, number>, ok: (k: number) => boolean) =>
    [...m.entries()].filter(([k]) => ok(k)).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return {
    n: rows.length,
    cboeM: millions(cboe),
    ownM: millions(own),
    flip: flipOf(rows, spot),
    callWall: best(callBy, (k) => k >= spot),
    putWall: best(putBy, (k) => k <= spot),
    top: [...byStrike.entries()].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1])).slice(0, 5).map(([k, v]) => [k, millions(v)]),
  };
}

/** Cboe `delayed_quotes/options/SPY.json` yanıtı → özet. Zincir geçersizse null. */
export function computeGex(raw: unknown, nowSec: number): GexRead | null {
  const j = raw as { timestamp?: unknown; data?: { current_price?: unknown; close?: unknown; options?: unknown } } | null;
  const spot = Number(j?.data?.current_price ?? j?.data?.close);
  const options = j?.data?.options;
  if (!Number.isFinite(spot) || spot <= 0 || !Array.isArray(options)) return null;

  const rows: Row[] = [];
  for (const item of options) {
    const o = item as Record<string, unknown>;
    const m = String(o.option).match(/^SPY(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/);
    if (!m) continue;
    const exp = `20${m[1]}-${m[2]}-${m[3]}`;
    const expiry = nyDateTimeToEpoch(exp, 16 * 60);
    if (expiry <= nowSec) continue;
    rows.push({
      k: Number(m[5]) / 1000,
      oi: Number(o.open_interest) || 0,
      vol: Number(o.volume) || 0,
      iv: Number(o.iv) || 0,
      g: Number(o.gamma) || 0,
      cp: m[4] === "C" ? 1 : -1,
      t: Math.max((expiry - nowSec) / YEAR_SEC, MIN_T),
      exp,
    });
  }
  const near = rows.filter((r) => Math.abs(r.k / spot - 1) < 0.1);
  if (!near.length) return null;

  const firstExpiry = near.map((r) => r.exp).sort()[0] ?? null;
  const first = near.filter((r) => r.exp === firstExpiry);
  const atm = near.filter((r) => Math.abs(r.k - spot) < 3 && IV_OK(r.iv) && r.t * 365 > 5);
  const valid = near.filter((r) => r.oi > 0 && IV_OK(r.iv));
  const within = (days: number) => valid.filter((r) => r.t * 365 <= days);

  return {
    at: nowSec,
    source: String(j?.timestamp ?? ""),
    spot: r2(spot),
    atmIv: atm.length ? Math.round((atm.reduce((a, r) => a + r.iv, 0) / atm.length) * 1000) / 1000 : null,
    quality: { contracts: near.length, oiPos: near.filter((r) => r.oi > 0).length, ivOk: near.filter((r) => IV_OK(r.iv)).length },
    firstExpiry,
    firstOi: first.reduce((a, r) => a + r.oi, 0),
    firstVolume: first.reduce((a, r) => a + r.vol, 0),
    d0: scopeOf(valid.filter((r) => r.exp === firstExpiry), spot),
    d7: scopeOf(within(7), spot),
    d45: scopeOf(within(45), spot),
  };
}
