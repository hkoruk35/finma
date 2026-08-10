"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { appendHashtagsWithinLimit } from "@/lib/x/hashtags";
import { localizedThemeTitle } from "@/lib/hotThemes2026";
import { nyWallTimeToUtcIso, utcIsoToNyDisplay, nyTodayDateStr, nyMaxDateStr } from "@/lib/x/timezone";
import { WEEKDAY_LABELS_TR } from "@/lib/x/recurringSchedules";
import type { ListType } from "@/lib/x/generateContent";
import type { ListOptionCategory, ListOptionItem } from "@/lib/x/listOptions";
import { getMarketAssetLabel } from "@/lib/x/marketAssetLabels";
import { formatNumber } from "@/lib/formatNumber";

const LIST_PICKER_CATEGORIES: { key: ListOptionCategory; label: string }[] = [
  { key: "top100", label: "Top 100" },
  { key: "swing", label: "Trend Hisseleri" },
  { key: "watchlist", label: "Trend Adayları" },
  { key: "sector", label: "Sektörler" },
  { key: "index", label: "Endeksler" },
  { key: "commodity", label: "Değerli Madenler" },
  { key: "fx", label: "Döviz" },
  { key: "crypto", label: "Kripto" },
];

const MARKET_ASSET_CATEGORIES = new Set(["sector", "index", "commodity", "fx", "crypto"]);

const LIST_TYPES: { type: ListType; label: string }[] = [
  { type: "swing", label: "Swing Trade" },
  { type: "trend", label: "Trend Hisseleri" },
  { type: "top100", label: "Top 100" },
  { type: "sector_heatmap", label: "Sektör Isı Haritası" },
];

const ACCENT = "#58a6ff";
const LOCALES = ["en", "es", "fr", "pt", "tr"] as const;
type Locale = (typeof LOCALES)[number];

const inputStyle = { background: "#161b22", border: "1px solid #30363d", color: "#e6edf3", padding: "6px 10px", borderRadius: 4, fontSize: 12, fontFamily: "monospace" };
const btnStyle = { background: ACCENT, color: "#0d1117", border: "none", padding: "8px 16px", borderRadius: 4, fontWeight: 700, fontSize: 12, cursor: "pointer" };

interface PoolItem {
  id: string;
  source: "top100" | "swing" | "trend" | "manual" | "watchlist" | "sector" | "index" | "commodity" | "fx" | "crypto";
  ticker: string;
  company: string | null;
  sector: string | null;
  theme: string | null;
  weekly: boolean;
  locale: Locale | null;
}

interface PostRow {
  id: string;
  content_type: string;
  ticker: string | null;
  list_type: string | null;
  locale: string;
  status: string;
  content_text: string | null;
  tweet_id: string | null;
  created_at: string;
}

interface ScheduledRow {
  id: string;
  content_type: string;
  ticker: string | null;
  list_type: string | null;
  locale: string;
  content_text: string | null;
  scheduled_at: string;
}

interface RecurringScheduleRow {
  id: string;
  content_type: "stock" | "market_asset";
  ticker: string;
  category: string | null;
  weekly: boolean;
  locale: string | null;
  recurrence_type: "interval" | "weekly";
  interval_hours: number | null;
  weekday: number | null;
  time_of_day: string | null;
  enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
}

interface AutomationSettings {
  enabled: boolean;
  x_posting_enabled: boolean;
  interval_minutes: number;
  ratio_top100: number;
  ratio_swing: number;
  ratio_trend: number;
}

interface OhlcBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketData {
  bars: OhlcBar[];
  changePct: number;
  rvol: number;
  opportunity: boolean;
  trendLabels: Record<Locale, string>;
  opportunityLabels: Record<Locale, string>;
}

interface MarketAssetData {
  price: number | null;
  changePct: number | null;
  bars: OhlcBar[]; // sadece haftalık modda dolu — bkz. buildCardParamsFor
}

