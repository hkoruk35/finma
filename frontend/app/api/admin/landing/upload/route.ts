import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extname } from "path";

function requireAdmin(req: NextRequest) {
  return req.cookies.get("boga_auth")?.value === "admin";
}

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const folder = String(formData.get("folder") ?? "landing");

  if (!file) return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 400 });

  const allowedImages = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
  const allowedPdf = [".pdf"];
  const ext = extname(file.name).toLowerCase();

  if (![...allowedImages, ...allowedPdf].includes(ext)) {
    return NextResponse.json({ error: "Sadece resim veya PDF yüklenebilir" }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const slug = file.name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .toLowerCase();
  const filename = `${folder}/${Date.now()}_${slug}`;

  const sb = getSupabaseAdmin();
  const { error } = await sb.storage
    .from("landing")
    .upload(filename, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const { data: urlData } = sb.storage.from("landing").getPublicUrl(filename);
  return NextResponse.json({ url: urlData.publicUrl });
}

