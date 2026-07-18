import { google } from "@ai-sdk/google";
import { streamText, tool } from "ai";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { hasAnyAuth } from "@/lib/apiAuth";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const maxDuration = 60;

function getBogaContext(pageContext: any) {
  let contextStr = "Sen BOGA AI Copilot'sun. Kullanıcılara sitemizdeki verileri kullanarak finansal asistanlık yaparsın.\n\n";

  if (pageContext) {
    if (pageContext.type === "ticker") {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.value} hissesinin grafik ve analiz sayfasındadır.\n\n`;
    } else if (pageContext.page) {
      contextStr += `KULLANICI BAĞLAMI: Kullanıcı şu anda ${pageContext.page} sayfasındadır.\n\n`;
    }
  }

  try {
    const dirBase = path.resolve(process.cwd(), "public", "data", "swing2026");
    if (fs.existsSync(dirBase)) {
      const files = fs.readdirSync(dirBase).filter(f => f.startsWith("swing_") && f.endsWith(".json"));
      if (files.length > 0) {
        files.sort((a, b) => b.localeCompare(a));
        const picksData = JSON.parse(fs.readFileSync(path.join(dirBase, files[0]), "utf-8"));
        
        if (picksData && picksData.picks) {
          const topPicks = picksData.picks.slice(0, 10).map((p: any) => 
            `- ${p.ticker} (Skor: ${p.score}/100, Sinyal: ${p.status}, Fiyat: $${p.current_price})`
          ).join("\n");
          contextStr += `GÜNCEL BOGA AI SWING TERCİHLERİ:\n${topPicks}\n\n`;
        }
      }
    }
  } catch (e) {}

  contextStr += `KURALLAR:
1. Kısa (concise) cevaplar ver. Uzun paragraflar yazma. Maddeler kullan.
2. Sadece finans/borsa konuş, diğer soruları reddet.
3. Bir hissenin analizini gösterirken 'show_stock_card' aracını kullan, asla metin olarak analiz dökümü yazma.
4. "NVIDIA grafiği" vb dendiğinde 'navigate_to' aracını çağır. Ancak GEÇERSİZ/HAYALİ tickerlara gitme, eğer borsa kodu mevcut değilse reddet.`;
  return contextStr;
}

export async function POST(req: NextRequest) {
  if (!(await hasAnyAuth(req))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for credit updates
    { cookies: { get(name) { return req.cookies.get(name)?.value; }, set() {}, remove() {} } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  // Credit check logic
  // Assume table `user_credits` exists with (user_id, daily_limit, current_usage, last_reset_date)
  const today = new Date().toISOString().split('T')[0];
  let { data: creditData } = await supabase.from('user_credits').select('*').eq('user_id', user.id).single();
  
  if (!creditData) {
    // Initialize if not exists (Free tier default 20)
    await supabase.from('user_credits').insert([{ user_id: user.id, daily_limit: 20, current_usage: 0, last_reset_date: today }]);
    creditData = { daily_limit: 20, current_usage: 0, last_reset_date: today };
  } else if (creditData.last_reset_date !== today) {
    // Reset on a new day
    await supabase.from('user_credits').update({ current_usage: 0, last_reset_date: today }).eq('user_id', user.id);
    creditData.current_usage = 0;
  }

  if (creditData.current_usage >= creditData.daily_limit) {
    return new Response("Daily Copilot Limit Reached. Limit: " + creditData.daily_limit, { status: 429 });
  }

  // Increment Usage (Best Effort)
  await supabase.from('user_credits').update({ current_usage: creditData.current_usage + 1 }).eq('user_id', user.id);

  const { messages, pageContext } = await req.json();
  const systemPrompt = getBogaContext(pageContext);

  try {
    const result = streamText({
      model: google("gemini-2.5-flash"),
      system: systemPrompt,
      messages,
      tools: {
        navigate_to: tool({
          description: "Kullanıcı belirli bir hissenin sayfasına veya grafiğine gitmek istediğinde kullan.",
          parameters: z.object({ ticker: z.string() }),
          execute: async ({ ticker }) => {
            // Validation step: In real-world, we'd check against a valid ticker list
            const isValid = ticker.length <= 5 && /^[A-Z]+$/.test(ticker);
            if (!isValid) return { success: false, error: "Geçersiz hisse senedi sembolü." };
            return { success: true, ticker: ticker.toUpperCase(), message: "Yönlendiriliyor..." };
          },
        }),
        show_stock_card: tool({
          description: "Bir hissenin güncel teknik detaylarını kart formatında göstermek için.",
          parameters: z.object({
            ticker: z.string(),
            companyName: z.string(),
            trend: z.enum(["Bullish", "Bearish", "Neutral"]),
            bogaScore: z.number().min(0).max(100),
            riskLevel: z.string(),
            support: z.number(),
            resistance: z.number(),
            target: z.number(),
            summary: z.string(),
          }),
          execute: async (args) => {
            return { success: true, ...args };
          }
        }),
      },
      maxSteps: 3,
      async onFinish({ text, toolCalls, toolResults }) {
        // Save chat to DB best-effort
        const allMessages = [...messages, { role: "assistant", content: text, toolCalls }];
        await supabase.from("copilot_chats").upsert({
          user_id: user.id,
          chat_state: allMessages,
          updated_at: new Date().toISOString()
        }, { onConflict: "user_id" });
      }
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.error("Copilot API Error:", error.message);
    return new Response("Service Unavailable", { status: 503 });
  }
}
