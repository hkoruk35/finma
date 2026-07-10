import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const tickerUpper = ticker.toUpperCase();

    // Simple chart bars visualization
    const bars = Array.from({ length: 30 }).map((_, i) => ({
      height: Math.floor(Math.random() * 80 + 20),
      isGreen: Math.random() > 0.4,
    }));

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)",
            padding: "40px",
            fontFamily: '"Inter", -apple-system, sans-serif',
            color: "white",
            position: "relative",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "30px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ fontSize: "32px", fontWeight: "700", color: "#00d2ff", letterSpacing: "1px" }}>
                🚀 BOGA AI
              </div>
              <div style={{ fontSize: "18px", color: "#94a3b8" }}>Stock Analysis</div>
            </div>
            <div style={{ textAlign: "right", fontSize: "36px", fontWeight: "800", color: "#00d2ff", letterSpacing: "1px" }}>
              {tickerUpper}
            </div>
          </div>

          {/* Chart Area */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "flex-end",
              gap: "1px",
              marginBottom: "30px",
              padding: "20px",
              background: "rgba(15, 23, 42, 0.5)",
              borderRadius: "12px",
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}
          >
            {bars.map((bar, i) => (
              <div
                key={`bar-${i}`}
                style={{
                  width: "6px",
                  height: `${bar.height}px`,
                  background: bar.isGreen ? "#10b981" : "#ef4444",
                }}
              />
            ))}
          </div>

          {/* Info Grid */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1, padding: "16px", background: "rgba(59, 130, 246, 0.1)", borderRadius: "8px", border: "1px solid rgba(59, 130, 246, 0.3)" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>SECTOR</div>
              <div style={{ fontSize: "18px", fontWeight: "600", color: "#3b82f6" }}>Technology</div>
            </div>
            <div style={{ flex: 1, padding: "16px", background: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>TREND</div>
              <div style={{ fontSize: "18px", fontWeight: "600", color: "#10b981" }}>Uptrend</div>
            </div>
            <div style={{ flex: 1, padding: "16px", background: "rgba(245, 158, 11, 0.1)", borderRadius: "8px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>VOLUME</div>
              <div style={{ fontSize: "18px", fontWeight: "600", color: "#f59e0b" }}>High</div>
            </div>
          </div>

          {/* Changes */}
          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#94a3b8" }}>1 Day</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#10b981", marginTop: "4px" }}>+2.45%</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#94a3b8" }}>1 Week</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#10b981", marginTop: "4px" }}>+5.12%</div>
            </div>
            <div style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: "14px", color: "#94a3b8" }}>1 Month</div>
              <div style={{ fontSize: "20px", fontWeight: "700", color: "#ef4444", marginTop: "4px" }}>-3.22%</div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "14px", color: "#94a3b8", borderTop: "1px solid rgba(59, 130, 246, 0.2)", paddingTop: "16px" }}>
            <div>bogastock.com</div>
            <div style={{ fontWeight: "600" }}>@bogastock</div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    console.error("OG image generation error:", error);
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
