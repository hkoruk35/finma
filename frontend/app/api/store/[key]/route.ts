import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

function requireAdmin(req: NextRequest): boolean {
  return !!req.cookies.get('boga_auth')?.value
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

  let body: { value: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }) }

  const sb = adminClient()
  // Fetch existing value
  const { data: existing } = await sb.from('shared_store').select('value').eq('key', key).single()
  const current = (existing?.value as any) ?? {}
  const merged = { ...(current as object), ...(body.value as object) }

  const { error } = await sb.from('shared_store').upsert({ key, value: merged, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// Her istemci tarafi yazma cagrisi tarihsel olarak POST kullaniyor (PATCH
// degil) — route sadece PATCH tanimliyordu, yani bu yazmalarin tamami 405 ile
// sessizce basarisiz oluyordu (theme_overrides, hot_themes_removals,
// tracker_v1, portfolio_swing/longterm, watchlist, vb. hicbiri kalici
// olarak Supabase'e yazilmiyordu). PATCH ile ayni davranisi saglayarak
// mevcut tum cagri noktalarini tek seferde duzeltiyoruz.
export const POST = PATCH

