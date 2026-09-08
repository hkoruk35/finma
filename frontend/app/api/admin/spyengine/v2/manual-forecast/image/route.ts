/**
 * SPY Engine — Manuel Günlük Tahmin: görselden veri çıkarımı.
 *
 * Kullanıcı elle çizdiği/başka yerde ürettiği bir tahmin grafiğinin
 * fotoğrafını/ekran görüntüsünü yükler. Bu route görseli Supabase storage'a
 * kaydeder ve Claude'un görsel yorumlamasıyla 09:30-16:00 ET arası 5 dakikalık
 * fiyat noktalarını çıkarmaya çalışır. Çıkarılan noktalar KAYDEDİLMEZ —
 * kullanıcı arayüzde gözden geçirip "Güncelle"ye bastığında ayrı POST
 * /manual-forecast isteğiyle kaydedilir (uydurma veri sessizce saklanmasın).
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { isStaffWriteAuthed } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `Sana SPY (S&P 500 ETF) için 09:30-16:00 ET arası bir gün içi
fiyat tahmin grafiği/notu gösterilecek. Görevin: görseldeki eğri veya
işaretli noktalardan, 5 dakikalık aralıklarla (09:30, 09:35, 09:40, ...
15:55, 16:00) TAHMİNİ fiyat değerlerini oku ve SADECE şu JSON formatında
döndür, başka hiçbir metin ekleme:

{"points":[{"time":"09:30","price":767.50}, {"time":"09:35","price":767.80}, ...]}

Kurallar:
- time alanı HER ZAMAN "HH:MM" formatında (24 saat, ET).
- Görselde net görünmeyen/okunamayan aralıkları atla, uydurma değer üretme.
- Görseldeki eğriyi olabildiğince yoğun örnekle (mümkünse her 5 dakikada bir nokta).
- Sadece geçerli JSON döndür, markdown code fence kullanma.`;

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY tanımlı değil" }, { status: 500 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "image dosyası gerekli" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Görsel 8MB'dan büyük olamaz" }, { status: 400 });
  }
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ ok: false, error: "Sadece görsel dosyası kabul edilir" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const base64 = Buffer.from(bytes).toString("base64");
  const mediaType = file.type as "image/png" | "image/jpeg" | "image/webp" | "image/gif";

  // Storage'a yükle (referans olarak saklanır, kullanıcı arayüzde de gösterebilir)
  let imageUrl: string | null = null;
  try {
    const ext = (file.type.split("/")[1] || "png").slice(0, 10);
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("spyengine-forecast-images")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (!uploadError) {
      const { data: pub } = supabaseAdmin.storage.from("spyengine-forecast-images").getPublicUrl(path);
      imageUrl = pub.publicUrl;
    }
  } catch {
    // Storage başarısız olsa bile analiz denemesi devam etsin
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Bu görseldeki SPY 5 dakikalık tahmin verisini JSON olarak çıkar." },
          ],
        },
      ],
    });
    const block = msg.content[0];
    const text = block?.type === "text" ? block.text.trim() : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    const parsed = JSON.parse(cleaned) as { points?: { time: string; price: number }[] };
    const points = (parsed.points ?? []).filter(
      (p) => typeof p.time === "string" && /^\d{2}:\d{2}$/.test(p.time) && Number.isFinite(p.price)
    );

    if (!points.length) {
      return NextResponse.json({
        ok: false,
        error: "Görselden okunabilir nokta çıkarılamadı — verileri elle girmeyi dene.",
        imageUrl,
      });
    }

    return NextResponse.json({ ok: true, points, imageUrl, raw: text });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: `Görsel analiz edilemedi: ${e instanceof Error ? e.message : String(e)}`,
        imageUrl,
      },
      { status: 502 }
    );
  }
}
