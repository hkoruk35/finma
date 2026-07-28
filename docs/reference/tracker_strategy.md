# BOGA Tracker Sayfası — Strateji & Yapı Dökümanı

> **Amaç:** 1W/1D trend filtresiyle seçilen hisseleri 1H güncelleme ile izlemek
> ve aynı 1H verisiyle giriş kararı vermek.

---

## Genel Çerçeve: 2 Katmanlı Yaklaşım

| Katman | Zaman Dilimi | Amaç | Güncelleme |
|--------|-------------|------|-----------|
| **Tarama** | 1W + 1D | Watchlist'e ekleme kriteri | Manuel / haftalık |
| **İzleme + Giriş** | 1H | Tracker sayfası — hem izle hem giriş karar ver | Saatbaşı 09:15–16:15 |

**Temel kural:** 15M kullanılmaz. 15M gürültü üretir, swing ve options süresiyle uyumsuzdur.
1H mum kapanışı hem izleme sinyali hem giriş onayıdır.

Ek kural: 1D bear trendinde 1H bullish sinyal → giriş yapılmaz. Üst katman her zaman önce gelir.

---

## Katman 1 — Tarama (1W + 1D)

### Watchlist'e Ekleme Kriterleri

**Temel filtreler:**
- 1W fiyat EMA20 üstünde VE yükselen trend yapısı (higher highs, higher lows)
- 1D fiyat EMA50 üstünde
- 1D RSI: 45–70 arası (aşırı alım değil, momentum devam ediyor)
- Hacim: Son 1D hacim, 20 günlük ortalama hacmin en az %80'i

**Hisse tipi etiketleme:**

| Tip | Ek Kriter |
|-----|-----------|
| **Swing** | 1D'de net destek kırılması veya breakout yakını |
| **Long** | 1W trendi güçlü, fundamentals pozitif, düşük beta |
| **Option (Long Call)** | IV Rank < 50, yaklaşan katalist, güçlü momentum |
| **CSP (Cash Secured Put)** | 1D support yakını, IV yüksek, temettü geçmişi pozitif |
| **CC (Covered Call)** | Portföyde mevcut hisse, 1H yatay/dar range, yüksek IV |

---

## Katman 2 — İzleme + Giriş (1H)

### Tablo Yapısı (Sütunlar)

| Sütun | İçerik | Güncelleme |
|-------|--------|-----------|
| **Ticker** | Sembol + Tip etiketi (Swing/Long/Opt/CSP/CC) | — |
| **Fiyat** | Son 1H kapanış fiyatı | Saatbaşı |
| **Değişim %** | Günlük % değişim, renk kodlu | Saatbaşı |
| **Hacim** | Son 1H hacim / 20-bar ort. hacim oranı | Saatbaşı |
| **EMA20** | 1H EMA20 değeri + fiyata göre konum (↑↓) | Saatbaşı |
| **EMA50** | 1H EMA50 değeri + konum | Saatbaşı |
| **EMA200** | 1H EMA200 değeri + konum | Saatbaşı |
| **EMA Durum** | Bullish / Yükseliş / Nötr / Düşüş / Bearish | Saatbaşı |
| **RSI (1H)** | 1H RSI-14 değeri, renk kodlu | Saatbaşı |
| **Mum Paterni** | Son kapanan 1H mumda tespit edilen patern | Saatbaşı |
| **Sinyal** | AL / İzle / Bekle / SAT | Saatbaşı |
| **Not** | Manuel not alanı | Manuel |

### EMA Sıralama Durumu

```
Bullish  → Fiyat > EMA20 > EMA50 > EMA200   (en güçlü)
Yükseliş → Fiyat > EMA20 > EMA50, EMA200 altında
Nötr     → EMA'lar birbirine yakın veya karışık
Düşüş    → Fiyat < EMA20 < EMA50
Bearish  → Fiyat < EMA20 < EMA50 < EMA200   (en zayıf)
```

### Renk Kodlama Sistemi

**Satır arka planı:**
- Açık yeşil → EMA Bullish + RSI 50–70 + hacim oranı ≥ 0.8
- Açık sarı → 2/3 koşul pozitif (karışık sinyal)
- Nötr/beyaz → Bekleme aşaması
- Açık kırmızı → EMA bearish veya RSI < 40

**EMA sütunları:**
- Fiyat > EMA → yeşil değer ↑
- Fiyat < EMA → kırmızı değer ↓
- Fiyat EMA'ya %0.5 yakın → turuncu (kritik seviye, dikkat)

