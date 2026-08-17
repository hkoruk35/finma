"use client";

/**
 * SPX SuperTrade — Strateji Laboratuvarı
 * Yapılar, canlı spot fiyat ve VIX'ten türetilen Black-Scholes primleriyle
 * fiyatlanır; maliyet, maksimum risk, maksimum kâr ve başa baş noktaları
 * bacak primlerinden hesaplanır (sabit rakam yoktur).
 */

import React, { useMemo, useState } from "react";
import type { SignalState } from "@/lib/spx/types";
import { impliedVolFor, priceOption } from "@/lib/spx/options";
import { Badge, EmptyState, INSET, Panel, Row, Tabs, num } from "./supertrade/ui";

type Category = "ALL" | "SIMPLE" | "SPREAD" | "RANGE";

const CATEGORY_LABEL: Record<Exclude<Category, "ALL">, string> = {
  SIMPLE: "Tek bacak",
  SPREAD: "Tanımlı risk spread",
  RANGE: "Çoklu bacak / bant",
};

interface Structure {
  id: string;
  name: string;
  category: Exclude<Category, "ALL">;
  legs: string;
  netLabel: string;
  netAmount: number;
  maxLoss: number;
  maxProfit: number | null; // null = teorik sınırsız
  breakeven: string;
  delta: string;
  horizon: string;
  score: number;
  reason: string;
  invalidation: string;
}

const HORIZON_OPTIONS = [
  { value: "SCALP", label: "5–15 dk" },
  { value: "MOMENTUM", label: "15–45 dk" },
  { value: "CLOSE", label: "Gün sonu" },
] as const;
type Horizon = (typeof HORIZON_OPTIONS)[number]["value"];

