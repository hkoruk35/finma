import { NextResponse } from "next/server";
import { listOptionsDates } from "@/lib/data-server";

export async function GET() {
  const dates = listOptionsDates();
  return NextResponse.json({ dates }, {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
