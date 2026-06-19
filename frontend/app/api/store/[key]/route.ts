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
]

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  if (!ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Geçersiz key' }, { status: 400 })
  }

  let body: { value: unknown }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 }) }

  const sb = adminClient()
  const { error } = await sb
    .from('shared_store')
    .upsert({ key, value: body.value, updated_at: new Date().toISOString() }, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
