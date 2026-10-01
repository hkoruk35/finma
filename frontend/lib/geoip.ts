/**
 * Offline IP → country lookup (DB-IP "IP to Country Lite", CC BY 4.0, https://db-ip.com).
 *
 * Why: the country used to come only from CDN request headers
 * (x-vercel-ip-country / cf-ipcountry). After the move to the self-hosted
 * Hetzner box those headers no longer exist, so ~93% of sessions were stored
 * as "Unknown". This reads the free .mmdb database from disk — no network call,
 * the visitor IP never leaves the server.
 *
 * Fail-safe by design: missing file / bad IP / any error → null (callers keep
 * "Unknown"). A failed open is retried at most every 5 minutes.
 */

import maxmind, { type CountryResponse, type Reader } from "maxmind";

const DB_PATH = process.env.GEOIP_DB_PATH || "/root/finma/geo/dbip-country-lite.mmdb";
const RETRY_MS = 5 * 60_000;

let reader: Reader<CountryResponse> | null = null;
let opening: Promise<Reader<CountryResponse> | null> | null = null;
let lastFailAt = 0;

async function getReader(): Promise<Reader<CountryResponse> | null> {
  if (reader) return reader;
  if (opening) return opening;
  if (Date.now() - lastFailAt < RETRY_MS) return null;
  opening = maxmind
    .open<CountryResponse>(DB_PATH)
    .then((r) => {
      reader = r;
      return r;
    })
    .catch(() => {
      lastFailAt = Date.now();
      return null;
    })
    .finally(() => {
      opening = null;
    });
  return opening;
}

/** ISO-3166 alpha-2 country code for an IPv4/IPv6 address, or null if unknown. */
export async function lookupCountry(ip: string | null | undefined): Promise<string | null> {
  if (!ip || ip === "Unknown") return null;
  try {
    const r = await getReader();
    if (!r || !maxmind.validate(ip)) return null;
    const code = r.get(ip)?.country?.iso_code;
    return code && /^[A-Z]{2}$/.test(code) ? code : null;
  } catch {
    return null;
  }
}
