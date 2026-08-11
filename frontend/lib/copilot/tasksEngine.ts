// BOGA Copilot Smart Tasks Engine & Task Pipeline

import { getUSMarketStatus } from "./marketSchedule";
import { supabaseAdmin } from "@/lib/supabase-admin";

export type TaskType =
  | "premarket_briefing"
  | "company_daily_watch"
  | "material_news_watch"
  | "earnings_watch"
  | "sector_analysis"
  | "theme_analysis"
  | "top_movers_watch"
  | "watchlist_monitoring"
  | "midday_update"
  | "closing_recap"
  // spec böl. 19.1 — eksik görev türleri
  | "insider_watch"
  | "analyst_activity_watch"
  | "commodity_watch"
  | "fx_watch"
  | "crypto_watch"
  | "personal_watchlist_daily_watch"
  | "trend_list_change_watch"
  | "trend_candidate_promotion_watch"
  | "top7_change_watch"
  | "top100_change_watch"
  | "list_intersection_watch"
  | "theme_list_change_watch"; // parametrized by `subject` = hotThemes2026 slug

/** Görev tipinin hangi 5-liste kategorisini izlediği — snapshot/karşılaştırma
 *  motoru bu eşlemeyi kullanarak getSiteCategoryStocksList'i doğru kategoriyle çağırır. */
export const LIST_WATCH_TASK_CATEGORY: Partial<Record<TaskType, "trend_stocks" | "trend_candidate_watchlist" | "top_7" | "top_100" | "user_watchlist">> = {
  personal_watchlist_daily_watch: "user_watchlist",
  watchlist_monitoring: "user_watchlist",
  trend_list_change_watch: "trend_stocks",
  trend_candidate_promotion_watch: "trend_candidate_watchlist",
  top7_change_watch: "top_7",
  top100_change_watch: "top_100",
};

/** Kripto/döviz/emtia artık crossAssetData.ts (Yahoo Finance) ile gerçek veriye
 *  bağlı — bkz. taskRunner.ts:runCrossAssetWatchTask. Insider/analist filing
 *  feed'i ve çoklu-liste kesişim izleme için hâlâ gerçek bir kaynak yok; cron
 *  bunları UYDURMA VERİYLE çalıştırmak yerine dürüstçe "skipped" yazar. */
export const UNSUPPORTED_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  "insider_watch",
  "analyst_activity_watch",
  "list_intersection_watch",
]);

/** Bu görev türleri crossAssetData.ts (Yahoo Finance) ile izlenir — subject
 *  alanı bir varlık adı/sembolü olmalı (örn. "bitcoin", "EURUSD", "gold"). */
export const CROSS_ASSET_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  "crypto_watch",
  "fx_watch",
  "commodity_watch",
]);

/** Bu görev türü bir hotThemes2026 temasını izler — `subject` alanı tema
 *  slug'ıdır. LIST_WATCH_TASK_CATEGORY'ye SIĞMAZ çünkü o eşleme sabit (her
 *  TaskType tek bir SiteListCategory'ye bağlı), oysa 12 farklı tema `subject`
 *  ile parametrize edilir — bkz. taskRunner.ts:runThemeWatchTask. */
export const THEME_WATCH_TASK_TYPES: ReadonlySet<TaskType> = new Set([
  "theme_list_change_watch",
]);

export interface TaskRunLog {
  idempotency_key: string;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  attempt_count: number;
  data_timestamp: string | null;
  delivery_status: "delivered" | "muted" | "failed" | null;
  error_code: string | null;
}

export interface CopilotTask {
  id: string;
  user_id: string;
  task_type: TaskType;
  subject?: string;
  clarification_answer?: string;
  status: "active" | "paused" | "completed" | "muted";
  mute_until?: string | null;
  mute_allow_critical?: boolean;
  language: string;
  schedule: {
    premarket?: string;
    midday?: string;
    closing?: string;
  };
  alert_on_material_news?: boolean;
  last_snapshot?: any;
  created_at: string;
  run_logs?: TaskRunLog[];
}

export function buildIdempotencyKey(
  userId: string,
  taskId: string,
  taskType: TaskType,
  subject: string = "",
  scheduledPeriod: string
): string {
  const dateStr = new Date().toISOString().split("T")[0];
  const cleanSubject = subject.replace(/[^A-Z0-9]/gi, "_").toUpperCase();
  return `${userId}_${taskId}_${taskType}_${cleanSubject}_${scheduledPeriod}_${dateStr}`;
}

