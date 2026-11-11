import HubShell, { HubSection, HubLink } from "@/components/admin/hub/HubShell";
import HubQuotes from "@/components/admin/hub/HubQuotes";
import { ENGINES } from "@/lib/spyengine/engines";
import { LEVERAGED_ETFS } from "@/lib/adminHub";

export const metadata = { title: "Kaldıraçlı ETF Merkezi | BOGA AI" };

export default function LeveragedHubPage() {
  return (
    <HubShell title="🚀 Kaldıraçlı ETF Merkezi" subtitle="UPRO / SPXU — sinyal SPY Engine'den gelir (SPY yükselirse UPRO, düşerse SPXU). Yeni ETF'ler buraya eklenecek.">
      <HubSection title="Canlı fiyatlar" hint="Fiyatlar Yahoo'dan; ETF'in kendi motoru henüz yok">
        <HubQuotes items={LEVERAGED_ETFS.map((e) => ({ symbol: e.symbol, name: e.name, note: e.note }))} />
      </HubSection>
      <HubSection title="Sinyal kaynağı: SPY">
        <HubQuotes items={[{ symbol: "SPY", name: ENGINES.SPY.name, href: ENGINES.SPY.page, note: "Sinyal için SPY Engine'i aç" }]} compact />
        <div style={{ marginTop: 10, background: "#0d1117", border: "1px solid #30363d", borderRadius: 8, padding: 14, fontSize: 12, color: "#8b949e", lineHeight: 1.6 }}>
          Kural özeti: SPY 15m trend + 5m erken uyarı yönü belirler; yükselişte UPRO, düşüşte SPXU hisse olarak alınır. Opsiyon yok, gece taşıma yok.
          Bu sayfa şimdilik fiyat ve SPY motoru bağlantısıdır; ETF'e özel takip motoru istenirse ayrıca kurulur.
        </div>
        <div style={{ marginTop: 10 }}><HubLink href={ENGINES.SPY.page}>SPY Engine'i aç</HubLink></div>
      </HubSection>
    </HubShell>
  );
}
