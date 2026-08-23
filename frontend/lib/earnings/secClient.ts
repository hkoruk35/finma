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

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * XBRL "companyconcept" API'si, TEK bir tag (örn. NetIncomeLoss) için bir
 * şirketin TÜM geçmiş bildirimlerdeki TÜM period/context kombinasyonlarını
 * döner — aynı 10-Q içinde bile "3 ay" (çeyrek) VE "9 ay" (yıl başından
 * bugüne) süreli iki ayrı context bulunur (start/end farklı). Eski kod
 * sadece "en yeni end tarihi"ne göre sıralayıp ilkini alıyordu; bu, aynı
 * bildirim içinde Revenues'un 3 aylık context'ten, NetIncomeLoss'un ise 9
 * aylık context'ten gelmesine yol açabiliyordu (AMAT vakası: 2026-08-23
 * kullanıcı bildirimi — $9.12B olması gereken çeyrek geliri $5.16B, çeyrek
 * net kârı $2.54B olması gereken rakam $7.37B [dokuz aylık] olarak
 * yayınlanmıştı, EPS de aynı şekilde 9 aylık rakamdı).
 *
 * Düzeltme: SADECE işlenmekte olan bildirimin accession number'ı (accn) ile
 * eşleşen context'lere bak — bu, tüm rakamların AYNI belgeden geldiğini
 * garanti eder. O belge içinde birden fazla süre varsa (3 ay vs 9 ay), form
 * tipine göre beklenen süreye (10-Q -> ~1 çeyrek, 10-K -> ~1 yıl) en yakın
 * olanı seç — YTD/farklı süreli context'leri ele.
 */
function pickPeriodMatch(units: any[], accessionNo: string, form: string): any | null {
  const sameFiling = units.filter(
    (u: any) => u.accn === accessionNo && (u.form === "10-Q" || u.form === "10-K") && u.start && u.end
  );
  if (sameFiling.length === 0) return null;

  const targetDays = form === "10-K" ? 365 : 91;
  const toleranceDays = form === "10-K" ? 20 : 15;
  const withDuration = sameFiling.map((u: any) => ({
    u,
    days: (new Date(u.end).getTime() - new Date(u.start).getTime()) / MS_PER_DAY,
  }));
  const durationMatches = withDuration.filter((x) => Math.abs(x.days - targetDays) <= toleranceDays);
  const pool = durationMatches.length > 0 ? durationMatches : withDuration;

  // Aynı sureyi karsilayan birden fazla kayit varsa (nadiren, duzeltilmis/
  // restated bir versiyon) en yeni 'end' tarihli olanini tercih et.
  pool.sort((a, b) => new Date(b.u.end).getTime() - new Date(a.u.end).getTime());
  return pool[0]?.u ?? null;
}

/**
 * Bir bildirim için temel finansal metrikleri (Gelir, Net Kar, EPS) SEC'in
 * XBRL "companyconcept" API'sinden çeker — ham 10-Q/10-K belgesinin tamamını
 * indirmek yerine sadece yapılandırılmış rakamları alır (DeepSeek'e gönderilecek
 * veri hacmini ve dolayısıyla maliyeti minimumda tutar).
 *
 * accessionNo + form: hangi bildirimin işlendiğini belirtir — pickPeriodMatch
 * bunu kullanarak tüm rakamların AYNI belgeden ve AYNI süreden geldiğini
 * garanti eder (bkz. yukarıdaki not).
 */
export async function getKeyFinancialMetrics(
  cik: string,
  accessionNo: string,
  form: string
): Promise<Record<string, number | null>> {
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
      const matched = pickPeriodMatch(units, accessionNo, form);
      out[key] = matched?.val ?? null;
    } catch {
      out[key] = null;
    }
  }
  // revenue tag'i şirkete göre değişebilir — ikisinden hangisi doluysa onu kullan
  if (out.revenue == null && out.revenueAlt != null) out.revenue = out.revenueAlt;
  delete out.revenueAlt;

  // Ek güvenlik ağı (tutarlılık kontrolü): kök nedeni yukarıda düzeltmiş
  // olsak da veri kalitesi tek katmana bağlı olmasın — net kâr gelirden
  // büyükse (normal bir şirket için imkansız) ya da negatif gelir gibi
  // anlamsız bir kombinasyon varsa, o rakamı DeepSeek'e YANLIŞ olarak
  // göndermek yerine null'a çevir; DeepSeek zaten null alanları metne
  // dökmüyor (bkz. deepseekAnalysis.ts promptu "sadece verilen rakamlara
  // dayan").
  if (out.revenue != null && out.netIncome != null && out.revenue > 0 && out.netIncome > out.revenue) {
    out.revenue = null;
    out.netIncome = null;
    out.eps = null;
  }

  return out;
}