export async function getUserTasks(userId: string): Promise<CopilotTask[]> {
  try {
    const { data } = await supabaseAdmin
      .from("copilot_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
    return (data as CopilotTask[]) || [];
  } catch {
    return [];
  }
}

export async function createCopilotTask(
  userId: string,
  taskType: TaskType,
  subject?: string,
  language: string = "tr"
): Promise<CopilotTask> {
  const status = getUSMarketStatus();
  const newTask: Omit<CopilotTask, "id"> = {
    user_id: userId,
    task_type: taskType,
    subject: subject || taskType,
    status: "active",
    language,
    schedule: {
      premarket: status.premarketTimeET,
      midday: status.middayTimeET,
      closing: status.closingTimeET,
    },
    alert_on_material_news: true,
    created_at: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabaseAdmin.from("copilot_tasks").insert(newTask).select().single();
    if (error || !data) {
      return { id: `task_${Date.now()}`, ...newTask };
    }
    return data as CopilotTask;
  } catch {
    return { id: `task_${Date.now()}`, ...newTask };
  }
}

export async function cancelCopilotTask(userId: string, taskId: string): Promise<void> {
  try {
    await supabaseAdmin
      .from("copilot_tasks")
      .update({ status: "completed" })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch {}
}

export const TASK_LABELS: Record<string, any> = {
  tr: {
    headerTitle: "BUGÜNKÜ GÖREVLERİM",
    breakBtn: "☕ Mola Ver",
    muteBtn: "🔕 Sessize Al",
    breakPromptMsg: "☕ Mola Modu Aktif. Görevleriniz arka planda çalışmaya devam ediyor. Gözlerinizi dinlendirebilirsiniz!",
    taskConfirmedMsg: (subject: string) =>
      `Anlaşıldı! **${subject}** için takip başlatıldı. 08:45 ET (Açılış öncesi), 12:00 ET (Gün ortası) ve 16:15 ET (Kapanış) raporları hazırlanacak.`,
    quickChoices: [
      { label: "📊 Bugünkü Bilançoları İzle", action: "task_earnings", type: "earnings_watch", subject: "Günün Bilançoları" },
      { label: "🤖 Teknoloji & Yapay Zekâ Sektörü", action: "task_tech", type: "sector_analysis", subject: "Teknoloji & Yapay Zekâ" },
      { label: "🌅 Açılış Öncesi Piyasa Özeti", action: "task_premarket", type: "premarket_briefing", subject: "Piyasa Açılışı" },
      { label: "🔥 Günün Öne Çıkan Hisseleri", action: "task_movers", type: "top_movers_watch", subject: "Trend Hisseler" },
    ],
  },
  en: {
    headerTitle: "MY ACTIVE TASKS",
    breakBtn: "☕ Take a Break",
    muteBtn: "🔕 Mute",
    breakPromptMsg: "☕ Break Mode Active. Your background tasks keep running. Rest your eyes!",
    taskConfirmedMsg: (subject: string) =>
      `Got it! Tracking started for **${subject}**. Updates will be prepared at 08:45 ET, 12:00 ET, and 16:15 ET.`,
    quickChoices: [
      { label: "📊 Monitor Today's Earnings", action: "task_earnings", type: "earnings_watch", subject: "Today Earnings" },
      { label: "🤖 Tech & AI Sector Watch", action: "task_tech", type: "sector_analysis", subject: "Tech & AI Sector" },
      { label: "🌅 Premarket Briefing", action: "task_premarket", type: "premarket_briefing", subject: "Market Open" },
      { label: "🔥 Top Movers Watch", action: "task_movers", type: "top_movers_watch", subject: "Trending Stocks" },
    ],
  },
  es: {
    headerTitle: "MIS TAREAS ACTIVAS",
    breakBtn: "☕ Descansar",
    muteBtn: "🔕 Silenciar",
    breakPromptMsg: "☕ Modo Descanso Activo. Tus tareas siguen ejecutándose en segundo plano. ¡Puedes descansar la vista!",
    taskConfirmedMsg: (subject: string) =>
      `¡Entendido! Seguimiento iniciado para **${subject}**. Se prepararán informes a las 08:45 ET (antes de la apertura), 12:00 ET (mediodía) y 16:15 ET (cierre).`,
    quickChoices: [
      { label: "📊 Ver Resultados de Hoy", action: "task_earnings", type: "earnings_watch", subject: "Resultados Hoy" },
      { label: "🤖 Sector Tecnología e IA", action: "task_tech", type: "sector_analysis", subject: "Tecnología e IA" },
      { label: "🌅 Resumen Previo a la Apertura", action: "task_premarket", type: "premarket_briefing", subject: "Apertura del Mercado" },
      { label: "🔥 Acciones Destacadas de Hoy", action: "task_movers", type: "top_movers_watch", subject: "Acciones en Tendencia" },
    ],
  },
  fr: {
    headerTitle: "MES TÂCHES ACTIVES",
    breakBtn: "☕ Pause",
    muteBtn: "🔕 Sourdine",
    breakPromptMsg: "☕ Mode Pause Actif. Vos tâches continuent de fonctionner en arrière-plan. Reposez vos yeux !",
    taskConfirmedMsg: (subject: string) =>
      `Reçu ! Suivi activé pour **${subject}**. Des rapports seront préparés à 08h45 ET (avant ouverture), 12h00 ET (milieu de journée) et 16h15 ET (clôture).`,
    quickChoices: [
      { label: "📊 Suivre les Résultats du Jour", action: "task_earnings", type: "earnings_watch", subject: "Résultats du Jour" },
      { label: "🤖 Secteur Tech & IA", action: "task_tech", type: "sector_analysis", subject: "Technologie & IA" },
      { label: "🌅 Résumé Avant Ouverture", action: "task_premarket", type: "premarket_briefing", subject: "Ouverture du Marché" },
      { label: "🔥 Actions Phares du Jour", action: "task_movers", type: "top_movers_watch", subject: "Actions Tendance" },
    ],
  },
  pt: {
    headerTitle: "MINHAS TAREFAS ATIVAS",
    breakBtn: "☕ Pausa",
    muteBtn: "🔕 Silenciar",
    breakPromptMsg: "☕ Modo Pausa Ativo. Suas tarefas continuam rodando em segundo plano. Você pode descansar os olhos!",
    taskConfirmedMsg: (subject: string) =>
      `Entendido! Acompanhamento iniciado para **${subject}**. Relatórios serão preparados às 08:45 ET (pré-abertura), 12:00 ET (meio-dia) e 16:15 ET (fechamento).`,
    quickChoices: [
      { label: "📊 Acompanhar Balanços de Hoje", action: "task_earnings", type: "earnings_watch", subject: "Balanços de Hoje" },
      { label: "🤖 Setor de Tecnologia & IA", action: "task_tech", type: "sector_analysis", subject: "Tecnologia & IA" },
      { label: "🌅 Resumo Pré-Mercado", action: "task_premarket", type: "premarket_briefing", subject: "Abertura do Mercado" },
      { label: "🔥 Ações em Destaque Hoje", action: "task_movers", type: "top_movers_watch", subject: "Ações em Tendência" },
    ],
  },
  id: {
    headerTitle: "TUGAS AKTIF SAYA",
    breakBtn: "☕ Istirahat",
    muteBtn: "🔕 Bisukan",
    breakPromptMsg: "☕ Mode Istirahat Aktif. Tugas Anda tetap berjalan di latar belakang. Silakan istirahatkan mata Anda!",
    taskConfirmedMsg: (subject: string) =>
      `Baik! Pemantauan dimulai untuk **${subject}**. Laporan akan disiapkan pada 08:45 ET (pra-pembukaan), 12:00 ET (siang hari), dan 16:15 ET (penutupan).`,
    quickChoices: [
      { label: "📊 Pantau Laporan Laba Hari Ini", action: "task_earnings", type: "earnings_watch", subject: "Laporan Laba Hari Ini" },
      { label: "🤖 Sektor Teknologi & AI", action: "task_tech", type: "sector_analysis", subject: "Teknologi & AI" },
      { label: "🌅 Ringkasan Pra-Pembukaan Pasar", action: "task_premarket", type: "premarket_briefing", subject: "Pembukaan Pasar" },
      { label: "🔥 Saham Unggulan Hari Ini", action: "task_movers", type: "top_movers_watch", subject: "Saham Tren" },
    ],
  },
};
