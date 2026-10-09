"use client";

/**
 * SPY Engine V9.0 — sayfa panelleri.
 * Ticker şeridi, bilgi kartları, giriş uyarısı, kapı durumu ve pozisyon kutusu.
 *
 * Ortak kural: bir değer null ise "—" veya "veri yok" yazılır; hiçbir
 * kartta tahmini/son-bilinen değer gerçek veri gibi gösterilmez.
 */

import { useState, useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { nyClock, type SessionPhase } from "@/lib/spyengine/core";
import {
  CONTRACT_RULES, CONTRACT_TONE, EXIT_STOP_PCT,
  type PositionState, type EngineState, type GateStatus,
  type GateCheck, type Side, type RegimeSide, type RegimeState,
  type M15VetoRead, type VolumeVetoRead, type Layer1Read,
} from "@/lib/spyengine/strategy";
import type { ReversalState } from "@/lib/spyengine/reversal";

/** Rejim (5m Layer1+2) etiket ve rengi — eski TREND/SIKIŞMA/BELİRSİZ yerine */
export const REGIME_LABEL: Record<RegimeSide, string> = {
  LONG: "LONG REJİMİ",
  SHORT: "SHORT REJİMİ",
  NONE: "REJİM YOK",
};

export function regimeColor(side: RegimeSide): string {
  if (side === "LONG") return "#22c55e";
  if (side === "SHORT") return "#ef4444";
  return "#64748b";
}

// ── Ortak küçük parçalar ──────────────────────────────────────────

export const SURFACE = "bg-[#0f141d] border border-[#1c2635] rounded-lg";

export function num(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toLocaleString("tr-TR", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function signed(v: number | null | undefined, d = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${num(v, d)}`;
}

export function tone(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "text-slate-500";
  if (v > 0) return "text-[#22c55e]";
  if (v < 0) return "text-[#ef4444]";
  return "text-slate-400";
}

export function Panel({ title, right, children, className = "" }: {
  title: string; right?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={`${SURFACE} ${className}`}>
      <header className="flex items-center justify-between gap-2 border-b border-[#1c2635] px-3 py-2">
        <h2 className="text-[11px] font-semibold tracking-wide text-slate-300">{title}</h2>
        {right}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Açılır/kapanır bölüm — talimattaki "okunaklı açılır gizlenir" gereksinimi */
export function Disclosure({ title, badge, defaultOpen = false, children }: {
  title: string; badge?: ReactNode; defaultOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={SURFACE}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-[#141b26]"
      >
        <span className="flex items-center gap-2">
          <span className={`text-[10px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">{title}</span>
          {badge}
        </span>
        <span className="rounded-md border border-sky-500/60 bg-sky-500/15 px-3 py-1 text-[12px] font-bold text-sky-300">{open ? "▴ gizle" : "▾ göster"}</span>
      </button>
      {open && <div className="border-t border-[#1c2635] p-3">{children}</div>}
    </section>
  );
}

// ── Ticker şeridi ─────────────────────────────────────────────────

export interface StripQuote {
  label: string; symbol: string; name: string;
  price: number | null; prevClose: number | null;
  change: number | null; changePct: number | null;
  /** Son ~60 dakikaya göre yüzde değişim */
  changePctHour?: number | null;
  time: number | null; extended: boolean; error: string | null;
}

export function TickerStrip({ quotes, updatedAt }: { quotes: StripQuote[]; updatedAt: number | null }) {
  // Popup, konum hesabı VİEWPORT'a göre olan `position: fixed` yerine,
  // burada sahip olduğumuz `wrapRef` (position: relative, transform'suz,
  // overflow'suz) sarmalayıcıya göre `position: absolute` kullanır. Neden:
  // `fixed`, sayfadaki ÜST bir elemanda transform/filter/backdrop-filter
  // varsa (CSS'in "containing block" kuralı gereği) viewport'a değil o
  // elemana göre konumlanır -- bu, popup'ın beklenmedik yerlerde (örn.
  // ekranın en tepesinde) açılmasına yol açabilir. `wrapRef` bizim
  // kontrolümüzde, kesinlikle transform'suz bir kutu olduğu için bu sorunu
  // kökten ortadan kaldırır. Popup yine de bu kutunun DIŞINDA, ayrı bir
  // sibling olarak render edilir ki şeridin overflow-x-auto'su onu kırpmasın.
  const [hover, setHover] = useState<{ idx: number; rect: DOMRect } | null>(null);
  const [chartData, setChartData] = useState<Record<string, MiniBar[]>>({});
  const popRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Fare hücreden ayrılınca popup HEMEN kapanmaz -- 18 sn açık kalır (rahat
  // okumak için) ya da kullanıcı herhangi bir yere tıklayınca hemen kapanır.
  // Popup'ın üstüne tekrar girilirse (fare hücreden popup'a taşınırken)
  // kapanma iptal edilir.
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(null), 18000);
  };
  useEffect(() => cancelClose, []);

  // Herhangi bir yere tıklayınca popup'ı hemen kapat.
  useEffect(() => {
    if (!hover) return;
    const onClick = () => { cancelClose(); setHover(null); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hover != null]);

  const hoverSymbol = hover ? quotes[hover.idx]?.symbol ?? null : null;

  useEffect(() => {
    if (!hoverSymbol || chartData[hoverSymbol]) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/spyengine/v2/ticker-sparkline?symbol=${encodeURIComponent(hoverSymbol)}`);
        const json = await res.json();
        if (cancelled) return;
        setChartData((prev) => ({ ...prev, [hoverSymbol]: json.ok ? json.bars ?? [] : [] }));
      } catch {
        if (!cancelled) setChartData((prev) => ({ ...prev, [hoverSymbol]: [] }));
      }
    })();
    return () => { cancelled = true; };
  }, [hoverSymbol, chartData]);

  // Popup, hücrenin HEMEN YANINDA açılır (üstte/altta değil) — böylece
  // fare hücreden popup'a düz bir çizgide taşınabilir. Konum, wrapRef'in
  // (yukarıdaki not) sol-üst köşesine göre hesaplanır; viewport sınırları
  // için hâlâ window.innerWidth/innerHeight kullanılır, sadece sonuç
  // wrapRef'in orijinine göre wrapRef içinde `absolute` konumlanacak
  // şekilde ofsetlenir.
  useLayoutEffect(() => {
    if (!hover || !popRef.current || !wrapRef.current) { setPos(null); return; }
    const el = popRef.current;
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const M = 8;

    let leftAbs = hover.rect.right + M;
    if (leftAbs + w + M > vw) leftAbs = hover.rect.left - w - M;
    leftAbs = Math.min(Math.max(M, leftAbs), Math.max(M, vw - w - M));

    // Hücrenin DİKEY ORTASINA hizala (üst kenarına değil) -- böylece
    // viewport'a sığdırmak için kırpma gerektiğinde bile popup, hangi
    // hücrenin üzerinde durduğuna en yakın konumda kalır, ekranın rastgele
    // bir köşesine "zıplamaz".
    let topAbs = hover.rect.top + hover.rect.height / 2 - h / 2;
    topAbs = Math.min(Math.max(M, topAbs), Math.max(M, vh - h - M));

    setPos({ top: topAbs - wrapRect.top, left: leftAbs - wrapRect.left });
  }, [hover, chartData]);

  const hq = hover ? quotes[hover.idx] : null;

  return (
    <div ref={wrapRef} className="relative">
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">Canlı Piyasa Şeridi</span>
        <span className="font-mono text-[10px] text-slate-600">
          {updatedAt ? `${nyClock(updatedAt, true)} ET` : "veri bekleniyor"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <div className="grid gap-px bg-[#1c2635] [grid-template-columns:repeat(auto-fit,minmax(136px,1fr))]">
          {quotes.map((q, idx) => {
            const up = (q.changePct ?? 0) > 0;
            const down = (q.changePct ?? 0) < 0;
            const hourUp = (q.changePctHour ?? 0) > 0;
            const hourDown = (q.changePctHour ?? 0) < 0;
            return (
              <div
                key={q.symbol}
                className="cursor-pointer bg-[#0f141d] px-2.5 py-1.5 transition-colors hover:bg-[#1c2635]"
                onMouseEnter={(e) => { cancelClose(); setHover({ idx, rect: e.currentTarget.getBoundingClientRect() }); }}
                onMouseLeave={scheduleClose}
              >
                <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                  <span className="truncate text-[10px] font-semibold text-sky-300">{q.label}</span>
                  {q.extended && <span className="shrink-0 text-[8px] text-amber-400/80">EXT</span>}
                </div>
                {q.error || q.price == null ? (
                  <div className="font-mono text-[10px] text-slate-600">veri yok</div>
                ) : (
                  <>
                    <div className="flex items-baseline justify-between gap-1.5 whitespace-nowrap">
                      <span className="font-mono text-[11px] tabular-nums text-slate-100">{num(q.price, q.price > 1000 ? 0 : 2)}</span>
                      <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${tone(q.changePct)}`}>
                        {up ? "▲" : down ? "▼" : "▬"}{signed(q.changePct, 2)}%
                      </span>
                    </div>
                    {q.changePctHour != null && (
                      <div className="mt-0.5 flex items-baseline justify-between gap-1.5 whitespace-nowrap border-t border-white/5 pt-0.5">
                        <span className="text-[8px] font-medium text-slate-500">1sa</span>
                        <span className={`shrink-0 font-mono text-[9.5px] tabular-nums ${tone(q.changePctHour)}`}>
                          {hourUp ? "▲" : hourDown ? "▼" : "▬"}{signed(q.changePctHour, 2)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>

      {/* Hover popup — wrapRef'e göre absolute, ticker kutusunun DIŞINDA
          bir sibling; şeridin overflow-x-auto'sundan asla kırpılmaz. */}
      {hq && (
        <div
          ref={popRef}
          className="absolute z-[9999] max-h-[80vh] w-[320px] overflow-y-auto rounded-lg border border-[#2d3748] bg-[#0a0e17] p-3 shadow-2xl"
          style={{
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
            visibility: pos ? "visible" : "hidden",
          }}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
        >
          <div className="mb-2 flex items-start justify-between gap-3 border-b border-[#1c2635] pb-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] font-semibold text-slate-200">{hq.name}</div>
              <div className="text-[10px] text-slate-500">{hq.symbol}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-[13px] font-bold text-slate-100">
                {num(hq.price, hq.price != null && hq.price > 1000 ? 0 : 2)}
              </div>
              <div className={`font-mono text-[11px] font-semibold ${tone(hq.changePct)}`}>
                {signed(hq.change, 2)} ({signed(hq.changePct, 2)}%)
              </div>
            </div>
          </div>

          <MiniCandles bars={chartData[hq.symbol]} />

          <div className="mb-3 mt-2 grid grid-cols-2 gap-2 text-[9px]">
            <div>
              <div className="text-slate-500">Önceki Kapanış</div>
              <div className="font-mono text-slate-300">{hq.prevClose != null ? num(hq.prevClose) : "—"}</div>
            </div>
            <div>
              <div className="text-slate-500">Seans Tipi</div>
              <div className="text-slate-300">{hq.extended ? "Seans Dışı" : "Düzenli"}</div>
            </div>
          </div>

          <a
            href={`/global/tr/graphic/${encodeURIComponent(hq.symbol)}`}
            className="block rounded bg-[#1d4ed8] px-3 py-2 text-center text-[10px] font-semibold text-white transition-colors hover:bg-[#1e40af]"
          >
            Detay Grafik
          </a>
        </div>
      )}
    </div>
  );
}

// ── Bilgi kartları ────────────────────────────────────────────────

export interface SpotStats {
  price: number | null; priceTime: number | null;
  prevClose: number | null; change: number | null; changePct: number | null;
  rthHigh: number | null; rthLow: number | null;
  preHigh: number | null; preLow: number | null;
  sessionHigh: number | null; sessionLow: number | null;
  rangePct: number | null; vwap: number | null; atr14: number | null;
  volume: number; rthVolume: number; barCount: number;
  lastBarTime: number | null; date: string;
}

const PHASE_LABEL: Record<SessionPhase, string> = {
  PRE: "Premarket (04:00–09:30 ET)",
  RTH: "Düzenli Seans (09:30–16:00 ET)",
  POST: "Afterhours (16:00–20:00 ET)",
  CLOSED: "Piyasa Kapalı",
};

const PHASE_TONE: Record<SessionPhase, string> = {
  PRE: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  RTH: "bg-green-500/15 text-green-300 border-green-500/25",
  POST: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  CLOSED: "bg-slate-700/40 text-slate-400 border-slate-600/40",
};

export function PhaseBadge({ phase }: { phase: SessionPhase }) {
  return (
    <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${PHASE_TONE[phase]}`}>
      {PHASE_LABEL[phase]}
    </span>
  );
}

function Card({ label, value, sub, tone: t }: { label: string; value: ReactNode; sub?: ReactNode; tone?: string }) {
  return (
    <div className="rounded-md border border-[#1c4753]/50 bg-[#0f2e37] px-2.5 py-2 transition-colors hover:border-[#1c4753]">
      <div className="text-[9px] font-semibold tracking-wider text-sky-300">{label}</div>
      <div className={`mt-0.5 font-mono text-[13px] font-semibold leading-tight ${t ?? "text-slate-100"}`}>{value}</div>
      {sub != null && <div className="mt-0.5 font-mono text-[9.5px] leading-snug text-slate-400">{sub}</div>}
    </div>
  );
}

export function InfoCards({ spot, lastFetch, phase }: {
  spot: SpotStats | null; lastFetch: number | null; phase: SessionPhase;
}) {
  if (!spot) {
    return (
      <div className={`${SURFACE} px-3 py-4 text-[12px] text-slate-500`}>SPY verisi bekleniyor…</div>
    );
  }
  const dir =
    spot.changePct == null ? "—" : spot.changePct > 0 ? "YUKARI ▲" : spot.changePct < 0 ? "AŞAĞI ▼" : "YATAY ▬";

  return (
    <div className={`${SURFACE} overflow-hidden p-1.5`}>
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(148px,1fr))]">
        <Card
          label="SPY FİYAT"
          value={spot.price == null ? "veri yok" : `$${num(spot.price)}`}
          sub={spot.priceTime ? `${nyClock(spot.priceTime, true)} ET` : "zaman yok"}
        />
        <Card
          label="GÜNLÜK DEĞİŞİM"
          value={spot.changePct == null ? "—" : `${signed(spot.changePct)}%`}
          sub={spot.change == null ? "önceki kapanış yok" : `${signed(spot.change)} $ · önc. ${num(spot.prevClose)}`}
          tone={tone(spot.changePct)}
        />
        <Card label="YÖN" value={dir} sub={PHASE_LABEL[phase]} tone={tone(spot.changePct)} />
        <Card
          label="ZİRVE / DİP (SEANS)"
          value={`${num(spot.sessionHigh)} / ${num(spot.sessionLow)}`}
          sub={spot.rangePct == null ? "aralık yok" : `aralıkta %${num(spot.rangePct, 0)} konumda`}
        />
        <Card
          label="RTH ZİRVE / DİP"
          value={`${num(spot.rthHigh)} / ${num(spot.rthLow)}`}
          sub={
            spot.preHigh == null
              ? "premarket verisi yok"
              : `pre ${num(spot.preHigh)} / ${num(spot.preLow)}`
          }
        />
        <Card
          label="SON GÜNCELLEME"
          value={lastFetch ? nyClock(lastFetch, true) : "—"}
          sub={`${spot.barCount} mum · ${spot.lastBarTime ? nyClock(spot.lastBarTime) : "—"} son mum`}
        />
        <Card label="VWAP" value={spot.vwap == null ? "veri yok" : num(spot.vwap)} sub="seans içi kümülatif" />
        <Card label="ATR(14) 1m" value={spot.atr14 == null ? "veri yok" : num(spot.atr14, 3)} sub="ortalama gerçek aralık" />
        <Card
          label="HACİM (SEANS)"
          value={spot.volume ? Math.round(spot.volume).toLocaleString("tr-TR") : "—"}
          sub={`RTH ${spot.rthVolume ? Math.round(spot.rthVolume).toLocaleString("tr-TR") : "—"}`}
        />
        <Card
          label="AÇILIŞA GÖRE"
          value={
            spot.rthLow == null || spot.rthHigh == null || spot.price == null
              ? "—"
              : `${num(spot.price - (spot.rthLow + spot.rthHigh) / 2)}`
          }
          sub="RTH orta noktaya uzaklık"
        />
        <Card label="SEANS TARİHİ" value={spot.date} sub="New York takvimi" />
        <Card
          label="ÖNCEKİ KAPANIŞ"
          value={spot.prevClose == null ? "veri yok" : num(spot.prevClose)}
          sub="dünkü kapanış"
        />
      </div>
    </div>
  );
}

// ── İki katman okuması (V3: 1m ana sürücü, 5m destek — 15m karara girmez) ──

/**
 * KAPI DURUMU — el ile işlem açarken veto listesi.
 * Motor kendi sinyalini üretmese bile "şu an LONG/SHORT açsam hangi kapı
 * geçer, hangisi geçmez" burada tek bakışta görülür. Liste V8.0 mimarisini
 * gösterir: 15m yön teyidi (zorunlu kapı, 30m yok), hacim vetosu, 5m ana
 * karar skorunun bileşenleri (VWAP/formasyon/hacim/RSI/EMA21), acil çıkış
 * çakışması kontrolü (bkz. strategy.ts gateChecksFor).
 */

/** Bir yönün o anki duruşu — hem sütun başlığı hem ön uyarı bunu kullanır. */
export interface SideStanding {
  side: Side;
  passed: number;
  total: number;
  missing: string[];
}

export function standingFor(list: GateCheck[], side: Side): SideStanding {
  const missing = list.filter((g) => !g.ok).map((g) => g.label);
  return { side, passed: list.length - missing.length, total: list.length, missing };
}

// ── Ön uyarı (kurulum oluşmadan haber ver) ────────────────────────

export type AlertLevel = "FIRED" | "IMMINENT" | "NEAR" | "IDLE";

export interface EntryAlert {
  level: AlertLevel;
  side: Side | null;
  standing: SideStanding | null;
}

/**
 * Kurulum HENÜZ oluşmadan haber veren ön uyarı. Motorun giriş/çıkış
 * kurallarına dokunmaz — yalnızca aynı kapı verisini okuyup "ne kadar
 * yakınız" sorusunu yanıtlar.
 *
 *   FIRED    = motor sinyali verdi (5m ana karar skoru eşiği geçti, 15m
 *              yön teyidi de aynı yönde)
 *   IMMINENT = 5m ana karar bu yönde ateşlendi ama giriş penceresi/çakışma
 *              gibi bir sebeple henüz TRIGGERED'a dönmedi
 *   NEAR     = henüz ateşlenmedi ama bir yönün kapıları çoğunlukla geçti
 */
export function computeEntryAlert(
  gates: GateStatus | null,
  regimeSide: RegimeSide,
  state: EngineState,
  action: "LONG" | "SHORT" | "BEKLE"
): EntryAlert {
  if (!gates || !gates.long.length) return { level: "IDLE", side: null, standing: null };

  if (state === "TRIGGERED" && action !== "BEKLE") {
    const list = action === "LONG" ? gates.long : gates.short;
    return { level: "FIRED", side: action, standing: standingFor(list, action) };
  }

  if (regimeSide !== "NONE") {
    const list = regimeSide === "LONG" ? gates.long : gates.short;
    return { level: "IMMINENT", side: regimeSide, standing: standingFor(list, regimeSide) };
  }

  const cands = (["LONG", "SHORT"] as const).map((s) => standingFor(s === "LONG" ? gates.long : gates.short, s));
  cands.sort((a, b) => b.passed - a.passed);
  const best = cands[0];
  if (best.total > 0 && best.passed / best.total >= 0.6) return { level: "NEAR", side: best.side, standing: best };
  return { level: "IDLE", side: null, standing: best };
}

const ALERT_STYLE: Record<AlertLevel, { ring: string; text: string; icon: string }> = {
  // FIRED = motor GERÇEK bir işlem önerisi verdiği tek an; diğer üç seviye
  // sadece durum bilgisidir. Bu yüzden yalnızca FIRED yeşil zemine geçer —
  // IMMINENT/NEAR ile karıştırılmasın diye bilinçli olarak farklı renk.
  FIRED: { ring: "border-[#22c55e]/70 bg-[#22c55e]/20", text: "text-[#4ade80]", icon: "🎯" },
  IMMINENT: { ring: "border-blue-500/55 bg-blue-600/16", text: "text-blue-300", icon: "⚡" },
  NEAR: { ring: "border-sky-500/35 bg-sky-500/8", text: "text-sky-300", icon: "👀" },
  IDLE: { ring: "border-[#1c2635] bg-[#0f141d]", text: "text-slate-400", icon: "○" },
};

/**
 * Sayfanın en üstündeki durum çubuğu: ne olduğu, ne eksik ve bir sonraki
 * 1m kapanışa kaç saniye kaldığı (canlı zamanlayıcı hâlâ 1m granülerliğinde
 * çalışıyor). Tablette de tek bakışta okunur boyutta.
 */
export function AlertBanner({
  alert, secondsToClose, stateLabel, nextStep, inPosition,
}: {
  alert: EntryAlert;
  secondsToClose: number | null;
  stateLabel: string;
  nextStep: string;
  inPosition: boolean;
}) {
  const st = inPosition
    ? { ring: "border-[#3b82f6]/45 bg-[#3b82f6]/10", text: "text-sky-300", icon: "◆" }
    : ALERT_STYLE[alert.level];
  const sideTone =
    alert.side === "LONG" ? "text-[#22c55e]" : alert.side === "SHORT" ? "text-[#ef4444]" : "text-slate-400";
  /** Gerçek işlem önerisi anı — büyük/yeşil vurgu yalnızca burada devreye girer */
  const isFired = !inPosition && alert.level === "FIRED";

  let headline: string;
  if (inPosition) headline = "POZİSYON AÇIK — çıkış kuralı bekleniyor";
  else if (alert.level === "FIRED") headline = `${alert.side} GİRİŞ SİNYALİ (eski motor) — 5m puan eşiği geçti, 15m kapısı açık`;
  else if (alert.level === "IMMINENT") headline = `${alert.side} REJİMİ SERBEST (eski motor) — 5m puanı herhangi bir mumda eşiği geçebilir`;
  else if (alert.level === "NEAR") headline = `${alert.side} kurulumu yaklaşıyor`;
  else headline = stateLabel;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border px-3 py-2 ${st.ring} ${
        isFired ? "border-2 py-3 shadow-[0_0_26px_-4px_rgba(34,197,94,0.6)]" : ""
      }`}
    >
      <span
        className={`flex items-center gap-2 font-bold tracking-wide ${
          isFired ? "text-[19px] sm:text-[24px]" : "text-[13px] sm:text-[15px]"
        } ${inPosition || alert.level === "IDLE" ? st.text : isFired ? "text-[#4ade80]" : sideTone} ${
          alert.level === "FIRED" || alert.level === "IMMINENT" ? "animate-pulse" : ""
        }`}
      >
        <span>{st.icon}</span>
        <span>{headline}</span>
      </span>


      {secondsToClose != null && (
        <span
          className={`ml-auto rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${
            secondsToClose <= 10 ? "bg-orange-500/20 text-orange-300" : "bg-[#111827] text-slate-400"
          }`}
          title="Değerlendirilen 1m mumun kapanışına kalan süre — karar sadece kapalı mumla verilir"
        >
          1m kapanış · {secondsToClose}sn
        </span>
      )}

      <div
        className={`w-full leading-snug ${
          isFired ? "text-[13px] font-semibold text-[#bbf7d0] sm:text-[14px]" : "text-[11px] text-slate-300"
        }`}
      >
        {isFired ? `⚠️ İŞLEM ÖNERİSİ — ${nextStep}` : nextStep}
      </div>
    </div>
  );
}

// ── Kapı tablosu — LONG ve SHORT AYNI ANDA ────────────────────────

function GateColumn({
  side, list,
}: {
  side: Side; list: GateCheck[];
}) {
  const st = standingFor(list, side);
  const allOk = st.passed === st.total;
  const isLong = side === "LONG";
  const accent = isLong ? "#22c55e" : "#ef4444";
  const rows: { label: string; full: string; ok: boolean; detail: string }[] = list.map((g) => ({
    label: g.label, full: g.label, ok: g.ok, detail: g.detail,
  }));

  return (
    <div className="min-w-0 flex-1">
      <div
        className="flex items-center justify-between gap-2 px-2.5 py-1.5"
        style={{ backgroundColor: allOk ? `${accent}22` : "transparent" }}
      >
        <span className="text-[12px] font-bold tracking-wide" style={{ color: accent }}>
          {side}
        </span>
        <span className="font-mono text-[11px] font-semibold" style={{ color: allOk ? accent : "#64748b" }}>
          {st.passed}/{st.total}
        </span>
      </div>

      <div className="flex gap-0.5 px-2.5 pb-1">
        {rows.map((r, i) => (
          <span key={i} className="h-1 flex-1 rounded-sm" style={{ backgroundColor: r.ok ? accent : "#1c2635" }} />
        ))}
      </div>

      <div className="px-2.5 pb-1 text-[9.5px] font-semibold" style={{ color: allOk ? accent : "#64748b" }}>
        {allOk ? "tüm kapılar açık" : `${st.total - st.passed} kapı kapalı`}
      </div>

      <div className="px-2.5 pb-2">
        {rows.map((r, i) => (
          <div
            key={i}
            title={r.full}
            className="flex items-center justify-between gap-1.5 border-b border-[#151c28] py-[3px] last:border-0"
          >
            <span className="flex min-w-0 items-center gap-1">
              <span className={r.ok ? "text-[#22c55e]" : "text-[#ef4444]"}>{r.ok ? "✓" : "✕"}</span>
              <span className={`truncate text-[10px] ${r.ok ? "text-slate-300" : "text-slate-500"}`}>{r.label}</span>
            </span>
            <span className={`shrink-0 font-mono text-[10px] ${r.ok ? "text-slate-300" : "text-[#ef4444]"}`}>
              {r.detail}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Kapı Durumu — LONG ve SHORT sütunları YAN YANA. Sekme yok: hangi yönün
 * öne çıktığı sütun başlığındaki sayaçtan (ör. 5/7) tek bakışta görünür,
 * ikisi aynı anda izlenir.
 */
export function GatePanel({ gates }: { gates: GateStatus | null }) {
  if (!gates || !gates.long.length) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Kapı Durumu</div>
        <div className="mt-1 text-[12px] text-slate-500">Mum verisi bekleniyor.</div>
      </div>
    );
  }

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Kapı Durumu{" "}
          <span className="text-[9px] font-normal text-slate-600">
            · 5m ana karar (VWAP+formasyon+hacim+RSI) + 15m yön teyidi (zorunlu) + hacim vetosu · iki yön birlikte
          </span>
        </span>
      </div>
      <div className="flex divide-x divide-[#1c2635]">
        <GateColumn side="LONG" list={gates.long} />
        <GateColumn side="SHORT" list={gates.short} />
      </div>
    </div>
  );
}

// ── Reversal Gate Column (tek yön, puanlama tabanlı) ────────────────

/**
 * Çıkış Takip Paneli — açık pozisyon varsa çıkış uyarı sinyallerini
 * aşama aşama gösterir. GatePanel'deki girişin çıkış karşılığı.
 */
export function ExitGatePanel({ reversal }: { reversal: ReversalState | null }) {
  const openSide = reversal?.openSide ?? null;

  if (!openSide) {
    return (
      <div className={`${SURFACE} overflow-hidden`}>
        <div className="border-b border-[#1c2635] px-3 py-1.5">
          <span className="text-[11px] font-semibold tracking-wide text-slate-300">
            Çıkış Takibi{" "}
            <span className="text-[9px] font-normal text-slate-600">· pozisyon açılınca aktifleşir</span>
          </span>
        </div>
        <div className="px-2.5 py-3 text-[11px] text-slate-600">
          Aktif pozisyon yok. Bir LONG veya SHORT girildiğinde burada ters dönüş sinyalleri izlenecek.
        </div>
      </div>
    );
  }

  const { exitWarn, exitScore, exitChecks, isMarketHours } = reversal!;
  const accent = exitWarn ? "#f97316" : "#64748b";
  const sideWord = openSide === "LONG" ? "LONG" : "SHORT";

  return (
    <div className={`${SURFACE} overflow-hidden`}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-1.5">
        <span className="text-[11px] font-semibold tracking-wide text-slate-300">
          Çıkış Takibi{" "}
          <span className="text-[9px] font-normal text-slate-600">
            · {sideWord} pozisyon · ters dönüş sinyali izleniyor
          </span>
        </span>
        {exitWarn && (
          <span className="animate-pulse rounded border border-orange-500/50 bg-orange-500/15 px-2 py-0.5 text-[10px] font-bold text-orange-300">
            ⚠ ÇIKIŞ UYARISI
          </span>
        )}
      </div>

      <div className="px-2.5 py-2">
        <div className="mb-1.5 flex items-center gap-2">
          <div className="flex gap-0.5">
            {exitChecks.map((c, i) => (
              <span key={i} className="h-1 w-8 rounded-sm" style={{ backgroundColor: c.ok ? accent : "#1c2635" }} />
            ))}
          </div>
          <span className="font-mono text-[11px]" style={{ color: accent }}>
            {exitScore}/{exitChecks.length}
            {exitWarn ? " — çıkış sinyali" : " — sinyal yok"}
          </span>
        </div>

        {exitChecks.map((c, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-1.5 border-b border-[#151c28] py-[3px] last:border-0"
          >
            <span className="flex min-w-0 items-center gap-1">
              <span className={c.ok ? "text-[#f97316]" : "text-[#64748b]"}>{c.ok ? "⚠" : "○"}</span>
              <span className={`truncate text-[10px] ${c.ok ? "text-slate-300" : "text-slate-500"}`} title={c.label}>
                {c.label}
              </span>
            </span>
            <span className={`shrink-0 font-mono text-[10px] ${c.ok ? "text-orange-300" : "text-slate-600"}`}>
              {c.detail}
            </span>
          </div>
        ))}

        {!isMarketHours && (
          <div className="mt-1.5 text-[9.5px] text-slate-600">
            Piyasa saatleri dışında — izleme modunda, uyarı susturulmuş.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pozisyon paneli (talimat §6) ──────────────────────────────────

function Stat({ k, v, t }: { k: string; v: ReactNode; t?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-[#151c28] py-1 last:border-0">
      <span className="text-[10px] text-slate-500">{k}</span>
      <span className={`font-mono text-[11px] ${t ?? "text-slate-200"}`}>{v}</span>
    </div>
  );
}

export function PositionPanel({ position, livePremium }: {
  position: PositionState | null; livePremium: number | null;
}) {
  if (!position) {
    return (
      <div className={`${SURFACE} px-3 py-4`}>
        <div className="text-[11px] font-semibold text-slate-300">Açık Pozisyon</div>
        <div className="mt-1 text-[12px] text-slate-500">Açık pozisyon yok — motor giriş serisi arıyor.</div>
      </div>
    );
  }

  const prem = livePremium ?? position.lastPremium;
  const pctFromEntry =
    prem != null && position.entryPremium ? ((prem - position.entryPremium) / position.entryPremium) * 100 : null;
  const total = position.realizedPnl + (position.unrealizedPnl ?? 0);
  const rules = CONTRACT_RULES[position.contractType];
  const pg = position.progress;
  const isLong = position.side === "LONG";

  return (
    <div className={SURFACE}>
      <div className="flex items-center justify-between border-b border-[#1c2635] px-3 py-2">
        <span className="shrink-0 text-[11px] font-semibold tracking-wide text-slate-300">
          {position.status === "OPEN" ? "Açık Pozisyon" : "Son Pozisyon"}
        </span>
        <div className="flex items-center gap-1.5">
          <span
            className="rounded border px-2 py-0.5 text-[10px] font-bold"
            style={{ borderColor: `${CONTRACT_TONE[position.contractType]}55`, backgroundColor: `${CONTRACT_TONE[position.contractType]}22`, color: CONTRACT_TONE[position.contractType] }}
          >
            {rules.label}
          </span>
          <span
            className={`rounded border px-2 py-0.5 text-[10px] font-bold ${
              isLong
                ? "border-green-500/30 bg-green-500/15 text-green-300"
                : "border-red-500/30 bg-red-500/15 text-red-300"
            }`}
          >
            {isLong ? "LONG GİRİŞ · CALL" : "SHORT GİRİŞ · PUT"}
          </span>
        </div>
      </div>

      <div className="px-3 py-2">
        {position.premiumDataMissing && (
          <div className="mb-2 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1.5 text-[10px] leading-snug text-amber-300">
            Bu giriş için 0DTE opsiyon primi verisi gelmedi. Giriş/çıkış zamanı ve gerekçesi
            doğru, ama $ kâr/zarar hesaplanamıyor — teorik fiyat üretilmiyor.
          </div>
        )}

        {/* Çıkışa yakınlık — canlı takip için en önemli kutu (öncelik sırası: EOD > EMA kesişimi > RSI dönüşü > stop > trailing) */}
        {position.status === "OPEN" ? (
          <div className="mb-2 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-2">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Çıkışa yakınlık</span>
              <span className="font-mono text-slate-500">{pg.barsHeld} mum taşındı</span>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              <span>
                5m EMA21 (ACİL):{" "}
                <b className={pg.emaFavor === true ? "text-[#22c55e]" : pg.emaFavor === false ? "text-[#ef4444]" : "text-slate-500"}>
                  {pg.emaFavor == null ? "veri yok" : pg.emaFavor ? "lehte" : "ALEYHTE — çıkış tetiklenmek üzere"}
                </b>
                {pg.emaGapPct != null && <span className="ml-1 font-mono text-slate-600">({signed(pg.emaGapPct, 2)}%)</span>}
              </span>
              <span>
                5m RSI (NORMAL):{" "}
                <b className={pg.rsiSupportive === true ? "text-[#22c55e]" : pg.rsiSupportive === false ? "text-[#ef4444]" : "text-slate-500"}>
                  {pg.rsiSupportive == null ? "veri yok" : pg.rsiSupportive ? "destekliyor" : "aleyhte"}
                </b>
                {pg.rsi5 != null && <span className="ml-1 font-mono text-slate-600">({pg.rsi5.toFixed(0)})</span>}
              </span>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              <span>
                {pg.stopSpy != null ? (
                  <>15m yapı stopu (Stop_SPY): <b className="text-orange-300">{num(pg.stopSpy)}</b></>
                ) : (
                  <>Güvenlik ağı (%{EXIT_STOP_PCT * 100}, swing/ATR verisi henüz yok) — anlık:{" "}
                  <b className={tone(pg.premiumPct)}>{pg.premiumPct == null ? "veri yok" : `${signed(pg.premiumPct * 100, 0)}%`}</b></>
                )}
              </span>
              {pg.trailFloorPct != null && (
                <span>Trailing taban: <b className="text-sky-300">+{(pg.trailFloorPct * 100).toFixed(0)}%</b></span>
              )}
            </div>
            <div className="text-[10px] leading-snug text-slate-500">{pg.note}</div>
            {pg.bestSpot != null && (
              <div className="mt-1 text-[9px] text-slate-600">En iyi seviye: <b className="text-slate-400">${num(pg.bestSpot)}</b></div>
            )}
          </div>
        ) : (
          <div className="mb-2 rounded border border-[#1c2635] bg-[#0a0e17] px-2 py-2">
            <div className="text-[10px] font-semibold text-slate-400">Çıkış gerekçesi</div>
            <div className="mt-0.5 text-[10px] leading-snug text-slate-500">{position.exitNote ?? "—"}</div>
          </div>
        )}

        <Stat k="Kontrat" v={position.contract ?? "—"} />
        <Stat k="Strike / Vade" v={position.strike ? `$${position.strike} · ${position.expiry}` : "—"} />
        <Stat k="Giriş saati" v={`${nyClock(position.entryTime)} ET`} />
        <Stat k="Giriş SPY" v={`$${num(position.entrySpot)}`} />
        <Stat k="Giriş primi" v={position.entryPremium == null ? "veri yok" : `$${num(position.entryPremium)}`} />
        {position.exitTime != null && (
          <>
            <Stat k="Çıkış saati" v={`${nyClock(position.exitTime)} ET`} />
            <Stat k="Çıkış SPY" v={position.exitSpot == null ? "—" : `$${num(position.exitSpot)}`} />
            <Stat k="Çıkış primi" v={position.exitPremium == null ? "veri yok" : `$${num(position.exitPremium)}`} />
          </>
        )}
        <Stat
          k="Anlık prim"
          v={prem == null ? "veri yok" : `$${num(prem)}${pctFromEntry != null ? ` (${signed(pctFromEntry, 1)}%)` : ""}`}
          t={tone(pctFromEntry)}
        />
        <Stat k="Gerçekleşen K/Z" v={`$${signed(position.realizedPnl)}`} t={tone(position.realizedPnl)} />
        <Stat
          k="Açık K/Z"
          v={position.unrealizedPnl == null ? "veri yok" : `$${signed(position.unrealizedPnl)}`}
          t={tone(position.unrealizedPnl)}
        />
        <Stat k="Toplam (kontrat başına)" v={`$${signed(total)}`} t={tone(total)} />
      </div>
    </div>
  );
}

// ── Olay listesi ──────────────────────────────────────────────────

// ── Strateji şeması (V8.0: 5m ana karar (puanlama) → 15m yön teyidi (kapı) → kontrat seçimi → ATR stop → çıkış) ──

// ── Mini Sparkline Grafik ───────────────────────────────────────

interface MiniBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  ema: number | null;
}

const MINI_W = 296;
const MINI_H = 118;

/** Son 20 günlük 1d mum + EMA21. bars undefined = yükleniyor, [] = veri yok. */
function MiniCandles({ bars }: { bars: MiniBar[] | undefined }) {
  const box = "flex items-center justify-center rounded border border-[#1c2635] bg-[#0b0f18] text-[9px] text-slate-600";

  if (bars === undefined) {
    return <div className={box} style={{ width: MINI_W, height: MINI_H }}>Grafik yükleniyor…</div>;
  }
  if (!bars.length) {
    return <div className={box} style={{ width: MINI_W, height: MINI_H }}>Mum verisi yok</div>;
  }

  const pad = 5;
  const emas = bars.map((b) => b.ema).filter((v): v is number => v != null);
  const min = Math.min(...bars.map((b) => b.low), ...emas);
  const max = Math.max(...bars.map((b) => b.high), ...emas);
  const range = max - min || 1;
  const innerH = MINI_H - pad * 2;
  const y = (v: number) => pad + (1 - (v - min) / range) * innerH;

  const slot = MINI_W / bars.length;
  const bw = Math.max(2, slot * 0.62);

  // EMA21 çizgisi — sadece hesaplanabilmiş noktalar
  const emaPts = bars
    .map((b, i) => (b.ema == null ? null : `${slot * (i + 0.5)},${y(b.ema)}`))
    .filter((p): p is string => p != null)
    .join(" ");

  return (
    <div className="rounded border border-[#1c2635] bg-[#0b0f18]">
      <svg width={MINI_W} height={MINI_H} viewBox={`0 0 ${MINI_W} ${MINI_H}`} className="block">
        {bars.map((b, i) => {
          const cx = slot * (i + 0.5);
          const rise = b.close >= b.open;
          const color = rise ? "#22c55e" : "#ef4444";
          const top = y(Math.max(b.open, b.close));
          const bot = y(Math.min(b.open, b.close));
          return (
            <g key={b.time}>
              <line x1={cx} x2={cx} y1={y(b.high)} y2={y(b.low)} stroke={color} strokeWidth={1} />
              <rect
                x={cx - bw / 2}
                y={top}
                width={bw}
                height={Math.max(1, bot - top)}
                fill={color}
              />
            </g>
          );
        })}
        {emaPts && (
          <polyline points={emaPts} fill="none" stroke="#eab308" strokeWidth={1.4} strokeLinejoin="round" />
        )}
      </svg>
      <div className="flex items-center justify-between border-t border-[#1c2635] px-2 py-1 text-[8px] text-slate-500">
        <span>son {bars.length} gün · 1d</span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-3 bg-[#eab308]" />
          EMA21 {emas.length ? num(emas[emas.length - 1]) : "—"}
        </span>
      </div>
    </div>
  );
}

// ── 15 Günlük OHLC Tablosu ──────────────────────────────────────

export interface OHLCRow {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ── V4: REJİM PANELLERİ ───────────────────────────────────────────

export interface RegimeBlock {
  veto: M15VetoRead;
  volumeVeto: VolumeVetoRead;
  layer1: Layer1Read;
  current: RegimeState;
  cooldownUntil: number | null;
  cooldownActive: boolean;
}

// ── V7.0 — POZİSYON & GÜNLÜK LİMİT KARTI ───────────────────────────

// ── V4: SEVİYE PANELİ ve GÜN KAPANIŞ TAHMİNİ ──────────────────────

