# Phase 1: Direct Skills Integration
## BOGA AI — DCF + Peer Comps Tool Use

**Tarih:** 2026-06-16  
**Kapsam:** Mevcut sistemi bozmadan, additive entegrasyon  
**Hedef:** Claude'un özerk olarak DCF ve peer comparison hesaplaması yapması

---

## 1. Dürüst Analiz: Mevcut Sistem vs. Gerçek Eksikler

### Mevcut Sistemin Güçlü Yanları (DEĞİŞTİRME)

| Bileşen | Durum | Nerede |
|---|---|---|
| EMA 20/50/200 + Stack | ✅ Tam | `ask/route.ts → fetchYahooLive()` |
| RSI14 (Wilder) | ✅ Tam | `calcRSI()` |
| ATR14 + Volatilite | ✅ Tam | `calcATR()` |
| MACD 12/26/9 | ✅ Tam | `fetchYahooLive()` |
| OBV + A/D + CMF + MFI | ✅ Tam | `calcFlowSummary()` |
| Pivot-tabanlı S/R | ✅ Tam | `buildSRFromPivots()` |
| 1H Timing (BOS, Sweep, Pullback) | ✅ Tam | `calculateSupportResistance1h()` |
| 15m Bleeding detection | ✅ Tam | `check15mMicroTrend()` |
| Composite Score (4 faktör) | ✅ Tam | `finalMaster = tScore*0.40 + fScore*0.25 + mScore*0.20 + smScore*0.15` |
| Monte Carlo (28-gün) | ✅ Tam | `generateBogaSimulation()` |
| Buy/Sell/Stop zone (ATR-tabanlı) | ✅ Tam | `calculateSupportResistance1h()` |
| PE, PB, margins, FCF yield | ✅ Tam | `fetchYahooWithCrumb()` via quoteSummary |

### Gerçekten Eksik Olan 3 Şey

**1. Intrinsic Value (DCF)**  
Sistem PE/PB ve FCF yield'i çekiyor ama bunları bir **fiyat hedefine** çevirmiyor. Claude şu an "değerleme mantıklı görünüyor" gibi metin yazıyor, ama $8.50'lik bir hissenin gerçek değeri $14 mü $6 mı bunu hesaplamıyor. DCF bunu sağlar: FCF projeksiyonu + WACC + terminal value → intrinsic value.

**2. Peer Comparison (Comps)**  
"ONDS pahalı mı ucuz mu?" sorusunu yanıtlamak için sektör ortalamasına ihtiyaç var. Şu an sistem sadece tek bir hissenin PE/EBITDA'sına bakıyor, ama sektör ortalaması nedir bilmiyor. Comps bunu sağlar: rakip hisselerin multiples'ını çekip relative valuation yapar.

**3. Tool Use (Otonom Karar)**  
Bu ikisinin en önemlisi. Şu an Claude her soruda aynı pre-computed datayı alıyor. Özerklik şu demek: Claude "bu soru fundamental değerleme gerektiriyor, DCF çalıştırıyorum" kararını kendisi verebilmeli. Bu olmadan sistem ne kadar iyi olursa olsun "reaktif" kalır.

---

## 2. Maliyet Analizi

### Mevcut Sistem Maliyeti (Referans)

| Endpoint | Model | Input $/1M | Output $/1M | Tahmini/Çağrı |
|---|---|---|---|---|
| `/api/ask` | `claude-3-5-sonnet-20240620` | $3 | $15 | ~$0.008 |
| `/api/deep-analysis` | `claude-sonnet-4-6` | $3 | $15 | ~$0.015 |

### Direct Skills Ekleme Maliyeti

**Öneri: Sonnet 4.6 kullan (Opus değil)**  
Skills için `claude-opus-4-8` zorunlu değil. `claude-sonnet-4-6` (zaten mevcut) yeterli.

| Senaryo | Fazladan Token | Ek Maliyet/Çağrı |
|---|---|---|
| Sadece DCF | +1 loop (~2,000 token) | +$0.010 |
| DCF + Comps | +2 loop (~4,000 token) | +$0.020 |
| DCF + Comps + Earnings | +3 loop (~5,500 token) | +$0.030 |

**Kritik Not:** Skills her chat mesajında tetiklenmez. Yalnızca kullanıcı "analiz yap", "değerleme", "intrinsic value" gibi bir şey istediğinde çalışır. Normal sohbet sorularında sıfır ek maliyet.

