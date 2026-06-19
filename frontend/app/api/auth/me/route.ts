import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const cookie = req.cookies.get('boga_auth')?.value
  if (!cookie) return NextResponse.json({ role: null })
  const role = cookie === 'readonly' ? 'readonly' : 'admin'
  return NextResponse.json({ role })
}
