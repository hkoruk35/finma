import { NextRequest, NextResponse } from "next/server";
import { runDueTasks } from "@/lib/copilot/taskRunner";

/**
 * GET /api/cron/copilot-tasks
 * BOGA Copilot Akıllı Görevler yürütücüsü (spec böl. 19-23).
 * Piyasa saatlerinde saatlik çağrılmalı (örn. diğer hourly scan job'larıyla
 * aynı zamanlayıcı) — premarket/midday/closing periyotlarını kendi içinde
 * idempotency_key ile ayırt eder, aynı periyot için iki kez çalışmaz.
 *
 * NOT: vercel.json'daki cron girişi bu endpoint'i saatlik tetikler (Vercel,
 * CRON_SECRET ortam değişkeni tanımlıysa isteğe otomatik olarak Authorization:
 * Bearer header'ı ekler). Bu proje diğer saatlik job'ları (swing scan, fiyat
 * güncelleme) harici bir zamanlayıcıyla (Windows Task Scheduler) tetikliyor —
 * bu endpoint artık ayrıca Vercel Cron ile de güvence altında.
 */

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runDueTasks();
    return NextResponse.json({ success: true, ...summary, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("[cron/copilot-tasks] error:", error);
    return NextResponse.json({ error: "Task runner failed", message: String(error) }, { status: 500 });
  }
}
