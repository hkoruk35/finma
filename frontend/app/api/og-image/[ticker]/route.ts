import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const revalidate = 3600; // 1 saat cache

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;
    const tickerUpper = ticker.toUpperCase();

    return new ImageResponse(
      (
        <div
          style={{
            fontSize: 48,
            background: "linear-gradient(135deg, #0a0e17 0%, #1a1f2e 100%)",
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontFamily: '"Inter", sans-serif',
            gap: "20px",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: "bold",
              color: "#00d2ff",
              letterSpacing: "2px",
            }}
          >
            {tickerUpper}
          </div>
          <div
            style={{
              fontSize: 32,
              color: "#94a3b8",
              fontWeight: "400",
            }}
          >
            Technical Analysis Chart
          </div>
          <div
            style={{
              fontSize: 24,
              color: "#64748b",
              marginTop: "40px",
            }}
          >
            Boga AI Stock Analysis
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (error) {
    return new Response("Failed to generate OG image", { status: 500 });
  }
}
