/** Trend / swing / opsiyon aday tablosu (sunucu bileşeni) — Dark Grey #0f1117 zemin (tracker sayfalarıyla tutarlı). */

export interface PickRow {
  ticker: string;
  a?: string;
  b?: string;
  c?: string;
}

const TH: React.CSSProperties = { textAlign: "left", fontSize: 10, color: "#8b949e", padding: "7px 10px", fontWeight: 800, textTransform: "uppercase", borderBottom: "1px solid #30363d" };
const TD: React.CSSProperties = { fontSize: 12, padding: "7px 10px", borderBottom: "1px solid #1c2128", color: "#e6edf3" };

export default function PicksTable({ rows, heads, empty }: { rows: PickRow[]; heads: [string, string, string]; empty: string }) {
  if (!rows.length) {
    return <div style={{ background: "#0f1117", border: "1px solid #30363d", borderRadius: 8, padding: 16, fontSize: 12, color: "#8b949e" }}>{empty}</div>;
  }
  return (
    <div style={{ background: "#0f1117", border: "1px solid #30363d", borderRadius: 8, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr><th style={TH}>Hisse</th><th style={TH}>{heads[0]}</th><th style={TH}>{heads[1]}</th><th style={TH}>{heads[2]}</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.ticker}>
              <td style={{ ...TD, fontWeight: 900, color: "#58a6ff" }}>{r.ticker}</td>
              <td style={TD}>{r.a ?? "—"}</td>
              <td style={TD}>{r.b ?? "—"}</td>
              <td style={TD}>{r.c ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
