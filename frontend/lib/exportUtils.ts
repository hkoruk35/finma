export function exportScreenerResultsToXLS(results: any[], presetName: string) {
  if (!results.length) return;

  const timestamp = new Date().toLocaleString("tr-TR").replace(/[/:\s]/g, "-");
  const filename = `BOGA_Screener_${presetName}_${timestamp}.xls`;

  const headers = [
    "Ticker", "Company", "Setup", "Price", "Change %", "MACD", "RSI", "R/R",
    "BOGA Score", "RVOL", "ADX", "Sector", "MACD Hist", "Market Cap"
  ];

  let html = `
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr style="background-color: #0f141e; color: #e2e8f0;">
          ${headers.map(h => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  results.forEach((stock) => {
    const change1d = stock.change_1d >= 0 ? "+" : "";
    const macdLabel = stock.macd > 0 ? "Pozitif" : stock.macd_hist > 0 ? "Yükseliyor" : "Negatif";

    html += `
      <tr>
        <td>${stock.ticker}</td>
        <td>${stock.company}</td>
        <td>${stock.primary_setup || "swing"}</td>
        <td>$${stock.price.toFixed(2)}</td>
        <td>${change1d}${stock.change_1d.toFixed(2)}%</td>
        <td>${macdLabel}</td>
        <td>${stock.rsi?.toFixed(0) || "—"}</td>
        <td>${stock.rr_ratio}</td>
        <td>${stock.boga_score}</td>
        <td>${stock.rvol.toFixed(1)}x</td>
        <td>${stock.adx?.toFixed(0) || "—"}</td>
        <td>${stock.sector || "—"}</td>
        <td>${stock.macd_hist?.toFixed(3) || "—"}</td>
        <td>${stock.market_cap_label}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportSwingResultsToXLS(results: any[]) {
  if (!results.length) return;

  const timestamp = new Date().toLocaleString("tr-TR").replace(/[/:\s]/g, "-");
  const filename = `BOGA_Swing_${timestamp}.xls`;

  const headers = [
    "Ticker", "Company", "Sector", "Price", "Buy Zone", "Target", "Stop",
    "Change 1D %", "Change 1W %", "Change 1M %", "Entry", "R/R Ratio", "Status"
  ];

  let html = `
    <table border="1" cellpadding="5" cellspacing="0">
      <thead>
        <tr style="background-color: #0f141e; color: #e2e8f0;">
          ${headers.map(h => `<th>${h}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
  `;

  results.forEach((pick) => {
    html += `
      <tr>
        <td>${pick.ticker}</td>
        <td>${pick.company}</td>
        <td>${pick.sector || "—"}</td>
        <td>$${pick.price?.toFixed(2) || "—"}</td>
        <td>$${pick.buy_zone?.low?.toFixed(2) || "—"} - $${pick.buy_zone?.high?.toFixed(2) || "—"}</td>
        <td>$${pick.profit_zone?.low?.toFixed(2) || "—"}</td>
        <td>$${pick.stop_zone?.high?.toFixed(2) || "—"}</td>
        <td>${pick.change_1d >= 0 ? "+" : ""}${pick.change_1d?.toFixed(2) || "—"}%</td>
        <td>${pick.change_1w >= 0 ? "+" : ""}${pick.change_1w?.toFixed(2) || "—"}%</td>
        <td>${pick.change_1m >= 0 ? "+" : ""}${pick.change_1m?.toFixed(2) || "—"}%</td>
        <td>$${pick.entry?.toFixed(2) || "—"}</td>
        <td>${pick.rr_ratio || "—"}</td>
        <td>${pick.status || "—"}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
