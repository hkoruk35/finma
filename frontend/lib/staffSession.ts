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
  if (isRevokedEngineToken(value)) return null; // engellenen hesap (aşağıya bakın)
  return role;
}

/** İstekteki `boga_auth` çerezinden doğrulanmış rol (route handler'lar ve proxy.ts için). */
export function getStaffRole(req: Pick<NextRequest, "cookies">): StaffRole | null {
  return readStaffRole(req.cookies.get(STAFF_COOKIE)?.value);
}

/* ─── Engellenen yönetim hesapları (2026-11-10, kullanıcı talebi: şüpheli girişler) ─────────────────
 * - Giriş: app/api/auth/login bu e-postalara oturum açmaz, STAFF_BLOCKED_MESSAGE ile 403 döner.
 * - Açık oturumlar: çerez e-posta taşımadığı için, engellenen tek hesabın rolü olan "engine" için
 *   ENGINE_SESSIONS_NOT_BEFORE'dan önce imzalanmış tüm çerezler geçersiz sayılır (readStaffRole null döner).
 * - proxy.ts: engellenen oturumla /admin/** açılırsa çerezler silinir, giriş sayfası mesajı gösterir.
 * Engeli kaldırmak: e-postayı listeden çıkar (eski çerezler yine de geçersiz kalır → yeniden giriş). */
export const BLOCKED_STAFF_EMAILS: readonly string[] = ["afk2351@outlook.com"];
export const STAFF_BLOCKED_MESSAGE = "Şüpheli girişler nedeniyle erişiminiz engellendi.";
export const STAFF_USER_COOKIE = "boga_user";

/** Bu andan önce imzalanmış "engine" oturumları reddedilir (unix sn). */
const ENGINE_SESSIONS_NOT_BEFORE = Math.floor(Date.parse("2026-11-12T00:00:00Z") / 1000);

export function isBlockedStaffEmail(email: string | null | undefined): boolean {
  return !!email && BLOCKED_STAFF_EMAILS.includes(email.trim().toLowerCase());
}

/** İmzası geçerli ama iptal edilmiş eski bir "engine" oturumu mu? (imza kontrolünü readStaffRole yapar) */
function isRevokedEngineToken(value: string | null | undefined): boolean {
  if (!value) return false;
  const parts = value.split(".");
  if (parts.length !== 4 || parts[0] !== VERSION || parts[1] !== "engine") return false;
  const issuedAt = Number(parts[2]) - STAFF_SESSION_MAX_AGE_SECONDS;
  return issuedAt < ENGINE_SESSIONS_NOT_BEFORE;
}

/** proxy.ts: istek engellenen bir hesaba mı ait? (boga_user e-postası ya da iptal edilmiş engine çerezi) */
export function isBlockedStaffRequest(req: Pick<NextRequest, "cookies">): boolean {
  if (isBlockedStaffEmail(req.cookies.get(STAFF_USER_COOKIE)?.value)) return true;
  return isRevokedEngineToken(req.cookies.get(STAFF_COOKIE)?.value);
}
