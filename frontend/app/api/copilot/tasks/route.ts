import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { getUserTasks, createCopilotTask, cancelCopilotTask, TaskType } from "@/lib/copilot/tasksEngine";
import { SupportedLocale } from "@/lib/copilot/visitorDemo";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ tasks: [] });
    }

    const tasks = await getUserTasks(userData.user.id);
    return NextResponse.json({ tasks });
  } catch (err) {
    return NextResponse.json({ tasks: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const taskType: TaskType = body.taskType || "company_daily_watch";
    const subject: string | undefined = body.subject;
    const language: SupportedLocale = body.language || "tr";

    const task = await createCopilotTask(userData.user.id, taskType, subject, language);
    return NextResponse.json({ success: true, task });
  } catch (err) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get("id");
    if (!taskId) {
      return NextResponse.json({ error: "Missing task id" }, { status: 400 });
    }

    await cancelCopilotTask(userData.user.id, taskId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Failed to cancel task" }, { status: 500 });
  }
}
