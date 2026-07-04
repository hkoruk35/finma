import { NextRequest, NextResponse } from "next/server";
import {
  getLandingConfigsFromDB,
  upsertLandingConfigToDB,
  deleteLandingConfigFromDB,
  type LandingConfig,
} from "@/lib/landingConfig";

function requireAdmin(req: NextRequest) {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin";
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const configs = await getLandingConfigsFromDB();
  return NextResponse.json(configs);
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lang, section, data } = body as { lang: string; section: string; data: unknown };
  if (!lang || !section) return NextResponse.json({ error: "lang ve section gerekli" }, { status: 400 });

  const configs = await getLandingConfigsFromDB();
  if (!configs[lang]) configs[lang] = {} as LandingConfig;
  ((configs[lang] as unknown) as Record<string, unknown>)[section] = data;

  try {
    await upsertLandingConfigToDB(lang, configs[lang]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB write error" }, { status: 502 });
  }
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { lang, data } = body as { lang: string; data: LandingConfig };
  if (!lang) return NextResponse.json({ error: "lang gerekli" }, { status: 400 });

  try {
    await upsertLandingConfigToDB(lang, data);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB write error" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const lang = req.nextUrl.searchParams.get("lang");
  if (!lang) return NextResponse.json({ error: "lang gerekli" }, { status: 400 });

  try {
    await deleteLandingConfigFromDB(lang);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "DB delete error" }, { status: 502 });
  }
}

