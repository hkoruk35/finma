import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import EngineGrid from "@/components/admin/hub/EngineGrid";
import { ENGINES } from "@/lib/spyengine/engines";
import { INDEX_ENGINES, PRIORITY_STOCKS, SECONDARY_STOCKS } from "@/lib/adminHub";
import EngineMonitor from "@/components/admin/hub/EngineMonitor";

export const metadata = { title: "Endeks Merkezi | BOGA AI" };

export default function IndexHubPage() {
  const monitor = [
    ...INDEX_ENGINES.map((s) => ({ symbol: s, page: ENGINES[s].page, group: "endeks" })),
    ...PRIORITY_STOCKS.map((s) => ({ symbol: s, page: ENGINES[s].page, group: "1. öncelik" })),
    ...SECONDARY_STOCKS.map((s) => ({ symbol: s, page: ENGINES[s].page, group: "2. grup" })),
  ];
  return (
    <HubShell title="⚡ Endeks Merkezi" subtitle="SPY · QQQ · IWM — gün içi Takip Sistemi motorları (0DTE).">
      <HubSection title="Motor izleme listesi — tüm motorlar" hint="Pozisyon / tetik hazır / erken uyarı olanlar en üstte · ticker üzerine gel: grafik · tıkla: motor sayfası">
        <EngineMonitor symbols={monitor} />
      </HubSection>
      <HubSection title="Canlı fiyatlar" hint="Karta tıkla → motor sayfası">
        <EngineGrid symbols={INDEX_ENGINES} />
      </HubSection>
      <HubSection title="Motorlar">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
          {INDEX_ENGINES.map((s) => (
            <div key={s} style={{ background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 900, fontSize: 15 }}>{s} Engine</div>
                <div style={{ fontSize: 10, color: "#8b949e" }}>{ENGINES[s].versionLabel} · {ENGINES[s].expiry}</div>
              </div>
              <p style={{ fontSize: 11, color: "#8b949e", margin: "8px 0 12px", lineHeight: 1.5 }}>{ENGINES[s].note}</p>
              <HubLink href={ENGINES[s].page}>{s} Engine'i aç</HubLink>
            </div>
          ))}
        </div>
      </HubSection>
      <HubSection title="Diğer endeks araçları">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <HubLink href="/admin/supertrade">SPX Yön Motoru</HubLink>
          <HubLink href="/admin/supertrade/v4">Fırsat Tarayıcı</HubLink>
          <HubLink href="/admin/supertrade/performance">Performans</HubLink>
        </div>
      </HubSection>
    </HubShell>
  );
}
