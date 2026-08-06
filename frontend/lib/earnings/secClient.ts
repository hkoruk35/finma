// SEC EDGAR istemcisi — resmi API, API key gerektirmez, sadece SEC'in
// zorunlu tuttuğu bir User-Agent header'ı (isim + iletişim e-postası) ister.
// https://www.sec.gov/os/accessing-edgar-data

const SEC_USER_AGENT = "BogaStock Earnings Bot contact@bogastock.com";

interface CompanyTickerEntry {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerCikMapCache: Map<string, CompanyTickerEntry> | null = null;
let tickerCikMapFetchedAt = 0;
const TICKER_MAP_TTL_MS = 24 * 60 * 60 * 1000; // günde bir kez yeter, SEC'in kendi güncelleme sıklığı da düşük

async function secFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: { "User-Agent": SEC_USER_AGENT, Accept: "application/json" } });
  if (!res.ok) throw new Error(`SEC EDGAR HTTP ${res.status} for ${url}`);
  return res.json();
}

/** SEC'in resmi ticker->CIK eşleme dosyası — tüm halka açık şirketleri kapsar. */
export async function getTickerCikMap(): Promise<Map<string, CompanyTickerEntry>> {
  if (tickerCikMapCache && Date.now() - tickerCikMapFetchedAt < TICKER_MAP_TTL_MS) {
    return tickerCikMapCache;
  }
  const data = await secFetch("https://www.sec.gov/files/company_tickers.json");
  const map = new Map<string, CompanyTickerEntry>();
  for (const entry of Object.values(data) as CompanyTickerEntry[]) {
    map.set(entry.ticker.toUpperCase(), entry);
  }
  tickerCikMapCache = map;
  tickerCikMapFetchedAt = Date.now();
  return map;
}

export interface RecentFiling {
  ticker: string;
  cik: string;
  companyName: string;
  form: string; // '10-Q' | '10-K'
  filingDate: string; // YYYY-MM-DD
  reportDate: string; // YYYY-MM-DD (dönem sonu, filingDate'ten farklı olabilir)
  accessionNo: string;
  primaryDocUrl: string;
}

const EARNINGS_FORM_TYPES = new Set(["10-Q", "10-K"]);

/**
 * Bir ticker için son N gün içinde SEC'e düşmüş 10-Q/10-K bildirimlerini döner.
 * SEC EDGAR "submissions" API'si her CIK için ayrı bir JSON döner — hızlı ve
 * ücretsizdir, ama tek tek çağrılması gerekir (toplu endpoint yok).
 */
export async function getRecentFilingsForTicker(ticker: string, lookbackDays: number): Promise<RecentFiling[]> {
  const map = await getTickerCikMap();
  const entry = map.get(ticker.toUpperCase());
  if (!entry) return [];

  const cikPadded = String(entry.cik_str).padStart(10, "0");
  let data: any;
  try {
    data = await secFetch(`https://data.sec.gov/submissions/CIK${cikPadded}.json`);
  } catch {
    return [];
  }

  const recent = data?.filings?.recent;
  if (!recent || !Array.isArray(recent.form)) return [];

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - lookbackDays);

  const out: RecentFiling[] = [];
  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    if (!EARNINGS_FORM_TYPES.has(form)) continue;
    const filingDate = recent.filingDate[i];
    if (!filingDate || new Date(filingDate) < cutoff) continue;
    const accessionNo = recent.accessionNumber[i];
    const primaryDoc = recent.primaryDocument[i];
    out.push({
      ticker: ticker.toUpperCase(),
      cik: cikPadded,
      companyName: entry.title,
      form,
      filingDate,
      reportDate: recent.reportDate[i] || filingDate,
      accessionNo,
      primaryDocUrl: `https://www.sec.gov/Archives/edgar/data/${entry.cik_str}/${accessionNo.replace(/-/g, "")}/${primaryDoc}`,
    });
  }
  return out;
}

/**
 * Bir CIK için temel finansal metrikleri (Gelir, Net Kar, EPS) SEC'in XBRL
 * "companyconcept" API'sinden çeker — ham 10-Q/10-K belgesinin tamamını
 * indirmek yerine sadece yapılandırılmış rakamları alır (DeepSeek'e gönderilecek
 * veri hacmini ve dolayısıyla maliyeti minimumda tutar).
 */
export async function getKeyFinancialMetrics(cik: string): Promise<Record<string, number | null>> {
  const concepts = [
    { key: "revenue", tag: "Revenues" },
    { key: "revenueAlt", tag: "RevenueFromContractWithCustomerExcludingAssessedTax" },
    { key: "netIncome", tag: "NetIncomeLoss" },
    { key: "eps", tag: "EarningsPerShareDiluted" },
  ];
  const out: Record<string, number | null> = {};
  for (const { key, tag } of concepts) {
    try {
      const data = await secFetch(`https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/us-gaap/${tag}.json`);
      const units = data?.units?.USD || data?.units?.["USD/shares"] || [];
      const latest = units
        .filter((u: any) => u.form === "10-Q" || u.form === "10-K")
        .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime())[0];
      out[key] = latest?.val ?? null;
    } catch {
      out[key] = null;
    }
  }
  // revenue tag'i şirkete göre değişebilir — ikisinden hangisi doluysa onu kullan
  if (out.revenue == null && out.revenueAlt != null) out.revenue = out.revenueAlt;
  delete out.revenueAlt;
  return out;
}
