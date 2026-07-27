import { NextRequest, NextResponse } from 'next/server';
import { getVisitors } from '@/lib/visitor-store';

function requireAdmin(req: NextRequest): boolean {
  const role = req.cookies.get('boga_auth')?.value;
  return role === 'admin' || role === 'readonly';
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const visitors = getVisitors();

  const formatted = visitors.map((v) => ({
    id: v.id,
    ip: v.ip,
    country: v.country,
    city: v.city,
    page: v.page,
    timestamp: v.timestamp,
    userAgent: v.userAgent,
    duration: Math.round((Date.now() - v.sessionStart) / 1000), // seconds
  }));

  return NextResponse.json({ visitors: formatted });
}
