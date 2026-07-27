import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface VisitorSession {
  id: string;
  ip: string;
  country: string;
  city: string;
  page: string;
  timestamp: number;
  userAgent: string;
  sessionStart: number;
}

const MAX_VISITORS_MEMORY = 200;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const STORAGE_PATH = process.env.NODE_ENV === 'production' ? '/tmp' : process.cwd();
const VISITORS_FILE = join(STORAGE_PATH, '.visitors-data.json');

let visitors = new Map<string, VisitorSession>();
let visitorsArray: VisitorSession[] = [];

function loadFromDisk(): void {
  try {
    if (existsSync(VISITORS_FILE)) {
      const data = readFileSync(VISITORS_FILE, 'utf-8');
      const loaded = JSON.parse(data) as VisitorSession[];
      visitorsArray = loaded;
      loaded.forEach((v) => visitors.set(v.id, v));
    }
  } catch {
    // Silently fail - start fresh
  }
}

function saveToDisk(): void {
  try {
    writeFileSync(VISITORS_FILE, JSON.stringify(visitorsArray), 'utf-8');
  } catch {
    // Silently fail
  }
}

// Load on module init
if (typeof global !== 'undefined' && !(globalThis as any).visitorsLoaded) {
  loadFromDisk();
  (globalThis as any).visitorsLoaded = true;
}

export function addVisitor(data: Omit<VisitorSession, 'id' | 'sessionStart' | 'timestamp'>): VisitorSession {
  const id = `${data.ip}-${Date.now()}`;
  const now = Date.now();

  const session: VisitorSession = {
    id,
    ip: data.ip,
    country: data.country,
    city: data.city,
    page: data.page,
    timestamp: now,
    userAgent: data.userAgent,
    sessionStart: now,
  };

  visitors.set(id, session);
  visitorsArray.unshift(session);

  // Keep only last MAX_VISITORS_MEMORY in memory
  if (visitorsArray.length > MAX_VISITORS_MEMORY) {
    const removed = visitorsArray.pop();
    if (removed) {
      visitors.delete(removed.id);
    }
  }

  cleanup();
  saveToDisk();
  return session;
}

export function getVisitors(hoursAgo?: number): VisitorSession[] {
  cleanup();
  let result = visitorsArray;

  if (hoursAgo) {
    const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000;
    result = visitorsArray.filter((v) => v.timestamp >= cutoff);
  }

  return result.map((v) => ({
    ...v,
    timestamp: v.timestamp,
  }));
}

export function updateDuration(visitorId: string): void {
  const visitor = visitors.get(visitorId);
  if (visitor) {
    visitor.timestamp = Date.now();
  }
}

function cleanup(): void {
  const now = Date.now();
  const expired: string[] = [];

  visitors.forEach((visitor, id) => {
    if (now - visitor.timestamp > SESSION_TIMEOUT_MS) {
      expired.push(id);
      visitors.delete(id);
    }
  });

  if (expired.length > 0) {
    visitorsArray = visitorsArray.filter((v) => !expired.includes(v.id));
  }
}

export function getVisitorCount(): number {
  cleanup();
  return visitorsArray.length;
}

export function clearAll(): void {
  visitors.clear();
  visitorsArray = [];
  saveToDisk();
}
