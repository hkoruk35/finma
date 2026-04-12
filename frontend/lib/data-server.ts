/**
 * Server-only JSON loader for BOGA bot data.
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
  
  // If date is provided, target the archive folder for that date
  const folder = date ? date : "latest";

  if (process.env.FINMA_DATA_PATH) {
    candidates.push(process.env.FINMA_DATA_PATH);
  }
  
  // Local dev paths
  candidates.push(path.resolve(process.cwd(), "..", "transfer", folder));
  candidates.push(path.resolve(process.cwd(), "..", "..", "transfer", folder));
  // Vercel/production paths (archives are also in data/YYYY-MM-DD)
  candidates.push(path.resolve(process.cwd(), "public", "data", folder));
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

export function readPublicJson(filename: string): any | null {
  try {
    const fullPath = path.join(process.cwd(), "public", filename);
    if (fs.existsSync(fullPath)) {
      return JSON.parse(sanitizeNaN(fs.readFileSync(fullPath, "utf-8")));
    }
  } catch {}
  return null;
}
