import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('boga_auth')?.value
  if (!cookie) return NextResponse.json({ role: null })
  const role = cookie === 'readonly' ? 'readonly' : cookie === 'engine' ? 'engine' : 'admin'
  // hangi yönetici (Copilot karşılaması için; yetki kararı boga_auth'tan)
  const email = req.cookies.get('boga_user')?.value ?? null
  return NextResponse.json({ role, email })
}
