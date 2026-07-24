// BOGA Copilot Proactive Smart Tasks Engine (5-Language Support: TR, EN, PT, ES, FR)

import { supabaseAdmin } from "@/lib/supabase-admin";
import { SupportedLocale } from "@/lib/copilot/visitorDemo";

export type TaskType =
  | "premarket_briefing"
  | "company_daily_watch"
  | "earnings_watch"
  | "material_news_watch"
  | "sector_watch"
  | "theme_watch"
  | "top_movers_watch"
  | "watchlist_watch"
  | "midday_update"
  | "closing_recap";

export interface CopilotTask {
  id: string;
  user_id: string;
  language: SupportedLocale;
  task_type: TaskType;
  subject_type?: string;
  subject?: string;
  timezone?: string;
  schedule?: {
    premarket?: string;
    midday?: string;
    postmarket?: string;
  };
  focus?: string[];
  alert_on_material_news?: boolean;
  detail_level?: "short" | "medium";
  status: "active" | "paused" | "completed";
  created_at: string;
  last_run_at?: string | null;
}

export interface TaskSnapshot {
  id: string;
  task_id: string;
  title: string;
  content: string;
  phase: "premarket" | "midday" | "postmarket" | "material_alert";
  created_at: string;
}

// Memory task store fallback for in-memory or Supabase tables
const memoryTasks = new Map<string, CopilotTask[]>();

export async function getUserTasks(userId: string): Promise<CopilotTask[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("copilot_tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (!error && data) return data as CopilotTask[];
  } catch {}

  return memoryTasks.get(userId) || [];
}

export async function createCopilotTask(
  userId: string,
  taskType: TaskType,
  subject?: string,
  language: SupportedLocale = "tr",
  focus: string[] = ["all"]
): Promise<CopilotTask> {
  const newTask: CopilotTask = {
    id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    user_id: userId,
    language,
    task_type: taskType,
    subject_type: subject ? "stock" : "general",
    subject: subject ? subject.toUpperCase() : undefined,
    timezone: "America/New_York",
    schedule: {
      premarket: "08:45",
      midday: "12:00",
      postmarket: "16:15",
    },
    focus,
    alert_on_material_news: true,
    detail_level: "short",
    status: "active",
    created_at: new Date().toISOString(),
  };

  try {
    await supabaseAdmin.from("copilot_tasks").insert({
      id: newTask.id,
      user_id: userId,
      language,
      task_type: taskType,
      subject_type: newTask.subject_type,
      subject: newTask.subject,
      schedule: newTask.schedule,
      focus,
      status: "active",
    });
  } catch {
    const existing = memoryTasks.get(userId) || [];
    memoryTasks.set(userId, [newTask, ...existing]);
  }

  return newTask;
}

export async function cancelCopilotTask(userId: string, taskId: string): Promise<boolean> {
  try {
    await supabaseAdmin
      .from("copilot_tasks")
      .update({ status: "completed" })
      .eq("id", taskId)
      .eq("user_id", userId);
  } catch {
    const existing = memoryTasks.get(userId) || [];
    memoryTasks.set(userId, existing.filter((t) => t.id !== taskId));
  }
  return true;
}

