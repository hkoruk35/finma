import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // /global/* sayfaları tamamen açık — hiçbir auth kontrolü yok
  if (request.nextUrl.pathname.startsWith('/global')) {
    return NextResponse.next();
  }

  // Başka sayfalar için default davranış
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
};
