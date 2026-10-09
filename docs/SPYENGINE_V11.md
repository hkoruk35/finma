# SPY Engine V11 — Karar Hiyerarşisi (V10 ile yan yana)

Sayfa: `/admin/spyengine/v2` · API: `/api/admin/spyengine/v2/decision` · V10 (`/admin/spyengine/v1`) DEĞİŞMEDİ.
Talimat: `SPY Engine V11 — Karar Hiyerarşisi Yeniden Tasarımı.docx` (2026-10-08).

## Mimari (talimattan sapma)
Talimat "backend FastAPI" der. Gerçekte FastAPI servisi (`spy_signal_engine/`) 2026-09-30'da durduruldu ve frontend onu kullanmıyor;
V10'un tüm sunucu mantığı Next.js route'larında + `frontend/lib/spyengine/`. V11 de aynı yolu izler:
**tek karar modülü = `frontend/lib/spyengine/v11/engine.ts`** (saf TS, sunucuda çalışır). Sayfa hiçbir yön hesaplamaz.

| Dosya | Görev |
|---|---|
| `v11/config.ts` | Tüm eşikler (başlangıç değerleri; "EK:" işaretliler belgede sayısı olmayanlar) |
| `v11/engine.ts` | L1 rejim · L2 skor/yön · L3–L5 kurulum/tetik/yönetim · olay kalitesi · hüküm |
| `v11/archive.ts` | 60 gün olay isabeti + geriye dönük V11 işlem sonuçları |
| `v11/snapshot.ts` | Sayfa yükü (karar üretmez) |
| `v11/service.ts` | Veri çekme (Yahoo 5m 60g + canlı 5m, opsiyon duvarları) + önbellek |
| `v11/engine.test.ts` | `npx tsx lib/spyengine/v11/engine.test.ts` — çelişki tablosunun her satırı (C1–C12) + değişmezler |

Gün her istekte kapanmış 5m RTH mumlarıyla baştan "oynatılır" → histerezis sunucuda bellek tutmadan deterministik; aynı kod arşivde çalışır.
`flow.ts` içinde yalnızca `profileOf` `export` edildi (başka değişiklik yok). Yeni gösterge eklenmedi.

## V10 haritası (hangi dosya hangi paneli/hükmü üretiyor) → V11 karşılığı
| V10 paneli / hükmü | Üreten | V11 |
|---|---|---|
| Karar Desteği (LONG/SHORT, YENİ YÖN) | `openingMap.ts` liveDirection/decisionRead, `page.tsx` DecisionPanel | Karar Kartı (tek) |
| Senaryo Takibi, bacak zinciri, BACAK BİTTİ | `scenarioTrack.ts`, `scenario.ts` | Karar Kartı + "Bugünkü bacaklar" arşiv şeridi |
| Gün tipi / "Son 2 saat: TREND GÜNÜ" | `dayType.ts` (`page.tsx:1975`) | Tek rejim rozeti (L1) |
| Açılış rejimi kartı | `openingMap.ts` openingRegime | AÇILIŞ durumu; 10:00'da arşiv satırı |
| 4h/1h/30m/15m/5m kartları | `openingMap.ts` tfRead, `panels.tsx` | 1h+30m → htf_bias girdisi; 15m yön; 5m tetik (tek satır) |
| LONG/SHORT plan hücreleri | `tradingPlan.ts`, `PlanCell` | Yalnızca rejime/yöne uyan kurulum + R/R kapısı |
| Erken uyarı / olay listesi | `flow.ts` flowRead | Olay kalitesi A/B/C + Erken Uyarı Şeridi |
| Pivot "~130 dk" varış tahmini | `pivots.ts` pivotRead + `PivotCard` | Kaldırıldı; seviye listesinde ATR mesafesi |
| Tahmin haritası / gün sonu kapanış (%41) | `forecastModel.ts`, `ForecastMap.tsx` | V11 ana ekranında yok; Kanıt → Deneysel |
| POC/VAH/VAL, havuzlar, pivotlar, opsiyon duvarları (4 panel) | `flow.ts`, `pivots.ts`, `optionLevels.ts` | Tek birleşik seviye listesi |

## Talimatın istediği doğrulama: "Son 2 saat" hangi pencereye bakıyor?
`page.tsx:1972-1976`: son **24 adet 5m mum** dilimlenip `dayTypeLive()` çağrılıyor, ama VWAP serisi **tüm günün kümülatif VWAP'ı**.
`dayType.ts` etiketteki "▼ aşağı" yönünü *fiyatın VWAP'a göre tarafından* (kapanışların ≥%80'i VWAP altı) çıkarır, fiyat yönünden değil.
Fiyat 14:00–16:00 arası 772,5→773,9 yükselirken hâlâ gün-VWAP'ının altındaysa "TREND GÜNÜ ▼" çıkar; yani pencere bayat değil,
**etiket VWAP-tarafını yön diye sunuyor** (kök neden). V11'de bu etiket yok.

## Belgede olmayan / yorumlanan yerler
- "Sayfa yerleşimi, Bant 6" belgede yok (docx'te bu bölüm yok): yerleşimi ilkelerden türettim (başlık → fiyat/rejim → Karar Kartı → Erken Uyarı Şeridi → açılış/bacak satırı → grafik → Kanıt).
- Sonuç ölçütü "✓ ≥0,5×ATR gitti": ters yönden önce ulaşma (first-touch) olarak tanımlandı; yalnızca "ulaştı" ölçütünde rastgele taban %70 çıkıyor ve olaylar tabandan ayrışmıyor. First-touch tabanı ≈ %47.
- T1 kuralı: en yakın seviye <1R ise bir sonraki seviye (tek adım); sonra R/R<1 ise PAS.
- Kenar tetiği asgari olay sınıfı = A (belge); `edgeTriggerMinGrade: "B"` ile gevşetilebilir.
- Hacim profili 5m mumlardan (V10'da 1m); çünkü 60 günlük arşiv yalnızca 5m. Opsiyon duvarları geçmiş arşive girmez.
- İlke 7 uygulaması: arşivde (tür+seviye+sınıf, n≥20) isabet <%50 ise olay şeritten düşer, Kanıt→Deneysel'e iner.

## Arşiv bulguları (59 seans, 5m, ilk kurulum — 2026-10-08)
Talimat "60 günlük arşivle kalibre edilir" der; ilk sonuçlar kalibrasyon girdisidir, edge kanıtı değildir:
V11 hükümleriyle 20 işlem (hepsi YATAY kenar), kazanç %55, ort. −0,10R. TREND kurulumu hiç tetiklenmedi.
SWEEP_LOW A %54 (107), SWEEP_HIGH A %45 (76), PUSH_DOWN A %33 (27) — taban %47.
