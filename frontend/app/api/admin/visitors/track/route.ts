import { NextRequest, NextResponse } from 'next/server';
import { addVisitor } from '@/lib/visitor-store';

// Track visitor pageviews

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get('page') || '/';

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
             req.headers.get('x-real-ip') ||
             'Unknown';

  const country = req.headers.get('x-vercel-ip-country') ||
                  req.headers.get('cf-ipcountry') ||
                  'Unknown';

  const city = req.headers.get('x-vercel-ip-city') || 'Unknown';

  const userAgent = req.headers.get('user-agent') || 'Unknown';

  // Fire and forget - don't wait for database
  addVisitor({
    ip: ip.trim(),
    country,
    city,
    page,
    userAgent,
  }).catch((err) => console.error('Visitor track error:', err));

  // Return 1x1 transparent GIF for analytics pixel approach
  const gif = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x01, 0x44, 0x00, 0x3b]);

  return new NextResponse(gif, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export async function POST(req: NextRequest) {
  let body: { page?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const page = body.page || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ||
             req.headers.get('x-real-ip') ||
             'Unknown';
  const country = req.headers.get('x-vercel-ip-country') ||
                  req.headers.get('cf-ipcountry') ||
                  'Unknown';
  const city = req.headers.get('x-vercel-ip-city') || 'Unknown';
  const userAgent = req.headers.get('user-agent') || 'Unknown';

  // Fire and forget
  addVisitor({
    ip: ip.trim(),
    country,
    city,
    page,
    userAgent,
  }).catch((err) => console.error('Visitor track error:', err));

  return NextResponse.json({ ok: true }, { status: 200 });
}
