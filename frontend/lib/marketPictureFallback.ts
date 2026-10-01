/**
 * Rule-based "Current Market Analysis" — used ONLY when every AI provider fails
 * (e.g. DeepSeek balance exhausted + invalid Gemini key, which froze the homepage
 * analysis for days). Deterministic, built from the same verified Yahoo numbers
 * the AI prompt receives; no invented tickers, levels or macro events.
 *
 * Output shape matches the AI text: "## Heading" sections, one string per locale.
 * The last line states that this is an automatic data summary, so readers are
 * never told it is human/AI commentary.
 */

import type { MarketPictureMode } from "@/lib/x/generateContent";

type Locale = "en" | "es" | "fr" | "pt" | "tr" | "id";
const LOCALE_LIST: Locale[] = ["en", "es", "fr", "pt", "tr", "id"];

interface Quote {
  label: string;
  changePct: number;
}

export interface FallbackFacts {
  mode: MarketPictureMode;
  indices: Quote[];
  sectors: Quote[];
  commoditiesFx?: Quote[];
  advancers?: number | null;
  decliners?: number | null;
  topGainers?: { ticker: string; changePct: number }[];
  topLosers?: { ticker: string; changePct: number }[];
  weekChangePct?: number | null;
}

const FLAT = 0.05;
const dir = (p: number): "up" | "down" | "flat" => (p > FLAT ? "up" : p < -FLAT ? "down" : "flat");

interface Dict {
  h: [string, string, string, string, string];
  /** "<label> <closed/trading> <dir> <pct>%" */
  sess: (label: string, p: number, n: string, closed: boolean) => string;
  breadth: (adv: number, dec: number) => string;
  vix: (p: number, n: string) => string;
  leaders: (list: string) => string;
  laggards: (list: string) => string;
  vsIndex: (label: string, rel: "out" | "under" | "in", base: string) => string;
  smallCaps: (rel: "out" | "under" | "in") => string;
  sectorsLine: (best: string, worst: string, up: number, total: number) => string;
  cross: (items: string) => string;
  watch: (mode: MarketPictureMode, lead: string, vixP: number, weekPct: string | null) => string;
  footer: string;
  upDown: { up: string; down: string; flat: string };
}