**RSI:**
- 70+ → kırmızı (aşırı alım)
- 50–70 → yeşil (momentum bölgesi)
- 40–50 → sarı (nötr)
- 40 altı → kırmızı (zayıf momentum)

**Hacim oranı (son 1H / 20-bar ort.):**
- ≥ 1.5x → koyu yeşil (güçlü katılım)
- 0.8–1.5x → normal
- < 0.8x → gri (düşük katılım, sinyal zayıf)

### İzlenecek Mum Paternleri (1H)

**Bullish — giriş sinyali adayı:**
- Hammer / Inverted Hammer
- Bullish Engulfing
- Morning Star
- Bullish Harami
- Piercing Line
- Dragonfly Doji (destek üstünde)

**Bearish — çıkış veya pozisyon alma uyarısı:**
- Shooting Star / Hanging Man
- Bearish Engulfing
- Evening Star
- Bearish Harami
- Gravestone Doji (direnç altında)

**Nötr / devam:**
- Doji (karar aşaması, bir sonraki mumu bekle)
- Spinning Top

### Sinyal Mantığı (1H — otomatik)

```
AL    → EMA Durum = Bullish veya Yükseliş
          VE RSI 50–70
          VE bullish mum paterni
          VE hacim oranı ≥ 0.8

İzle  → Yukarıdaki koşulların 2/3'ü karşılanıyor
          (henüz tam onay yok, bir sonraki mumu bekle)

SAT   → EMA Durum = Bearish veya Düşüş
          VE RSI < 45
          VE bearish mum paterni

Bekle → Diğer tüm durumlar
```

### Giriş Kararı (1H kapanış bazlı)

Sinyal = AL olduğunda, 1H mum kapanışında pozisyon alınır.
15M beklenmez, 15M sinyali aranmaz.

```
Entry  = AL sinyali veren 1H mumun kapanış fiyatı
          veya bir sonraki 1H mumun açılışı
Stop   = AL mumunun low'u altı (veya en yakın 1H destek altı)
Risk   = Entry - Stop
Hedef1 = Entry + (Risk × 1.5)   → %60 pozisyon kapat
Hedef2 = Entry + (Risk × 2.5)   → %40 kalan, trailing stop
```

### Tip Bazlı Giriş Farklılıkları

**Swing:**
- Entry: 1H AL sinyali kapanışında
- Stop: 1H mum lows
- DTE (opsiyon ise): 7–14 gün

**Long (pozisyon):**
- Entry: 1H AL sinyali, 1D trendi de yukarı ise
- Stop: daha geniş — 1H destek bölgesi altı
- Hedef: açık uçlu, trailing stop