### Günlük Maliyet Tahmini

```
100 mesaj/gün varsayımı:
- 20% skills trigger = 20 skills çağrısı/gün
- 20 × $0.030 = $0.60/gün ek maliyet
- Aylık: ~$18 ek

500 mesaj/gün varsayımı:
- 20% skills trigger = 100 skills çağrısı/gün
- 100 × $0.030 = $3/gün ek maliyet
- Aylık: ~$90 ek
```

**Sonuç:** Mevcut sisteme göre maliyet artışı düşük, fayda somut.

---

## 3. Phase 1 Scope

### Neler Yapılıyor

1. **Yeni endpoint**: `/api/skills/route.ts` — mevcut dosyalara **dokunulmaz**
2. **Yeni lib**: `frontend/lib/skills/` — DCF ve Comps hesaplama fonksiyonları
3. **Tool definitions**: `betaZodTool` ile Claude'un çağırabileceği tool tanımları

### Neler Yapılmıyor (Phase 2+)

- `ask/route.ts` modifiye edilmez (Phase 2'de opsiyonel bağlantı)
- LBO tool (fayda/maliyet oranı düşük swing trading için)
- Managed Agents kurulumu (Phase 3)

### Dosya Yapısı

```
frontend/
├── app/api/
│   ├── ask/route.ts          ← DOKUNULMAZ (mevcut)
│   ├── deep-analysis/route.ts ← DOKUNULMAZ (mevcut)
│   └── skills/
│       └── route.ts          ← YENİ (bağımsız endpoint)
└── lib/
    └── skills/
        ├── dcf.ts            ← YENİ: DCF hesaplama
        ├── comps.ts          ← YENİ: Peer comparison
        └── toolDefs.ts       ← YENİ: betaZodTool tanımları
```

---

## 4. Implementasyon

### Adım 1: Tool Definitions (`frontend/lib/skills/toolDefs.ts`)

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// betaZodTool: SDK'nın Zod schema'dan otomatik JSON schema ürettiği yardımcı
// Not: @anthropic-ai/sdk'da doğrudan export edilmez, raw tool definition kullan

export const DCF_TOOL = {
  name: "run_dcf",
  description: "Hisse için DCF (Discounted Cash Flow) intrinsic value hesaplar. Bull/base/bear senaryoları üretir. Kullanıcı fundamental değerleme, intrinsic value, hedef fiyat, veya 'değer mi?' sorduğunda çalıştır.",
  input_schema: {
    type: "object" as const,
    properties: {
      ticker:            { type: "string",  description: "Hisse sembolü (örn. ONDS, AAPL)" },
      currentPrice:      { type: "number",  description: "Güncel fiyat USD" },
      revenueGrowthRate: { type: "number",  description: "Tahmini yıllık büyüme oranı (0.15 = %15). Bilinmiyorsa YF verisi kullanılır." },
      wacc:              { type: "number",  description: "WACC. Boş bırakılırsa sector default kullanılır." },
    },
    required: ["ticker", "currentPrice"],
  },
};

export const COMPS_TOOL = {
  name: "run_comps",
  description: "Peer group EV/EBITDA, P/E multiples ile implied valuation range hesaplar. 'Pahalı mı?', 'sektöre göre nasıl?', 'peer comparison' sorularında çalıştır.",
  input_schema: {
    type: "object" as const,
    properties: {
      ticker:       { type: "string", description: "Analiz edilecek hisse" },
      currentPrice: { type: "number", description: "Güncel fiyat" },
      peers:        { 
        type: "array", 
        items: { type: "string" }, 
        description: "Manuel peer listesi. Boş bırakılırsa sector'a göre otomatik seçilir." 
      },
    },
    required: ["ticker", "currentPrice"],
  },
};

export const FINANCIAL_SKILLS = [DCF_TOOL, COMPS_TOOL];
```

### Adım 2: DCF Engine (`frontend/lib/skills/dcf.ts`)

```typescript
// WACC defaults by sector (YF industry string → WACC)
const SECTOR_WACC: Record<string, number> = {
  "Technology":              0.11,
  "Semiconductors":          0.11,
  "Software—Application":    0.10,
  "Wireless Telecom":        0.12,
  "Communication Equipment": 0.12,
  "Healthcare":              0.10,
  "Biotechnology":           0.13,
  "Energy":                  0.13,
  "Utilities":               0.08,
  "Financial Services":      0.09,
  "Real Estate":             0.09,
  "Consumer Cyclical":       0.10,
  "default":                 0.115,
};

export interface DCFInput {
  ticker: string;
  currentPrice: number;
  revenueGrowthRate?: number;
  wacc?: number;
}

export interface DCFOutput {
  ticker: string;
  currentPrice: number;
  intrinsicValue: number;
  upside: number;
  scenarios: {
    bull:  { value: number; upside: number };
    base:  { value: number; upside: number };
    bear:  { value: number; upside: number };
  };
  wacc: number;
  usedGrowthRate: number;
  pvTerminalValue: number;
  pvFCFSum: number;
  netDebt: number;
  sharesOutstanding: number;
  methodology: string;
}

export function calcDCF(params: DCFInput, yfData: any): DCFOutput {
  const fd = yfData?.financialData ?? {};
  const ks = yfData?.defaultKeyStatistics ?? {};
  const sd = yfData?.summaryDetail ?? {};

  // ── Inputs ──
  const freeCashFlow    = fd.freeCashflow?.raw ?? 0;
  const totalRevenue    = fd.totalRevenue?.raw ?? 0;
  const sharesOut       = ks.sharesOutstanding?.raw ?? ks.floatShares?.raw ?? 1;
  const netDebt         = (fd.totalDebt?.raw ?? 0) - (fd.totalCash?.raw ?? 0);
  const revenueGrowth   = fd.revenueGrowth?.raw ?? 0.10;
  const industry        = yfData?.assetProfile?.industry ?? "default";

  const wacc = params.wacc ?? SECTOR_WACC[industry] ?? SECTOR_WACC.default;
  const g    = params.revenueGrowthRate ?? revenueGrowth;
  const tgr  = 0.03; // terminal growth rate

  // Handle FCF = 0 (pre-profit companies): estimate from revenue
  const baseFCF = freeCashFlow !== 0 
    ? freeCashFlow 
    : totalRevenue * 0.08; // 8% FCF margin estimate for pre-profit

  if (baseFCF === 0) {
    // Cannot model — return with explanation
    return {
      ticker: params.ticker,
      currentPrice: params.currentPrice,
      intrinsicValue: 0,
      upside: 0,
      scenarios: {
        bull: { value: 0, upside: 0 },
        base: { value: 0, upside: 0 },
        bear: { value: 0, upside: 0 },
      },
      wacc, usedGrowthRate: g, pvTerminalValue: 0, pvFCFSum: 0,
      netDebt, sharesOutstanding: sharesOut,
      methodology: "FCF verisi yetersiz — DCF hesaplanamadı. Revenue-based tahmin kullanın.",
    };
  }

  // ── Base Scenario: 5-year FCF projection ──
  const calcPV = (growthMultiplier: number) => {
    const fcfs = Array.from({ length: 5 }, (_, i) =>
      baseFCF * Math.pow(1 + g * growthMultiplier, i + 1)
    );
    const pvFCFs = fcfs.reduce((sum, fcf, i) => sum + fcf / Math.pow(1 + wacc, i + 1), 0);
    const terminalFCF = fcfs[4] * (1 + tgr);
    const pvTerminal  = (terminalFCF / (wacc - tgr)) / Math.pow(1 + wacc, 5);
    const equityValue = pvFCFs + pvTerminal - netDebt;
    const intrinsic   = equityValue / sharesOut;
    return { intrinsic: Math.max(0, intrinsic), pvTerminal, pvFCFs };
  };

  const base = calcPV(1.0);
  const bull = calcPV(1.35); // growth 35% above base
  const bear = calcPV(0.65); // growth 35% below base

  const upside = (base.intrinsic - params.currentPrice) / params.currentPrice;

  return {
    ticker:            params.ticker,
    currentPrice:      params.currentPrice,
    intrinsicValue:    +base.intrinsic.toFixed(2),
    upside:            +upside.toFixed(4),
    scenarios: {
      bull: { value: +bull.intrinsic.toFixed(2), upside: +((bull.intrinsic - params.currentPrice) / params.currentPrice).toFixed(4) },
      base: { value: +base.intrinsic.toFixed(2), upside: +upside.toFixed(4) },
      bear: { value: +bear.intrinsic.toFixed(2), upside: +((bear.intrinsic - params.currentPrice) / params.currentPrice).toFixed(4) },
    },
    wacc,
    usedGrowthRate:    +g.toFixed(4),
    pvTerminalValue:   +base.pvTerminal.toFixed(0),
    pvFCFSum:          +base.pvFCFs.toFixed(0),
    netDebt:           +netDebt.toFixed(0),
    sharesOutstanding: sharesOut,
    methodology:       `5Y FCF DCF | WACC: ${(wacc*100).toFixed(1)}% | Growth: ${(g*100).toFixed(1)}% | TGR: ${(tgr*100).toFixed(1)}%`,
  };
}
```

### Adım 3: Comps Engine (`frontend/lib/skills/comps.ts`)

```typescript
// Sector → default peer list (YF tickers)
const SECTOR_PEERS: Record<string, string[]> = {
  "Wireless Telecom":        ["T", "VZ", "TMUS", "LUMN"],
  "Communication Equipment": ["CSCO", "JNPR", "NTGR", "CIEN"],
  "Technology":              ["MSFT", "AAPL", "GOOGL", "META"],
  "Semiconductors":          ["NVDA", "AMD", "INTC", "AVGO"],
  "Biotechnology":           ["MRNA", "REGN", "BIIB", "VRTX"],
  "Energy":                  ["XOM", "CVX", "COP", "SLB"],
  "default":                 ["SPY"],
};

export interface CompsInput {
  ticker: string;
  currentPrice: number;
  peers?: string[];
  industry?: string;
}

export interface CompsOutput {
  ticker: string;
  peerList: string[];
  targetMetrics: {
    pe:         number | null;
    evEbitda:   number | null;
    evRevenue:  number | null;
    pbRatio:    number | null;
  };
  peerMedians: {
    pe:         number | null;
    evEbitda:   number | null;
    evRevenue:  number | null;
  };
  impliedValues: {
    fromPE:       number | null;
    fromEvEbitda: number | null;
    fromEvRevenue: number | null;
    consensus:    number | null;
  };
  discount: number | null; // negative = discount to peers, positive = premium
  verdict: "CHEAP" | "FAIR" | "EXPENSIVE" | "INSUFFICIENT_DATA";
}

// Fetches basic quote data from YF for peer metrics
async function fetchPeerMetrics(ticker: string): Promise<{ pe: number | null; evEbitda: number | null; evRevenue: number | null } | null> {
  try {
    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json",
    };
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=1d&interval=1d`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta ?? {};
    return {
      pe:        meta.trailingPE   ?? null,
      evEbitda:  meta.forwardPE    ?? null, // fallback — real EV/EBITDA needs quoteSummary
      evRevenue: null,
    };
  } catch {
    return null;
  }
}

export async function calcComps(params: CompsInput, targetYFData: any): Promise<CompsOutput> {
  const ks = targetYFData?.defaultKeyStatistics ?? {};
  const fd = targetYFData?.financialData ?? {};
  const sd = targetYFData?.summaryDetail ?? {};
  const ap = targetYFData?.assetProfile ?? {};

  const industry = params.industry ?? ap.industry ?? "default";
  const peerList = params.peers?.length ? params.peers : (SECTOR_PEERS[industry] ?? SECTOR_PEERS.default);

  // Target metrics
  const targetPE       = sd.trailingPE?.raw ?? ks.trailingPE?.raw ?? null;
  const targetEVEbitda = ks.enterpriseToEbitda?.raw ?? null;
  const targetEVRev    = ks.enterpriseToRevenue?.raw ?? null;
  const targetPB       = ks.priceToBook?.raw ?? null;

  // Fetch peer metrics in parallel
  const peerResults = await Promise.allSettled(peerList.map(fetchPeerMetrics));
  const validPeers = peerResults
    .filter((r): r is PromiseFulfilledResult<{ pe: number | null; evEbitda: number | null; evRevenue: number | null }> => 
      r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  const median = (arr: (number | null)[]) => {
    const clean = arr.filter((v): v is number => v !== null && isFinite(v));
    if (!clean.length) return null;
    const sorted = clean.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  };

  const medPE      = median(validPeers.map(p => p.pe));
  const medEVEbitda = median(validPeers.map(p => p.evEbitda));

  // Implied values based on peer medians
  const eps         = targetPE && params.currentPrice ? params.currentPrice / targetPE : null;
  const fromPE      = medPE && eps ? +(medPE * eps).toFixed(2) : null;
  const fromEvEbitda = null; // requires EBITDA calculation — Phase 2 enhancement
  const fromEvRevenue = null;

  const impliedValues = [fromPE, fromEvEbitda, fromEvRevenue].filter(v => v !== null) as number[];
  const consensus = impliedValues.length > 0 
    ? +(impliedValues.reduce((a, b) => a + b, 0) / impliedValues.length).toFixed(2)
    : null;

  // Discount/premium to peers
  let discount: number | null = null;
  if (targetPE && medPE) {
    discount = +((targetPE - medPE) / medPE).toFixed(4);
  }

  const verdict: CompsOutput["verdict"] = 
    discount === null ? "INSUFFICIENT_DATA" :
    discount < -0.20 ? "CHEAP" :
    discount > 0.25  ? "EXPENSIVE" :
    "FAIR";

  return {
    ticker:        params.ticker,
    peerList,
    targetMetrics: { pe: targetPE, evEbitda: targetEVEbitda, evRevenue: targetEVRev, pbRatio: targetPB },
    peerMedians:   { pe: medPE, evEbitda: medEVEbitda, evRevenue: null },
    impliedValues: { fromPE, fromEvEbitda, fromEvRevenue, consensus },
    discount,
    verdict,
  };
}
```

### Adım 4: Skills Endpoint (`frontend/app/api/skills/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FINANCIAL_SKILLS, DCF_TOOL, COMPS_TOOL } from "@/lib/skills/toolDefs";
import { calcDCF } from "@/lib/skills/dcf";
import { calcComps } from "@/lib/skills/comps";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── YF Auth (deep-analysis ile aynı pattern) ──────────────────────────────────
const YF_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
let _crumb: string | null = null;
let _cookie: string | null = null;
let _crumbTs = 0;

async function getAuth() {
  if (_crumb && _cookie && Date.now() - _crumbTs < 50 * 60 * 1000) return { crumb: _crumb, cookie: _cookie };
  const r1 = await fetch("https://fc.yahoo.com", { headers: { "User-Agent": YF_UA } });
  const raw = r1.headers.get("set-cookie") ?? "";
  const a3 = raw.match(/A3=([^;]+)/)?.[1];
  const a1 = raw.match(/A1=([^;]+)/)?.[1];
  const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");
  const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
    headers: { "User-Agent": YF_UA, "Cookie": cookie },
  });
  const crumb = (await r2.text()).trim();
  if (crumb && crumb.length < 20) { _crumb = crumb; _cookie = cookie; _crumbTs = Date.now(); }
  return { crumb, cookie };
}

