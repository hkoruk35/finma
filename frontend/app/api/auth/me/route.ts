import { NextRequest, NextResponse } from 'next/server'
import { getStaffRole } from '@/lib/staffSession'

export async function GET(req: NextRequest) {
  // İmzası doğrulanmış rol (lib/staffSession.ts); düz/eski/sahte çerez → null
  const role = getStaffRole(req)
  if (!role) return NextResponse.json({ role: null })
  // hangi yönetici (Copilot karşılaması için; yetki kararı boga_auth'tan)
  const email = req.cookies.get('boga_user')?.value ?? null
  return NextResponse.json({ role, email })
}
