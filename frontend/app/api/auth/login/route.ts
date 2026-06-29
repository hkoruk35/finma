import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Brute-force koruması: basit in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  entry.count++
  return entry.count > MAX_ATTEMPTS
}

function clearAttempts(ip: string) {
  attempts.delete(ip)
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Çok fazla yanlış giriş denemesi. 15 dakika bekleyin.' },
      { status: 429 }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-posta / kullanıcı adı ve şifre gerekli.' },
      { status: 400 }
    )
  }

  const { data: user } = await supabaseAdmin
    .from('admins')
    .select('email, password_hash, role')
    .eq('email', email.toLowerCase())
    .single()

  // Kullanıcı bulunamazsa da bcrypt çalıştır (timing attack önleme)
  const hashToCheck =
    user?.password_hash ?? '$2b$12$invalidhashfortimingatttackprevention000000000000000'
  const valid = await bcrypt.compare(password, hashToCheck)

  if (!user || !valid) {
    return NextResponse.json(
      { error: 'Geçersiz kullanıcı adı veya şifre.' },
      { status: 401 }
    )
  }

  clearAttempts(ip)

  const res = NextResponse.json({ ok: true, role: user.role })
  res.cookies.set('boga_auth', user.role, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 saat
    path: '/',
  })
  return res
}
