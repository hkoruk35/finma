// BOGA Copilot Görev Çalıştırıcı — spec böl. 19-23.
// Vercel Cron / harici zamanlayıcı tarafından periyodik olarak çağrılan
// /api/cron/copilot-tasks bu modülü kullanır. Her "due" görev için: idempotency
// kontrolü -> snapshot al -> öncekiyle karşılaştır -> anlamlıysa alert yaz.
// Veri kaynağı olmayan görev türleri (kripto/emtia/döviz/insider/analist)
// UYDURULMAZ — dürüstçe "skipped" olarak işaretlenir (bkz. UNSUPPORTED_TASK_TYPES).

import { supabaseAdmin } from "@/lib/supabase-admin";
import { getCurrentPeriodKey, getUSMarketStatus } from "@/lib/copilot/marketSchedule";
import { CopilotTask, TaskType, LIST_WATCH_TASK_CATEGORY, UNSUPPORTED_TASK_TYPES, CROSS_ASSET_TASK_TYPES, buildIdempotencyKey } from "@/lib/copilot/tasksEngine";
import { getSiteCategoryStocksList, getFastStockCardData } from "@/lib/copilot/stockData";
import { getCrossAssetQuote } from "@/lib/copilot/crossAssetData";
import { calculateMaterialityScore } from "@/lib/copilot/materialityScore";

interface RunResult {
  taskId: string;
  status: "completed" | "skipped" | "failed";
  reason?: string;
  alertCreated: boolean;
}

function tickerSetDiff(prev: string[] | undefined, next: string[]): { entered: string[]; left: string[] } {
  const prevSet = new Set(prev || []);
  const nextSet = new Set(next);
  return {
    entered: next.filter((t) => !prevSet.has(t)),
    left: (prev || []).filter((t) => !nextSet.has(t)),
  };
}

async function recordRun(
  taskId: string,
  idempotencyKey: string,
  scheduledFor: Date,
  status: string,
  extra: { errorCode?: string; deliveryStatus?: string; dataTimestamp?: string } = {}
) {
  await supabaseAdmin.from("copilot_task_runs").insert({
    task_id: taskId,
    idempotency_key: idempotencyKey,
    scheduled_for: scheduledFor.toISOString(),
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    status,
    attempt_count: 1,
    data_timestamp: extra.dataTimestamp || null,
    delivery_status: extra.deliveryStatus || null,
    error_code: extra.errorCode || null,
  }).select().single();
}

