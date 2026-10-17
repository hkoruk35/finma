/**
 * Yönetim (staff) oturum çerezi — `boga_auth` — imzalama ve doğrulama. TEK KAYNAK.
 *
 * 2026-10-17 güvenlik düzeltmesi: çerez eskiden düz rol metniydi ("admin" / "readonly" / "engine");
 * tarayıcıda `document.cookie = "boga_auth=admin"` yazan herkes /admin/** ve admin API'lerine giriyordu.
 * Artık değer: `v1.<rol>.<sonKullanma(unix sn)>.<HMAC-SHA256 base64url>`. Eski düz çerezler REDDEDİLİR
 * (→ yeniden giriş). Rol kararı yalnız readStaffRole()'dan gelir; çerez değerini asla doğrudan karşılaştırmayın.
 *
 * Sır: BOGA_AUTH_SECRET (≥32 karakter). Tanımlı değilse sunucuda zaten bulunan Supabase service-role
 * anahtarından etiketli HMAC ile türetilir (deploy sırasında oturumlar kırılmasın diye); ikisi de yoksa
 * imzalama/doğrulama başarısız olur (fail-closed). Sırrı değiştirmek tüm yönetim oturumlarını düşürür.
 *
 * proxy.ts (Next 16 proxy = Node runtime), route handler'lar ve server component'ler aynı fonksiyonu kullanır.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

export const STAFF_COOKIE = "boga_auth";
export const STAFF_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 saat

export const STAFF_ROLE_VALUES = ["admin", "readonly", "engine"] as const;
export type StaffRole = (typeof STAFF_ROLE_VALUES)[number];

const VERSION = "v1";

let cachedKey: Buffer | null | undefined;

function signingKey(): Buffer | null {
  if (cachedKey !== undefined) return cachedKey;
  const explicit = process.env.BOGA_AUTH_SECRET;
  if (explicit && explicit.length >= 32) {
    cachedKey = Buffer.from(explicit, "utf8");
  } else {
    const base = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    cachedKey = base ? createHmac("sha256", base).update("boga_auth/v1 signing key").digest() : null;
  }
  return cachedKey;
}

function mac(key: Buffer, payload: string): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

const isStaffRoleValue = (v: string): v is StaffRole => (STAFF_ROLE_VALUES as readonly string[]).includes(v);

/** Giriş başarılı olduğunda çereze yazılacak imzalı değer. Sır yoksa null (giriş reddedilmeli). */
export function signStaffSession(role: string, maxAgeSeconds = STAFF_SESSION_MAX_AGE_SECONDS): string | null {
  const key = signingKey();
  if (!key || !isStaffRoleValue(role)) return null;
  const exp = Math.floor(Date.now() / 1000) + maxAgeSeconds;
  const payload = `${VERSION}.${role}.${exp}`;
  return `${payload}.${mac(key, payload)}`;
}

/** Çerez değerini doğrular; geçerli ve süresi dolmamışsa rolü, aksi halde null döner. */
export function readStaffRole(value: string | null | undefined): StaffRole | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) return null;
  const [, role, expStr, sig] = parts;
  if (!isStaffRoleValue(role) || !/^\d{1,12}$/.test(expStr)) return null;
  if (Number(expStr) <= Math.floor(Date.now() / 1000)) return null;
  const key = signingKey();
  if (!key) return null;
  const expected = Buffer.from(mac(key, `${VERSION}.${role}.${expStr}`));
  const given = Buffer.from(sig);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return role;
}

/** İstekteki `boga_auth` çerezinden doğrulanmış rol (route handler'lar ve proxy.ts için). */
export function getStaffRole(req: Pick<NextRequest, "cookies">): StaffRole | null {
  return readStaffRole(req.cookies.get(STAFF_COOKIE)?.value);
}
