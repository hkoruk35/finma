const fs = require('fs');
const path = require('path');

const PERFORMANCE_FILE = path.join(__dirname, '../public/swing_performance.json');

async function fetchChartData(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1y`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || !result.timestamp) return null;

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];
    if (!quotes) return null;

    const candles = [];
    for (let i = 0; i < timestamps.length; i++) {
      if (quotes.open[i] != null && quotes.high[i] != null && quotes.low[i] != null && quotes.close[i] != null) {
        const dateStr = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        candles.push({
          date: dateStr,
          open: quotes.open[i],
          high: quotes.high[i],
          low: quotes.low[i],
          close: quotes.close[i],
        });
      }
    }
    return candles;
  } catch (err) {
    return null;
  }
}

async function run() {
  console.log("Loading swing_performance.json...");
  const rawData = fs.readFileSync(PERFORMANCE_FILE, 'utf8');
  const perfJson = JSON.parse(rawData);
  const history = perfJson.history || [];

  console.log(`Processing ${history.length} total signals...`);
  const tickers = Array.from(new Set(history.map(h => h.ticker)));
  console.log(`Unique tickers: ${tickers.length}`);

  const candleCache = new Map();
  let fetchedCount = 0;
  const BATCH_SIZE = 15;

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async t => {
        const candles = await fetchChartData(t);
        return { ticker: t, candles };
      })
    );

    for (const { ticker, candles } of results) {
      if (candles && candles.length > 0) {
        candleCache.set(ticker, candles);
      }
    }
    fetchedCount += batch.length;
  }

  const updatedHistory = [];
  let winCount = 0;
  let lossCount = 0;
  let totalReturn = 0;

  for (const trade of history) {
    const candles = candleCache.get(trade.ticker);
    if (!candles) {
      updatedHistory.push(trade);
      continue;
    }

    const t0Idx = candles.findIndex(c => c.date >= trade.date);
    if (t0Idx === -1) {
      updatedHistory.push(trade);
      continue;
    }

    // Entry price
    const entryPrice = trade.entry || candles[t0Idx].open;
    
    // Stop Loss pct: min 7.0% (clamped if less than 7%)
    let stopPct = Math.max(7.0, trade.sl_pct || 7.0);
    const stopPrice = entryPrice * (1 - stopPct / 100);

    // Track holding window (up to 30 days)
    const maxIndex = Math.min(candles.length - 1, t0Idx + 30);
    let hitStop = false;
    let stopDate = null;
    let peakPrice = entryPrice;
    let peakDate = trade.date;
    let daysHeld = 0;

    for (let k = t0Idx; k <= maxIndex; k++) {
      const c = candles[k];
      daysHeld = k - t0Idx;

      if (c.high > peakPrice) {
        peakPrice = c.high;
        peakDate = c.date;
      }

      if (c.low <= stopPrice) {
        hitStop = true;
        stopDate = c.date;
        break;
      }
    }

    const peakGainPct = parseFloat((((peakPrice - entryPrice) / entryPrice) * 100).toFixed(2));

    let result = "WIN";
    let returnPct = 0;

    if (hitStop) {
      result = "LOSS";
      returnPct = -stopPct;
      lossCount++;
    } else {
      // SL görmeyen hiçbir işlem zarar olarak kabul edilmez. Kara geçtiğinde tepe noktası kâr kabul edilir.
      result = "WIN";
      returnPct = peakGainPct > 0 ? peakGainPct : 0.0;
      winCount++;
    }

    totalReturn += returnPct;

    updatedHistory.push({
      ...trade,
      entry: parseFloat(entryPrice.toFixed(2)),
      stop_loss: parseFloat(stopPrice.toFixed(2)),
      sl_pct: parseFloat(stopPct.toFixed(2)),
      max_price: parseFloat(peakPrice.toFixed(2)),
      peak_date: peakDate,
      peak_gain_pct: peakGainPct,
      return_pct: parseFloat(returnPct.toFixed(2)),
      days: daysHeld,
      result: result,
      exit_date: hitStop ? stopDate : peakDate
    });
  }

  const completed = winCount + lossCount;
  const winRate = completed > 0 ? parseFloat(((winCount / completed) * 100).toFixed(1)) : 0;
  const avgReturn = completed > 0 ? parseFloat((totalReturn / completed).toFixed(1)) : 0;

  const newStats = {
    total_picks: history.length,
    completed_count: completed,
    win_rate: winRate,
    avg_return_pct: avgReturn,
    stop_loss_pct: "Min 7%",
    last_updated: new Date().toISOString()
  };

  const outputJson = {
    stats: newStats,
    history: updatedHistory
  };

  fs.writeFileSync(PERFORMANCE_FILE, JSON.stringify(outputJson, null, 2), 'utf8');
  console.log("\n=== RECALCULATION COMPLETE ===");
  console.log(JSON.stringify(newStats, null, 2));
}

run().catch(console.error);