**Option (Long Call):**
- Entry: 1H AL sinyali + IV Rank < 40 kontrolü
- Strike: ATM veya 1 adım OTM
- DTE: 21–45 gün (theta decay'e karşı koruma)

**CSP (Cash Secured Put):**
- Entry: 1D destek bölgesinde, 1H düşüş yavaşlıyor
- Strike: 1D destek hizasında OTM put
- DTE: 7–21 gün

**CC (Covered Call):**
- Entry: 1H direnç bölgesine yaklaşırken, momentum yavaşlıyor
- Strike: 1H direnç hizasında OTM call
- DTE: 7–14 gün

---

## Hover Grafik — TradingView Mini Chart

Ticker hücresinin üzerine gelindiğinde (hover) küçük bir popup açılır.

**İçerik:**
- Son 20 mum — 1H zaman dilimi
- EMA20 (mavi), EMA50 (turuncu), EMA200 (kırmızı) çizgileri
- Hacim barları altta
- Boyut: ~420 x 260 px

**Uygulama — TradingView Widget (seçilen yöntem):**

```html
<!-- TradingView Mini Chart Widget -->
<div class="tradingview-widget-container">
  <div class="tradingview-widget-container__widget"></div>
  <script type="text/javascript"
    src="https://s3.tradingview.com/external-embedding/embed-widget-mini-symbol-overview.js">
  {
    "symbol": "AAPL",
    "width": 420,
    "height": 220,
    "locale": "en",
    "dateRange": "1D",
    "colorTheme": "light",
    "isTransparent": false,
    "autosize": false,
    "largeChartUrl": "https://www.tradingview.com/chart/?symbol=AAPL"
  }
  </script>
</div>
```

**Parametre notları:**
- `dateRange: "1D"` → bugünün 1H mumlarını gösterir (son ~20 mum)
- `symbol` değeri hover'daki ticker ile dinamik olarak değişir
- `largeChartUrl` → tıklanınca TradingView tam ekran açar
- Ücretsiz, API key gerekmez, iframe embed çalışır

**Alternatif (yedek):**
```
https://finviz.com/chart.ashx?t=AAPL&ty=c&ta=1&p=i60&cs=l
```
- `p=i60` → 1H intraday
- TradingView yüklenemezse `<img>` tag olarak kullanılır

---

## Tracker Güncelleme Takvimi

| Zaman (ET) | Eylem |
|-----------|-------|
| 09:15 | Bot başlar — tüm tracker listesi için Yahoo Finance'tan 1H veri çek, EMA/RSI/patern hesapla, `tracker_output.json` yaz |
| 10:00 | Saatbaşı güncelleme — aynı işlem |
| 11:00 | Saatbaşı güncelleme |
| 12:00 | Saatbaşı güncelleme |
| 13:00 | Saatbaşı güncelleme |
| 14:00 | Saatbaşı güncelleme |
| 15:00 | Saatbaşı güncelleme |
| 16:00 | Saatbaşı güncelleme |
| 16:15 | Son güncelleme — gün sonu kapanış verileri, pozisyon notları |

**Toplam:** Günde 9 güncelleme (09:15 + 7 saatbaşı + 16:15 kapanış)

---

## Veri Altyapısı — Web + Bot Destekli

### tracker_output.json Yapısı

Her saatbaşı bot tarafından üretilir. React tracker sayfası bu dosyayı okur.

```json
{
  "updated_at": "2026-05-25T14:00:00",
  "market_status": "open",
  "tickers": [
    {
      "ticker": "AAPL",
      "type": "Swing",
      "price": 213.45,
      "change_pct": 1.23,
      "volume_ratio": 1.4,
      "ema20": 210.12,
      "ema50": 205.67,
      "ema200": 195.30,
      "ema_status": "Bullish",
      "rsi": 62.4,
      "candle_pattern": "Hammer",
      "signal": "AL",
      "note": ""
    }
  ]
}
```

### Python Bot — Veri Çekme

```python
import yfinance as yf
import pandas as pd
import json
from datetime import datetime

TRACKER_LIST = ["AAPL", "NVDA", "TSLA", "SPY", "QQQ", "MSFT", "AMD"]

def calc_ema(series, span):
    return series.ewm(span=span, adjust=False).mean().iloc[-1]

def calc_rsi(series, period=14):
    delta = series.diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss
    return (100 - 100 / (1 + rs)).iloc[-1]

def detect_pattern(df):
    c = df.iloc[-1]
    p = df.iloc[-2]
    body = abs(c.Close - c.Open)
    rng  = c.High - c.Low
    lower_wick = min(c.Open, c.Close) - c.Low
    upper_wick = c.High - max(c.Open, c.Close)
    bullish = c.Close > c.Open
    prev_bullish = p.Close > p.Open
    prev_body = abs(p.Close - p.Open)
    if body < rng * 0.1:
        return "Doji"
    if bullish and not prev_bullish and body > prev_body:
        return "Bullish Engulfing"
    if not bullish and prev_bullish and body > prev_body:
        return "Bearish Engulfing"
    if bullish and lower_wick > body * 2 and upper_wick < body * 0.5:
        return "Hammer"
    if upper_wick > body * 2 and lower_wick < body * 0.5:
        return "Shooting Star" if not bullish else "Inv. Hammer"
    return "—"

def ema_status(price, e20, e50, e200):
    if price > e20 > e50 > e200:
        return "Bullish"
    if price > e20 > e50:
        return "Yükseliş"
    if price < e20 < e50 < e200:
        return "Bearish"
    if price < e20 < e50:
        return "Düşüş"
    return "Nötr"

def signal(ema_s, rsi, pattern):
    bull_patterns = ["Hammer", "Bullish Engulfing", "Inv. Hammer", "Morning Star"]
    bear_patterns = ["Shooting Star", "Bearish Engulfing", "Evening Star"]
    bull = ema_s in ("Bullish", "Yükseliş") and 50 <= rsi <= 70
    bear = ema_s in ("Bearish", "Düşüş") and rsi < 45
    if bull and pattern in bull_patterns:
        return "AL"
    if bear and pattern in bear_patterns:
        return "SAT"
    if bull or pattern in bull_patterns:
        return "İzle"
    return "Bekle"

def fetch_ticker(ticker):
    df = yf.download(ticker, period="30d", interval="1h", progress=False)
    if df.empty:
        return None
    price   = float(df["Close"].iloc[-1])
    prev    = float(df["Close"].iloc[-2])
    chg_pct = (price - prev) / prev * 100
    e20     = float(calc_ema(df["Close"], 20))
    e50     = float(calc_ema(df["Close"], 50))
    e200    = float(calc_ema(df["Close"], 120))  # Yahoo 1H limiti ~120 bar
    rsi     = float(calc_rsi(df["Close"]))
    avg_vol = float(df["Volume"].iloc[-20:].mean())
    vol_ratio = float(df["Volume"].iloc[-1]) / avg_vol if avg_vol > 0 else 1.0
    pattern = detect_pattern(df)
    ema_s   = ema_status(price, e20, e50, e200)
    sig     = signal(ema_s, rsi, pattern)
    return {
        "ticker": ticker,
        "price": round(price, 2),
        "change_pct": round(chg_pct, 2),
        "volume_ratio": round(vol_ratio, 2),
        "ema20": round(e20, 2),
        "ema50": round(e50, 2),
        "ema200": round(e200, 2),
        "ema_status": ema_s,
        "rsi": round(rsi, 1),
        "candle_pattern": pattern,
        "signal": sig,
    }

def run_update():
    results = []
    for t in TRACKER_LIST:
        data = fetch_ticker(t)
        if data:
            results.append(data)
    output = {
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "market_status": "open",
        "tickers": results
    }
    with open("tracker_output.json", "w") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"[{output['updated_at']}] {len(results)} ticker güncellendi.")

if __name__ == "__main__":
    run_update()
```

**Saatbaşı otomatik çalıştırma (cron):**
```bash
# crontab -e
15 9 * * 1-5  cd /path/to/boga && python tracker_update.py
0 10-16 * * 1-5  cd /path/to/boga && python tracker_update.py
15 16 * * 1-5  cd /path/to/boga && python tracker_update.py
```

---

## Tracker React Uygulaması — Özellik Listesi

- [x] Ticker ekleme / silme
- [x] Tip etiketi (Swing / Long / Option / CSP / CC)
- [x] 1H otomatik güncelleme (saatbaşı refresh)
- [x] EMA20 / EMA50 / EMA200 sütunları renk kodlu (↑↓)
- [x] RSI sütunu renk kodlu
- [x] Mum paterni tespiti (son kapanan 1H mum)
- [x] Sinyal sütunu (AL / İzle / Bekle / SAT)
- [x] Hover → 1H mini grafik (TradingView Widget, son 20 mum)
- [x] Manuel not alanı (her ticker için)
- [x] Sıralama: Sinyal → RSI → EMA Durum
- [x] Filtre: Tip bazlı + Sinyal bazlı
- [ ] tracker_output.json okuma (Faz 2)
- [ ] Entry / Stop / Hedef hesaplayıcı (Faz 4)
- [ ] Export: CSV veya JSON (Faz 4)

---

## Öncelik Sırası — Geliştirme Roadmap

**Faz 1 — Temel (Mevcut)**
Ticker tablosu, manuel veri girişi, EMA renk kodlama, tip etiketleri.
Yahoo Finance API ile tarayıcıdan direkt veri çekme (React artifact).

**Faz 2 — Otomasyon**
`tracker_update.py` botu saatbaşı çalışır.
`tracker_output.json` dosyasını yazar (saat + gün bazlı log).
React sayfası bu JSON'u okur, Yahoo Finance'a direkt bağımlılık kalkar.
BOGA AI (`swing115_boga.py`) ile entegrasyon — bot çıktısı tracker'a akar.

**Faz 3 — UX**
Hover grafik → TradingView Mini Chart Widget (son 20 mum, 1H, ücretsiz).
EMA çizgileri grafikte görünür.
Sinyal sütunu otomasyonu JSON bazlı kesinleşir.

**Faz 4 — Gelişmiş**
1H sinyal paneli: AL sinyali olan satıra tıklayınca genişler.
Entry / Stop / Hedef hesaplayıcı (Risk × 1.5 / × 2.5 formülü).
Tip bazlı DTE önerisi (Swing: 7–14 gün, Option: 21–45 gün vb.).
JSON log: her güncelleme tarih/saat damgasıyla saklanır, geçmiş görüntülenebilir.

---

*Son güncelleme: 25 Mayıs 2026 — BOGA AI Swing Trading System*
*Versiyon: 2.0 — 15M kaldırıldı, 2 katmanlı yapıya geçildi*
