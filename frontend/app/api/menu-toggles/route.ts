import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Public — header (MemberHeader.tsx) hangi üst seviye menü öğelerinin
// görünür olduğunu buradan öğrenir. Admin "Menü Yönetimi" sayfası yazar.
export async function GET() {
  const { data, error } = await supabaseAdmin.from("site_menu_toggles").select("key, enabled, label_override");
  if (error) return NextResponse.json({ toggles: {} }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });

  const toggles: Record<string, { enabled: boolean; labelOverride: string | null }> = {};
  for (const row of data ?? []) {
    toggles[row.key] = { enabled: row.enabled, labelOverride: row.label_override };
  }
  return NextResponse.json({ toggles }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
