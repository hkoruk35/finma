/**
 * SPY Engine V4 — kapanış tahmini kaydı ve İSABET TAKİBİ (spec §4).
 *
 * NEDEN: tahminin "güven %60" demesi, o bandın gerçekten %60 isabet etmesi
 * anlamına gelmiyor — bu yalnızca 20 seanslık kalibrasyonun vaadi. Sistemin
 * kendini kalibre edebilmesi için ÜRETİLEN tahminler saklanmalı ve seans
 * kapandığında gerçek kapanışla karşılaştırılmalı. Panelde "güven %60"un
 * yanında "gerçekleşen isabet %X" bu yüzden ayrı gösteriliyor.
 *
 * Depolama: Supabase `shared_store` KV, anahtar `spyengine_v4_forecasts`
 * (bkz. docs/DATA_CONTRACTS.md). Seans başına tek kayıt; anlık görüntüler
 * 5 dakikalık kovalara yuvarlanır, böylece 1 sn'lik yoklama kaydı şişirmez.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında (bkz. frontend/AGENTS.md §3).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffAuthed, isStaffWriteAuthed } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STORE_KEY = "spyengine_v4_forecasts";
const MAX_SESSIONS = 60;
/** Anlık görüntü kovası — spec "her 5 dakikada bir güncellenmeli" diyor */
const BUCKET_SEC = 5 * 60;

interface Snapshot {
  /** 5 dakikalık kovaya yuvarlanmış üretim anı */
  at: number;
  remainingMin: number;
  low: number;
  high: number;
  mid: number;
}

interface ForecastSession {
  date: string;
  updatedAt: string;
  snapshots: Snapshot[];
  /** Seans kapandıktan sonra doldurulur */
  actualClose: number | null;
}

interface Payload {
  sessions: Record<string, ForecastSession>;
}

async function readStore(): Promise<Payload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store").select("value").eq("key", STORE_KEY).maybeSingle();
    const v = data?.value as Payload | undefined;
    if (v && typeof v === "object" && v.sessions) return v;
  } catch {
    // Supabase erişilemiyorsa boş dön — panel yine çalışsın.
  }
  return { sessions: {} };
}

/** Bir seansın isabeti: bandın içinde kapanan anlık görüntü sayısı */
function scoreOf(s: ForecastSession): { checked: number; hit: number } {
  if (s.actualClose == null) return { checked: 0, hit: 0 };
  const hit = s.snapshots.filter((x) => s.actualClose! >= x.low && s.actualClose! <= x.high).length;
  return { checked: s.snapshots.length, hit };
}

export async function GET(req: NextRequest) {
  if (!isStaffAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }
  const store = await readStore();
  let checked = 0, hit = 0;
  const sessions = Object.values(store.sessions)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((s) => {
      const sc = scoreOf(s);
      checked += sc.checked;
      hit += sc.hit;
      return {
        date: s.date,
        snapshots: s.snapshots.length,
        actualClose: s.actualClose,
        checked: sc.checked,
        hit: sc.hit,
      };
    });

  return NextResponse.json(
    { ok: true, checked, hit, sessions },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  let body: {
    date?: string;
    snapshot?: { at: number; remainingMin: number; low: number; high: number; mid: number };
    actualClose?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Geçersiz istek" }, { status: 400 });
  }

  const date = body.date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, error: "date (YYYY-MM-DD) gerekli" }, { status: 400 });
  }

  const store = await readStore();
  const rec: ForecastSession = store.sessions[date] ?? {
    date, updatedAt: new Date().toISOString(), snapshots: [], actualClose: null,
  };

  if (body.snapshot && Number.isFinite(body.snapshot.low) && Number.isFinite(body.snapshot.high)) {
    const at = Math.floor(body.snapshot.at / BUCKET_SEC) * BUCKET_SEC;
    // Aynı kovaya ikinci kez yazma — 1 sn'lik yoklama kaydı şişirmesin
    if (!rec.snapshots.some((s) => s.at === at)) {
      rec.snapshots.push({
        at,
        remainingMin: body.snapshot.remainingMin,
        low: body.snapshot.low,
        high: body.snapshot.high,
        mid: body.snapshot.mid,
      });
      rec.snapshots.sort((a, b) => a.at - b.at);
    }
  }

  // Gerçek kapanış yalnızca BİR KEZ yazılır — sonradan değişmez
  if (rec.actualClose == null && Number.isFinite(body.actualClose)) {
    rec.actualClose = body.actualClose!;
  }

  rec.updatedAt = new Date().toISOString();
  store.sessions[date] = rec;

  const keys = Object.keys(store.sessions).sort().reverse().slice(0, MAX_SESSIONS);
  const trimmed: Record<string, ForecastSession> = {};
  for (const k of keys) trimmed[k] = store.sessions[k];

  try {
    const { error } = await supabaseAdmin
      .from("shared_store")
      .upsert(
        { key: STORE_KEY, value: { sessions: trimmed }, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Tahmin kaydedilemedi: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  const sc = scoreOf(rec);
  return NextResponse.json({ ok: true, date, snapshots: rec.snapshots.length, ...sc });
}
