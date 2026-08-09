import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { isXPostingEnabled } from "@/lib/x/settings";
import { LOCALES, type Locale, type MarketAssetCategory } from "@/lib/x/generateContent";
import { publishTargetNow } from "@/lib/x/publishNow";
import { computeNextIntervalRunIso, computeNextWeeklyRunIso } from "@/lib/x/recurringSchedules";

export const runtime = "nodejs";
export const maxDuration = 90;

const CRON_SECRET = process.env.CRON_SECRET;
const MAX_SCHEDULES_PER_RUN = 5;

interface RecurringSchedule {
  id: string;
  content_type: "stock" | "market_asset";
  ticker: string;
  category: MarketAssetCategory | null;
  company: string | null;
  sector: string | null;
  theme: string | null;
  weekly: boolean;
  locale: Locale | null;
  recurrence_type: "interval" | "weekly";
  interval_hours: number | null;
  weekday: number | null;
  time_of_day: string | null;
  next_run_at: string;
}

// Zamani gelmis (next_run_at <= now, enabled=true) tekrarlanan programlari
// bulup ateşler, sonra bir sonraki calisma zamanina ilerletir. pg_cron
// tarafindan her 15 dakikada bir tetiklenir (bkz. 0029_pg_cron_x_recurring_schedules.sql).
// Uretim mantigi lib/x/publishNow.ts'te — admin/x/publish-now (manuel "Simdi
// Yayinla" butonu) ile AYNI kod yolunu kullanir.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: due } = await supabaseAdmin
    .from("x_recurring_schedules")
    .select("*")
    .eq("enabled", true)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(MAX_SCHEDULES_PER_RUN);

  if (!due || due.length === 0) {
    return NextResponse.json({ processed: [] });
  }

  const postingEnabled = await isXPostingEnabled();
  const processed: Array<{ scheduleId: string; ticker: string; results?: Awaited<ReturnType<typeof publishTargetNow>>; error?: string }> = [];

  for (const sched of due as RecurringSchedule[]) {
    const nextRunAt =
      sched.recurrence_type === "interval"
        ? computeNextIntervalRunIso(sched.interval_hours!)
        : computeNextWeeklyRunIso(sched.weekday!, sched.time_of_day!);

    // Optimistik kilit: next_run_at hala beklenen degerse ilerlet ve bu satiri
    // biz kazanmis oluruz — ayni anda iki cron calismasi ayni satiri iki kez
    // islemez.
    const { data: claimed } = await supabaseAdmin
      .from("x_recurring_schedules")
      .update({ next_run_at: nextRunAt, last_run_at: new Date().toISOString() })
      .eq("id", sched.id)
      .eq("next_run_at", sched.next_run_at)
      .select()
      .maybeSingle();

    if (!claimed) continue;

    try {
      const targetLocales: Locale[] = sched.locale ? [sched.locale] : [...LOCALES];
      const results = await publishTargetNow(
        {
          contentType: sched.content_type,
          ticker: sched.ticker,
          category: sched.category,
          company: sched.company,
          sector: sched.sector,
          theme: sched.theme,
          weekly: sched.weekly,
          source: "recurring",
        },
        targetLocales,
        postingEnabled
      );
      processed.push({ scheduleId: sched.id, ticker: sched.ticker, results });
    } catch (e: any) {
      console.error("[cron/x-recurring-schedules] schedule failed:", sched.ticker, e?.message);
      processed.push({ scheduleId: sched.id, ticker: sched.ticker, error: e?.message });
    }
  }

  return NextResponse.json({ processed });
}
