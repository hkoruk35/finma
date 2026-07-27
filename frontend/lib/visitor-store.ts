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

const MAX_VISITORS = 200;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

let visitors = new Map<string, VisitorSession>();
let visitorsArray: VisitorSession[] = [];

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

  // Keep only last MAX_VISITORS
  if (visitorsArray.length > MAX_VISITORS) {
    const removed = visitorsArray.pop();
    if (removed) {
      visitors.delete(removed.id);
    }
  }

  cleanup();
  return session;
}

export function getVisitors(): VisitorSession[] {
  cleanup();
  return visitorsArray.map((v) => ({
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
}
