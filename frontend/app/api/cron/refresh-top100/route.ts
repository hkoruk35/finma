import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/cron/refresh-top100
 * Scheduled cron job — runs every day at 00:00:00 NY time (America/New_York)
 * Vercel Cron: "0 0 * * * America/New_York"
 * Calls POST /api/refresh-top100 to update top100_snapshot
 */

const CRON_SECRET = process.env.CRON_SECRET;
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://bogastock.com";

export async function GET(req: NextRequest) {
  // Verify cron secret to prevent unauthorized trigger
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Call the refresh endpoint
    const res = await fetch(`${BASE_URL}/api/refresh-top100`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass a special marker so refresh-top100 knows this is from cron (if needed)
      },
      signal: AbortSignal.timeout(120000), // 2 minutes timeout
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Refresh failed:", data);
      return NextResponse.json(
        { error: "Refresh failed", details: data },
        { status: 500 }
      );
    }

    console.log("Cron refresh successful:", data);
    return NextResponse.json({
      success: true,
      refreshResult: data,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Cron job error:", error);
    return NextResponse.json(
      { error: "Cron job failed", message: String(error) },
      { status: 500 }
    );
  }
}

// Optional: add a manual trigger endpoint for testing (requires auth)
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return GET(req);
}
