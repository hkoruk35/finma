#!/usr/bin/env node
/**
 * One-off / repeatable backfill: fill traffic_sessions.country for rows stored as
 * "Unknown" (or NULL) by looking the recorded IP up in the offline DB-IP database.
 *
 *   node scripts/backfill-traffic-country.mjs            # dry run (default): counts only
 *   node scripts/backfill-traffic-country.mjs --apply    # write
 *
 * Safety:
 *  - only rows with country = 'Unknown' / NULL are touched; real values are never overwritten
 *  - only the `country` column is written (the IP stays where it is, nothing is sent anywhere)
 *  - IPs that the database cannot resolve stay "Unknown"
 * Env (server): NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY, GEOIP_DB_PATH (optional).
 */
import maxmind from "maxmind";

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const dbPath = process.env.GEOIP_DB_PATH || "/root/finma/geo/dbip-country-lite.mmdb";
if (!url || !key) throw new Error("Supabase env missing");

const H = { apikey: key, Authorization: `Bearer ${key}` };
const PAGE = 1000;
const CHUNK = 40;

const reader = await maxmind.open(dbPath);

async function getJson(path) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers: H });
    if (res.ok) return res.json();
    await new Promise((r) => setTimeout(r, 500 * 2 ** i));
  }
  throw new Error(`GET failed: ${path}`);
}

// 1) unique IPs of Unknown/NULL sessions (keyset pagination on session_id would need an index; offset is fine for a one-off)
const filter = "or=(country.eq.Unknown,country.is.null)&ip=not.is.null&ip=neq.Unknown";
const ips = new Map(); // ip -> sessions
let offset = 0;
for (;;) {
  const rows = await getJson(`traffic_sessions?select=ip&${filter}&order=session_id.asc&offset=${offset}&limit=${PAGE}`);
  for (const r of rows) ips.set(r.ip, (ips.get(r.ip) ?? 0) + 1);
  if (rows.length < PAGE) break;
  offset += PAGE;
  if (offset % 20000 === 0) console.log("scanned", offset, "rows,", ips.size, "unique ips");
}
console.log("unknown-country sessions:", [...ips.values()].reduce((a, b) => a + b, 0), "· unique IPs:", ips.size);

// 2) resolve
const byCountry = new Map(); // CC -> ips[]
let unresolved = 0, unresolvedSessions = 0;
for (const [ip, n] of ips) {
  let cc = null;
  try {
    cc = maxmind.validate(ip) ? reader.get(ip)?.country?.iso_code ?? null : null;
  } catch {
    cc = null;
  }
  if (!cc) {
    unresolved++;
    unresolvedSessions += n;
    continue;
  }
  (byCountry.get(cc) ?? byCountry.set(cc, []).get(cc)).push(ip);
}
const resolvedSessions = [...byCountry.values()].flat().reduce((a, ip) => a + ips.get(ip), 0);
console.log(`resolvable: ${resolvedSessions} sessions in ${byCountry.size} countries · unresolved: ${unresolvedSessions} sessions (${unresolved} IPs)`);
console.log("top:", [...byCountry.entries()].map(([c, l]) => [c, l.reduce((a, ip) => a + ips.get(ip), 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10).map((x) => x.join(":")).join(" "));

if (!APPLY) {
  console.log("DRY RUN — nothing written. Re-run with --apply to update.");
  process.exit(0);
}

// 3) write, grouped by country, only rows still Unknown/NULL
let written = 0;
for (const [cc, list] of byCountry) {
  for (let i = 0; i < list.length; i += CHUNK) {
    const chunk = list.slice(i, i + CHUNK);
    const inList = chunk.map((ip) => `"${ip}"`).join(",");
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch(`${url}/rest/v1/traffic_sessions?ip=in.(${encodeURIComponent(inList)})&or=(country.eq.Unknown,country.is.null)`, {
        method: "PATCH",
        headers: { ...H, "Content-Type": "application/json", Prefer: "return=headers-only,count=exact" },
        body: JSON.stringify({ country: cc }),
      });
      if (res.ok) {
        const range = res.headers.get("content-range") ?? "";
        written += Number(range.split("/")[1]) || 0;
        break;
      }
      if (attempt === 3) throw new Error(`PATCH failed for ${cc}: HTTP ${res.status} ${await res.text()}`);
      await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
    }
  }
  console.log("updated", cc, "→ total so far", written);
}
console.log("DONE. rows updated:", written);
