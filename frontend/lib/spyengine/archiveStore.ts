/**
 * SPY Engine V2 — sinyal arşivinin depolama katmanı (SADECE SUNUCU).
 *
 * Motor deterministik olduğu için (aynı mumlar → aynı sinyaller) arşiv
 * "kaynak" değil KALICI KOPYA'dır: Yahoo'nun 1m geçmişi düştükten sonra da
 * o günün sinyalleri ve GERÇEK prim sonuçları okunabilsin diye tutulur.
 *
 * Depolama: Supabase `shared_store` KV (bkz. docs/DATA_CONTRACTS.md) — ayrı
 * migration gerektirmez. Seans başına tek kayıt; aynı gün tekrar yazılırsa
 * üzerine yazılır, bu yüzden tekrar tekrar çağırmak zararsızdır (idempotent).
 */

import "server-only";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  ARCHIVE_STORE_KEY, ARCHIVE_MAX_SESSIONS, buildArchiveSession,
  type ArchivePayload, type ArchiveSession, type ArchivedTrade,
} from "./archiveTypes";

export async function readArchive(): Promise<ArchivePayload> {
  try {
    const { data } = await supabaseAdmin
      .from("shared_store")
      .select("value")
      .eq("key", ARCHIVE_STORE_KEY)
      .maybeSingle();
    const value = data?.value as ArchivePayload | undefined;
    if (value && typeof value === "object" && value.sessions) return value;
  } catch {
    // Supabase erişilemiyorsa boş arşiv dön — sayfa yine de çalışsın.
  }
  return { sessions: {} };
}

async function persist(sessions: Record<string, ArchiveSession>): Promise<void> {
  // Sadece en yeni ARCHIVE_MAX_SESSIONS seansı sakla
  const keys = Object.keys(sessions).sort().reverse().slice(0, ARCHIVE_MAX_SESSIONS);
  const trimmed: Record<string, ArchiveSession> = {};
  for (const k of keys) trimmed[k] = sessions[k];

  const { error } = await supabaseAdmin
    .from("shared_store")
    .upsert(
      { key: ARCHIVE_STORE_KEY, value: { sessions: trimmed }, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    );
  if (error) throw new Error(error.message);
}

/** Tek seansı yazar (oku → değiştir → yaz) */
export async function writeSession(date: string, trades: ArchivedTrade[]): Promise<void> {
  const archive = await readArchive();
  archive.sessions[date] = buildArchiveSession(date, trades);
  await persist(archive.sessions);
}

/**
 * Birden çok seansı TEK okuma-yazma turunda yazar.
 * Geri doldurma her seans için ayrı upsert yapsaydı, aradaki bir hata
 * arşivi yarım bırakırdı; burada ya hepsi yazılır ya hiçbiri.
 */
export async function writeSessions(batch: { date: string; trades: ArchivedTrade[] }[]): Promise<void> {
  if (!batch.length) return;
  const archive = await readArchive();
  for (const { date, trades } of batch) {
    archive.sessions[date] = buildArchiveSession(date, trades);
  }
  await persist(archive.sessions);
}