export default function StrategyLab({
  spxPrice,
  state,
  vix,
  minutesLeft,
}: {
  spxPrice: number;
  state: SignalState;
  vix: number;
  minutesLeft: number;
}) {
  const [budgetInput, setBudgetInput] = useState("300");
  const [category, setCategory] = useState<Category>("ALL");
  const [horizon, setHorizon] = useState<Horizon>("MOMENTUM");
  
  // 15 dakikalık strateji döngüsü kilidi
  const [lockedPrice, setLockedPrice] = useState(spxPrice);
  const [lastCycle, setLastCycle] = useState(Math.floor(minutesLeft / 15));

  React.useEffect(() => {
    const currentCycle = Math.floor(minutesLeft / 15);
    if (currentCycle !== lastCycle) {
      setLockedPrice(spxPrice);
      setLastCycle(currentCycle);
    }
  }, [minutesLeft, spxPrice, lastCycle]);

  // Yeni fiyat kilidi üzerinden hesapla
  const activePrice = lockedPrice || spxPrice;

  const budget = Math.max(50, Number(budgetInput) || 300);
  const isShort = state.includes("SHORT") && !state.startsWith("FAILED");
  const isLong = state.includes("LONG") && !state.startsWith("FAILED");

  const structures = useMemo<Structure[]>(() => {
    if (!activePrice) return [];
    const atm = Math.round(activePrice / 5) * 5;
    const t = Math.max(10, minutesLeft);

    const call = (k: number) => priceOption(activePrice, k, t, impliedVolFor(vix, activePrice, k), true).price;
    const put = (k: number) => priceOption(activePrice, k, t, impliedVolFor(vix, activePrice, k), false).price;
    const callDelta = (k: number) =>
      priceOption(activePrice, k, t, impliedVolFor(vix, activePrice, k), true).delta;
    const putDelta = (k: number) =>
      priceOption(activePrice, k, t, impliedVolFor(vix, activePrice, k), false).delta;

    const money = (v: number) => Math.round(v * 100);
    const list: Structure[] = [];

    const horizonLabel = HORIZON_OPTIONS.find((h) => h.value === horizon)!.label;
    const stateTr = state.replace(/_/g, " ").toLowerCase();

    if (isLong || isShort) {
      const dir = isLong ? 1 : -1;
      const type = isLong ? "C" : "P";
      const priceAt = isLong ? call : put;
      const deltaAt = isLong ? callDelta : putDelta;

      // 1. Tek bacak ATM
      const k1 = atm;
      const c1 = money(priceAt(k1));
      list.push({
        id: "single",
        name: `Tek bacak ${isLong ? "CALL" : "PUT"} (ATM)`,
        category: "SIMPLE",
        legs: `Al ${k1} ${type}`,
        netLabel: "Net maliyet",
        netAmount: c1,
        maxLoss: c1,
        maxProfit: null,
        breakeven: (k1 + (dir * c1) / 100).toFixed(2),
        delta: `Delta ${deltaAt(k1).toFixed(2)} · yüksek gamma`,
        horizon: horizonLabel,
        score: 0,
        reason: `Kırılım sonrası hızlı delta genişlemesinden yararlanır. Tüm risk ödenen ${c1} dolarla sınırlıdır.`,
        invalidation: "Hareket 10–15 dakika içinde gelmezse zaman erimesi primi hızla eritir.",
      });

      // 2. Dar debit spread
      const long2 = atm;
      const short2 = atm + dir * 5;
      const cost2 = money(priceAt(long2) - priceAt(short2));
      list.push({
        id: "tight",
        name: `Dar debit ${isLong ? "CALL" : "PUT"} spread (5 puan)`,
        category: "SIMPLE",
        legs: `Al ${long2} ${type} / Sat ${short2} ${type}`,
        netLabel: "Net maliyet",
        netAmount: cost2,
        maxLoss: cost2,
        maxProfit: 500 - cost2,
        breakeven: (long2 + (dir * cost2) / 100).toFixed(2),
        delta: `Delta ${(deltaAt(long2) - deltaAt(short2)).toFixed(2)} · theta dengeli`,
        horizon: horizonLabel,
        score: 0,
        reason: `Satılan bacak zaman erimesini dengeler; ${cost2} dolar riskle 5 puanlık hedef bandı yakalar.`,
        invalidation: "ES'in VWAP'ın ters tarafına geçmesi.",
      });

      // 3. Standart debit spread
      const long3 = atm;
      const short3 = atm + dir * 10;
      const cost3 = money(priceAt(long3) - priceAt(short3));
      list.push({
        id: "standard",
        name: `Standart debit ${isLong ? "CALL" : "PUT"} spread (10 puan)`,
        category: "SPREAD",
        legs: `Al ${long3} ${type} / Sat ${short3} ${type}`,
        netLabel: "Net maliyet",
        netAmount: cost3,
        maxLoss: cost3,
        maxProfit: 1000 - cost3,
        breakeven: (long3 + (dir * cost3) / 100).toFixed(2),
        delta: `Delta ${(deltaAt(long3) - deltaAt(short3)).toFixed(2)} · dengeli gamma`,
        horizon: horizonLabel,
        score: 0,
        reason: `Mevcut ${stateTr} durumunda 10 puanlık hedef bandı için tanımlı riskli standart yapı.`,
        invalidation: "ES'in VWAP'ın ters tarafına geçmesi.",
      });

      // 4. Savunmaci kredi spread
      const shortK = atm - dir * 5;
      const longK = atm - dir * 10;
      const credit4 = isLong
        ? money(put(shortK) - put(longK))
        : money(call(shortK) - call(longK));
      list.push({
        id: "credit",
        name: `Savunmacı kredi spread (${isLong ? "BULL PUT" : "BEAR CALL"})`,
        category: "SPREAD",
        legs: isLong ? `Sat ${shortK} P / Al ${longK} P` : `Sat ${shortK} C / Al ${longK} C`,
        netLabel: "Net kredi",
        netAmount: credit4,
        maxLoss: Math.max(1, 500 - credit4),
        maxProfit: credit4,
        breakeven: (shortK - (dir * credit4) / 100).toFixed(2),
        delta: "Pozitif theta · olasılık öncelikli",
        horizon: "Gün sonu",
        score: 0,
        reason: `Fiyat ${shortK} seviyesinin ${isLong ? "üstünde" : "altında"} kaldığı sürece yön hareketi olmasa bile prim toplar.`,
        invalidation: `SPX ${shortK} seviyesini ${isLong ? "aşağı" : "yukarı"} kırarsa risk hızla artar.`,
      });
    } else {
      // Yönsüz / bant yapıları
      const cK = atm + 10;
      const pK = atm - 10;
      const strangleCost = money(call(cK) + put(pK));
      list.push({
        id: "strangle",
        name: "OTM strangle (çift yönlü kırılım)",
        category: "SIMPLE",
        legs: `Al ${cK} C + Al ${pK} P`,
        netLabel: "Net maliyet",
        netAmount: strangleCost,
        maxLoss: strangleCost,
        maxProfit: null,
        breakeven: `${(pK - strangleCost / 100).toFixed(2)} / ${(cK + strangleCost / 100).toFixed(2)}`,
        delta: "Delta nötr · yüksek vega",
        horizon: HORIZON_OPTIONS.find((h) => h.value === horizon)!.label,
        score: 0,
        reason: "Yön tahmini yapmadan bandın hangi tarafa kırılırsa kırılsın hareketi yakalar.",
        invalidation: "Fiyatın bant içinde kalması — iki bacak birden erir.",
      });

      const icSP = atm - 10;
      const icLP = atm - 15;
      const icSC = atm + 10;
      const icLC = atm + 15;
      const icCredit = money(put(icSP) - put(icLP) + call(icSC) - call(icLC));
      list.push({
        id: "condor",
        name: "Iron condor (tanımlı risk yatay bant)",
        category: "RANGE",
        legs: `Sat ${icSP}P / Al ${icLP}P + Sat ${icSC}C / Al ${icLC}C`,
        netLabel: "Net kredi",
        netAmount: icCredit,
        maxLoss: Math.max(1, 500 - icCredit),
        maxProfit: icCredit,
        breakeven: `${(icSP - icCredit / 100).toFixed(2)} – ${(icSC + icCredit / 100).toFixed(2)}`,
        delta: "Delta nötr · pozitif theta",
        horizon: "Gün sonu",
        score: 0,
        reason: `Fiyat ${icSP} – ${icSC} bandında kaldığı sürece iki taraftan da prim toplar.`,
        invalidation: "Banda hacimli ve kalıcı kırılım.",
      });

      const ibCredit = money(put(atm) + call(atm) - put(atm - 5) - call(atm + 5));
      list.push({
        id: "butterfly",
        name: "Iron butterfly (ATM sabitlenme)",
        category: "RANGE",
        legs: `Sat ${atm}P + Sat ${atm}C / Al ${atm - 5}P + Al ${atm + 5}C`,
        netLabel: "Net kredi",
        netAmount: ibCredit,
        maxLoss: Math.max(1, 500 - ibCredit),
        maxProfit: ibCredit,
        breakeven: `${(atm - ibCredit / 100).toFixed(2)} – ${(atm + ibCredit / 100).toFixed(2)}`,
        delta: "Delta nötr · maksimum theta",
        horizon: "Gün sonu",
        score: 0,
        reason: "Fiyat açılış seviyesine yakın kapanırsa en yüksek prim getirisini sunar.",
        invalidation: "Hızlı ve tek yönlü trend başlangıcı.",
      });
    }

    // Sıralama skoru: risk/getiri + bütçe uyumu + yön uyumu
    return list.map((s) => {
      let score = 55;
      if (s.maxProfit !== null && s.maxLoss > 0) {
        score += Math.min(22, (s.maxProfit / s.maxLoss) * 8);
      } else {
        score += 12; // sınırsız getiri potansiyeli
      }
      if (s.maxLoss <= budget) score += Math.min(12, ((budget - s.maxLoss) / budget) * 12);
      else score -= 25;
      if (horizon === "CLOSE" && s.horizon === "Gün sonu") score += 8;
      if (horizon !== "CLOSE" && s.horizon !== "Gün sonu") score += 8;
      return { ...s, score: Math.max(0, Math.min(99, Math.round(score))) };
    });
  }, [activePrice, vix, minutesLeft, isLong, isShort, state, budget, horizon]);

  const filtered = category === "ALL" ? structures : structures.filter((s) => s.category === category);
  const withinBudget = filtered.filter((s) => s.maxLoss <= budget).sort((a, b) => b.score - a.score);
  const overBudget = filtered.filter((s) => s.maxLoss > budget);

  return (
    <Panel
      title="Strateji Laboratuvarı"
      hint={`teorik fiyatlama · IV tabanı VIX ${num(vix, 1)} · vadeye ${minutesLeft} dk`}
      right={
        <div className="flex items-center gap-3">
          <Badge tone="warn">15 dk Strateji Döngüsü</Badge>
          <Tabs
            size="sm"
            value={category}
            onChange={setCategory}
            options={[
              { value: "ALL", label: `Tümü (${structures.length})` },
              { value: "SIMPLE", label: CATEGORY_LABEL.SIMPLE },
              { value: "SPREAD", label: CATEGORY_LABEL.SPREAD },
              { value: "RANGE", label: CATEGORY_LABEL.RANGE },
            ]}
          />
        </div>
      }
    >
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className={`${INSET} p-3`}>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">
            Deterministik durum
          </div>
          <div className="mt-1 text-[13px] text-slate-200">{state.replace(/_/g, " ")}</div>
        </div>
        <div className={`${INSET} p-3`}>
          <label className="block text-[10px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">
            Maksimum risk bütçesi ($)
          </label>
          <input
            type="number"
            min={50}
            step={50}
            value={budgetInput}
            onChange={(e) => setBudgetInput(e.target.value)}
            className="mt-1 w-full border-b border-[#1c2635] bg-transparent pb-1 text-[13px] tabular-nums text-slate-100 outline-none transition-colors focus:border-[#3b82f6]"
          />
        </div>
        <div className={`${INSET} p-3`}>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">
            Hedef süre
          </div>
          <div className="mt-1.5">
            <Tabs
              size="sm"
              value={horizon}
              onChange={setHorizon}
              options={HORIZON_OPTIONS.map((h) => ({ value: h.value, label: h.label }))}
            />
          </div>
        </div>
        <div className={`${INSET} p-3`}>
          <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">
            Bütçeye uyan yapı
          </div>
          <div className="mt-1 text-[13px] tabular-nums text-slate-200">
            {withinBudget.length} / {filtered.length}
            <span className="ml-2 text-[11px] text-slate-500">sınır ${budget}</span>
          </div>
        </div>
      </div>

      {withinBudget.length === 0 ? (
        <EmptyState>
          ${budget} bütçesiyle bu kategoride tanımlı riskli bir yapı bulunamadı. Bütçeyi artırın veya
          başka bir kategori seçin.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {withinBudget.map((s, i) => (
            <article key={s.id} className={`${INSET} flex flex-col p-3.5`}>
              <header className="mb-2.5 flex items-start justify-between gap-2 border-b border-[#1c2635] pb-2.5">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.06em] text-slate-500">
                    {CATEGORY_LABEL[s.category]}
                  </div>
                  <h4 className="mt-0.5 text-[13px] font-medium leading-snug text-slate-100">{s.name}</h4>
                </div>
                {i === 0 && <Badge tone="brand">Öne çıkan</Badge>}
              </header>

              <div className="space-y-0.5">
                <Row label="Bacaklar" value={<span className="font-mono text-[11px]">{s.legs}</span>} />
                <Row label={s.netLabel} value={`$${s.netAmount}`} />
                <Row
                  label="Maksimum risk"
                  value={`$${s.maxLoss}`}
                  valueClass="text-[#ef4444]"
                />
                <Row
                  label="Maksimum kâr"
                  value={s.maxProfit === null ? "Teorik sınırsız" : `$${s.maxProfit}`}
                  valueClass="text-[#22c55e]"
                />
                <Row
                  label="Risk / getiri"
                  value={
                    s.maxProfit === null
                      ? "Yön ve hız odaklı"
                      : `1 : ${(s.maxProfit / Math.max(1, s.maxLoss)).toFixed(1)}`
                  }
                />
                <Row label="Başa baş" value={s.breakeven} />
                <Row label="Greeks" value={<span className="text-[11px]">{s.delta}</span>} />
                <Row label="Hedef süre" value={s.horizon} />
                <Row label="Sıralama skoru" value={`${s.score} / 100`} valueClass="text-[#3b82f6]" />
              </div>

              <div className="mt-2.5 border-t border-[#1c2635] pt-2.5">
                <div className="text-[10px] font-medium uppercase tracking-[0.06em] text-[#3b82f6]">
                  Neden bu yapı
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{s.reason}</p>
                <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">
                  İptal koşulu
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{s.invalidation}</p>
              </div>
            </article>
          ))}
        </div>
      )}

      {overBudget.length > 0 && (
        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.06em] text-slate-500">
            Bütçe dışı kalanlar
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {overBudget.map((s) => (
              <div
                key={s.id}
                className={`${INSET} flex items-center justify-between gap-3 px-3 py-2 text-[12px]`}
              >
                <span className="min-w-0 truncate text-slate-300">{s.name}</span>
                <span className="shrink-0 tabular-nums text-[#ef4444]">
                  ${s.maxLoss}
                  <span className="ml-1.5 text-[11px] text-slate-500">
                    (+${s.maxLoss - budget} gerekli)
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Primler Black-Scholes ile modellenmiş teorik değerlerdir (faiz ve temettü sıfır kabul edilir,
        örtük oynaklık VIX'ten türetilir). Canlı OPRA kotasyonu değildir ve otomatik emre dönüşmez.
      </p>
    </Panel>
  );
}
