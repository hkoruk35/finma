import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Kullanicilar yalnizca sunucu tarafinda, env vars'tan okunur.
// Kaynak kodda sifre yoktur.
function getUsers() {
  return [
    {
      email: process.env.AUTH_USER1_EMAIL ?? '',
      hash: process.env.AUTH_USER1_HASH ?? '',
    },
    {
      email: process.env.AUTH_USER2_EMAIL ?? '',
      hash: process.env.AUTH_USER2_HASH ?? '',
    },
  ].filter((u) => u.email && u.hash)
}

// Brute-force korumasi: basit in-memory rate limiter
const attempts = new Map<string, { count: number; resetAt: number }>()
const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000 // 15 dakika

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
      { error: 'Cok fazla yanlis giris denemesi. 15 dakika bekleyin.' },
      { status: 429 }
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Gecersiz istek.' }, { status: 400 })
  }

  const { email, password } = body
  if (!email || !password) {
    return NextResponse.json(
      { error: 'E-posta ve sifre gerekli.' },
      { status: 400 }
    )
  }

  const users = getUsers()
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )

  // Kullanici bulunamadiysa da bcrypt calistir (timing attack onleme)
  const hashToCheck =
    user?.hash ?? '$2b$12$invalidhashfortimingatttackprevention000000000000000'
  const valid = await bcrypt.compare(password, hashToCheck)

  if (!user || !valid) {
    return NextResponse.json(
      { error: 'Gecersiz kullanici adi veya sifre.' },
      { status: 401 }
    )
  }

  clearAttempts(ip)

  // Basarili giris
  const res = NextResponse.json({ ok: true })
  res.cookies.set('boga_auth', 'true', {
    httpOnly: true,        // JS erisemez
    secure: true,          // Sadece HTTPS
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 saat
    path: '/',
  })
  return res
}
