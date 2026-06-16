import type Anthropic from "@anthropic-ai/sdk";

export const DCF_TOOL: Anthropic.Tool = {
  name: "run_dcf",
  description:
    "Hisse için DCF (Discounted Cash Flow) intrinsic value hesaplar. " +
    "Yahoo Finance'den çekilen FCF ve gelir verileriyle bull/base/bear senaryoları üretir. " +
    "Kullanıcı 'intrinsic value', 'hedef fiyat', 'değerleme', 'kaça değer', 'DCF' ifadelerini kullandığında çalıştır.",
  input_schema: {
    type: "object",
    properties: {
      ticker: {
        type: "string",
        description: "Hisse sembolü (örn. ONDS, AAPL, NVDA)",
      },
      currentPrice: {
        type: "number",
        description: "Hissenin güncel fiyatı USD",
      },
      revenueGrowthRate: {
        type: "number",
        description:
          "Tahmini yıllık büyüme oranı (0.15 = %15). " +
          "Belirtilmezse Yahoo Finance büyüme verisi kullanılır.",
      },
      wacc: {
        type: "number",
        description:
          "İskonto oranı (WACC). Belirtilmezse sektöre göre varsayılan kullanılır " +
          "(Teknoloji: %11, Telecom: %12, Sağlık: %10, Enerji: %13, Kamu: %8).",
      },
    },
    required: ["ticker", "currentPrice"],
  },
};

export const COMPS_TOOL: Anthropic.Tool = {
  name: "run_comps",
  description:
    "Peer group karşılaştırması. Rakip hisselerin P/E, P/B değerlerini çekip " +
    "medyan hesaplar ve hedef hissenin ne kadar iskontolu/primli işlem gördüğünü döndürür. " +
    "Kullanıcı 'pahalı mı', 'ucuz mu', 'sektöre göre', 'peer comparison', 'rakiplerine kıyasla' dediğinde çalıştır.",
  input_schema: {
    type: "object",
    properties: {
      ticker: {
        type: "string",
        description: "Analiz edilecek hisse sembolü",
      },
      currentPrice: {
        type: "number",
        description: "Hissenin güncel fiyatı",
      },
      peers: {
        type: "array",
        items: { type: "string" },
        description:
          "Manuel peer listesi (örn. ['T', 'VZ', 'TMUS']). " +
          "Boş bırakılırsa sektöre göre otomatik seçilir.",
      },
    },
    required: ["ticker", "currentPrice"],
  },
};

export const FINANCIAL_TOOLS: Anthropic.Tool[] = [DCF_TOOL, COMPS_TOOL];