// Localized Task Action Titles & Labels across 5 languages
export const TASK_LABELS: Record<SupportedLocale, {
  headerTitle: string;
  createTask: string;
  manageTasks: string;
  adjustAlerts: string;
  quickPrompt: string;
  quickChoices: { label: string; action: string; type: TaskType; subject?: string }[];
  breakPromptTitle: string;
  breakPromptMsg: string;
  breakBtn: string;
  taskConfirmedMsg: (subject: string) => string;
}> = {
  tr: {
    headerTitle: "Bugünkü Görevlerim",
    createTask: "Yeni Görev Oluştur",
    manageTasks: "Görevleri Yönet",
    adjustAlerts: "Bildirim Ayarları",
    quickPrompt: "Bugün piyasada sizin için neyi takip etmemi istersiniz?\nBir şirketi, sektörü veya temayı gün boyunca izleyip kısa değerlendirmeler sunabilirim.",
    quickChoices: [
      { label: "⚡ Tesla'yı Takip Et", action: "track_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 NVIDIA'yı Takip Et", action: "track_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Bugünkü Bilançoları İzle", action: "track_earnings", type: "earnings_watch" },
      { label: "🤖 Yapay Zekâ Teması", action: "track_ai_theme", type: "theme_watch", subject: "AI" },
      { label: "💻 Teknoloji Sektörü", action: "track_tech_sector", type: "sector_watch", subject: "Technology" },
      { label: "🌅 Açılış Öncesi Piyasa Özeti", action: "premarket_summary", type: "premarket_briefing" },
      { label: "🔥 Günün Öne Çıkan Hisseleri", action: "top_movers", type: "top_movers_watch" },
    ],
    breakPromptTitle: "☕ Biraz Dinlenmek İster Misiniz?",
    breakPromptMsg: "Gözlerinizi dinlendirebilirsiniz! Ben arka planda piyasayı, izleme listenizi ve aktif görevlerinizi takip etmeye devam ediyorum. Önemli bir gelişme olduğunda sizi bilgilendireceğim.",
    breakBtn: "☕ Mola Ver",
    taskConfirmedMsg: (subject: string) => `Tamamdır! **${subject}** için gün boyu takip başlatıldı. 08:45 ET, 12:00 ET ve 16:15 ET değerlendirmeleri ve ani önemli haberler size iletilecektir.`,
  },
  en: {
    headerTitle: "Today's Active Tasks",
    createTask: "Create New Task",
    manageTasks: "Manage Tasks",
    adjustAlerts: "Notification Settings",
    quickPrompt: "What would you like me to track for you in the market today?\nI can monitor a company, sector, theme, or market move throughout the day and deliver concise briefings.",
    quickChoices: [
      { label: "⚡ Track Tesla Today", action: "track_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Track NVIDIA Today", action: "track_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Track Today's Earnings", action: "track_earnings", type: "earnings_watch" },
      { label: "🤖 AI Theme Watch", action: "track_ai_theme", type: "theme_watch", subject: "AI" },
      { label: "💻 Technology Sector", action: "track_tech_sector", type: "sector_watch", subject: "Technology" },
      { label: "🌅 Premarket Briefing", action: "premarket_summary", type: "premarket_briefing" },
      { label: "🔥 Today's Market Leaders", action: "top_movers", type: "top_movers_watch" },
    ],
    breakPromptTitle: "☕ Would you like to take a break?",
    breakPromptMsg: "Feel free to rest your eyes! I will keep monitoring the market, your watchlist, and active tasks in the background. I'll notify you if a material event occurs.",
    breakBtn: "☕ Take a Break",
    taskConfirmedMsg: (subject: string) => `Got it! Full-day watch started for **${subject}**. You'll receive updates at 08:45 ET, 12:00 ET, 16:15 ET, and instant alerts for material news.`,
  },
  pt: {
    headerTitle: "Minhas Tarefas Ativas",
    createTask: "Criar Nova Tarefa",
    manageTasks: "Gerenciar Tarefas",
    adjustAlerts: "Configurar Notificações",
    quickPrompt: "O que você gostaria que eu acompanhasse no mercado para você hoje?\nPosso monitorar uma empresa, setor ou tema ao longo do dia e fornecer breves relatórios.",
    quickChoices: [
      { label: "⚡ Acompanhar Tesla Hoje", action: "track_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Acompanhar NVIDIA Hoje", action: "track_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Balanços de Hoje", action: "track_earnings", type: "earnings_watch" },
      { label: "🤖 Tema de Inteligência Artificial", action: "track_ai_theme", type: "theme_watch", subject: "AI" },
      { label: "💻 Setor de Tecnologia", action: "track_tech_sector", type: "sector_watch", subject: "Technology" },
      { label: "🌅 Resumo Pré-Mercado", action: "premarket_summary", type: "premarket_briefing" },
      { label: "🔥 Destaques do Dia", action: "top_movers", type: "top_movers_watch" },
    ],
    breakPromptTitle: "☕ Gostaria de fazer uma pausa?",
    breakPromptMsg: "Pode descansar os olhos! Continuo acompanhando o mercado e suas tarefas ativas em segundo plano. Notificarei você se surgir algo relevante.",
    breakBtn: "☕ Fazer uma Pausa",
    taskConfirmedMsg: (subject: string) => `Pronto! Acompanhamento diário iniciado para **${subject}**. Você receberá atualizações às 08:45 ET, 12:00 ET, 16:15 ET e alertas imediatos.`,
  },
  es: {
    headerTitle: "Mis Tareas Activas",
    createTask: "Crear Nueva Tarea",
    manageTasks: "Gestionar Tareas",
    adjustAlerts: "Ajustar Notificaciones",
    quickPrompt: "¿Qué te gustaría que siga en el mercado para ti hoy?\nPuedo monitorear una empresa, sector o tema durante todo el día y brindarte breves informes.",
    quickChoices: [
      { label: "⚡ Seguir a Tesla Hoy", action: "track_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Seguir a NVIDIA Hoy", action: "track_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Resultados Financieros Hoy", action: "track_earnings", type: "earnings_watch" },
      { label: "🤖 Tema Inteligencia Artificial", action: "track_ai_theme", type: "theme_watch", subject: "AI" },
      { label: "💻 Sector Tecnología", action: "track_tech_sector", type: "sector_watch", subject: "Technology" },
      { label: "🌅 Resumen Pre-Mercado", action: "premarket_summary", type: "premarket_briefing" },
      { label: "🔥 Destacadas del Día", action: "top_movers", type: "top_movers_watch" },
    ],
    breakPromptTitle: "☕ ¿Te gustaría tomar un descanso?",
    breakPromptMsg: "¡Descansa la vista! Seguiré monitoreando el mercado y tus tareas activas en segundo plano. Te notificaré si ocurre algún evento relevante.",
    breakBtn: "☕ Tomar un Descanso",
    taskConfirmedMsg: (subject: string) => `¡Entendido! Seguimiento diario iniciado para **${subject}**. Recibirás informes a las 08:45 ET, 12:00 ET, 16:15 ET y alertas instantáneas.`,
  },
  fr: {
    headerTitle: "Mes Tâches Actives",
    createTask: "Créer une Tâche",
    manageTasks: "Gérer les Tâches",
    adjustAlerts: "Paramètres de Notification",
    quickPrompt: "Que souhaitez-vous que je suive sur le marché pour vous aujourd'hui ?\nJe peux surveiller une entreprise, un secteur ou un thème toute la journée et vous transmettre de courts résumés.",
    quickChoices: [
      { label: "⚡ Suivre Tesla Aujourd'hui", action: "track_tsla", type: "company_daily_watch", subject: "TSLA" },
      { label: "🚀 Suivre NVIDIA Aujourd'hui", action: "track_nvda", type: "company_daily_watch", subject: "NVDA" },
      { label: "📊 Résultats d'Aujourd'hui", action: "track_earnings", type: "earnings_watch" },
      { label: "🤖 Thème Intelligence Artificielle", action: "track_ai_theme", type: "theme_watch", subject: "AI" },
      { label: "💻 Secteur Technologie", action: "track_tech_sector", type: "sector_watch", subject: "Technology" },
      { label: "🌅 Aperçu Pré-Marché", action: "premarket_summary", type: "premarket_briefing" },
      { label: "🔥 Actions Phares du Jour", action: "top_movers", type: "top_movers_watch" },
    ],
    breakPromptTitle: "☕ Souhaitez-vous faire une pause ?",
    breakPromptMsg: "Reposez vos yeux ! Je continue de surveiller le marché et vos tâches actives en arrière-plan. Je vous préviendrai en cas d'événement majeur.",
    breakBtn: "☕ Faire une Pause",
    taskConfirmedMsg: (subject: string) => `Compris ! Suivi quotidien activé pour **${subject}**. Vous recevrez des résumés à 08h45 ET, 12h00 ET, 16h15 ET et des alertes immédiates.`,
  },
};