const D: Record<Locale, Dict> = {
  en: {
    h: ["S&P 500 / The Big Picture", "Nasdaq 100 & Technology", "Dow Jones & Russell 2000 / Small Caps", "Sectors & Cross-Asset Signals", "What to Watch Next"],
    sess: (l, p, n, c) => `${l} ${c ? "closed" : "is trading"} ${dir(p) === "up" ? "up" : dir(p) === "down" ? "down" : "flat"} ${n}%`,
    breadth: (a, d) => `Breadth is ${a > d * 1.5 ? "strong" : d > a * 1.5 ? "weak" : "mixed"}: ${a} advancers against ${d} decliners in the S&P 500.`,
    vix: (p, n) => `The VIX is ${dir(p) === "up" ? "rising" : dir(p) === "down" ? "easing" : "unchanged"} (${n}%), ${dir(p) === "up" ? "a sign hedging demand is picking up" : dir(p) === "down" ? "pointing to calmer positioning" : "so volatility positioning is steady"}.`,
    leaders: (s) => `Biggest gainers: ${s}.`,
    laggards: (s) => `Biggest decliners: ${s}.`,
    vsIndex: (l, r, b) => `${l} is ${r === "out" ? "outperforming" : r === "under" ? "lagging" : "moving in line with"} the ${b}.`,
    smallCaps: (r) => r === "out" ? "Small caps are beating large caps, a sign of improving risk appetite." : r === "under" ? "Small caps are lagging large caps, a more cautious risk tone." : "Small caps and large caps are moving together.",
    sectorsLine: (b, w, u, t) => `${u} of ${t} sectors are higher. Strongest: ${b}. Weakest: ${w}.`,
    cross: (s) => `Cross-asset moves: ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `The S&P 500 changed ${wk}% over the week. ` : ""}Into next week, watch whether ${lead} leadership holds and whether the VIX stays ${v > 0 ? "elevated" : "contained"}.`
      : m === "day_close"
      ? `Into the next session, watch whether ${lead} leadership holds and whether the VIX keeps ${v > 0 ? "climbing" : "easing"}.`
      : `This view refreshes during the session. Key checks: ${lead} leadership and the VIX direction.`,
    footer: "Automatic data summary built from live market numbers.",
    upDown: { up: "up", down: "down", flat: "flat" },
  },
  es: {
    h: ["S&P 500 / Panorama General", "Nasdaq 100 y Tecnología", "Dow Jones y Russell 2000 / Small Caps", "Sectores y Señales Entre Activos", "Qué Vigilar"],
    sess: (l, p, n, c) => `${l} ${c ? "cerró" : "cotiza"} ${dir(p) === "up" ? "al alza" : dir(p) === "down" ? "a la baja" : "sin cambios"} ${n}%`,
    breadth: (a, d) => `La amplitud es ${a > d * 1.5 ? "fuerte" : d > a * 1.5 ? "débil" : "mixta"}: ${a} alzas frente a ${d} bajas en el S&P 500.`,
    vix: (p, n) => `El VIX ${dir(p) === "up" ? "sube" : dir(p) === "down" ? "baja" : "se mantiene"} (${n}%), ${dir(p) === "up" ? "señal de mayor demanda de cobertura" : dir(p) === "down" ? "con posicionamiento más calmado" : "con posicionamiento estable"}.`,
    leaders: (s) => `Mayores subidas: ${s}.`,
    laggards: (s) => `Mayores caídas: ${s}.`,
    vsIndex: (l, r, b) => `${l} ${r === "out" ? "supera al" : r === "under" ? "queda por detrás del" : "se mueve en línea con el"} ${b}.`,
    smallCaps: (r) => r === "out" ? "Las small caps superan a las grandes, señal de mayor apetito por el riesgo." : r === "under" ? "Las small caps rinden menos que las grandes, tono más cauteloso." : "Small caps y grandes se mueven juntas.",
    sectorsLine: (b, w, u, t) => `${u} de ${t} sectores suben. Más fuerte: ${b}. Más débil: ${w}.`,
    cross: (s) => `Movimientos entre activos: ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `El S&P 500 varió ${wk}% en la semana. ` : ""}De cara a la próxima semana, vigile si ${lead} mantiene el liderazgo y si el VIX se ${v > 0 ? "mantiene elevado" : "mantiene contenido"}.`
      : m === "day_close"
      ? `Para la próxima sesión, vigile si ${lead} mantiene el liderazgo y si el VIX ${v > 0 ? "sigue subiendo" : "sigue cediendo"}.`
      : `Esta vista se actualiza durante la sesión. Claves: liderazgo de ${lead} y dirección del VIX.`,
    footer: "Resumen automático de datos construido con cifras de mercado en vivo.",
    upDown: { up: "al alza", down: "a la baja", flat: "sin cambios" },
  },
  fr: {
    h: ["S&P 500 / Vue d'Ensemble", "Nasdaq 100 et Technologie", "Dow Jones et Russell 2000 / Petites Capitalisations", "Secteurs et Signaux Multi-Actifs", "À Surveiller"],
    sess: (l, p, n, c) => `${l} ${c ? "a clôturé" : "évolue"} ${dir(p) === "up" ? "en hausse" : dir(p) === "down" ? "en baisse" : "stable"} ${n}%`,
    breadth: (a, d) => `La largeur du marché est ${a > d * 1.5 ? "solide" : d > a * 1.5 ? "faible" : "mitigée"} : ${a} valeurs en hausse contre ${d} en baisse sur le S&P 500.`,
    vix: (p, n) => `Le VIX ${dir(p) === "up" ? "monte" : dir(p) === "down" ? "recule" : "est stable"} (${n}%), ${dir(p) === "up" ? "signe d'une demande de couverture accrue" : dir(p) === "down" ? "avec un positionnement plus calme" : "avec un positionnement stable"}.`,
    leaders: (s) => `Plus fortes hausses : ${s}.`,
    laggards: (s) => `Plus fortes baisses : ${s}.`,
    vsIndex: (l, r, b) => `${l} ${r === "out" ? "surperforme" : r === "under" ? "sous-performe" : "évolue comme"} le ${b}.`,
    smallCaps: (r) => r === "out" ? "Les petites capitalisations devancent les grandes, signe d'un appétit pour le risque en amélioration." : r === "under" ? "Les petites capitalisations sont à la traîne, ton plus prudent." : "Petites et grandes capitalisations évoluent de concert.",
    sectorsLine: (b, w, u, t) => `${u} secteurs sur ${t} sont en hausse. Plus fort : ${b}. Plus faible : ${w}.`,
    cross: (s) => `Mouvements multi-actifs : ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `Le S&P 500 a varié de ${wk}% sur la semaine. ` : ""}Pour la semaine prochaine, surveillez si ${lead} garde le leadership et si le VIX reste ${v > 0 ? "élevé" : "contenu"}.`
      : m === "day_close"
      ? `Pour la prochaine séance, surveillez si ${lead} garde le leadership et si le VIX ${v > 0 ? "continue de monter" : "continue de reculer"}.`
      : `Cette vue est actualisée pendant la séance. Points clés : leadership de ${lead} et direction du VIX.`,
    footer: "Résumé automatique construit à partir des chiffres de marché en direct.",
    upDown: { up: "en hausse", down: "en baisse", flat: "stable" },
  },
  pt: {
    h: ["S&P 500 / Visão Geral", "Nasdaq 100 e Tecnologia", "Dow Jones e Russell 2000 / Small Caps", "Setores e Sinais Entre Ativos", "O Que Acompanhar"],
    sess: (l, p, n, c) => `${l} ${c ? "fechou" : "negocia"} ${dir(p) === "up" ? "em alta" : dir(p) === "down" ? "em baixa" : "estável"} ${n}%`,
    breadth: (a, d) => `A amplitude é ${a > d * 1.5 ? "forte" : d > a * 1.5 ? "fraca" : "mista"}: ${a} em alta contra ${d} em baixa no S&P 500.`,
    vix: (p, n) => `O VIX ${dir(p) === "up" ? "sobe" : dir(p) === "down" ? "recua" : "está estável"} (${n}%), ${dir(p) === "up" ? "sinal de maior procura por proteção" : dir(p) === "down" ? "com posicionamento mais calmo" : "com posicionamento estável"}.`,
    leaders: (s) => `Maiores altas: ${s}.`,
    laggards: (s) => `Maiores quedas: ${s}.`,
    vsIndex: (l, r, b) => `${l} ${r === "out" ? "supera o" : r === "under" ? "fica atrás do" : "acompanha o"} ${b}.`,
    smallCaps: (r) => r === "out" ? "As small caps superam as grandes, sinal de maior apetite por risco." : r === "under" ? "As small caps ficam atrás das grandes, tom mais cauteloso." : "Small caps e grandes caminham juntas.",
    sectorsLine: (b, w, u, t) => `${u} de ${t} setores sobem. Mais forte: ${b}. Mais fraco: ${w}.`,
    cross: (s) => `Movimentos entre ativos: ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `O S&P 500 variou ${wk}% na semana. ` : ""}Para a próxima semana, acompanhe se ${lead} mantém a liderança e se o VIX segue ${v > 0 ? "elevado" : "contido"}.`
      : m === "day_close"
      ? `Para o próximo pregão, acompanhe se ${lead} mantém a liderança e se o VIX ${v > 0 ? "continua subindo" : "continua recuando"}.`
      : `Esta visão é atualizada durante o pregão. Pontos-chave: liderança de ${lead} e direção do VIX.`,
    footer: "Resumo automático de dados construído com números de mercado ao vivo.",
    upDown: { up: "em alta", down: "em baixa", flat: "estável" },
  },
  tr: {
    h: ["S&P 500 / Genel Tablo", "Nasdaq 100 ve Teknoloji", "Dow Jones ve Russell 2000 / Küçük Şirketler", "Sektörler ve Varlıklar Arası Sinyaller", "Bir Sonraki Adımda İzlenecekler"],
    sess: (l, p, n, c) => dir(p) === "flat"
      ? `${l} ${c ? "günü yatay (%" + n + ") tamamladı" : "şu an yatay (%" + n + ") seyrediyor"}`
      : `${l} ${c ? "günü" : "şu an"} %${n} ${dir(p) === "up" ? "yükselişle" : "düşüşle"} ${c ? "tamamladı" : "işlem görüyor"}`,
    breadth: (a, d) => `Piyasa genişliği ${a > d * 1.5 ? "güçlü" : d > a * 1.5 ? "zayıf" : "karışık"}: S&P 500'de ${a} yükselen, ${d} düşen hisse var.`,
    vix: (p, n) => `VIX ${dir(p) === "up" ? "yükseliyor" : dir(p) === "down" ? "geriliyor" : "yatay"} (%${n}); ${dir(p) === "up" ? "korunma talebinin arttığına işaret ediyor" : dir(p) === "down" ? "daha sakin bir pozisyonlanmaya işaret ediyor" : "oynaklık pozisyonlaması sabit"}.`,
    leaders: (s) => `En çok yükselenler: ${s}.`,
    laggards: (s) => `En çok düşenler: ${s}.`,
    vsIndex: (l, r, b) => `${l}, ${b} endeksine göre ${r === "out" ? "daha güçlü" : r === "under" ? "daha zayıf" : "benzer"} seyrediyor.`,
    smallCaps: (r) => r === "out" ? "Küçük şirketler büyüklerin önünde; risk iştahının iyileştiğine işaret." : r === "under" ? "Küçük şirketler büyüklerin gerisinde; daha temkinli bir risk tonu." : "Küçük ve büyük şirketler birlikte hareket ediyor.",
    sectorsLine: (b, w, u, t) => `${t} sektörün ${u} tanesi yükselişte. En güçlü: ${b}. En zayıf: ${w}.`,
    cross: (s) => `Varlıklar arası hareketler: ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `S&P 500 hafta boyunca %${wk} değişti. ` : ""}Gelecek hafta için ${lead} liderliğinin sürüp sürmediğine ve VIX'in ${v > 0 ? "yüksek kalıp kalmadığına" : "sakin kalıp kalmadığına"} bakın.`
      : m === "day_close"
      ? `Bir sonraki seans için ${lead} liderliğinin sürüp sürmediğine ve VIX'in ${v > 0 ? "yükselmeye devam edip etmediğine" : "gerilemeye devam edip etmediğine"} bakın.`
      : `Bu görünüm seans boyunca güncellenir. Ana kontroller: ${lead} liderliği ve VIX yönü.`,
    footer: "Canlı piyasa verilerinden otomatik oluşturulan veri özeti.",
    upDown: { up: "yükselişte", down: "düşüşte", flat: "yatay" },
  },
  id: {
    h: ["S&P 500 / Gambaran Besar", "Nasdaq 100 & Teknologi", "Dow Jones & Russell 2000 / Saham Kecil", "Sektor & Sinyal Lintas Aset", "Yang Perlu Dipantau"],
    sess: (l, p, n, c) => `${l} ${c ? "ditutup" : "diperdagangkan"} ${dir(p) === "up" ? "naik" : dir(p) === "down" ? "turun" : "datar"} ${n}%`,
    breadth: (a, d) => `Keluasan pasar ${a > d * 1.5 ? "kuat" : d > a * 1.5 ? "lemah" : "beragam"}: ${a} saham naik berbanding ${d} turun di S&P 500.`,
    vix: (p, n) => `VIX ${dir(p) === "up" ? "naik" : dir(p) === "down" ? "turun" : "stabil"} (${n}%), ${dir(p) === "up" ? "tanda permintaan lindung nilai meningkat" : dir(p) === "down" ? "menunjukkan posisi yang lebih tenang" : "posisi volatilitas stabil"}.`,
    leaders: (s) => `Kenaikan terbesar: ${s}.`,
    laggards: (s) => `Penurunan terbesar: ${s}.`,
    vsIndex: (l, r, b) => `${l} ${r === "out" ? "mengungguli" : r === "under" ? "tertinggal dari" : "bergerak searah dengan"} ${b}.`,
    smallCaps: (r) => r === "out" ? "Saham kecil mengungguli saham besar, tanda selera risiko membaik." : r === "under" ? "Saham kecil tertinggal dari saham besar, nada lebih berhati-hati." : "Saham kecil dan besar bergerak bersama.",
    sectorsLine: (b, w, u, t) => `${u} dari ${t} sektor menguat. Terkuat: ${b}. Terlemah: ${w}.`,
    cross: (s) => `Pergerakan lintas aset: ${s}.`,
    watch: (m, lead, v, wk) => m === "week_close"
      ? `${wk ? `S&P 500 berubah ${wk}% sepekan ini. ` : ""}Untuk pekan depan, pantau apakah kepemimpinan ${lead} bertahan dan apakah VIX tetap ${v > 0 ? "tinggi" : "terkendali"}.`
      : m === "day_close"
      ? `Untuk sesi berikutnya, pantau apakah kepemimpinan ${lead} bertahan dan apakah VIX ${v > 0 ? "terus naik" : "terus turun"}.`
      : `Tampilan ini diperbarui selama sesi. Pantau: kepemimpinan ${lead} dan arah VIX.`,
    footer: "Ringkasan data otomatis dari angka pasar langsung.",
    upDown: { up: "naik", down: "turun", flat: "datar" },
  },
};