async function fetchYFSummary(ticker: string) {
  const { crumb, cookie } = await getAuth();
  const modules = "assetProfile,financialData,defaultKeyStatistics,summaryDetail";
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}&crumb=${encodeURIComponent(crumb)}`;
  const res = await fetch(url, { headers: { "User-Agent": YF_UA, "Cookie": cookie } });
  if (!res.ok) return null;
  const json = await res.json();
  return json?.quoteSummary?.result?.[0] ?? null;
}

// ── Tool Handler ──────────────────────────────────────────────────────────────
async function handleToolCall(toolName: string, toolInput: any, yfDataCache: Map<string, any>) {
  const ticker = toolInput.ticker?.toUpperCase() ?? "";

  // Lazy fetch + cache YF data per ticker
  if (!yfDataCache.has(ticker)) {
    yfDataCache.set(ticker, await fetchYFSummary(ticker));
  }
  const yfData = yfDataCache.get(ticker);

  if (toolName === "run_dcf") {
    return calcDCF({ ticker, currentPrice: toolInput.currentPrice, revenueGrowthRate: toolInput.revenueGrowthRate, wacc: toolInput.wacc }, yfData);
  }
  if (toolName === "run_comps") {
    return await calcComps({ ticker, currentPrice: toolInput.currentPrice, peers: toolInput.peers }, yfData);
  }
  return { error: `Unknown tool: ${toolName}` };
}

// ── Agentic Loop ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ticker, currentPrice, query, history = [] } = body;

    if (!ticker || !currentPrice) {
      return NextResponse.json({ error: "ticker ve currentPrice zorunlu" }, { status: 400 });
    }

    const yfDataCache = new Map<string, any>();
    const messages: Anthropic.MessageParam[] = [
      ...history,
      {
        role: "user",
        content: query ?? `${ticker} için tam fundamental analiz yap. Güncel fiyat: $${currentPrice}. DCF intrinsic value ve peer comparison hesapla.`,
      },
    ];

    const SYSTEM = `Sen BOGA AI'ın fundamental analiz motorusun.
