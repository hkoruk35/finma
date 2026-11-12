import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import EngineGrid from "@/components/admin/hub/EngineGrid";
import PicksTable, { type PickRow } from "@/components/admin/hub/PicksTable";
import { getOptionsData, getSwingAllPicks } from "@/lib/data";
import { OPTION_PREFS, PRIORITY_STOCKS, SECONDARY_STOCKS } from "@/lib/adminHub";

export const metadata = { title: "Hisse Opsiyon Merkezi | BOGA AI" };
export const dynamic = "force-dynamic";

const px = (n: unknown) => (typeof n === "number" && isFinite(n) ? `$${n.toFixed(2)}` : "—");

export default async function OptionsHubPage() {
  const [opt, swing] = await Promise.all([getOptionsData().catch(() => null), getSwingAllPicks().catch(() => null)]);
  const optPicks: any[] = Array.isArray(opt?.picks) ? opt!.picks : [];
  const optRows: PickRow[] = optPicks.slice(0, 20).map((p) => ({
    ticker: p.ticker,
    a: p.score != null ? `${Number(p.score).toFixed(1)}${p.grade ? ` · ${p.grade}` : ""}` : undefined,
    b: px(p.current_price),
    c: p.institutional?.strike != null
      ? `${p.institutional.side ?? "CALL"} $${p.institutional.strike} · ${p.institutional.expiration ?? p.exp_date ?? ""}${p.institutional.dte != null ? ` (${p.institutional.dte}g)` : ""}`
      : p.exp_date ?? undefined,
  }));
  const trend: any[] = Array.isArray(swing?.picks) ? swing.picks : [];
  const trendRows: PickRow[] = trend.slice(0, 15).map((p) => ({
    ticker: String(p.ticker),
    a: p.score != null ? String(typeof p.score === "number" ? p.score.toFixed(1) : p.score) : undefined,
    b: px(p.current_price),
    c: p.sector ?? undefined,
  }));

  return (
    <HubShell title="🎯 Hisse Opsiyon Merkezi" subtitle="Engine hisseleri (haftalık vade) + opsiyon tarayıcısı + Trend Hisseleri.">
      <HubSection title="Opsiyon tercihi (başlangıç şablonu)">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
          {OPTION_PREFS.map(([k, v]) => (
            <div key={k} style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, color: "#8b949e" }}>{k}</div>
              <div style={{ fontSize: 13, fontWeight: 800, marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
      </HubSection>
      <HubSection title="Birinci öncelik" hint="Takip Sistemi motorları — karta tıkla">
        <EngineGrid symbols={PRIORITY_STOCKS} />
      </HubSection>
      <HubSection title="İkinci grup">
        <EngineGrid symbols={SECONDARY_STOCKS} compact />
      </HubSection>
      <HubSection title="Opsiyon tarayıcısı adayları" hint={opt?.date ? `Tarama: ${opt.date}` : undefined} right={<HubLink href="/admin/trading/options">Tam tarayıcı</HubLink>}>
        <PicksTable rows={optRows} heads={["Skor", "Fiyat", "Kontrat (21–45g)"]} empty="Şu an opsiyon adayı yok (tarama henüz çalışmadı)." />
      </HubSection>
      <HubSection title="Trend Hisseleri (opsiyon izleme için)" right={<HubLink href="/admin/trading/swing">Swing listesi</HubLink>}>
        <PicksTable rows={trendRows} heads={["Skor", "Fiyat", "Sektör"]} empty="Şu an trend hissesi yok." />
      </HubSection>
    </HubShell>
  );
}
