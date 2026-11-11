import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import EngineGrid from "@/components/admin/hub/EngineGrid";
import PicksTable, { type PickRow } from "@/components/admin/hub/PicksTable";
import { getSwingAllPicks } from "@/lib/data";
import { PRIORITY_STOCKS, SECONDARY_STOCKS } from "@/lib/adminHub";

export const metadata = { title: "Hisse Swing Merkezi | BOGA AI" };
export const dynamic = "force-dynamic";

const px = (n: unknown) => (typeof n === "number" && isFinite(n) ? `$${n.toFixed(2)}` : "—");

export default async function SwingHubPage() {
  const data = await getSwingAllPicks().catch(() => null);
  const picks: any[] = Array.isArray(data?.picks) ? data.picks : [];
  const rows: PickRow[] = picks.slice(0, 25).map((p) => ({
    ticker: String(p.ticker),
    a: p.score != null ? String(typeof p.score === "number" ? p.score.toFixed(1) : p.score) : undefined,
    b: px(p.current_price),
    c: p.buy_zone?.low != null ? `${px(p.buy_zone.low)} – ${px(p.buy_zone.high)}` : undefined,
  }));

  return (
    <HubShell title="📈 Hisse Swing Merkezi" subtitle="Engine hisseleri + BOGA'nın güncellenen Trend (swing) hisseleri.">
      <HubSection title="Birinci öncelik" hint="Takip Sistemi motorları — karta tıkla">
        <EngineGrid symbols={PRIORITY_STOCKS} />
      </HubSection>
      <HubSection title="İkinci grup">
        <EngineGrid symbols={SECONDARY_STOCKS} compact />
      </HubSection>
      <HubSection title="Trend Hisseleri (swing adayları)" hint={data?.date ? `Güncelleme: ${data.date}` : undefined} right={<HubLink href="/admin/trading/swing">Tam swing listesi</HubLink>}>
        <PicksTable rows={rows} heads={["Skor", "Fiyat", "Giriş bölgesi"]} empty="Şu an swing adayı yok (veri henüz güncellenmedi)." />
      </HubSection>
    </HubShell>
  );
}
