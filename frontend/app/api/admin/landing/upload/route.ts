import { NextRequest, NextResponse } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import { join, extname } from "path";

function requireAdmin(req: NextRequest) {
  return req.cookies.get("boga_auth")?.value === "admin";
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = String(formData.get("folder") ?? "landing");

  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const allowed = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const ext = extname(file.name).toLowerCase();
  if (!allowed.includes(ext)) return NextResponse.json({ error: "Sadece resim yüklenebilir" }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const slug = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  const filename = `${Date.now()}_${slug}`;
  const dir = join(process.cwd(), "public", "uploads", folder);

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), buffer);

  return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
}