async function runListWatchTask(task: CopilotTask, category: NonNullable<(typeof LIST_WATCH_TASK_CATEGORY)[TaskType]>): Promise<RunResult> {
  const res = await getSiteCategoryStocksList(category, task.language, task.user_id);
  if (res.isFallback) {
    return { taskId: task.id, status: "failed", reason: "list_source_unavailable", alertCreated: false };
  }

  const prevTickers: string[] = task.last_snapshot?.tickers || [];
  const { entered, left } = tickerSetDiff(prevTickers, res.tickers);
  const changed = entered.length > 0 || left.length > 0;

  await supabaseAdmin.from("copilot_tasks").update({
    last_snapshot: { tickers: res.tickers, captured_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }).eq("id", task.id);

  await supabaseAdmin.from("copilot_task_snapshots").insert({
    task_id: task.id,
    snapshot: { tickers: res.tickers, entered, left },
  });

  if (changed && prevTickers.length > 0) {
    const severity = entered.length + left.length >= 3 ? "high" : "medium";
    await supabaseAdmin.from("copilot_alerts").insert({
      user_id: task.user_id,
      task_id: task.id,
      severity,
      title: `${res.categoryName}: liste değişikliği`,
      body: [
        entered.length > 0 ? `Girenler: ${entered.join(", ")}` : null,
        left.length > 0 ? `Çıkanlar: ${left.join(", ")}` : null,
      ].filter(Boolean).join(" · "),
    });
    return { taskId: task.id, status: "completed", alertCreated: true };
  }
  return { taskId: task.id, status: "completed", alertCreated: false };
}

async function runTickerWatchTask(task: CopilotTask): Promise<RunResult> {
  const ticker = (task.subject || "").trim().toUpperCase();
  if (!ticker || !/^[A-Z.\-]{1,6}$/.test(ticker)) {
    return { taskId: task.id, status: "skipped", reason: "no_valid_ticker_subject", alertCreated: false };
  }

  const card = await getFastStockCardData(ticker, task.language);
  const prev = task.last_snapshot;

  await supabaseAdmin.from("copilot_tasks").update({
    last_snapshot: { ticker, bogaScore: card.bogaScore, trend: card.trend, captured_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  }).eq("id", task.id);

  await supabaseAdmin.from("copilot_task_snapshots").insert({
    task_id: task.id,
    snapshot: { ticker, bogaScore: card.bogaScore, trend: card.trend },
  });

  if (!prev) return { taskId: task.id, status: "completed", alertCreated: false };

  const scoreDelta = Math.abs((card.bogaScore ?? 0) - (prev.bogaScore ?? 0));
  const trendChanged = prev.trend && prev.trend !== card.trend;

  if (!trendChanged && scoreDelta < 10) {
    return { taskId: task.id, status: "completed", alertCreated: false };
  }

  const materiality = calculateMaterialityScore({
    companyRelevance: 15,
    financialImpact: Math.min(25, scoreDelta),
    sourceConfidence: 12,
    priceReaction: 0,
    volumeAnomaly: 0,
    userRelevance: 10,
    novelty: trendChanged ? 5 : 2,
    duplicatePenalty: 0,
  });

  if (materiality.tier === "ignore") {
    return { taskId: task.id, status: "completed", alertCreated: false };
  }

  await supabaseAdmin.from("copilot_alerts").insert({
    user_id: task.user_id,
    task_id: task.id,
    ticker,
    severity: materiality.tier === "critical_alert" ? "critical" : materiality.tier === "instant_alert" ? "high" : "medium",
    materiality_score: materiality.score,
    title: `${ticker}: ${trendChanged ? "trend değişti" : "BOGA Score değişti"}`,
    body: trendChanged
      ? `Trend ${prev.trend} -> ${card.trend} olarak güncellendi.`
      : `BOGA Score ${prev.bogaScore} -> ${card.bogaScore} olarak güncellendi.`,
  });

  return { taskId: task.id, status: "completed", alertCreated: true };
}

async function runCrossAssetWatchTask(task: CopilotTask): Promise<RunResult> {
  const asset = (task.subject || "").trim();
  if (!asset) return { taskId: task.id, status: "skipped", reason: "no_asset_subject", alertCreated: false };

  const quote = await getCrossAssetQuote(asset);
  if (!quote) return { taskId: task.id, status: "failed", reason: "cross_asset_source_unavailable", alertCreated: false };

  const prev = task.last_snapshot;
  await supabaseAdmin.from("copilot_tasks").update({
    last_snapshot: { asset: quote.label, price: quote.price, changePct: quote.changePct, captured_at: quote.asOf },
    updated_at: new Date().toISOString(),
  }).eq("id", task.id);
  await supabaseAdmin.from("copilot_task_snapshots").insert({
    task_id: task.id,
    snapshot: { asset: quote.label, price: quote.price, changePct: quote.changePct },
  });

  if (!prev) return { taskId: task.id, status: "completed", alertCreated: false };

  const moveSincePrev = prev.price > 0 ? Math.abs(((quote.price - prev.price) / prev.price) * 100) : 0;
  if (moveSincePrev < 2) return { taskId: task.id, status: "completed", alertCreated: false };

  await supabaseAdmin.from("copilot_alerts").insert({
    user_id: task.user_id,
    task_id: task.id,
    ticker: quote.yahooSymbol,
    severity: moveSincePrev >= 5 ? "high" : "medium",
    title: `${quote.label}: %${moveSincePrev.toFixed(1)} hareket`,
    body: `Fiyat $${prev.price} -> $${quote.price} (${quote.changePct >= 0 ? "+" : ""}${quote.changePct}% günlük).`,
  });
  return { taskId: task.id, status: "completed", alertCreated: true };
}

/** Şu anki piyasa periyoduna (premarket/midday/closing) göre "due" olan tüm
 *  aktif görevleri bir kez çalıştırır. Aynı periyot için aynı gün tekrar
 *  çağrılırsa idempotency_key sayesinde hiçbir görev iki kez çalışmaz.
 *  Kripto/döviz/emtia görevleri ABD piyasa takvimine BAĞLI DEĞİLDİR (spec böl. 20)
 *  — piyasa kapalıyken de (hafta sonu dahil) saatlik çalışmaya devam ederler;
 *  bu yüzden bu görev türleri için ayrı, saat bazlı bir idempotency periyodu kullanılır. */
export async function runDueTasks(): Promise<{ ran: number; skipped: number; failed: number; results: RunResult[] }> {
  const periodKey = getCurrentPeriodKey();
  const marketStatus = getUSMarketStatus();
  const usMarketClosed = periodKey === "off_hours" || marketStatus.isHoliday;
  const hourlyPeriodKey = `hour_${new Date().getUTCHours()}`;

  const { data: tasks } = await supabaseAdmin
    .from("copilot_tasks")
    .select("*")
    .eq("status", "active");

  const results: RunResult[] = [];
  for (const task of (tasks || []) as CopilotTask[]) {
    if (task.mute_until && new Date(task.mute_until) > new Date()) continue;

    const taskType = task.task_type as TaskType;
    const isCrossAsset = CROSS_ASSET_TASK_TYPES.has(taskType);
    if (usMarketClosed && !isCrossAsset) continue; // ABD borsası kapalı — sadece kripto/fx/emtia devam eder

    const effectivePeriod = isCrossAsset ? hourlyPeriodKey : periodKey;
    const idempotencyKey = buildIdempotencyKey(task.user_id, task.id, taskType, task.subject, effectivePeriod);
    const { data: existingRun } = await supabaseAdmin
      .from("copilot_task_runs")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existingRun) continue; // bu periyot için zaten çalıştı

    try {
      if (UNSUPPORTED_TASK_TYPES.has(taskType)) {
        await recordRun(task.id, idempotencyKey, new Date(), "skipped", { errorCode: "no_data_source" });
        results.push({ taskId: task.id, status: "skipped", reason: "no_data_source", alertCreated: false });
        continue;
      }

      const listCategory = LIST_WATCH_TASK_CATEGORY[taskType];
      const result = isCrossAsset
        ? await runCrossAssetWatchTask(task)
        : listCategory
          ? await runListWatchTask(task, listCategory)
          : await runTickerWatchTask(task);

      await recordRun(task.id, idempotencyKey, new Date(), result.status, {
        deliveryStatus: result.alertCreated ? "delivered" : "muted",
      });
      results.push(result);
    } catch (err) {
      console.error(`[taskRunner] Task ${task.id} (${taskType}) failed:`, err);
      await recordRun(task.id, idempotencyKey, new Date(), "failed", { errorCode: "unhandled_exception" });
      results.push({ taskId: task.id, status: "failed", reason: "unhandled_exception", alertCreated: false });
    }
  }

  return {
    ran: results.filter((r) => r.status === "completed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