export default function XStudioPage() {
  const [pool, setPool] = useState<PoolItem[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [selected, setSelected] = useState<PoolItem | null>(null);
  const [texts, setTexts] = useState<Record<Locale, string>>({ en: "", es: "", fr: "", pt: "", tr: "" });
  const [locale, setLocale] = useState<Locale>("en");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"stock" | "promo" | "list" | "market_asset">("stock");
  const [weeklyMode, setWeeklyMode] = useState(false);
  const [listType, setListType] = useState<ListType | null>(null);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ ticker: string; changePct: number }[]>([]);
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [market, setMarket] = useState<MarketData | null>(null);
  const [marketAsset, setMarketAsset] = useState<MarketAssetData | null>(null);
  const [hashtags, setHashtags] = useState("");
  const [manualTicker, setManualTicker] = useState("");
  const [customInstruction, setCustomInstruction] = useState("");
  const [scheduled, setScheduled] = useState<ScheduledRow[]>([]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:30");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);

  // Yeni Hızlı Çoklu Dil Paylaşımı İçin:
  const [quickTicker, setQuickTicker] = useState("");
  const [quickText, setQuickText] = useState("");

  // Listeden Seç — Top100/Trend/Trend Adayları + Terminal ana sayfasındaki
  // sektör/endeks/emtia/döviz/kripto listelerinden manuel çoklu seçim.
  const [pickerCategory, setPickerCategory] = useState<ListOptionCategory | null>(null);
  const [pickerItems, setPickerItems] = useState<ListOptionItem[]>([]);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<Set<string>>(new Set());
  // Kuyruğa eklerken seçilen mod/dil — seçilen tüm öğelere uygulanır,
  // her öğeyi kuyruğa ekledikten sonra ayrı ayrı ayarlamaya gerek kalmaz.
  const [pickerWeekly, setPickerWeekly] = useState(false);
  const [pickerLocale, setPickerLocale] = useState<Locale | "">("");

  // Tekrarlanan Programlama — seçilen öğeleri "her N saatte bir" veya
  // "haftalık, belirli NY gün+saat" otomatik olarak sabitler.
  const [recurringSchedules, setRecurringSchedules] = useState<RecurringScheduleRow[]>([]);
  const [recurrenceType, setRecurrenceType] = useState<"interval" | "weekly">("interval");
  const [recurIntervalHours, setRecurIntervalHours] = useState(4);
  const [recurWeekday, setRecurWeekday] = useState(6); // Cumartesi
  const [recurTimeOfDay, setRecurTimeOfDay] = useState("17:00");

  const loadPool = useCallback(async () => {
    const res = await fetch("/api/admin/x/pool");
    if (res.ok) setPool((await res.json()).pool ?? []);
  }, []);

  const loadPosts = useCallback(async () => {
    const res = await fetch("/api/admin/x/post");
    if (res.ok) setPosts((await res.json()).posts ?? []);
  }, []);

  const loadScheduled = useCallback(async () => {
    const res = await fetch("/api/admin/x/schedule");
    if (res.ok) setScheduled((await res.json()).scheduled ?? []);
  }, []);

  const loadSettings = useCallback(async () => {
    const res = await fetch("/api/admin/x/settings");
    if (res.ok) setSettings((await res.json()).settings);
  }, []);

  const loadRecurringSchedules = useCallback(async () => {
    const res = await fetch("/api/admin/x/recurring-schedules");
    if (res.ok) setRecurringSchedules((await res.json()).schedules ?? []);
  }, []);

  const patchSettings = async (patch: Partial<AutomationSettings>) => {
    const res = await fetch("/api/admin/x/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) setSettings((await res.json()).settings);
  };

  useEffect(() => {
    loadPool();
    loadPosts();
    loadSettings();
    loadScheduled();
    loadRecurringSchedules();
    if (!scheduleDate) setScheduleDate(nyTodayDateStr());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPool, loadPosts, loadSettings, loadScheduled, loadRecurringSchedules]);

  const fillPool = async () => {
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (!res.ok) setError((await res.json()).error || "Kuyruk doldurma hatası");
    await loadPool();
    setBusy(false);
  };

  const clearPool = async () => {
    if (!confirm(`Kuyruktaki ${pool.length} bekleyen içerik silinsin mi?`)) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", { method: "DELETE" });
    if (!res.ok) setError((await res.json()).error || "Kuyruk temizleme hatası");
    await loadPool();
    setBusy(false);
  };

  const deletePoolItem = async (id: string) => {
    setError("");
    const res = await fetch(`/api/admin/x/pool?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "Silme hatası");
      return;
    }
    if (selected?.id === id) {
      setSelected(null);
      setImageUrl(null);
    }
    await loadPool();
  };

  const loadPickerCategory = async (cat: ListOptionCategory) => {
    setPickerCategory(cat);
    setPickerItems([]);
    setPickerSelected(new Set());
    setPickerLoading(true);
    setError("");
    const res = await fetch(`/api/admin/x/list-options?category=${cat}`);
    if (res.ok) {
      setPickerItems((await res.json()).items ?? []);
    } else {
      setError((await res.json().catch(() => ({}))).error || "Liste yüklenemedi");
    }
    setPickerLoading(false);
  };

  const togglePickerItem = (ticker: string) => {
    setPickerSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ticker)) next.delete(ticker);
      else next.add(ticker);
      return next;
    });
  };

  const addSelectedToPool = async () => {
    if (!pickerCategory || pickerSelected.size === 0) return;
    setBusy(true);
    setError("");
    const items = pickerItems
      .filter((it) => pickerSelected.has(it.ticker))
      .map((it) => ({ ticker: it.ticker, source: pickerCategory, company: it.label, sector: it.sector }));
    const res = await fetch("/api/admin/x/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, weekly: pickerWeekly, locale: pickerLocale || undefined }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Kuyruğa ekleme hatası");
    } else if (data.skipped?.length) {
      setError(`Zaten kuyrukta bekliyordu, atlandı: ${data.skipped.join(", ")}`);
    }
    setPickerSelected(new Set());
    await loadPool();
    setBusy(false);
  };

  // Seçilen öğeler için kalıcı tekrarlanan programlama oluşturur — kuyruğa
  // eklemekten farklı: bunlar cron/x-recurring-schedules tarafından zamanı
  // geldikçe taze AI metniyle otomatik üretilip yayınlanır.
  const scheduleSelectedRecurring = async () => {
    if (!pickerCategory || pickerSelected.size === 0) return;
    setBusy(true);
    setError("");
    const isStockCategory = !MARKET_ASSET_CATEGORIES.has(pickerCategory);
    const items = pickerItems.filter((it) => pickerSelected.has(it.ticker));
    const failed: string[] = [];
    for (const it of items) {
      const res = await fetch("/api/admin/x/recurring-schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentType: isStockCategory ? "stock" : "market_asset",
          ticker: it.ticker,
          category: isStockCategory ? undefined : pickerCategory,
          company: isStockCategory ? it.label : undefined,
          sector: isStockCategory ? it.sector : undefined,
          weekly: pickerWeekly,
          locale: pickerLocale || undefined,
          recurrenceType,
          intervalHours: recurrenceType === "interval" ? recurIntervalHours : undefined,
          weekday: recurrenceType === "weekly" ? recurWeekday : undefined,
          timeOfDay: recurrenceType === "weekly" ? recurTimeOfDay : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        failed.push(`${it.ticker}: ${data.error || "hata"}`);
      }
    }
    if (failed.length) setError(`Bazı öğeler programlanamadı — ${failed.join(" | ")}`);
    setPickerSelected(new Set());
    await loadRecurringSchedules();
    setBusy(false);
  };

  const toggleRecurringSchedule = async (id: string, enabled: boolean) => {
    setError("");
    const res = await fetch(`/api/admin/x/recurring-schedules?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Güncelleme hatası");
      return;
    }
    await loadRecurringSchedules();
  };

  const deleteRecurringSchedule = async (id: string) => {
    setError("");
    const res = await fetch(`/api/admin/x/recurring-schedules?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "Silme hatası");
      return;
    }
    await loadRecurringSchedules();
  };

  const generateStockText = async (item: PoolItem, weekly = false) => {
    setBusy(true);
    setError("");
    setSelected(item);
    setMode("stock");
    setWeeklyMode(weekly);
    setImageUrl(null);
    setMarket(null);
    setMarketAsset(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "stock", ticker: item.ticker, company: item.company, sector: item.sector, theme: item.theme, customInstruction: customInstruction.trim() || undefined, weekly }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setMarket(data.market ?? null);
    setHashtags(data.hashtags ?? "");
    if (item.locale) setLocale(item.locale);
    setBusy(false);
  };

  // Sektör/endeks/emtia/döviz/kripto kuyruk öğeleri için — kendi kart
  // şablonu var (kind: "market_asset", bkz. buildCardParamsFor): haftalık
  // modda gerçek fiyat grafiği eklenir, günlükte sade fiyat/değişim kartı.
  const generateMarketAssetText = async (item: PoolItem, weekly = false) => {
    setBusy(true);
    setError("");
    setSelected(item);
    setMode("market_asset");
    setWeeklyMode(weekly);
    setImageUrl(null);
    setMarket(null);
    setMarketAsset(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentType: "market_asset",
        ticker: item.ticker,
        label: item.company || item.ticker,
        category: item.source,
        customInstruction: customInstruction.trim() || undefined,
        weekly,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setHashtags(data.hashtags ?? "");
    setMarketAsset({ price: data.quote?.price ?? null, changePct: data.quote?.changePct ?? null, bars: data.bars ?? [] });
    if (item.locale) setLocale(item.locale);
    setBusy(false);
  };

  const generatePromoText = async () => {
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("promo");
    setWeeklyMode(false);
    setImageUrl(null);
    setMarket(null);
    setMarketAsset(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "promo" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setHashtags(data.hashtags ?? "");
    setBusy(false);
  };

  const generateListText = async (type: ListType) => {
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("list");
    setWeeklyMode(false);
    setImageUrl(null);
    setMarket(null);
    setMarketAsset(null);
    setListType(type);
    const res = await fetch("/api/admin/x/generate-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listType: type }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Liste özeti üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setListItems(data.items ?? []);
    setListTitle(data.listTitle ?? "");
    setHashtags("");
    setBusy(false);
  };

  const buildCardParamsFor = (loc: Locale) => {
    if (mode === "list") return null;
    if (mode === "stock" && selected) {
      return {
        kind: "stock" as const,
        ticker: selected.ticker,
        company: selected.company ?? undefined,
        sector: selected.sector ?? undefined,
        theme: localizedThemeTitle(selected.theme, loc),
        changePct: market?.changePct,
        rvol: market?.rvol,
        opportunity: market?.opportunity,
        opportunityLabel: market?.opportunityLabels?.[loc],
        trendLabel: market?.trendLabels?.[loc],
        bars: market?.bars ?? [],
        headline: texts[loc],
        locale: loc,
      };
    }
    if (mode === "market_asset" && selected) {
      return {
        kind: "market_asset" as const,
        ticker: selected.ticker,
        label: getMarketAssetLabel(selected.ticker, loc),
        category: selected.source as "sector" | "index" | "commodity" | "fx" | "crypto",
        changePct: marketAsset?.changePct ?? undefined,
        price: marketAsset?.price ?? undefined,
        weekly: weeklyMode,
        bars: marketAsset?.bars ?? [],
        headline: texts[loc],
        locale: loc,
      };
    }
    return {
      kind: "promo" as const,
      headline: texts[loc],
      subheadline: "bogastock.com",
      locale: loc,
    };
  };
  const buildCardParams = () => buildCardParamsFor(locale);

  // Manuel gonderiler icin premium karakter siniri (2500) — otomasyon
  // (cron/x-scheduler) hala varsayilan 280'i kullanir, buraya dokunmuyor.
  const MANUAL_POST_LIMIT = 2500;
  const getFinalTextFor = (loc: Locale) => (hashtags ? appendHashtagsWithinLimit(texts[loc], hashtags, MANUAL_POST_LIMIT) : texts[loc]);
  const getFinalText = () => getFinalTextFor(locale);

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${mode === "stock" && selected ? selected.ticker : "promo"}-${locale}.png`;
    a.click();
  };

  const copyText = async () => {
    await navigator.clipboard.writeText(getFinalText());
  };

  const previewImage = async () => {
    const cardParams = buildCardParams();
    if (!cardParams) return; // list gönderilerinde kart görseli yok
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cardParams),
    });
    if (!res.ok) {
      setError((await res.json()).error || "Görsel üretme hatası");
      setBusy(false);
      return;
    }
    const blob = await res.blob();
    setImageUrl(URL.createObjectURL(blob));
    setBusy(false);
  };

  const publish = async () => {
    if (!texts[locale]) {
      setError("Önce metin üretin.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "list"
          ? { locale, contentText: getFinalText(), listType }
          : { locale, contentText: getFinalText(), cardParams: buildCardParams() }
      ),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Paylaşım hatası");
      setBusy(false);
      return;
    }
    setBusy(false);
    setSelected(null);
    setImageUrl(null);
    setListType(null);
    setListItems([]);
    setTexts({ en: "", es: "", fr: "", pt: "", tr: "" });
    await Promise.all([loadPool(), loadPosts()]);
  };

  // Uretilen 5 dilin hepsini tek tek /api/admin/x/post'a gonderir — "Şimdi
  // Paylaş" sadece o an acik olan sekmenin (locale) dilini paylasir, bu ise
  // hepsini paylasip her dilin kendi /news sayfasina dusmesini saglar.
  const publishAll = async () => {
    const targets = LOCALES.filter((loc) => texts[loc]?.trim());
    if (targets.length === 0) {
      setError("Önce metin üretin.");
      return;
    }
    setBusy(true);
    setError("");
    const failed: string[] = [];
    for (const loc of targets) {
      const res = await fetch("/api/admin/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "list"
            ? { locale: loc, contentText: getFinalTextFor(loc), listType }
            : { locale: loc, contentText: getFinalTextFor(loc), cardParams: buildCardParamsFor(loc) }
        ),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        failed.push(`${loc.toUpperCase()}: ${data.error || "hata"}`);
      }
    }
    setBusy(false);
    if (failed.length) setError(`Bazı diller paylaşılamadı — ${failed.join(" | ")}`);
    setSelected(null);
    setImageUrl(null);
    setListType(null);
    setListItems([]);
    setTexts({ en: "", es: "", fr: "", pt: "", tr: "" });
    await Promise.all([loadPool(), loadPosts()]);
  };

  const schedulePost = async () => {
    if (!texts[locale]) {
      setError("Önce metin üretin.");
      return;
    }
    if (!scheduleDate || !scheduleTime) {
      setError("Tarih ve saat seçin.");
      return;
    }
    const scheduledAtUtc = nyWallTimeToUtcIso(scheduleDate, scheduleTime);
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        contentText: getFinalText(),
        contentType: mode,
        ticker: mode === "stock" ? selected?.ticker : undefined,
        sector: mode === "stock" ? selected?.sector : undefined,
        theme: mode === "stock" ? selected?.theme : undefined,
        source: mode === "stock" ? selected?.source : undefined,
        listType: mode === "list" ? listType : undefined,
        scheduledAtUtc,
        customPrompt: customInstruction.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Zamanlama hatası");
      setBusy(false);
      return;
    }
    setBusy(false);
    await loadScheduled();
  };

  const cancelSchedule = async (id: string) => {
    setError("");
    const res = await fetch(`/api/admin/x/schedule?id=${id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error || "İptal hatası");
      return;
    }
    await loadScheduled();
  };

  const processManualTicker = async (weekly = false) => {
    const tickerToProcess = manualTicker.toUpperCase().trim();
    if (!tickerToProcess) {
      setError("Lütfen bir ticker giriniz.");
      return;
    }
    setBusy(true);
    setError("");
    setSelected(null);
    setMode("stock");
    setWeeklyMode(weekly);
    setImageUrl(null);
    setMarket(null);
    setMarketAsset(null);
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "stock", ticker: tickerToProcess, company: null, sector: null, theme: null, customInstruction: customInstruction.trim() || undefined, weekly }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "AI metin üretme hatası");
      setBusy(false);
      return;
    }
    setTexts(data.texts);
    setMarket(data.market ?? null);
    setHashtags(data.hashtags ?? "");
    setSelected({ id: tickerToProcess, source: "manual" as const, ticker: tickerToProcess, company: null, sector: null, theme: null, weekly, locale: null });
    setBusy(false);
  };

  // "Analiz Et"in aksine bu, gönderiyi hemen üretmez — ticker'ı kalıcı kuyruğa
  // (x_content_pool) ekler, böylece otomasyon eklenme sırasına göre işler.
  const addTickerToQueue = async () => {
    const tickerToAdd = manualTicker.toUpperCase().trim();
    if (!tickerToAdd) {
      setError("Lütfen bir ticker giriniz.");
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/x/pool", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: tickerToAdd }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Kuyruğa ekleme hatası");
      setBusy(false);
      return;
    }
    setManualTicker("");
    await loadPool();
    setBusy(false);
  };

  const quickTranslateAndPublish = async () => {
    if (!quickText.trim()) {
      setError("Lütfen çevrilecek ana metni girin.");
      return;
    }
    setBusy(true);
    setError("Çeviri yapılıyor...");
    
    // 1. Çeviri İsteği
    const res = await fetch("/api/admin/x/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        contentType: "translate", 
        manualBaseText: quickText, 
        ticker: quickTicker.toUpperCase().trim() || undefined 
      }),
    });
    
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Çeviri hatası");
      setBusy(false);
      return;
    }
    
    const translatedTexts = data.texts as Record<Locale, string>;
    const tMarket = data.market;
    
    setError("Çeviri başarılı, 5 dilde yayınlanıyor...");
    
    // 2. Paylaşım İsteği
    const failed: string[] = [];
    for (const loc of LOCALES) {
      if (!translatedTexts[loc]) continue;
      
      const finalTxt = data.hashtags ? appendHashtagsWithinLimit(translatedTexts[loc], data.hashtags, MANUAL_POST_LIMIT) : translatedTexts[loc];
      
      let cardParams = undefined;
      if (quickTicker.trim()) {
        cardParams = {
          kind: "stock" as const,
          ticker: quickTicker.toUpperCase().trim(),
          theme: localizedThemeTitle(null, loc),
          changePct: tMarket?.changePct,
          rvol: tMarket?.rvol,
          opportunity: tMarket?.opportunity,
          opportunityLabel: tMarket?.opportunityLabels?.[loc],
          trendLabel: tMarket?.trendLabels?.[loc],
          bars: tMarket?.bars ?? [],
          headline: translatedTexts[loc],
          locale: loc,
        };
      } else {
        cardParams = {
          kind: "promo" as const,
          headline: translatedTexts[loc],
          subheadline: "bogastock.com",
          locale: loc,
        };
      }

      const postRes = await fetch("/api/admin/x/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: loc, contentText: finalTxt, cardParams }),
      });

      if (!postRes.ok) {
        const postData = await postRes.json().catch(() => ({}));
        failed.push(`${loc.toUpperCase()}: ${postData.error || "hata"}`);
      }
    }
    
    setBusy(false);
    if (failed.length) {
      setError(`Bazı diller paylaşılamadı — ${failed.join(" | ")}`);
    } else {
      setError(""); // clear error on full success
      setQuickText("");
      setQuickTicker("");
      alert("Başarıyla 5 dilde çevrildi ve paylaşıldı!");
    }
    
    await loadPosts();
  };

  return (
    <div style={{ padding: 24, fontFamily: "monospace", color: "#e6edf3" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: ACCENT }}>X Studio — @bogastock</h1>
        <Link href="/admin/x-studio/queue" style={{ color: ACCENT, fontSize: 12 }}>Kuyruk Listesi (Manuel Paylaş) →</Link>
      </div>

      {error && <div style={{ color: "#f85149", marginBottom: 12, fontSize: 12, fontWeight: "bold" }}>{error}</div>}

      {/* YENİ: HIZLI ÇOKLU DİL PAYLAŞIMI */}
      <div style={{ marginBottom: 24, padding: 16, border: `2px dashed ${ACCENT}`, borderRadius: 8, background: "#0d1117" }}>
        <h2 style={{ fontSize: 16, color: ACCENT, marginBottom: 12, fontWeight: "bold" }}>⚡ Hızlı Manuel 5-Dil Paylaşımı</h2>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ width: 120 }}>
            <label style={{ display: "block", fontSize: 11, marginBottom: 4, opacity: 0.8 }}>Ticker (Opsiyonel):</label>
            <input
              type="text"
              placeholder="Örn: AAPL"
              value={quickTicker}
              onChange={(e) => setQuickTicker(e.target.value)}
              style={{ ...inputStyle, width: "100%", textTransform: "uppercase" }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 300 }}>
            <label style={{ display: "block", fontSize: 11, marginBottom: 4, opacity: 0.8 }}>Ana Metin (Türkçe yazabilirsiniz, AI 5 dile çevirir):</label>
            <textarea
              placeholder="Örn: $AAPL bilanço sonrası harika görünüyor, hacim artışı pozitif sinyal."
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              style={{ ...inputStyle, width: "100%", height: 60, resize: "vertical" }}
            />
          </div>
          <button
            style={{ ...btnStyle, background: "#8b5cf6", height: 60, marginTop: 20 }}
            disabled={busy || !quickText.trim()}
            onClick={quickTranslateAndPublish}
          >
            Çevir & 5 Dilde Yayınla
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#8b949e", marginTop: 8, marginBottom: 0 }}>
          Not: Metindeki $AAPL gibi cashtag'ler bozulmadan çevrilir. Ticker girerseniz hisse kartı, girmezseniz promo kartı ile birlikte tüm web dillerine ve X'e yayınlanır.
        </p>
      </div>

      <div style={{ marginBottom: 16, display: "flex", gap: 8, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
            Manuel Hisse Seçimi (Analytics, Portfolio vb. sayfalardan inceleyip giriniz):
          </label>
          <input
            type="text"
            placeholder="Ticker giriniz (örn: AAPL, MSFT)"
            value={manualTicker}
            onChange={(e) => setManualTicker(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && processManualTicker()}
            style={{
              ...inputStyle,
              width: "100%",
              textTransform: "uppercase",
            }}
          />
        </div>
        <button
          style={{ ...btnStyle, marginTop: 26, background: "#22c55e" }}
          disabled={busy || !manualTicker.trim()}
          onClick={addTickerToQueue}
          title="Ticker'ı kalıcı kuyruğa ekler — otomasyon eklenme sırasına göre işler"
        >
          Kuyruğa Ekle
        </button>
        <button
          style={{ ...btnStyle, marginTop: 26 }}
          disabled={busy || !manualTicker.trim()}
          onClick={() => processManualTicker(false)}
          title="Kuyruğa eklemeden hemen kısa günlük metin/görsel üretir (tek seferlik önizleme)"
        >
          Analiz Et
        </button>
        <button
          style={{ ...btnStyle, marginTop: 26, background: "#8b5cf6" }}
          disabled={busy || !manualTicker.trim()}
          onClick={() => processManualTicker(true)}
          title="Sektör/rakip/tema analizi yapan, uzun formatlı haftalık gönderi üretir"
        >
          Haftalık Analiz Et
        </button>
      </div>

      {/* Listeden Seç — sitenin gerçek listelerinden (Top100/Trend/Trend
          Adayları) ve Terminal ana sayfasındaki sektör/endeks/emtia/döviz/
          kripto varlıklarından manuel çoklu seçimle kuyruğa ekleme. */}
      <div style={{ marginBottom: 24, padding: 16, border: `1px solid #30363d`, borderRadius: 8, background: "#0d1117" }}>
        <h2 style={{ fontSize: 16, color: ACCENT, marginBottom: 12, fontWeight: "bold" }}>📋 Listeden Seç</h2>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {LIST_PICKER_CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => loadPickerCategory(c.key)}
              style={{
                ...btnStyle,
                background: pickerCategory === c.key ? ACCENT : "#30363d",
                color: pickerCategory === c.key ? "#0d1117" : "#e6edf3",
              }}
              disabled={pickerLoading}
            >
              {c.label}
            </button>
          ))}
        </div>

        {pickerLoading && <div style={{ fontSize: 12, opacity: 0.6 }}>Yükleniyor…</div>}

        {!pickerLoading && pickerCategory && pickerItems.length === 0 && (
          <div style={{ fontSize: 12, opacity: 0.6 }}>Bu liste için şu an canlı veri yok.</div>
        )}

        {!pickerLoading && pickerItems.length > 0 && (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 280, overflowY: "auto", marginBottom: 10 }}>
              {pickerItems.map((it) => (
                <label
                  key={it.ticker}
                  style={{
                    ...inputStyle,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
                    border: pickerSelected.has(it.ticker) ? `1px solid ${ACCENT}` : inputStyle.border,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={pickerSelected.has(it.ticker)}
                      onChange={() => togglePickerItem(it.ticker)}
                    />
                    <span>{it.ticker}</span>
                    <span style={{ opacity: 0.6 }}>{it.label !== it.ticker ? it.label : ""}</span>
                  </span>
                  <span>
                    {it.price != null && <span style={{ opacity: 0.7, marginRight: 10 }}>{formatNumber(it.price, 2)}</span>}
                    {it.changePct != null && (
                      <span style={{ color: it.changePct >= 0 ? "#3fb950" : "#f85149" }}>
                        {it.changePct >= 0 ? "+" : ""}{formatNumber(it.changePct, 2)}%
                      </span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, opacity: 0.7 }}>Mod:</span>
              <button
                onClick={() => setPickerWeekly(false)}
                style={{ ...btnStyle, background: !pickerWeekly ? ACCENT : "#30363d", color: !pickerWeekly ? "#0d1117" : "#e6edf3" }}
              >
                Günlük
              </button>
              <button
                onClick={() => setPickerWeekly(true)}
                style={{ ...btnStyle, background: pickerWeekly ? "#8b5cf6" : "#30363d", color: "#fff" }}
              >
                Haftalık
              </button>
              <span style={{ fontSize: 11, opacity: 0.7, marginLeft: 10 }}>Dil:</span>
              <select
                value={pickerLocale}
                onChange={(e) => setPickerLocale(e.target.value as Locale | "")}
                style={{ ...inputStyle }}
              >
                <option value="">Tümü (5 dil üretilir, hepsi arasından seçersin)</option>
                {LOCALES.map((l) => (
                  <option key={l} value={l}>{l.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <button
              style={{ ...btnStyle, background: "#22c55e" }}
              disabled={busy || pickerSelected.size === 0}
              onClick={addSelectedToPool}
            >
              Seçilenleri Kuyruğa Ekle ({pickerSelected.size})
            </button>

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px dashed #30363d" }}>
              <div style={{ fontSize: 12, color: ACCENT, marginBottom: 8, fontWeight: 700 }}>
                🔁 Tekrarlanan Programlama (otomatik, kalıcı)
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() => setRecurrenceType("interval")}
                  style={{ ...btnStyle, background: recurrenceType === "interval" ? ACCENT : "#30363d", color: recurrenceType === "interval" ? "#0d1117" : "#e6edf3" }}
                >
                  Her N Saatte Bir
                </button>
                {recurrenceType === "interval" && (
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={recurIntervalHours}
                    onChange={(e) => setRecurIntervalHours(Number(e.target.value))}
                    style={{ ...inputStyle, width: 60 }}
                  />
                )}
                <button
                  onClick={() => setRecurrenceType("weekly")}
                  style={{ ...btnStyle, background: recurrenceType === "weekly" ? "#8b5cf6" : "#30363d", color: "#fff" }}
                >
                  Haftalık (NY saati)
                </button>
                {recurrenceType === "weekly" && (
                  <>
                    <select
                      value={recurWeekday}
                      onChange={(e) => setRecurWeekday(Number(e.target.value))}
                      style={{ ...inputStyle }}
                    >
                      {WEEKDAY_LABELS_TR.map((label, idx) => (
                        <option key={idx} value={idx}>{label}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={recurTimeOfDay}
                      onChange={(e) => setRecurTimeOfDay(e.target.value)}
                      style={{ ...inputStyle }}
                    />
                  </>
                )}
              </div>
              <button
                style={{ ...btnStyle, background: "#f59e0b" }}
                disabled={busy || pickerSelected.size === 0}
                onClick={scheduleSelectedRecurring}
              >
                Seçilenleri Tekrarlı Programla ({pickerSelected.size})
              </button>
              <div style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
                Not: Mod/Dil yukarıdaki seçime göre uygulanır. Her tetiklendiğinde AI taze metin üretir, otomasyon (X Bağlantısı) açıksa X'e de paylaşır.
              </div>
            </div>
          </>
        )}
      </div>

      {/* Tekrarlanan Programlar — yukarıdan oluşturulan kalıcı zamanlamaların listesi */}
      <div style={{ marginBottom: 24, padding: 16, border: `1px solid #30363d`, borderRadius: 8, background: "#0d1117" }}>
        <h2 style={{ fontSize: 16, color: ACCENT, marginBottom: 12, fontWeight: "bold" }}>
          🔁 Tekrarlanan Programlar ({recurringSchedules.length})
        </h2>
        {recurringSchedules.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>Tekrarlanan programlama yok.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {recurringSchedules.map((s) => (
            <div key={s.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", opacity: s.enabled ? 1 : 0.5 }}>
              <span>
                {s.ticker} <span style={{ opacity: 0.6 }}>({s.category || s.content_type})</span>
                {s.weekly ? " ★" : ""} {s.locale ? `[${s.locale.toUpperCase()}]` : "[Tümü]"}
              </span>
              <span style={{ opacity: 0.8 }}>
                {s.recurrence_type === "interval"
                  ? `Her ${s.interval_hours} saatte bir`
                  : `Her ${WEEKDAY_LABELS_TR[s.weekday ?? 0]} ${s.time_of_day} NY`}
              </span>
              <span style={{ color: "#f59e0b" }}>Sıradaki: {utcIsoToNyDisplay(s.next_run_at)}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => toggleRecurringSchedule(s.id, !s.enabled)}
                  style={{ ...btnStyle, padding: "4px 8px", fontSize: 10, background: s.enabled ? "#22c55e" : "#30363d" }}
                >
                  {s.enabled ? "Açık" : "Kapalı"}
                </button>
                <button
                  onClick={() => deleteRecurringSchedule(s.id)}
                  title="Sil"
                  style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, padding: "0 4px" }}
                >
                  ✕
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", fontSize: 12, marginBottom: 6, opacity: 0.8 }}>
          AI Talimatı (opsiyonel) — hedefe yönelik bir yönerge girin, AI metni buna göre üretir:
        </label>
        <textarea
          value={customInstruction}
          onChange={(e) => setCustomInstruction(e.target.value)}
          placeholder="örn: Temettü büyümesine odaklan / Kazanç raporundaki öne çıkan noktayı vurgula"
          style={{ ...inputStyle, width: "100%", height: 50, resize: "vertical" }}
        />
      </div>

      {settings && (
        <div style={{ ...inputStyle, display: "flex", alignItems: "center", gap: 20, marginBottom: 20, padding: 12, flexWrap: "wrap" }}>
          <button
            style={{ ...btnStyle, background: settings.enabled ? "#22c55e" : "#30363d", color: settings.enabled ? "#0d1117" : "#e6edf3" }}
            onClick={() => patchSettings({ enabled: !settings.enabled })}
          >
            Otomasyon: {settings.enabled ? "AÇIK" : "KAPALI"}
          </button>
          <button
            title="Kapalıyken hiçbir gönderi gerçekten X'e atılmaz — içerik yine üretilip /news akışına düşer."
            style={{ ...btnStyle, background: settings.x_posting_enabled ? "#22c55e" : "#f85149", color: "#0d1117" }}
            onClick={() => patchSettings({ x_posting_enabled: !settings.x_posting_enabled })}
          >
            X Bağlantısı: {settings.x_posting_enabled ? "AÇIK" : "KAPALI"}
          </button>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Aralık (dk):
            <input
              type="number"
              min={10}
              max={15}
              value={settings.interval_minutes}
              onChange={(e) => setSettings({ ...settings, interval_minutes: Number(e.target.value) })}
              onBlur={(e) => patchSettings({ interval_minutes: Number(e.target.value) })}
              style={{ ...inputStyle, width: 60 }}
            />
          </label>
          <span style={{ opacity: 0.7 }}>
            Kaynak oranı: Top100 {settings.ratio_top100}% / Swing {settings.ratio_swing}% / Trend {settings.ratio_trend}%
          </span>
        </div>
      )}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Kuyruk */}
        <div style={{ flex: 1, minWidth: 320 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 14, color: ACCENT }}>İçerik Kuyruğu ({pool.length})</h2>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={btnStyle} disabled={busy} onClick={fillPool}>Kuyruğu Doldur</button>
              <button
                style={{ ...btnStyle, background: "#f85149" }}
                disabled={busy || pool.length === 0}
                onClick={clearPool}
              >
                Kuyruğu Temizle
              </button>
            </div>
          </div>
          <button style={{ ...btnStyle, background: "#f59e0b", marginBottom: 12, width: "100%" }} disabled={busy} onClick={generatePromoText}>
            Promo Gönder (Manuel)
          </button>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 6 }}>
              Resim Yükle:
            </div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    setUploadedImage(ev.target?.result as string);
                  };
                  reader.readAsDataURL(file);
                }
              }}
              style={{
                ...inputStyle,
                width: "100%",
                cursor: "pointer",
              }}
            />
            {uploadedImage && (
              <div style={{ marginTop: 12 }}>
                <img src={uploadedImage} alt="uploaded" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 6, border: `1px solid ${ACCENT}` }} />
                <button
                  style={{ ...btnStyle, background: "#f85149", marginTop: 8, width: "100%" }}
                  onClick={() => setUploadedImage(null)}
                >
                  Resim Sil
                </button>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 500, overflowY: "auto" }}>
            {pool.map((item) => (
              <div
                key={item.id}
                style={{
                  ...inputStyle,
                  border: selected?.id === item.id ? `1px solid ${ACCENT}` : inputStyle.border,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, marginRight: 8 }}>
                  <span>
                    {item.ticker} <span style={{ opacity: 0.6 }}>({item.source})</span>
                    {(item.weekly || item.locale) && (
                      <span style={{ opacity: 0.7, fontSize: 10, marginLeft: 6 }}>
                        {item.weekly ? "★ Haftalık" : ""}{item.weekly && item.locale ? " · " : ""}{item.locale ? item.locale.toUpperCase() : ""}
                      </span>
                    )}
                  </span>
                  <span style={{ opacity: 0.6, fontSize: 11 }}>{item.sector || item.theme || ""}</span>
                </div>
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={() => (MARKET_ASSET_CATEGORIES.has(item.source) ? generateMarketAssetText(item, false) : generateStockText(item, false))}
                    title="Kısa günlük gönderi üret"
                    style={{ ...btnStyle, padding: "4px 8px", fontSize: 10, border: !item.weekly ? `1px solid ${ACCENT}` : "none" }}
                  >
                    Günlük
                  </button>
                  <button
                    onClick={() => (MARKET_ASSET_CATEGORIES.has(item.source) ? generateMarketAssetText(item, true) : generateStockText(item, true))}
                    title="Sektör/rakip/tema analizi yapan, uzun formatlı haftalık gönderi üret"
                    style={{ ...btnStyle, padding: "4px 8px", fontSize: 10, background: "#8b5cf6", border: item.weekly ? "1px solid #fff" : "none" }}
                  >
                    Haftalık
                  </button>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deletePoolItem(item.id); }}
                  title="Kuyruktan sil"
                  style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, marginLeft: 10, padding: "0 4px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Editör / Önizleme */}
        <div style={{ flex: 1, minWidth: 360 }}>
          <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>
            {mode === "promo"
              ? "Promo Gönderisi"
              : mode === "list"
              ? `${listTitle} Özeti`
              : mode === "market_asset" && selected
              ? `${selected.company || selected.ticker} Gönderisi`
              : selected
              ? `${selected.ticker} Gönderisi`
              : "Bir hisse veya varlık seçin"}
            {(mode === "stock" || mode === "market_asset") && weeklyMode && (
              <span style={{ color: "#8b5cf6", fontSize: 12, marginLeft: 8 }}>(Haftalık Analiz)</span>
            )}
          </h2>

          {mode === "list" && listItems.length > 0 && (
            <div style={{ ...inputStyle, marginBottom: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              {listItems.map((it) => (
                <span key={it.ticker} style={{ color: it.changePct >= 0 ? "#3fb950" : "#f85149" }}>
                  {it.ticker} {it.changePct >= 0 ? "+" : ""}{formatNumber(it.changePct, 1)}%
                </span>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {LOCALES.map((l) => (
              <button
                key={l}
                onClick={() => { setLocale(l); setImageUrl(null); }}
                style={{ ...btnStyle, background: locale === l ? ACCENT : "#30363d", color: locale === l ? "#0d1117" : "#e6edf3" }}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>

          <textarea
            style={{ ...inputStyle, width: "100%", height: 80, resize: "vertical" }}
            value={texts[locale]}
            maxLength={MANUAL_POST_LIMIT}
            onChange={(e) => setTexts((t) => ({ ...t, [locale]: e.target.value }))}
            placeholder="AI metni burada görünecek, düzenlenebilir..."
          />

          {hashtags && (
            <div style={{ ...inputStyle, marginTop: 6, opacity: 0.75, display: "flex", justifyContent: "space-between" }}>
              <span>Paylaşırken otomatik eklenecek: {hashtags}</span>
              <span>{texts[locale] ? appendHashtagsWithinLimit(texts[locale], hashtags, MANUAL_POST_LIMIT).length : 0}/{MANUAL_POST_LIMIT}</span>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {mode !== "list" && (
              <button style={btnStyle} disabled={busy || !texts[locale]} onClick={previewImage}>Görseli Önizle</button>
            )}
            <button style={{ ...btnStyle, background: "#22c55e" }} disabled={busy || !texts[locale]} onClick={publish}>
              {settings && !settings.x_posting_enabled ? "Yayınla (Sadece /news)" : "Şimdi Paylaş (API)"}
            </button>
            <button
              title="Üretilen tüm dillerin metnini kendi /news sayfalarına paylaşır"
              style={{ ...btnStyle, background: "#8957e5" }}
              disabled={busy || LOCALES.every((l) => !texts[l]?.trim())}
              onClick={publishAll}
            >
              {settings && !settings.x_posting_enabled ? "Tüm Dillerde Yayınla (/news)" : "Tüm Dillerde Paylaş (API)"}
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap", padding: 10, border: "1px dashed #30363d", borderRadius: 6 }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Zamanla ({locale.toUpperCase()}, NY saati):</span>
            <input
              type="date"
              value={scheduleDate}
              min={nyTodayDateStr()}
              max={nyMaxDateStr()}
              onChange={(e) => setScheduleDate(e.target.value)}
              style={{ ...inputStyle }}
            />
            <input
              type="time"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              style={{ ...inputStyle }}
            />
            <button style={{ ...btnStyle, background: "#8b5cf6" }} disabled={busy || !texts[locale]} onClick={schedulePost}>
              Zamanla
            </button>
          </div>

          {imageUrl && (
            <>
              <img src={imageUrl} alt="preview" style={{ marginTop: 16, width: "100%", borderRadius: 8, border: "1px solid #30363d" }} />

              <div style={{ marginTop: 12, padding: 12, border: `1px dashed ${ACCENT}`, borderRadius: 6 }}>
                <div style={{ fontSize: 11, color: ACCENT, marginBottom: 8, fontWeight: 700 }}>
                  MANUEL PAYLAŞIM (X API kredisi gerektirmez)
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button style={{ ...btnStyle, background: "#30363d" }} onClick={downloadImage}>Görseli İndir</button>
                  <button style={{ ...btnStyle, background: "#30363d" }} onClick={copyText}>Metni Kopyala</button>
                </div>
                <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
                  x.com'da @bogastock hesabınla yeni gönderi aç, indirdiğin görseli ve kopyaladığın metni ekleyip paylaş.
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Zamanlanmış */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>Zamanlanmış Gönderiler ({scheduled.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {scheduled.length === 0 && <div style={{ fontSize: 12, opacity: 0.5 }}>Zamanlanmış gönderi yok.</div>}
          {scheduled.map((s) => (
            <div key={s.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{s.content_type === "promo" ? "PROMO" : s.content_type === "list" ? `LIST:${s.list_type}` : s.ticker} [{s.locale}]</span>
              <span style={{ opacity: 0.7 }}>{s.content_text?.slice(0, 60)}</span>
              <span style={{ color: "#f59e0b" }}>{utcIsoToNyDisplay(s.scheduled_at)}</span>
              <button
                onClick={() => cancelSchedule(s.id)}
                title="İptal et"
                style={{ background: "transparent", border: "none", color: "#f85149", cursor: "pointer", fontSize: 13, marginLeft: 10, padding: "0 4px" }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Geçmiş */}
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 14, color: ACCENT, marginBottom: 8 }}>Son Gönderiler</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {posts.map((p) => (
            <div key={p.id} style={{ ...inputStyle, display: "flex", justifyContent: "space-between" }}>
              <span>{p.content_type === "promo" ? "PROMO" : p.content_type === "list" ? `LIST:${p.list_type}` : p.ticker} [{p.locale}]</span>
              <span style={{ opacity: 0.7 }}>{p.content_text?.slice(0, 60)}</span>
              <span style={{ color: p.status === "posted" ? "#22c55e" : p.status === "failed" ? "#f85149" : "#f59e0b" }}>{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
