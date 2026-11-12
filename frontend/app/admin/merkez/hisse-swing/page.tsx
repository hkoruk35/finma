import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import { EngineTable, SwingCandidates, SwingPerformance, type SwingPerfRow, type SwingPickRow } from "@/components/admin/hub/HubTables";
import { getSwingAllPicks, getSwingPerformance } from "@/lib/data";
import { ENGINES } from "@/lib/spyengine/engines";
import { PRIORITY_STOCKS, SECONDARY_STOCKS } from "@/lib/adminHub";

export const metadata = { title: "Hisse Swing Merkezi | BOGA AI" };
export const dynamic = "force-dynamic";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null);

export default async function SwingHubPage() {
  const [picksData, perf] = await Promise.all([getSwingAllPicks().catch(() => null), getSwingPerformance().catch(() => null)]);

  const engines = [
    ...PRIORITY_STOCKS.map((s) => ({ symbol: s, name: ENGINES[s].name, page: ENGINES[s].page, group: "Birinci öncelik" })),
    ...SECONDARY_STOCKS.map((s) => ({ symbol: s, name: ENGINES[s].name, page: ENGINES[s].page, group: "İkinci grup" })),
  ];

  const picks: any[] = Array.isArray(picksData?.picks) ? picksData.picks : [];
  const cand: SwingPickRow[] = picks.slice(0, 40).map((p) => ({
    ticker: String(p.ticker), company: p.company, score: num(p.score), price: num(p.current_price),
    buyLow: num(p.buy_zone?.low), buyHigh: num(p.buy_zone?.high), sector: p.sector ?? null,
  }));

  // son 90 günün öneri performansı (swing_performance.json · history), en yeni üstte
  const hist: any[] = Array.isArray(perf?.history) ? perf.history : [];
  const cutoff = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10);
  const rows: SwingPerfRow[] = hist
    .filter((h) => (h.entry_date ?? h.date) >= cutoff)
    .map((h) => ({
      date: String(h.entry_date ?? h.date), ticker: String(h.ticker), entry: num(h.entry_price) ?? num(h.entry) ?? 0,
      last: num(h.exit_price), ret: num(h.return_pct), peak: num(h.peak_gain_pct) ?? num(h.mfe_pct), mae: num(h.mae_pct),
      days: num(h.holding_days) ?? num(h.days), stop: num(h.active_sl_level) ?? num(h.stop_price), result: String(h.result ?? "—"), dup: !!h.is_duplicate,
    }))
    .filter((r) => r.entry > 0)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const st = perf?.stats ?? {};

  return (
    <HubShell title="📈 Hisse Swing Merkezi" subtitle="Engine hisseleri + BOGA Trend hisseleri — öneri anından bugüne performans. Ticker üzerine gel: grafik · tıkla: detay.">
      <HubSection title="Trend hisseleri — bugünkü adaylar" hint={picksData?.date ? `Liste tarihi: ${picksData.date} · öneriden beri değişim canlı fiyatla` : undefined} right={<HubLink href="/admin/trading/swing">Tam swing listesi</HubLink>}>
        <SwingCandidates rows={cand} date={picksData?.date ?? null} />
      </HubSection>
      <HubSection title="Öneri performansı (son 90 gün)" hint={st.last_updated ? `Performans güncelleme: ${String(st.last_updated).replace("T", " ").slice(0, 16)}` : undefined}>
        <SwingPerformance rows={rows} stats={{ winRate: num(st.win_rate), avg: num(st.avg_return_pct), pending: num(st.pending_count), completed: num(st.completed_count) }} />
      </HubSection>
      <HubSection title="Engine hisseleri" hint="Takip Sistemi motorları — tıkla: motor sayfası">
        <EngineTable rows={engines} />
      </HubSection>
    </HubShell>
  );
}