const NUM_LOCALE: Record<Locale, string> = { en: "en-US", es: "es-ES", fr: "fr-FR", pt: "pt-PT", tr: "tr-TR", id: "id-ID" };

export function buildFallbackTexts(f: FallbackFacts): Record<Locale, string> {
  const find = (list: Quote[] | undefined, label: string) => list?.find((q) => q.label === label);
  const spx = find(f.indices, "S&P 500");
  const ndx = find(f.indices, "Nasdaq 100");
  const dji = find(f.indices, "Dow Jones");
  const rut = find(f.indices, "Russell 2000");
  const vix = find(f.indices, "VIX");
  const sectors = [...(f.sectors ?? [])].sort((a, b) => b.changePct - a.changePct);
  const tech = find(f.sectors, "Technology");
  const comm = find(f.sectors, "Communication Services");
  const closed = f.mode !== "intraday";

  const out = {} as Record<Locale, string>;
  for (const loc of LOCALE_LIST) {
    const d = D[loc];
    const nf = new Intl.NumberFormat(NUM_LOCALE[loc], { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const n = (p: number) => nf.format(Math.abs(p));
    const sg = (p: number) => `${p >= 0 ? "+" : "−"}${n(p)}%`;
    const relTo = (p: number, base: number, tol = 0.15): "out" | "under" | "in" => (p - base > tol ? "out" : base - p > tol ? "under" : "in");

    // 1) S&P 500 / big picture
    const p1: string[] = [];
    if (spx) p1.push(`${d.sess("S&P 500", spx.changePct, n(spx.changePct), closed)}.`);
    if (f.advancers != null && f.decliners != null) p1.push(d.breadth(f.advancers, f.decliners));
    if (vix) p1.push(d.vix(vix.changePct, nf.format(vix.changePct)));
    if (f.topGainers?.length) p1.push(d.leaders(f.topGainers.slice(0, 3).map((g) => `${g.ticker} ${sg(g.changePct)}`).join(", ")));
    if (f.topLosers?.length) p1.push(d.laggards(f.topLosers.slice(0, 3).map((g) => `${g.ticker} ${sg(g.changePct)}`).join(", ")));

    // 2) Nasdaq & tech
    const p2: string[] = [];
    if (ndx) {
      p2.push(`${d.sess("Nasdaq 100", ndx.changePct, n(ndx.changePct), closed)}.`);
      if (spx) p2.push(d.vsIndex("Nasdaq 100", relTo(ndx.changePct, spx.changePct), "S&P 500"));
    }
    const techBits = [tech && `Technology ${sg(tech.changePct)}`, comm && `Communication Services ${sg(comm.changePct)}`].filter(Boolean);
    if (techBits.length) p2.push(`${techBits.join(" · ")}.`);

    // 3) Dow & small caps
    const p3: string[] = [];
    if (dji) p3.push(`${d.sess("Dow Jones", dji.changePct, n(dji.changePct), closed)}.`);
    if (rut) {
      p3.push(`${d.sess("Russell 2000", rut.changePct, n(rut.changePct), closed)}.`);
      if (spx) p3.push(d.smallCaps(relTo(rut.changePct, spx.changePct)));
    }

    // 4) sectors & cross-asset
    const p4: string[] = [];
    if (sectors.length) {
      const up = sectors.filter((s) => s.changePct > 0).length;
      const best = sectors[0], worst = sectors[sectors.length - 1];
      p4.push(d.sectorsLine(`${best.label} ${sg(best.changePct)}`, `${worst.label} ${sg(worst.changePct)}`, up, sectors.length));
    }
    if (f.commoditiesFx?.length) p4.push(d.cross(f.commoditiesFx.map((c) => `${c.label} ${sg(c.changePct)}`).join(", ")));

    // 5) what to watch
    const lead = sectors[0]?.label ?? "the leading sector";
    const wk = f.mode === "week_close" && f.weekChangePct != null ? nf.format(f.weekChangePct) : null;
    const p5 = [d.watch(f.mode, lead, vix?.changePct ?? 0, wk)];

    const blocks = [p1, p2, p3, p4, p5]
      .map((paras, i) => (paras.length ? `## ${d.h[i]}\n${paras.join(" ")}` : ""))
      .filter(Boolean);
    out[loc] = `${blocks.join("\n\n")}\n\n${d.footer}`;
  }
  return out;
}
