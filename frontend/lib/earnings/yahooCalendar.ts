// Yahoo Finance quoteSummary "calendarEvents" modülünden yaklaşan bilanço
// tarihi tahminlerini çeker. Aynı crumb/cookie akışı lib/copilot/liveFundamentals.ts
// içinde de kullanılıyor (Yahoo'nun v10 API'si kimlik doğrulaması gerektiriyor,
// bkz. o dosyadaki not) — burada bilinçli olarak küçük bir kod tekrarı var,
// server-only copilot kodunu bu genel amaçlı modüle bağlamamak için.

const YF_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

let _yfCrumb: string | null = null;
let _yfCookie: string | null = null;
let _yfCrumbTs = 0;
const YF_CRUMB_TTL = 50 * 60 * 1000;

async function getYFAuth(): Promise<{ crumb: string; cookie: string } | null> {
  if (_yfCrumb && _yfCookie && Date.now() - _yfCrumbTs < YF_CRUMB_TTL) {
    return { crumb: _yfCrumb, cookie: _yfCookie };
  }
  try {
    const homeRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": YF_UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(5000),
    });
    const raw = homeRes.headers.get("set-cookie") || "";
    const a3 = raw.match(/A3=([^;]+)/)?.[1];
    const a1 = raw.match(/A1=([^;]+)/)?.[1];
    const cookie = [a3 ? `A3=${a3}` : "", a1 ? `A1=${a1}` : ""].filter(Boolean).join("; ");

    const crumbRes = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": YF_UA, Accept: "text/plain", Cookie: cookie },
      signal: AbortSignal.timeout(5000),
    });
    if (crumbRes.ok) {
      const crumb = (await crumbRes.text()).trim();
      if (crumb && crumb.length < 20) {
        _yfCrumb = crumb;
        _yfCookie = cookie;
        _yfCrumbTs = Date.now();
        return { crumb, cookie };
      }
    }
  } catch {}
  return null;
}

export interface UpcomingEarnings {
  ticker: string;
  earningsDate: string; // YYYY-MM-DD
  isEstimate: boolean;
  epsEstimate: number | null;
  revenueEstimate: number | null;
}

export async function getUpcomingEarnings(ticker: string): Promise<UpcomingEarnings | null> {
  const t = ticker.trim().toUpperCase();
  if (!t || !/^[A-Z.\-]{1,6}$/.test(t)) return null;

  const auth = await getYFAuth();
  const crumbParam = auth ? `&crumb=${encodeURIComponent(auth.crumb)}` : "";
  const headers: Record<string, string> = { "User-Agent": YF_UA, Accept: "application/json" };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}?modules=calendarEvents${crumbParam}`,
      { headers, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const json = await res.json();
    const earnings = json?.quoteSummary?.result?.[0]?.calendarEvents?.earnings;
    const dateEntry = earnings?.earningsDate?.[0];
    if (!dateEntry?.fmt) return null;

    return {
      ticker: t,
      earningsDate: dateEntry.fmt,
      isEstimate: earnings?.isEarningsDateEstimate ?? true,
      epsEstimate: typeof earnings?.earningsAverage?.raw === "number" ? earnings.earningsAverage.raw : null,
      revenueEstimate: typeof earnings?.revenueAverage?.raw === "number" ? earnings.revenueAverage.raw : null,
    };
  } catch {
    return null;
  }
}
