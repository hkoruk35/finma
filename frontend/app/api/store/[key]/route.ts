import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createTimeoutFetch } from '@/lib/supabaseFetch'

// İzin verilen anahtarlar — güvenlik için whitelist
const ALLOWED_KEYS = [
  'watchlist',
  'tracker_v1',
  'smart_tracker_v1',
  'theme_overrides',
  'search_history',
  'preorder_analyses',
  'portfolio_swing',
  'portfolio_longterm',
  'hot_themes_removals',
  'theme_final_tickers',
]

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // DB düştüğünde tracker/izleme listesi istekleri askıda kalmasın.
    { global: { fetch: createTimeoutFetch() } }
  )
}

function requireAdmin(req: NextRequest): boolean {
  return !!req.cookies.get('boga_auth')?.value
}

// theme_overrides/hot_themes_removals gibi degerler ic ice dizi tutuyor
// (orn. {[tema]: [ticker,...]}); istemci "mevcut degeri oku -> JS'de degistir
// -> tam objeyi geri yaz" seklinde calisirsa, ust uste hizli tiklamalarda
// (or. "+ EKLE"ye art arda basmak) yaris durumu olusup daha once yazilan
// eklemeler kaybolabiliyor (tam olarak boyle bir veri kaybi yasandi). Bunun
// yerine tek bir istekte oku+degistir+yaz yapip, arada baskasi yazmis mi diye
// updated_at'i optimistic-lock olarak kullanip cakisirsa yeniden deniyoruz.
async function atomicArrayOp(
  sb: ReturnType<typeof adminClient>,
  key: string,
  path: string[],
  op: 'add' | 'remove',
  item: string,
  maxRetries = 6
): Promise<{ ok: true; value: any } | { ok: false; error: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data: row } = await sb.from('shared_store').select('value, updated_at').eq('key', key).maybeSingle()
    const current = (row?.value as any) ?? {}
    const next = JSON.parse(JSON.stringify(current))

    let node = next
    for (let i = 0; i < path.length - 1; i++) {
      if (typeof node[path[i]] !== 'object' || node[path[i]] === null) node[path[i]] = {}
      node = node[path[i]]
    }
    const leafKey = path[path.length - 1]
    const arr: string[] = Array.isArray(node[leafKey]) ? node[leafKey] : []
    node[leafKey] = op === 'add'
      ? (arr.includes(item) ? arr : [...arr, item])
      : arr.filter((x: string) => x !== item)

    if (!row) {
      const { error: insertError } = await sb.from('shared_store').insert({ key, value: next, updated_at: new Date().toISOString() })
      if (!insertError) return { ok: true, value: next }
      continue // baskasi araya girdi, tekrar dene
    }

    const { data: updated, error } = await sb
      .from('shared_store')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', key)
      .eq('updated_at', row.updated_at)
      .select('value')

    if (error) return { ok: false, error: error.message }
    if (updated && updated.length > 0) return { ok: true, value: next }
    // 0 satir guncellendi = arada baska bir istek yazdi, taze veriyle tekrar dene
  }
  return { ok: false, error: 'concurrent write conflict, max retries exceeded' }
}

// tracker_v1 (/admin/portfolio/tracker) degistiginde Top100'un 'fixed'
// kompozisyonunu (/global/{locale}/top100) gece yarisi cron'unu beklemeden
// hemen tazeler — /api/internal/top100-sync tam liste replace semantigi
// kullandigi icin her seferinde guncel tracker_v1.tickers'in tamami gonderilir.
async function syncTrackerToTop100Fixed(tickers: string[]) {
  try {
    if (tickers.length === 0) {
      // /api/internal/top100-sync bos tickers[] kabul etmiyor — tracker tamamen
      // bosaltildiginda 'fixed' kompozisyonunu burada dogrudan temizliyoruz.
      await adminClient().from('top100_tickers').delete().eq('source', 'fixed')
      return
    }
    if (!process.env.REVALIDATE_SECRET) return
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bogastock.com'
    await fetch(`${baseUrl}/api/internal/top100-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': process.env.REVALIDATE_SECRET },
      body: JSON.stringify({ tickers, source: 'fixed' }),
      signal: AbortSignal.timeout(120000),
    })
  } catch (e) {
    console.error('[store] tracker_v1 -> top100 fixed sync failed:', e)
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const PUBLIC_KEYS = ['hot_themes_removals', 'theme_overrides', 'theme_final_tickers']
  const { key } = await params

  if (!PUBLIC_KEYS.includes(key) && !requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Geçersiz key' }, { status: 400 })
  }

  const sb = adminClient()
  const { data, error } = await sb
    .from('shared_store')
    .select('value')
    .eq('key', key)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ value: data?.value ?? null })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  if (req.cookies.get('boga_auth')?.value !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { key } = await params
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Geçersiz key' }, { status: 400 })
  }

  let body: { value?: unknown; op?: 'arrayAdd' | 'arrayRemove'; path?: string[] | string; item?: string }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }) }

  const sb = adminClient()

  if (body.op === 'arrayAdd' || body.op === 'arrayRemove') {
    const path = Array.isArray(body.path) ? body.path.map(String) : body.path ? [String(body.path)] : []
    const item = body.item != null ? String(body.item) : ''
    if (path.length === 0 || !item) {
      return NextResponse.json({ error: 'path ve item gerekli' }, { status: 400 })
    }
    const result = await atomicArrayOp(sb, key, path, body.op === 'arrayAdd' ? 'add' : 'remove', item)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

    if (key === 'tracker_v1' && path.length === 1 && path[0] === 'tickers') {
      const newTickers: string[] = Array.isArray(result.value?.tickers) ? result.value.tickers : []
      after(() => syncTrackerToTop100Fixed(Array.from(new Set(newTickers))))
    }
    return NextResponse.json({ ok: true, value: result.value })
  }

  // Fetch existing value
  const { data: existing } = await sb.from('shared_store').select('value').eq('key', key).single()
  const current = (existing?.value as any) ?? {}
  const merged = { ...(current as object), ...(body.value as object) }

  const { error } = await sb.from('shared_store').upsert({ key, value: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (key === 'tracker_v1') {
    const oldTickers: string[] = Array.isArray((current as any)?.tickers) ? (current as any).tickers : []
    const newTickers: string[] = Array.isArray((merged as any)?.tickers) ? (merged as any).tickers : []
    const changed = oldTickers.length !== newTickers.length
      || oldTickers.some(t => !newTickers.includes(t))
      || newTickers.some(t => !oldTickers.includes(t))
    if (changed) after(() => syncTrackerToTop100Fixed(Array.from(new Set(newTickers))))
  }

  return NextResponse.json({ ok: true })
}

// Her istemci tarafi yazma cagrisi tarihsel olarak POST kullaniyor (PATCH
// degil) — route sadece PATCH tanimliyordu, yani bu yazmalarin tamami 405 ile
// sessizce basarisiz oluyordu (theme_overrides, hot_themes_removals,
// tracker_v1, portfolio_swing/longterm, watchlist, vb. hicbiri kalici
// olarak Supabase'e yazilmiyordu). PATCH ile ayni davranisi saglayarak
// mevcut tum cagri noktalarini tek seferde duzeltiyoruz.
export const POST = PATCH

