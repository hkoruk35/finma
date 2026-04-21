/**
 * Server-only JSON loader for BOGA AI bot data.
 *
 * This file is imported dynamically from lib/data.ts so that `fs` and
 * `path` never end up in the client bundle. Do NOT import this file
 * from client components.
 */

import fs from "fs";
import path from "path";

function sanitizeNaN(raw: string): string {
  return raw
    .replace(/:\s*NaN/g, ": null")
    .replace(/:\s*Infinity/g, ": null")
    .replace(/:\s*-Infinity/g, ": null");
}

/**
 * Read a JSON file from disk (server-side only).
 * Tries multiple candidate paths so the same code works in:
 *   - Local dev (frontend/ inside the worktree) → ../../../../transfer/latest
 *   - Vercel build/runtime → <cwd>/public/data/latest (copied by deploy.yml)
 *   - Custom override → FINMA_DATA_PATH env var
 */
export function readJson(relPath: string, date?: string): any | null {
  const candidates: string[] = [];

  const folder = date ? date : "latest";

  if (process.env.FINMA_DATA_PATH) {
    candidates.push(process.env.FINMA_DATA_PATH);
  }

  // Vercel/production: public/data/latest is committed to the repo and copied at build time
  // __dirname resolves reliably regardless of where Next.js sets process.cwd()
  const dirBase = path.resolve(__dirname, "..", "..", "..", "..");
  candidates.push(path.join(dirBase, "public", "data", folder));
  candidates.push(path.join(dirBase, "..", "public", "data", folder));

  // process.cwd() based (works in most Next.js setups)
  candidates.push(path.resolve(process.cwd(), "public", "data", folder));
  candidates.push(path.resolve(process.cwd(), ".next", "server", "..", "..", "public", "data", folder));

  // Local dev paths (worktree)
  candidates.push(path.resolve(process.cwd(), "..", "transfer", folder));
  candidates.push(path.resolve(process.cwd(), "..", "..", "transfer", folder));
  candidates.push(path.resolve(process.cwd(), "..", "data", folder));

  for (const base of candidates) {
    try {
      const fullPath = path.join(base, relPath);
      if (fs.existsSync(fullPath)) {
        const raw = sanitizeNaN(fs.readFileSync(fullPath, "utf-8"));
        return JSON.parse(raw);
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

export function listOptionsDates(): string[] {
  const candidates: string[] = [];
  const dirBase = path.resolve(__dirname, "..", "..", "..", "..");
  candidates.push(path.join(dirBase, "public", "data"));
  candidates.push(path.resolve(process.cwd(), "public", "data"));
  candidates.push(path.resolve(process.cwd(), "..", "data"));
  candidates.push(path.resolve(process.cwd(), "..", "..", "data"));

  for (const base of candidates) {
    try {
      if (!fs.existsSync(base)) continue;
      const dirs = fs.readdirSync(base).filter((d) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
        return fs.existsSync(path.join(base, d, "options_picks.json"));
      });
      if (dirs.length > 0) return dirs.sort().reverse();
    } catch {}
  }
  return [];
}

export function readPublicJson(filename: string): any | null {
  try {
    const fullPath = path.join(process.cwd(), "public", filename);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(sanitizeNaN(fs.readFileSync(fullPath, "utf-8")));
    }
  } catch {}
  return null;
}
