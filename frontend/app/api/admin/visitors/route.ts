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

  const timeframe = req.nextUrl.searchParams.get('timeframe') || 'all';

  let hoursAgo: number | undefined;
  if (timeframe === '24h') hoursAgo = 24;
  else if (timeframe === '7d') hoursAgo = 7 * 24;
  else if (timeframe === '30d') hoursAgo = 30 * 24;

  const visitors = await getVisitors(hoursAgo);

  const formatted = visitors.map((v) => {
    // Duration: from tracking time (sessionStart) to now
    // Both timestamp and sessionStart should be in milliseconds
    const durationMs = Math.max(0, Date.now() - v.sessionStart);
    const durationSeconds = Math.round(durationMs / 1000);

    return {
      id: v.id,
      ip: v.ip,
      country: v.country,
      city: v.city,
      page: v.page,
      timestamp: v.timestamp,
      userAgent: v.userAgent,
      duration: durationSeconds,
    };
  });

  return NextResponse.json({ visitors: formatted, timeframe });
}
