/**
 * SPY Engine V2 — arşiv geri doldurma.
 *
 * SORUN: arşiv yalnızca sayfa AÇIKKEN besleniyordu (SignalsArchive, kapanan
 * işlem sayısı değiştikçe POST atar). Sayfanın açık olmadığı seanslar hiç
 * kaydedilmiyor, o günlerin GERÇEK 0DTE prim sonuçları da Yahoo penceresi
 * kayınca tamamen kayboluyordu.
 *
 * ÇÖZÜM: bu uç nokta son N seansı sunucu tarafında yeniden oynatır ve
 * sonuçları arşive yazar. Motor deterministik olduğu için (aynı mumlar →
 * aynı sinyaller) yeniden oynatma, o gün canlı üretilenle aynı sonucu verir.
 *
 * PENCERE — ölçüldü, tahmin değil:
 *   · SPY 1m geçmişi: fetchSpyBundle `range=5d` kullanıyor → ~5 seans.
 *   · Süresi dolmuş 0DTE prim mumları: `range=5d` ile GELİYOR (`range=1d`
 *     ve `range=1mo` gelmiyor — 1mo, Yahoo'nun 8 günlük 1m sınırına takılır).
 *   Yani pratik tavan ~5 seans; bunun ötesi için veri yok, uydurulmaz.
 *
 * TASARIM NOTU: kendi v2 uç noktamıza HTTP ile gidiyoruz. Motor hattını
 * (bundle → aday → çıkış → prim → yaşam döngüsü) buraya kopyalamak ya da
 * canlı rotayı refactor etmek, çalışan tek üretim yolunu riske atardı;
 * kendine istek bir ağ sıçraması ekler ama canlı hatta HİÇ dokunmaz.
 *
 * Kimlik: /api/* proxy.ts matcher'ının dışında (bkz. frontend/AGENTS.md §3).
 */

import { NextRequest, NextResponse } from "next/server";
import { isStaffWriteAuthed } from "@/lib/apiAuth";
import { writeSessions } from "@/lib/spyengine/archiveStore";
import { toArchiveTrade, type ArchivedTrade } from "@/lib/spyengine/archiveTypes";
import { nyParts } from "@/lib/spyengine/core";
import type { PositionState } from "@/lib/spyengine/strategy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

/** Yahoo 1m penceresi ~5 seans taşıyor; üstünü istemek boş yere zaman yakar. */
const DEFAULT_DAYS = 5;
const MAX_DAYS = 10;

interface DayReport {
  date: string;
  ok: boolean;
  trades: number;
  withPremium: number;
  note: string;
}

/** Bugün HARİÇ, geriye doğru N ET iş günü (hafta sonu atlanır) */
function pastSessionDates(count: number): string[] {
  const out: string[] = [];
  const today = nyParts(Math.floor(Date.now() / 1000)).ymd;
  for (let back = 1; out.length < count && back <= count + 10; back++) {
    const p = nyParts(Math.floor(Date.now() / 1000) - back * 86400);
    if (p.weekday < 1 || p.weekday > 5) continue; // Pazar=0, Cumartesi=6
    if (p.ymd === today) continue;
    out.push(p.ymd);
  }
  return out;
}

export async function POST(req: NextRequest) {
  if (!isStaffWriteAuthed(req)) {
    return NextResponse.json({ ok: false, error: "Yetkisiz" }, { status: 401 });
  }

  const daysParam = Number(new URL(req.url).searchParams.get("days"));
  const days = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, MAX_DAYS) : DEFAULT_DAYS;

  const origin = req.nextUrl.origin;
  const cookie = req.headers.get("cookie") ?? "";
  const dates = pastSessionDates(days);

  const batch: { date: string; trades: ArchivedTrade[] }[] = [];
  const report: DayReport[] = [];

  for (const date of dates) {
    try {
      const res = await fetch(`${origin}/api/admin/spyengine/v2?date=${date}`, {
        headers: { cookie },
        cache: "no-store",
      });
      const json = (await res.json()) as {
        ok?: boolean; error?: string;
        positions?: PositionState[];
        bars?: { m1?: unknown[] };
      };

      if (!json.ok) {
        report.push({ date, ok: false, trades: 0, withPremium: 0, note: json.error || `HTTP ${res.status}` });
        continue;
      }
      if (!json.bars?.m1?.length) {
        report.push({ date, ok: false, trades: 0, withPremium: 0, note: "1m mum yok — Yahoo penceresinin dışında" });
        continue;
      }

      const positions = json.positions ?? [];
      const trades = positions.map(toArchiveTrade);
      const withPremium = trades.filter((t) => t.entryPremium != null).length;
      batch.push({ date, trades });
      report.push({
        date, ok: true, trades: trades.length, withPremium,
        note: trades.length === 0
          ? "sinyal üretilmedi"
          : withPremium === trades.length
          ? "tüm işlemlerde gerçek prim var"
          : `${trades.length - withPremium} işlemde prim verisi yok`,
      });
    } catch (e) {
      report.push({
        date, ok: false, trades: 0, withPremium: 0,
        note: e instanceof Error ? e.message : String(e),
      });
    }
  }

  try {
    await writeSessions(batch);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `Arşiv yazılamadı: ${e instanceof Error ? e.message : String(e)}`, report },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    written: batch.length,
    trades: batch.reduce((s, b) => s + b.trades.length, 0),
    withPremium: report.reduce((s, r) => s + r.withPremium, 0),
    report,
  });
}
