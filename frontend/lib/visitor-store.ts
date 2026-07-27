import { supabaseAdmin } from './supabase-admin';

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

interface VisitorRecord {
  id: string;
  ip: string;
  country: string;
  city: string;
  page: string;
  timestamp: number;
  user_agent: string;
  session_start: number;
  created_at: string;
}

const MAX_VISITORS_MEMORY = 200;
const SESSION_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes

let visitorsArray: VisitorSession[] = [];

export async function addVisitor(data: Omit<VisitorSession, 'id' | 'sessionStart' | 'timestamp'>): Promise<VisitorSession> {
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

  // Save to Supabase
  try {
    await supabaseAdmin.from('site_visitors').insert({
      id,
      ip: data.ip,
      country: data.country,
      city: data.city,
      page: data.page,
      timestamp: now,
      user_agent: data.userAgent,
      session_start: now,
    });
  } catch (err) {
    console.error('Failed to save visitor to Supabase:', err);
  }

  // Keep in-memory cache
  visitorsArray.unshift(session);
  if (visitorsArray.length > MAX_VISITORS_MEMORY) {
    visitorsArray.pop();
  }

  return session;
}

export async function getVisitors(hoursAgo?: number): Promise<VisitorSession[]> {
  try {
    let query = supabaseAdmin.from('site_visitors').select('*').order('timestamp', { ascending: false }).limit(200);

    if (hoursAgo) {
      const cutoff = Date.now() - hoursAgo * 60 * 60 * 1000;
      query = query.gte('timestamp', cutoff);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Failed to fetch visitors from Supabase:', error);
      return visitorsArray;
    }

    const sessions = (data as VisitorRecord[]).map((v) => ({
      id: v.id,
      ip: v.ip,
      country: v.country,
      city: v.city,
      page: v.page,
      timestamp: v.timestamp,
      userAgent: v.user_agent,
      sessionStart: v.session_start,
    }));

    visitorsArray = sessions;
    return sessions;
  } catch (err) {
    console.error('Error in getVisitors:', err);
    return visitorsArray;
  }
}

export function getVisitorCount(): number {
  return visitorsArray.length;
}

export async function clearAll(): Promise<void> {
  try {
    await supabaseAdmin.from('site_visitors').delete().gt('timestamp', 0);
  } catch (err) {
    console.error('Failed to clear visitors:', err);
  }
  visitorsArray = [];
}
