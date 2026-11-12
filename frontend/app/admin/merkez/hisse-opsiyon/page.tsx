import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import { EngineTable, OptionPerformance, OptionPicks, type OptionPickRow, type OptionPosRow } from "@/components/admin/hub/HubTables";
import { getOptionsData, getOptionsOutcomes } from "@/lib/data";
import { ENGINES } from "@/lib/spyengine/engines";
import { INDEX_ENGINES, OPTION_PREFS, PRIORITY_STOCKS, SECONDARY_STOCKS } from "@/lib/adminHub";

export const metadata = { title: "Hisse Opsiyon Merkezi | BOGA AI" };
export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export default async function OptionsHubPage() {
  const [opt, outc] = await Promise.all([getOptionsData().catch(() => null), getOptionsOutcomes().catch(() => null)]);

  const picks: any[] = Array.isArray(opt?.picks) ? opt!.picks : [];
  const pickRows: OptionPickRow[] = picks.slice(0, 80).map((p) => {
    const c = p.institutional ?? {};
    return {
      ticker: String(p.ticker), date: opt?.date ?? "", side: c.side === "PUT" ? "PUT" : "CALL", strike: num(c.strike), exp: c.expiration ?? p.exp_date ?? null,
      dte: num(c.dte) ?? num(p.dte), mid: num(c.premium), delta: num(c.delta), score: num(p.score), under: num(p.current_price),
      label: p.s5?.setup_type ?? p.entry_mode_label ?? null,
    };
  });

  const pos: any[] = Array.isArray(outc?.positions) ? outc!.positions : [];
  const posRows: OptionPosRow[] = pos
    .map((p) => {
      const open = p.status === "open";
      return {
        date: String(p.scan_date), ticker: String(p.ticker), side: p.side === "PUT" || p.strategy === "v242_put" ? "PUT" : "CALL",
        strike: num(p.strike), exp: p.expiration ?? null, entry: num(p.entry_premium),
        current: open ? num(p.current_premium) : num(p.exit_premium) ?? num(p.current_premium),
        pnl: open ? num(p.unrealized_pnl_pct) : num(p.pnl_pct), status: String(p.status), days: num(p.days_held),
        tp: num(p.tp_target), sl: num(p.sl_target), under0: num(p.underlying_entry), reason: p.exit_reason ?? null,
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const s = outc?.summary;

  const engines = [
    ...INDEX_ENGINES.map((x) => ({ symbol: x, name: ENGINES[x].name, page: ENGINES[x].page, group: "Endeks" })),
    ...PRIORITY_STOCKS.map((x) => ({ symbol: x, name: ENGINES[x].name, page: ENGINES[x].page, group: "Birinci öncelik" })),
    ...SECONDARY_STOCKS.map((x) => ({ symbol: x, name: ENGINES[x].name, page: ENGINES[x].page, group: "İkinci grup" })),
  ];

  return (
    <HubShell title="🎯 Hisse Opsiyon Merkezi" subtitle="Tarayıcı önerileri (21–45 gün, ATM/ITM1, Δ 0,55–0,70) ve öneri anından bugüne P&L. Ticker üzerine gel: grafik · tıkla: detay.">
      <div className="mt-3 flex flex-wrap gap-2">
        {OPTION_PREFS.map(([k, v]) => (
          <span key={k} className="rounded border border-[#30363d] bg-[#0d1117] px-2.5 py-1 font-mono text-[11px] text-slate-400">{k}: <b className="text-slate-100">{v}</b></span>
        ))}
      </div>
      <HubSection title="Güncel tarama önerileri" hint={opt?.date ? `Tarama: ${opt.date}${opt.generated_at ? ` · ${String(opt.generated_at).slice(11, 16)} ET` : ""} · hisse değişimi canlı fiyatla (yön lehine yeşil)` : undefined} right={<HubLink href="/admin/trading/options">Tam tarayıcı</HubLink>}>
        <OptionPicks rows={pickRows} />
      </HubSection>
      <HubSection title="Öneri performansı (P&L takibi)" right={<HubLink href="/admin/trading/options/performance">Performans terminali</HubLink>}>
        <OptionPerformance rows={posRows} summary={{ winRate: num(s?.win_rate), avg: num(s?.avg_pnl_pct), open: s?.open ?? 0, closed: s?.closed ?? 0, updated: outc?.updated_at ? String(outc.updated_at).replace("T", " ").slice(0, 16) : null }} />
      </HubSection>
      <HubSection title="Engine hisseleri" hint="Takip Sistemi motorları — tıkla: motor sayfası">
        <EngineTable rows={engines} />
      </HubSection>
    </HubShell>
  );
}
