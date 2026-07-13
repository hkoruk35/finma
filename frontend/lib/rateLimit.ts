import { NextRequest } from "next/server";

/**
 * In-memory IP rate limiter — app/api/auth/login/route.ts'deki deseni paylaşır.
 * Not: Vercel serverless'ta her instance kendi hafızasını tutar, bu yüzden bu
 * limit "kesin" değil, sadece basit/tekil kaynaklı kötüye kullanımı yavaşlatan
 * bir ilk savunma katmanıdır. Dağıtık/garanti bir limit için Upstash Redis gibi
 * paylaşımlı bir store'a taşınması önerilir (bkz. GUVENLIK_IZLEME.md).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(key: string, maxAttempts: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  entry.count++;
  return entry.count > maxAttempts;
}

export function getClientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
