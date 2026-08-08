import { NextRequest, NextFetchEvent } from 'next/server';
import { proxy, config } from './proxy';

export async function middleware(request: NextRequest, event: NextFetchEvent) {
  return proxy(request, event);
}

export { config };
