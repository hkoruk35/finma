import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import exchangeMap from './public/exchange_map.json';

const tickers = Object.keys(exchangeMap.exchanges).map(t => t.toLowerCase());

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const host = request.headers.get('host') || '';
  if (host.startsWith('www.')) {
    const newHost = host.replace('www.', '');
    const newUrl = new URL(request.url);
    newUrl.host = newHost;
    return NextResponse.redirect(newUrl, 308);
  }

  if (pathname.startsWith('/sector/')) {
    return new NextResponse('410 Gone', { status: 410 });
  }

  if (pathname.startsWith('/stock/')) {
    const parts = pathname.split('/');
    const rawTicker = parts[2];
    if (rawTicker) {
      const ticker = rawTicker.toLowerCase();
      if (tickers.includes(ticker)) {
        return NextResponse.redirect(new URL(`/en/analysis/${ticker}`, request.url), 308);
      } else {
        return new NextResponse('410 Gone', { status: 410 });
      }
    }
  }

  const deadPaths = ['/academy', '/old-terminal', '/old-tracker', '/picks', '/tracker', '/swing', '/option', '/themes', '/screener', '/archive'];
  if (deadPaths.some(p => pathname.startsWith(p + '/') || pathname === p)) {
    return new NextResponse('410 Gone', { status: 410 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};