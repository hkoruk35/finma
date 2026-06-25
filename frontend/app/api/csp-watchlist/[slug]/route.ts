import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_SLUGS = ['active', '525', '2550', '50250', 'portfolio', 'swing', 'daily', 'long_term']

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

// GET — watchlist'i oku
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!VALID_SLUGS.includes(slug)) {
    return NextResponse.json({ error: 'Geçersiz slug' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('csp_watchlists')
    .select('tickers, types, notes')
    .eq('slug', slug)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    tickers: data?.tickers ?? [],
    types: data?.types ?? {},
    notes: data?.notes ?? {},
  })
}

// POST — watchlist'i kaydet (upsert)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  if (!VALID_SLUGS.includes(slug)) {
    return NextResponse.json({ error: 'Geçersiz slug' }, { status: 400 })
  }

  let body: { tickers?: string[]; types?: Record<string, string>; notes?: Record<string, string> }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const supabase = getAdminClient()
  const { error } = await supabase
    .from('csp_watchlists')
    .upsert(
      {
        slug,
        tickers: body.tickers ?? [],
        types: body.types ?? {},
        notes: body.notes ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'slug' }
    )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