Kullanıcı bir hisse hakkında değerleme, intrinsic value, veya peer comparison istediğinde ilgili tool'ları çalıştır.
- Birden fazla tool art arda çalıştırabilirsin.
- Sonuçları Türkçe özetle ve swing trading perspektifinden yorumla.
- Alım/satım tavsiyesi verme, bunun yerine "değer açısından..." şeklinde yorum yap.`;

    // Manual agentic loop (tool runner beta gerektirir — manual daha kontrollü)
    let loopMessages = [...messages];
    const toolResults: any[] = [];

    for (let i = 0; i < 5; i++) { // max 5 iterations
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        system: SYSTEM,
        tools: FINANCIAL_SKILLS as any,
        messages: loopMessages,
      });

      if (response.stop_reason === "end_turn") {
        // Done — extract final text
        const textContent = response.content.find(c => c.type === "text");
        return NextResponse.json({
          ticker,
          analysis: textContent?.text ?? "",
          toolResults,
          model: response.model,
          usage: response.usage,
        });
      }

      if (response.stop_reason === "tool_use") {
        // Execute all tool calls in this response
        const toolUseBlocks = response.content.filter(c => c.type === "tool_use");
        const toolResultContents: Anthropic.ToolResultBlockParam[] = [];

        for (const block of toolUseBlocks) {
          if (block.type !== "tool_use") continue;
          const result = await handleToolCall(block.name, block.input, yfDataCache);
          toolResults.push({ tool: block.name, input: block.input, output: result });
          toolResultContents.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        // Append assistant response + tool results to loop
        loopMessages = [
          ...loopMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResultContents },
        ];
        continue;
      }

      // Unexpected stop reason
      break;
    }

    return NextResponse.json({ error: "Analiz tamamlanamadı" }, { status: 500 });

  } catch (err: any) {
    console.error("[skills] Error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
```

