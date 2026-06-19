import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

type UserRole = 'admin' | 'readonly'

function getUsers(): { email: string; hash: string; role: UserRole }[] {
  return ([
    {
      email: process.env.AUTH_USER1_EMAIL ?? '',
      hash:  process.env.AUTH_USER1_HASH  ?? '',
      role:  'admin' as UserRole,
    },
    {
      email: process.env.AUTH_USER2_EMAIL ?? '',
      hash:  process.env.AUTH_USER2_HASH  ?? '',
      role:  'admin' as UserRole,
    },
    {
      email: process.env.AUTH_USER3_EMAIL ?? '',
      hash:  process.env.AUTH_USER3_HASH  ?? '',
      role:  'readonly' as UserRole,
    },
  ] as { email: string; hash: string; role: UserRole }[]).filter((u) => u.email && u.hash)
}

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

  const users = getUsers()
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase()
  )

  // Kullanıcı bulunamazsa da bcrypt çalıştır (timing attack önleme)
  const hashToCheck =
    user?.hash ?? '$2b$12$invalidhashfortimingatttackprevention000000000000000'
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
