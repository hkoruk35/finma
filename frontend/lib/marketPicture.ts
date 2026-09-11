import type { Locale } from "@/lib/i18n/copy";
import { formatNumber } from "@/lib/formatNumber";

export interface SectorPerf {
  label: string;
  change_pct: number;
}

const T: Record<
  Locale,
  {
    weakest: (sector: string, pct: string) => string;
    onlyPositive: (sector: string) => string;
    strongest: (sector: string, pct: string) => string;
    mixed: (up: number, down: number) => string;
    vixUp: (pct: string) => string;
    vixDown: (pct: string) => string;
  }
> = {
  en: {
    weakest: (s, p) => `${s} is today's weakest sector, down ${p}%.`,
    onlyPositive: (s) => `${s} is the only major sector holding gains.`,
    strongest: (s, p) => `${s} leads the market, up ${p}%.`,
    mixed: (u, d) => `${u} sectors are advancing while ${d} are pulling back.`,
    vixUp: (p) => `A ${p}% jump in the VIX points to reduced risk appetite.`,
    vixDown: (p) => `The VIX is down ${p}%, suggesting calmer conditions.`,
  },
  tr: {
    weakest: (s, p) => `${s}, günün en zayıf sektörü olarak %${p} geriliyor.`,
    onlyPositive: (s) => `${s}, kazancını koruyan tek büyük sektör.`,
    strongest: (s, p) => `${s} sektörü %${p} ile piyasaya liderlik ediyor.`,
    mixed: (u, d) => `${u} sektör yükselirken ${d} sektör geri çekiliyor.`,
    vixUp: (p) => `VIX'teki %${p}'lik sıçrama risk iştahının azaldığını gösteriyor.`,
    vixDown: (p) => `VIX %${p} geriledi, bu da daha sakin bir seyre işaret ediyor.`,
  },
  es: {
    weakest: (s, p) => `${s} es el sector más débil hoy, con una caída del ${p}%.`,
    onlyPositive: (s) => `${s} es el único sector importante que mantiene ganancias.`,
    strongest: (s, p) => `${s} lidera el mercado, subiendo un ${p}%.`,
    mixed: (u, d) => `${u} sectores avanzan mientras ${d} retroceden.`,
    vixUp: (p) => `Un salto del ${p}% en el VIX indica menor apetito por el riesgo.`,
    vixDown: (p) => `El VIX cae un ${p}%, lo que sugiere condiciones más tranquilas.`,
  },
  fr: {
    weakest: (s, p) => `${s} est le secteur le plus faible aujourd'hui, en baisse de ${p}%.`,
    onlyPositive: (s) => `${s} est le seul grand secteur à rester dans le vert.`,
    strongest: (s, p) => `${s} mène le marché, en hausse de ${p}%.`,
    mixed: (u, d) => `${u} secteurs progressent tandis que ${d} reculent.`,
    vixUp: (p) => `Un bond de ${p}% du VIX signale une baisse de l'appétit pour le risque.`,
    vixDown: (p) => `Le VIX recule de ${p}%, signe de conditions plus calmes.`,
  },
  pt: {
    weakest: (s, p) => `${s} é o setor mais fraco hoje, em queda de ${p}%.`,
    onlyPositive: (s) => `${s} é o único grande setor que mantém ganhos.`,
    strongest: (s, p) => `${s} lidera o mercado, subindo ${p}%.`,
    mixed: (u, d) => `${u} setores avançam enquanto ${d} recuam.`,
    vixUp: (p) => `Um salto de ${p}% no VIX aponta para uma redução no apetite por risco.`,
    vixDown: (p) => `O VIX cai ${p}%, sugerindo condições mais calmas.`,
  },
  id: {
    weakest: (s, p) => `${s} menjadi sektor terlemah hari ini, turun ${p}%.`,
    onlyPositive: (s) => `${s} menjadi satu-satunya sektor utama yang masih menguat.`,
    strongest: (s, p) => `${s} memimpin pasar, naik ${p}%.`,
    mixed: (u, d) => `${u} sektor menguat sementara ${d} sektor melemah.`,
    vixUp: (p) => `Lonjakan ${p}% pada VIX menunjukkan selera risiko yang menurun.`,
    vixDown: (p) => `VIX turun ${p}%, menandakan kondisi yang lebih tenang.`,
  },
};

export function buildTodaysMarketPicture(
  locale: Locale,
  sectors: SectorPerf[],
  vixChangePct?: number | null
): string | null {
  const valid = sectors.filter((s) => Number.isFinite(s.change_pct));
  if (valid.length === 0) return null;

  const t = T[locale] ?? T.en;
  const sorted = [...valid].sort((a, b) => a.change_pct - b.change_pct);
  const weakest = sorted[0];
  const strongest = sorted[sorted.length - 1];
  const positiveCount = valid.filter((s) => s.change_pct > 0).length;
  const negativeCount = valid.filter((s) => s.change_pct < 0).length;

  const parts: string[] = [];

  if (weakest.change_pct < 0) {
    parts.push(t.weakest(weakest.label, formatNumber(Math.abs(weakest.change_pct), 2)));
  } else {
    parts.push(t.strongest(strongest.label, formatNumber(strongest.change_pct, 2)));
  }

  if (positiveCount === 1 && negativeCount === valid.length - 1) {
    parts.push(t.onlyPositive(valid.find((s) => s.change_pct > 0)!.label));
  } else if (weakest.change_pct < 0 && strongest.change_pct > 0) {
    parts.push(t.mixed(positiveCount, negativeCount));
  }

  if (vixChangePct != null && Number.isFinite(vixChangePct) && Math.abs(vixChangePct) >= 1) {
    parts.push(vixChangePct > 0 ? t.vixUp(formatNumber(vixChangePct, 2)) : t.vixDown(formatNumber(Math.abs(vixChangePct), 2)));
  }

  return parts.join(" ");
}
