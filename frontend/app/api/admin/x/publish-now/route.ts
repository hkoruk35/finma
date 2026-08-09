import { NextRequest, NextResponse } from "next/server";
import { isXPostingEnabled } from "@/lib/x/settings";
import { LOCALES, type Locale, type MarketAssetCategory } from "@/lib/x/generateContent";
import { publishTargetNow } from "@/lib/x/publishNow";

export const runtime = "nodejs";
export const maxDuration = 90;

function requireAdmin(req: NextRequest): boolean {
  return req.cookies.get("boga_auth")?.value === "admin";
}

const MARKET_ASSET_CATEGORIES = new Set(["sector", "index", "commodity", "fx", "crypto"]);

// X Studio "Analiz Yönetimi" — bir ticker/varlık için taze AI metni + kart
// görselini AI ile HEMEN üretip yayınlar (cron beklemeden). Recurring
// schedule'lar ile AYNI üretim mantığını kullanır (bkz. lib/x/publishNow.ts),
// tek fark: burada admin butonuyla anlık tetiklenir, "manual" olarak loglanır.
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { contentType, ticker, category, company, sector, theme, weekly, locale } = body as {
    contentType: "stock" | "market_asset";
    ticker: string;
    category?: MarketAssetCategory;
    company?: string | null;
    sector?: string | null;
    theme?: string | null;
    weekly?: boolean;
    locale?: Locale | null;
  };

  if (!contentType || !ticker) {
    return NextResponse.json({ error: "contentType, ticker required" }, { status: 400 });
  }
  if (contentType === "market_asset" && (!category || !MARKET_ASSET_CATEGORIES.has(category))) {
    return NextResponse.json({ error: "valid category required for market_asset" }, { status: 400 });
  }

  try {
    const postingEnabled = await isXPostingEnabled();
    const targetLocales: Locale[] = locale ? [locale] : [...LOCALES];
    const results = await publishTargetNow(
      {
        contentType,
        ticker: ticker.toUpperCase().trim(),
        category: contentType === "market_asset" ? category : null,
        company: contentType === "stock" ? company ?? null : null,
        sector: contentType === "stock" ? sector ?? null : null,
        theme: contentType === "stock" ? theme ?? null : null,
        weekly: !!weekly,
        source: "manual",
      },
      targetLocales,
      postingEnabled
    );
    return NextResponse.json({ results, postingEnabled });
  } catch (e: any) {
    console.error("[x/publish-now]", e?.message);
    return NextResponse.json({ error: e?.message || "publish failed" }, { status: 500 });
  }
}
