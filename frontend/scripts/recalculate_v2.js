const fs = require('fs');
const path = require('path');

const PERFORMANCE_FILE = path.join(__dirname, '../public/swing_performance.json');

// Fetch daily chart from Yahoo Finance
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

// Calculate ATR(14)
function calculateATR(candles, idx, period = 14) {
  if (idx < period) return null;
  let trSum = 0;
  for (let i = idx - period + 1; i <= idx; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trSum += tr;
  }
  return trSum / period;
}

async function run() {
  console.log("Loading swing_performance.json...");
  const rawData = fs.readFileSync(PERFORMANCE_FILE, 'utf8');
  const perfJson = JSON.parse(rawData);
  const history = perfJson.history || [];

  console.log(`Processing ${history.length} total signals...`);

  // Group items by ticker to minimize network requests
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
    console.log(`Fetched chart data for ${fetchedCount}/${tickers.length} tickers...`);
  }

  const updatedHistory = [];
  let expiredGapCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let totalRealizedReturn = 0;
  let totalMfe = 0;
  let totalMae = 0;
  let totalHoldingDays = 0;

  const targetHits = { 3: 0, 5: 0, 7: 0, 10: 0, 15: 0, 20: 0 };
  const targetDays = { 3: 0, 5: 0, 7: 0, 10: 0, 15: 0, 20: 0 };

  for (const trade of history) {
    const candles = candleCache.get(trade.ticker);
    if (!candles) {
      // Keep existing trade if no chart data available
      updatedHistory.push(trade);
      continue;
    }

    // Find T0 index
    const t0Idx = candles.findIndex(c => c.date >= trade.date);
    if (t0Idx === -1 || t0Idx + 1 >= candles.length) {
      updatedHistory.push(trade);
      continue;
    }

    const t0Candle = candles[t0Idx];
    const t1Candle = candles[t0Idx + 1]; // Entry day

    // Calculate ATR(14) at T0
    const atr14 = calculateATR(candles, t0Idx, 14) || (t0Candle.close * 0.02);
    const atrPct = (atr14 / t0Candle.close) * 100;
    
    // Stop loss: 1.8 * ATR, min 4%, max 10%
    const rawStopPct = 1.8 * atrPct;
    const stopPct = Math.max(4.0, Math.min(10.0, rawStopPct));
    
    const entryPrice = t1Candle.open;
    const gapPct = ((entryPrice - t0Candle.close) / t0Candle.close) * 100;

    // Check GAP Filter: > +3.0% gap up
    if (gapPct > 3.0) {
      expiredGapCount++;
      updatedHistory.push({
        ...trade,
        entry_date: t1Candle.date,
        entry_price: parseFloat(entryPrice.toFixed(2)),
        atr_14: parseFloat(atr14.toFixed(2)),
        stop_price: parseFloat((entryPrice * (1 - stopPct / 100)).toFixed(2)),
        stop_pct: parseFloat(stopPct.toFixed(2)),
        exit_date: t1Candle.date,
        exit_price: parseFloat(entryPrice.toFixed(2)),
        exit_reason: "EXPIRED_GAP",
        realized_return_pct: 0,
        result: "EXPIRED_GAP",
        performance_version: "v2_atr_20d"
      });
      continue;
    }

    const stopPrice = entryPrice * (1 - stopPct / 100);

    // Track targets
    const targets = [3, 5, 7, 10, 15, 20];
    const hits = { 3: false, 5: false, 7: false, 10: false, 15: false, 20: false };
    const daysToHit = { 3: null, 5: null, 7: null, 10: null, 15: null, 20: null };

    let exitDate = t1Candle.date;
    let exitPrice = entryPrice;
    let exitReason = "TIMEOUT";
    let holdingDays = 0;
    let maxHigh = t1Candle.high;
    let minLow = t1Candle.low;

    // Hold up to 20 trading days starting at T1 (index t0Idx + 1)
    const maxIndex = Math.min(candles.length - 1, t0Idx + 20);
    let isStopped = false;

    for (let k = t0Idx + 1; k <= maxIndex; k++) {
      const c = candles[k];
      const dayNum = k - t0Idx;
      holdingDays = dayNum;

      if (c.high > maxHigh) maxHigh = c.high;
      if (c.low < minLow) minLow = c.low;

      // Check Stop Loss
      if (c.low <= stopPrice) {
        isStopped = true;
        exitDate = c.date;
        exitReason = "STOP";
        exitPrice = c.open <= stopPrice ? c.open : stopPrice;

        // If stop occurs on same day as target, stop takes precedence
        // Check targets hit BEFORE stop day
        for (const targetPct of targets) {
          const targetPrice = entryPrice * (1 + targetPct / 100);
          if (c.high >= targetPrice && !hits[targetPct]) {
            // Conservative: same-day stop prevents target hit
          }
        }
        break;
      }

      // Check Targets hit on this day
      for (const targetPct of targets) {
        const targetPrice = entryPrice * (1 + targetPct / 100);
        if (c.high >= targetPrice && !hits[targetPct]) {
          hits[targetPct] = true;
          daysToHit[targetPct] = dayNum;
        }
      }

      exitDate = c.date;
      exitPrice = c.close;
    }

    if (!isStopped && holdingDays === 20) {
      exitReason = "TIMEOUT";
    } else if (!isStopped && maxIndex < t0Idx + 20) {
      exitReason = "ACTIVE";
    }

    // Returns & Costs
    const rawReturnPct = ((exitPrice - entryPrice) / entryPrice) * 100;
    const realizedReturnPct = parseFloat((rawReturnPct - 0.1).toFixed(2)); // 0.1% cost
    const resultStatus = realizedReturnPct > 0 ? "WIN" : "LOSS";

    const mfePct = parseFloat((((maxHigh - entryPrice) / entryPrice) * 100).toFixed(2));
    const maePct = parseFloat((((minLow - entryPrice) / entryPrice) * 100).toFixed(2));

    if (resultStatus === "WIN") winCount++;
    else lossCount++;

    totalRealizedReturn += realizedReturnPct;
    totalMfe += mfePct;
    totalMae += maePct;
    totalHoldingDays += holdingDays;

    for (const targetPct of targets) {
      if (hits[targetPct]) {
        targetHits[targetPct]++;
        targetDays[targetPct] += daysToHit[targetPct];
      }
    }

    updatedHistory.push({
      ...trade,
      entry_date: t1Candle.date,
      entry_price: parseFloat(entryPrice.toFixed(2)),
      atr_14: parseFloat(atr14.toFixed(2)),
      stop_price: parseFloat(stopPrice.toFixed(2)),
      stop_pct: parseFloat(stopPct.toFixed(2)),
      exit_date: exitDate,
      exit_price: parseFloat(exitPrice.toFixed(2)),
      exit_reason: exitReason,
      realized_return_pct: realizedReturnPct,
      return_pct: realizedReturnPct,
      mfe_pct: mfePct,
      mae_pct: maePct,
      holding_days: holdingDays,
      days: holdingDays,
      result: resultStatus,
      hit_3: hits[3],
      hit_5: hits[5],
      hit_7: hits[7],
      hit_10: hits[10],
      hit_15: hits[15],
      hit_20: hits[20],
      days_to_3: daysToHit[3],
      days_to_5: daysToHit[5],
      days_to_7: daysToHit[7],
      days_to_10: daysToHit[10],
      days_to_15: daysToHit[15],
      days_to_20: daysToHit[20],
      performance_version: "v2_atr_20d"
    });
  }

  const activeCount = winCount + lossCount;
  const winRate = activeCount > 0 ? parseFloat(((winCount / activeCount) * 100).toFixed(1)) : 0;
  const avgReturnPct = activeCount > 0 ? parseFloat((totalRealizedReturn / activeCount).toFixed(1)) : 0;
  const avgMfePct = activeCount > 0 ? parseFloat((totalMfe / activeCount).toFixed(1)) : 0;
  const avgMaePct = activeCount > 0 ? parseFloat((totalMae / activeCount).toFixed(1)) : 0;
  const avgHoldingDays = activeCount > 0 ? parseFloat((totalHoldingDays / activeCount).toFixed(1)) : 0;

  const targetStats = {};
  for (const t of [3, 5, 7, 10, 15, 20]) {
    const count = targetHits[t];
    targetStats[t] = {
      rate: activeCount > 0 ? parseFloat(((count / activeCount) * 100).toFixed(1)) : 0,
      avg_days: count > 0 ? parseFloat((targetDays[t] / count).toFixed(1)) : null,
      count
    };
  }

  const newStats = {
    total_picks: history.length,
    active_count: activeCount,
    expired_gap_count: expiredGapCount,
    win_rate: winRate,
    avg_return_pct: avgReturnPct,
    avg_mfe_pct: avgMfePct,
    avg_mae_pct: avgMaePct,
    avg_holding_days: avgHoldingDays,
    target_stats: targetStats,
    last_updated: new Date().toISOString(),
    stop_loss_pct: "1.8x ATR (4-10%)",
    performance_version: "v2_atr_20d"
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