---

## 5. Test Planı

### Test 1: Endpoint çalışıyor mu?

```bash
curl -X POST http://localhost:3000/api/skills \
  -H "Content-Type: application/json" \
  -d '{"ticker":"AAPL","currentPrice":200,"query":"AAPL değerleme"}'
```

Beklenen response:
```json
{
  "ticker": "AAPL",
  "analysis": "Apple için DCF hesabı...",
  "toolResults": [
    { "tool": "run_dcf", "output": { "intrinsicValue": 195.40, "upside": -0.023 } },
    { "tool": "run_comps", "output": { "verdict": "FAIR", "discount": 0.05 } }
  ]
}
```

### Test 2: Mevcut sistem bozuldu mu?

```bash
# ask endpoint'i normal çalışmalı
curl -X POST http://localhost:3000/api/ask \
  -H "Content-Type: application/json" \
  -d '{"message":"AAPL nasıl?","history":[]}'
```

---

## 6. Phase 2 Preview (Sonra)

Phase 1 çalışınca yapılacaklar:
1. `ask/route.ts` içinde opsiyonel skills tetikleyici — "değerleme" keyword'ü algılanırsa `/api/skills`'i internal call et, sonucu system prompt'a ekle
2. Earnings tool — beat/miss analizi
3. Gerçek EV/EBITDA peer comparison (şu an sadece PE)
4. Sonuçları 1 saat cache'le (zaten deep-analysis'de bu pattern var)

---

## 7. Özet: Eklemek Ne Kazandırıyor?

| Soru | Şu An | Sonra (Phase 1) |
|---|---|---|
| ONDS intrinsic value nedir? | Claude tahmin ediyor (text) | $X.XX — gerçek DCF hesabı |
| ONDS rakiplerine göre ucuz mu? | Bilinmiyor | Peer PE median → %20 iskontolu/primli |
| Claude hangi analizi yapacağına kendi karar veriyor mu? | Hayır | Evet — tool_use ile |
| Mevcut teknik analiz etkileniyor mu? | — | Hiç — ayrı endpoint |
| Aylık ek maliyet (100 msg/gün) | $0 | ~$18 |
