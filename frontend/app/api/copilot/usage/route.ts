import { NextResponse } from "next/server";
import { getMemberAccess } from "@/lib/apiAuth";

export async function GET() {
  const access = await getMemberAccess();
  if (!access.authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!access.hasAccess) {
    return NextResponse.json({ monthlyCredits: 0, topupCredits: 0, unlimited: false, hasAccess: false });
  }

  return NextResponse.json({
    monthlyCredits: access.monthlyCredits,
    topupCredits: access.topupCredits,
    // admin (staff comp) kredi sistemine tabi değil — bkz. copilot/chat/route.ts
    unlimited: access.plan === "admin",
    hasAccess: true,
  });
}
