import {
  Badge,
  fmt,
  INSET,
  Panel,
  Row,
  signed,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "@/components/admin/supertrade/ui";
import { CONFIDENCE_LABEL } from "@/lib/v4/scoring";
import type { AssetSnapshot, ForecastBundle } from "@/lib/v4/types";

export default function V4SuperTradeForecast({
  snapshot,
  precomputed,
}: {
  snapshot: AssetSnapshot;
  /** Kapanış Motoru'nun sunucu tarafında hesapladığı özet. Üç evresi var:
   *  LIVE_AFTERNOON (NY saatiyle 13:00'ten itibaren, piyasa açıkken —
   *  gelişmekte olan tahmin), LIVE_CLOSING (seans kapanışına ≤30 dk kala —
   *  asıl karar penceresi) ve FINAL (seans tamamen kapandıktan sonra, sabit
   *  özet). Her istekte güncellenir. Üç pencere dışında null — o durumda
   *  aynı basit mantık istemci tarafında anlık hesaplanır. */
  precomputed?: ForecastBundle | null;
}) {
  if (!snapshot) return null;

  const { levels, context, spotPrice, futuresPrice, vixPrice } = snapshot;

  let bias: "BULLISH" | "BEARISH" | "NEUTRAL";
  let score: number;
  let analysisText: string;

  if (precomputed) {
    bias = precomputed.bias;
    score = precomputed.score;
    analysisText = precomputed.analysisText;
  } else {
    // Kapanış Motoru'nun her iki penceresi de (canlı kapanış / final) henüz
    // açık değil — sekme yine de anında kullanılabilir olsun diye aynı basit
    // 4 faktörlü tahmin burada, istemci tarafında çalışır.
    score = 0;

    // 1. VWAP konumu
    if (futuresPrice > levels.futures.vwap) score += 1;
    else if (futuresPrice < levels.futures.vwap) score -= 1;

    // 2. ORH / ORL konumu
    if (spotPrice > levels.spot.orh) score += 2;
    else if (spotPrice < levels.spot.orl) score -= 2;

    // 3. VIX Trendi
    if (context.volatility.trend === "FALLING") score += 1;
    else if (context.volatility.trend === "RISING") score -= 1;

    // 4. Tarihsel Benzerlik
    if (context.analog.bias === "BULLISH") score += 1;
    else if (context.analog.bias === "BEARISH") score -= 1;

    bias = "NEUTRAL";
    if (score >= 2) bias = "BULLISH";
    else if (score <= -2) bias = "BEARISH";

    if (bias === "BULLISH") {
      analysisText = "Kapanışın VWAP ve direnç seviyeleri üzerinde olması, alıcıların kontrolü ele aldığını gösteriyor. VIX seviyesindeki gevşeme de bu durumu destekliyor. Ertesi gün için yukarı yönlü (Gap Up) açılış veya yükseliş trendinin devamı beklenebilir.";
    } else if (bias === "BEARISH") {
      analysisText = "Kapanışın kritik seviyelerin ve VWAP'ın altında kalması, zayıflığa işaret ediyor. Artan veya yüksek kalan VIX oynaklığı satıcıların iştahlı olduğunu gösteriyor. Ertesi gün zayıf bir açılış (Gap Down) muhtemeldir.";
    } else {
      analysisText = "Piyasa günü denge arayışı içinde tamamladı. Belirgin bir alıcı veya satıcı baskısı yok. Yarınki açılış yönü büyük ihtimalle gece seansındaki (overnight) gelişmelere bağlı olacaktır.";
    }
  }

  const isLiveAfternoon = precomputed?.stage === "LIVE_AFTERNOON";
  const isLiveClosing = precomputed?.stage === "LIVE_CLOSING";
  const isLive = isLiveAfternoon || isLiveClosing;
  const panelTitle = isLiveAfternoon
    ? "Öğleden Sonra Gelişen Yön Tahmini"
    : isLiveClosing
    ? "Kapanışa Doğru Canlı Yön Tahmini (Karar Penceresi)"
    : "Ertesi Gün Yön Beklentisi";
  const structures = precomputed?.structures ?? [];

  return (
    <div className="mt-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={panelTitle} padding="p-4">
          <div className="flex flex-wrap items-center gap-2">
            {isLiveAfternoon && (
              <Badge tone="brand" className="animate-pulse">
                CANLI · GELİŞİYOR
              </Badge>
            )}
            {isLiveClosing && (
              <Badge tone="brand" className="animate-pulse">
                CANLI · KAPANIŞ KARAR PENCERESİ
              </Badge>
            )}
            <Badge tone={bias === "BULLISH" ? "up" : bias === "BEARISH" ? "down" : "neutral"}>
              {bias === "BULLISH" ? "YÜKSELİŞ BEKLENTİSİ" : bias === "BEARISH" ? "DÜŞÜŞ BEKLENTİSİ" : "YATAY / YÖNSÜZ"}
            </Badge>
            {precomputed?.confidence && <Badge tone="warn">Güven: {CONFIDENCE_LABEL[precomputed.confidence]}</Badge>}
            <span className="text-[14px] font-medium text-slate-200">Tahmin Skoru: {signed(score, 0)}</span>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-slate-300">{analysisText}</p>
          {!precomputed && (
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Kapanış Motoru şu an aktif değil — bu tahmin, NY saatiyle 13:00&apos;ten itibaren (piyasa açıkken)
              veya seans tamamen kapandıktan sonra sunucu tarafında otomatik olarak hesaplanıp güncellenir.
            </p>
          )}
        </Panel>

        <Panel
          title={precomputed?.factors?.length ? "Kapanış Faktörleri" : "Tahmin Faktörleri"}
          hint={precomputed?.factors?.length ? "ölçülen 6 faktör" : undefined}
          padding={precomputed?.factors?.length ? "p-0" : "p-4"}
        >
          {precomputed?.factors?.length ? (
            <Table bordered={false}>
              <THead>
                <tr>
                  <Th>Faktör</Th>
                  <Th align="right">Ölçüm</Th>
                </tr>
              </THead>
              <TBody>
                {precomputed.factors.map((f, i) => (
                  <Tr key={`${f.label}-${i}`}>
                    <Td valueClass="text-slate-400">{f.label}</Td>
                    <Td
                      align="right"
                      valueClass={f.weight > 0 ? "text-[#22c55e]" : f.weight < 0 ? "text-[#ef4444]" : "text-slate-400"}
                    >
                      {f.detail}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : (
            <div className="space-y-2">
              <Row
                label="Kapanış Seviyesi"
                value={fmt(spotPrice)}
                valueClass={spotPrice > levels.spot.orh ? "text-[#22c55e]" : spotPrice < levels.spot.orl ? "text-[#ef4444]" : "text-slate-300"}
              />
              <Row
                label="VWAP Durumu (Vadeli)"
                value={`Vadeli ${futuresPrice > levels.futures.vwap ? "Üzerinde" : "Altında"}`}
                valueClass={futuresPrice > levels.futures.vwap ? "text-[#22c55e]" : "text-[#ef4444]"}
              />
              <Row
                label="Oynaklık (VIX)"
                value={`${fmt(vixPrice)} - ${context.volatility.trend === "RISING" ? "Yükseliyor" : context.volatility.trend === "FALLING" ? "Düşüyor" : "Yatay"}`}
                valueClass={context.volatility.trend === "FALLING" ? "text-[#22c55e]" : context.volatility.trend === "RISING" ? "text-[#ef4444]" : "text-slate-300"}
              />
              <Row
                label="Tarihsel Benzerlik"
                value={context.analog.bias === "BULLISH" ? "Yükseliş" : context.analog.bias === "BEARISH" ? "Düşüş" : "Nötr"}
                valueClass={context.analog.bias === "BULLISH" ? "text-[#22c55e]" : context.analog.bias === "BEARISH" ? "text-[#ef4444]" : "text-slate-300"}
              />
            </div>
          )}
        </Panel>
      </div>

      {structures.length > 0 && (
        <Panel
          title="Gecelik Opsiyon Önerisi"
          hint={`Kapanış Motoru · ${isLive ? "canlı, gelişen tahmin" : "final özet"} yönüne göre`}
        >
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {structures.map((s) => (
              <article key={s.id} className={`${INSET} flex flex-col p-3.5`}>
                <h4 className="text-[13px] font-medium leading-snug text-slate-100">{s.name}</h4>
                <div className="mt-2.5 space-y-0.5 border-t border-[#1c2635] pt-2.5">
                  <Row label="Bacaklar" value={<span className="font-mono text-[11px]">{s.legs}</span>} />
                  <Row label={s.netLabel} value={`$${fmt(s.netAmount, 0)}`} />
                  <Row label="Maksimum risk" value={`$${fmt(s.maxLoss, 0)}`} valueClass="font-medium text-[#ef4444]" />
                  <Row
                    label="Maksimum kâr"
                    value={s.maxProfit === null ? "Teorik sınırsız" : `$${fmt(s.maxProfit, 0)}`}
                    valueClass="font-medium text-[#22c55e]"
                  />
                  <Row label="Başa baş" value={s.breakeven} />
                </div>
                <p className="mt-2.5 border-t border-[#1c2635] pt-2.5 text-[11px] leading-relaxed text-slate-400">
                  {s.reason}
                </p>
              </article>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Primler Black-Scholes ile modellenmiş teorik değerlerdir, vade ertesi seansın açılışına kadar
            uzatılmıştır (0DTE değil). Canlı OPRA kotasyonu değildir ve otomatik emre dönüşmez.
          </p>
        </Panel>
      )}
    </div>
  );
}
