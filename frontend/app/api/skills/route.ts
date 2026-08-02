import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FINANCIAL_TOOLS } from "@/lib/skills/toolDefs";
import { calcDCF, type DCFInput } from "@/lib/skills/dcf";
import { calcComps, type CompsInput } from "@/lib/skills/comps";

export const runtime   = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Yahoo Finance Auth (same pattern as deep-analysis) ────────────────────────
const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
let _crumb   = "";
let _cookie  = "";
let _crumbTs = 0;

async function getYFAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (_crumb && _cookie && Date.now() - _crumbTs < 50 * 60 * 1000) {
    return { crumb: _crumb, cookie: _cookie };
  }
  try {
    const r1  = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": YF_UA, Accept: "text/html" },
      signal: AbortSignal.timeout(5000),
    });
    const raw = r1.headers.get("set-cookie") ?? "";
    const a3  = raw.match(/A3=([^;]+)/)?.[1];
    const a1  = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");

    const r2    = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YF_UA, Accept: "text/plain", Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.length > 20) return null;

    _crumb = crumb; _cookie = cookie; _crumbTs = Date.now();
    return { crumb, cookie };
  } catch (e: any) {
    console.warn("[skills] YF auth failed:", e?.message);
    return null;
  }
}

async function fetchYFSummary(ticker: string): Promise<any> {
  const auth = await getYFAuth();
  const modules = "assetProfile,financialData,defaultKeyStatistics,summaryDetail";
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const headers: Record<string, string> = { "User-Agent": YF_UA, Accept: "application/json" };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}${crumbParam}`,
      { headers, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) {
      if (res.status === 401) { _crumb = ""; _cookie = ""; }
      console.warn(`[skills] quoteSummary ${res.status} for ${ticker}`);
      return null;
    }
    const json = await res.json();
    return json?.quoteSummary?.result?.[0] ?? null;
  } catch (e: any) {
    console.warn("[skills] fetchYFSummary error:", e?.message);
    return null;
  }
}

// ── Tool dispatcher ───────────────────────────────────────────────────────────
async function dispatchTool(
  name: string,
  input: Record<string, any>,
  yfCache: Map<string, any>
): Promise<unknown> {
  const ticker = (input.ticker as string | undefined)?.toUpperCase() ?? "";
  if (!yfCache.has(ticker)) {
    yfCache.set(ticker, await fetchYFSummary(ticker));
  }
  const yfData = yfCache.get(ticker);

  if (name === "run_dcf") {
    return calcDCF(input as DCFInput, yfData);
  }
  if (name === "run_comps") {
    return await calcComps(input as CompsInput, yfData);
  }
  return { error: `Bilinmeyen tool: ${name}` };
}

// ── POST /api/skills ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      ticker,
      currentPrice,
      query,
      history = [],
    }: {
      ticker: string;
      currentPrice: number;
      query?: string;
      history?: Anthropic.MessageParam[];
    } = body;

    if (!ticker || !currentPrice) {
      return NextResponse.json(
        { error: "`ticker` ve `currentPrice` zorunlu" },
        { status: 400 }
      );
    }

    const userQuery =
      query ??
      `${ticker.toUpperCase()} için fundamental analiz yap. Güncel fiyat: $${currentPrice}. DCF intrinsic value ve peer comparison (comps) hesapla, sonuçları Türkçe özetle.`;

    const messages: Anthropic.MessageParam[] = [
      ...history,
      { role: "user", content: userQuery },
    ];

    const SYSTEM = `Sen BOGA AI'ın fundamental analiz motorusun. \
Kullanıcının isteğine göre run_dcf ve/veya run_comps tool'larını çalıştır. \
Birden fazla tool art arda kullanabilirsin. \
Sonuçları Türkçe, kısa ve swing trading perspektifinden özetle. \
Alım/satım tavsiyesi verme; bunun yerine "değer açısından..." veya "sektöre göre..." şeklinde yorum yap.`;

    const yfCache = new Map<string, any>();
    const toolLog: { tool: string; input: unknown; output: unknown }[] = [];
    let loopMessages = [...messages];

    // Manual agentic loop — max 6 turns
    for (let turn = 0; turn < 6; turn++) {
      const response = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 4096,
        system:     SYSTEM,
        tools:      FINANCIAL_TOOLS,
        messages:   loopMessages,
      });

      if (response.stop_reason === "end_turn") {
        const text = response.content.find(c => c.type === "text");
        return NextResponse.json({
          ticker:      ticker.toUpperCase(),
          analysis:    text?.type === "text" ? text.text : "",
          toolResults: toolLog,
          turns:       turn + 1,
          usage:       response.usage,
        });
      }

      if (response.stop_reason === "tool_use") {
        const toolUseBlocks = response.content.filter(
          (c): c is Anthropic.ToolUseBlock => c.type === "tool_use"
        );

        const toolResultContents: Anthropic.ToolResultBlockParam[] = [];
        for (const block of toolUseBlocks) {
          const result = await dispatchTool(
            block.name,
            block.input as Record<string, any>,
            yfCache
          );
          toolLog.push({ tool: block.name, input: block.input, output: result });
          toolResultContents.push({
            type:        "tool_result",
            tool_use_id: block.id,
            content:     JSON.stringify(result),
          });
        }

        loopMessages = [
          ...loopMessages,
          { role: "assistant", content: response.content },
          { role: "user",      content: toolResultContents },
        ];
        continue;
      }

      // max_tokens veya beklenmedik durum
      console.warn("[skills] Unexpected stop_reason:", response.stop_reason);
      break;
    }

    return NextResponse.json({ error: "Analiz tamamlanamadı" }, { status: 500 });
  } catch (err: any) {
    console.error("[skills] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Internal error" }, { status: 500 });
  }
}
