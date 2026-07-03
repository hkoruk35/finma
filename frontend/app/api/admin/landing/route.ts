import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const CONFIG_PATH = join(process.cwd(), "landing-config.json");

function requireAdmin(req: NextRequest) {
  const role = req.cookies.get("boga_auth")?.value;
  return role === "admin";
}

function readConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return NextResponse.json(readConfig());
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = readConfig();
  const { lang, section, data } = body as { lang: string; section: string; data: unknown };

  if (!lang || !section) return NextResponse.json({ error: "lang ve section gerekli" }, { status: 400 });

  if (!config[lang]) config[lang] = {};
  config[lang][section] = data;

  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const config = readConfig();
  const { lang, data } = body as { lang: string; data: unknown };

  if (!lang) return NextResponse.json({ error: "lang gerekli" }, { status: 400 });

  config[lang] = data;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  if (!lang) return NextResponse.json({ error: "lang gerekli" }, { status: 400 });

  const config = readConfig();
  delete config[lang];
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  return NextResponse.json({ ok: true });
}
