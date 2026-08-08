import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getMemberAccess, resolveMemberTierFromAccess } from "@/lib/apiAuth";

// Herkese açık — guest dahil. Spam önleme: cookie tabanlı basit günlük sayaç
// (Copilot'un anon kota mekanizmasıyla aynı desen — hesap gerektirmez).
const DAILY_LIMIT = 10;
const CATEGORIES = new Set([
  "bug",
  "data_error",
  "chart_terminal",
  "stock_analysis",
  "copilot",
  "lists",
  "account_login",
  "premium_billing",
  "mobile",
  "design_ux",
  "feature_request",
  "translation",
  "other",
]);
const MAX_MESSAGE_LEN = 5000;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const today = new Date().toISOString().slice(0, 10);
    const raw = cookieStore.get("boga_feedback_count")?.value;
    let count = 0;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.date === today) count = Number(parsed.count) || 0;
      } catch {}
    }
    if (count >= DAILY_LIMIT) {
      return NextResponse.json({ error: "Günlük geri bildirim limitine ulaşıldı, yarın tekrar deneyin." }, { status: 429 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    const form = await req.formData();

    const email = String(form.get("email") || "").trim();
    const category = String(form.get("category") || "").trim();
    const message = String(form.get("message") || "").trim();
    const pageUrl = String(form.get("page_url") || "").slice(0, 500) || null;
    const locale = String(form.get("locale") || "").slice(0, 10) || null;
    const deviceType = String(form.get("device_type") || "").slice(0, 20) || null;
    const viewport = String(form.get("viewport") || "").slice(0, 30) || null;
    const screenshot = form.get("screenshot");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Geçerli bir e-posta adresi gerekli." }, { status: 400 });
    }
    if (!CATEGORIES.has(category)) {
      return NextResponse.json({ error: "Geçersiz kategori." }, { status: 400 });
    }
    if (message.length < 10) {
      return NextResponse.json({ error: "Mesaj en az 10 karakter olmalı." }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: "Mesaj çok uzun." }, { status: 400 });
    }

    // Giriş yapmışsa hesap bağlamı — ama email formdan gelen (login'de zaten
    // otomatik dolduruluyor, client-side değiştirilemez alan) değerle DEĞİL,
    // gerçek oturumdan doğrulanmış email'le kaydedilir.
    let memberId: string | null = null;
    let plan: string = "anonymous";
    try {
      const supabase = await createSupabaseServerClient();
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        memberId = userData.user.id;
        const access = await getMemberAccess();
        plan = resolveMemberTierFromAccess(access);
      }
    } catch {}

    let screenshotUrl: string | null = null;
    if (screenshot instanceof File && screenshot.size > 0) {
      if (screenshot.size > MAX_SCREENSHOT_BYTES) {
        return NextResponse.json({ error: "Ekran görüntüsü 5MB'dan büyük olamaz." }, { status: 400 });
      }
      if (!screenshot.type.startsWith("image/")) {
        return NextResponse.json({ error: "Sadece görsel dosyası yüklenebilir." }, { status: 400 });
      }
      const ext = (screenshot.type.split("/")[1] || "png").slice(0, 10);
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const bytes = new Uint8Array(await screenshot.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from("feedback-screenshots")
        .upload(path, bytes, { contentType: screenshot.type, upsert: false });
      if (!uploadError) {
        const { data: pub } = supabaseAdmin.storage.from("feedback-screenshots").getPublicUrl(path);
        screenshotUrl = pub.publicUrl;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("feedback")
      .insert({
        member_id: memberId,
        email,
        category,
        message,
        page_url: pageUrl,
        page_path: pageUrl ? (() => { try { return new URL(pageUrl).pathname; } catch { return null; } })() : null,
        locale,
        device_type: deviceType,
        user_agent: req.headers.get("user-agent")?.slice(0, 300) || null,
        viewport,
        plan,
        screenshot_url: screenshotUrl,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[api/feedback] insert error:", error);
      return NextResponse.json({ error: "Gönderilemedi, lütfen tekrar deneyin." }, { status: 500 });
    }

    const res = NextResponse.json({ success: true, id: data.id });
    res.cookies.set("boga_feedback_count", JSON.stringify({ date: today, count: count + 1 }), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 2,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("[api/feedback] Exception:", err);
    return NextResponse.json({ error: "Gönderilemedi, lütfen tekrar deneyin." }, { status: 500 });
  }
}
