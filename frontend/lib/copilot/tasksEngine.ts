// BOGA Copilot Smart Tasks Engine & Task Pipeline

import { getUSMarketStatus, getCurrentPeriodKey } from "./marketSchedule";
import { calculateMaterialityScore } from "./materialityScore";
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
  | "closing_recap";

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
    const { data, error } = await supabaseAdmin
      .from("copilot_tasks")
      .insert([newTask])
      .select()
      .single();
    if (error || !data) throw error;
    return data as CopilotTask;
  } catch {
    return {
      id: `task-${Date.now()}`,
      ...newTask,
    };
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
      `Anlaşıldı! **${subject}** için akıllı takip başlatıldı. 08:45 ET (Açılış öncesi), 12:00 ET (Gün ortası) ve 16:15 ET (Kapanış) raporları hazırlayacağım.`,
    quickChoices: [
      { label: "⚡ Tesla'yı Takip Et", action: "task_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 NVIDIA'yı Takip Et", action: "task_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Bugünkü Bilançoları İzle", action: "task_earnings", type: "earnings_watch", subject: "Günün Bilançoları" },
      { label: "🤖 Yapay Zekâ Teması", action: "task_ai", type: "theme_analysis", subject: "Yapay Zekâ Hisseleri" },
      { label: "💻 Teknoloji Sektörü", action: "task_tech", type: "sector_analysis", subject: "Teknoloji Sektörü" },
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
      `Got it! Smart tracking started for **${subject}**. Updates will be prepared at 08:45 ET, 12:00 ET, and 16:15 ET.`,
    quickChoices: [
      { label: "⚡ Track Tesla Today", action: "task_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Track NVIDIA Today", action: "task_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Monitor Today's Earnings", action: "task_earnings", type: "earnings_watch", subject: "Today Earnings" },
      { label: "🤖 AI Sector Theme", action: "task_ai", type: "theme_analysis", subject: "AI Stocks" },
      { label: "💻 Tech Sector Watch", action: "task_tech", type: "sector_analysis", subject: "Tech Sector" },
      { label: "🌅 Premarket Briefing", action: "task_premarket", type: "premarket_briefing", subject: "Market Open" },
      { label: "🔥 Top Movers Watch", action: "task_movers", type: "top_movers_watch", subject: "Trending Stocks" },
    ],
  },
  es: {
    headerTitle: "MIS TAREAS ACTIVAS",
    breakBtn: "☕ Descansar",
    muteBtn: "🔕 Silenciar",
    breakPromptMsg: "☕ Modo Descanso Activo. Tus tareas siguen ejecutándose en segundo plano.",
    taskConfirmedMsg: (subject: string) =>
      `¡Entendido! Seguimiento inteligente iniciado para **${subject}**.`,
    quickChoices: [
      { label: "⚡ Seguir Tesla Hoy", action: "task_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Seguir NVIDIA Hoy", action: "task_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Ver Resultados de Hoy", action: "task_earnings", type: "earnings_watch", subject: "Resultados Hoy" },
      { label: "🤖 Tema Inteligencia Artificial", action: "task_ai", type: "theme_analysis", subject: "Acciones IA" },
    ],
  },
  fr: {
    headerTitle: "MES TÂCHES ACTIVES",
    breakBtn: "☕ Pause",
    muteBtn: "🔕 Sourdine",
    breakPromptMsg: "☕ Mode Pause Actif. Vos tâches s'exécutent en arrière-plan.",
    taskConfirmedMsg: (subject: string) =>
      `Reçu ! Suivi intelligent activé pour **${subject}**.`,
    quickChoices: [
      { label: "⚡ Suivre Tesla Aujourd'hui", action: "task_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Suivre NVIDIA Aujourd'hui", action: "task_nvda", type: "company_daily_watch", subject: "NVDA" },
    ],
  },
  pt: {
    headerTitle: "MINHAS TAREFAS ATIVAS",
    breakBtn: "☕ Pausa",
    muteBtn: "🔕 Silenciar",
    breakPromptMsg: "☕ Modo Pausa Ativo. Suas tarefas continuam rodando em segundo plano.",
    taskConfirmedMsg: (subject: string) =>
      `Entendido! Monitoramento inteligente iniciado para **${subject}**.`,
    quickChoices: [
      { label: "⚡ Acompanhar Tesla Hoje", action: "task_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Acompanhar NVIDIA Hoje", action: "task_nvda", type: "company_daily_watch", subject: "NVDA" },
    ],
  },
};
