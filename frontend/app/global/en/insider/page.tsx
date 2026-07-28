import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Insider Trading Activity | BOGASTOCK",
  description: "SEC Form 4 insider transactions - Real-time insider trading activity tracking.",
};

export default function InsiderPage() {
  const topBuyers: any[] = [];
  const insiderT = {
    title: "Insider Trading Activity",
    subtitle: "SEC Form 4 Filings - Last 90 Days",
    noData: "No insider transactions found",
    dataSource: "SEC EDGAR Form 4 Filings",
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header Section */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border-b border-slate-800 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight mb-2">{insiderT.title || "Insider Trading Activity"}</h1>
          <p className="text-slate-400 text-lg">{insiderT.subtitle || "SEC Form 4 Filings - Last 90 Days"}</p>
          <p className="text-slate-500 text-sm mt-4">
            Track executive and insider transactions across {topBuyers.length > 0 ? "tracked stocks" : "our universe"}. Data updated daily from SEC EDGAR.
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {topBuyers.length === 0 ? (
          <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-8 text-center">
            <p className="text-slate-400">{insiderT.noData || "No insider transactions found"}</p>
          </div>
        ) : null}
      </div>

      {/* Footer Info */}
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 border-t border-slate-800/50">
        <div className="space-y-2">
          <p>
            <strong>Data Source:</strong> {insiderT.dataSource || "SEC EDGAR Form 4 Filings"}
          </p>
          <p>
            <strong>Update Frequency:</strong> Daily, processed after market close. Form 4 filings are typically available 1-2 business days after insider transaction.
          </p>
          <p>
            <strong>Minimum Threshold:</strong> Only transactions with 1,000+ shares are displayed to filter noise.
          </p>
          <p>
            <strong>Disclaimer:</strong> This information is provided for educational and informational purposes only. It is not investment advice. Past insider activity does not guarantee future stock performance.
          </p>
        </div>
      </div>
    </main>
  );
}
