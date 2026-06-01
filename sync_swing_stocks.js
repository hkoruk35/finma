#!/usr/bin/env node

/**
 * Swing Stock Universe Daily Sync
 * Checks swing_performance.json for new tickers and updates MARKET_THEMES
 */

const fs = require('fs');
const path = require('path');

const themeDataPath = path.join(__dirname, './frontend/lib/themeData.ts');
const swingPerfPath = path.join(__dirname, './frontend/public/swing_performance.json');

async function syncSwingStocks() {
  try {
    // Read current swing performance data
    if (!fs.existsSync(swingPerfPath)) {
      console.log('❌ swing_performance.json not found');
      return { updated: false, message: 'swing_performance.json not found' };
    }

    const perfData = JSON.parse(fs.readFileSync(swingPerfPath, 'utf8'));
    
    // Extract tickers from performance data
    const swingTickers = new Set();
    if (perfData.history) {
      perfData.history.forEach(item => {
        if (item.ticker) swingTickers.add(item.ticker);
      });
    }

    // Read current themeData
    const themeContent = fs.readFileSync(themeDataPath, 'utf8');
    
    // Extract current Swing Performance Universe tickers
    const swingUniverseMatch = themeContent.match(/"Swing Performance Universe"[\s\S]*?"tickers":\s*\[([\s\S]*?)\]/);
    const currentTickers = new Set();
    
    if (swingUniverseMatch) {
      const tickerMatches = swingUniverseMatch[1].match(/"[A-Z]{1,5}"/g);
      if (tickerMatches) {
        tickerMatches.forEach(t => currentTickers.add(t.replace(/"/g, '')));
      }
    }

    // Find new tickers
    const newTickers = Array.from(swingTickers).filter(t => !currentTickers.has(t));
    
    if (newTickers.length === 0) {
      console.log('✓ No new tickers found. Universe is current.');
      console.log(`  Total tickers in universe: ${currentTickers.size}`);
      console.log(`  Latest swing_performance.json has: ${swingTickers.size} tickers`);
      return { 
        updated: false, 
        message: 'No new tickers',
        currentCount: currentTickers.size,
        perfCount: swingTickers.size
      };
    }

    // Update themeData with new tickers
    console.log(`\n✓ Found ${newTickers.length} new tickers!`);
    console.log('  New tickers:', newTickers.slice(0, 10).join(', ') + (newTickers.length > 10 ? `... and ${newTickers.length - 10} more` : ''));

    // Merge and sort all tickers
    const allTickersSet = new Set([...currentTickers, ...newTickers]);
    const sortedTickers = Array.from(allTickersSet).sort();

    // Generate new theme object
    const tickersList = sortedTickers.map(t => `      "${t}"`).join(',\n');
    
    // Find and replace the Swing Performance Universe theme
    const newThemeStr = `{
    "name": "Swing Performance Universe",
    "sector": "Market Universe",
    "tickers": [
${tickersList}
    ]
  }`;

    // Replace the old theme with the new one
    const updatedContent = themeContent.replace(
      /"Swing Performance Universe"[\s\S]*?\},\n  {/,
      newThemeStr + ',\n  {'
    );

    if (updatedContent === themeContent) {
      // If replacement didn't work as expected, try alternative method
      console.log('⚠ Standard replacement failed, trying alternative method...');
      
      // Find the theme and replace it more carefully
      const themeStart = updatedContent.indexOf('"Swing Performance Universe"');
      if (themeStart === -1) {
        console.log('❌ Could not find Swing Performance Universe theme');
        return { updated: false, message: 'Theme not found' };
      }

      // Find the closing bracket of this theme
      let bracketCount = 0;
      let foundStart = false;
      let themeEnd = -1;
      
      for (let i = themeStart; i < updatedContent.length; i++) {
        if (updatedContent[i] === '{') {
          bracketCount++;
          foundStart = true;
        } else if (updatedContent[i] === '}' && foundStart) {
          bracketCount--;
          if (bracketCount === 0) {
            themeEnd = i + 1;
            break;
          }
        }
      }

      if (themeEnd === -1) {
        console.log('❌ Could not find theme boundaries');
        return { updated: false, message: 'Theme boundaries not found' };
      }

      // Extract text before and after the theme
      const beforeTheme = updatedContent.substring(0, themeStart - 4); // -4 to remove "  {\n"
      const afterTheme = updatedContent.substring(themeEnd);

      const finalContent = beforeTheme + '  ' + newThemeStr + '\n' + afterTheme;
      
      // Write back
      fs.writeFileSync(themeDataPath, finalContent);
      
      console.log(`\n✓ Updated Swing Performance Universe with ${sortedTickers.length} tickers`);
      return {
        updated: true,
        newTickersCount: newTickers.length,
        totalCount: sortedTickers.length,
        newTickers: newTickers
      };
    } else {
      // Write back the updated content
      fs.writeFileSync(themeDataPath, updatedContent);
      
      console.log(`\n✓ Updated Swing Performance Universe with ${sortedTickers.length} tickers`);
      return {
        updated: true,
        newTickersCount: newTickers.length,
        totalCount: sortedTickers.length,
        newTickers: newTickers
      };
    }

  } catch (error) {
    console.error('❌ Error during sync:', error.message);
    return { updated: false, error: error.message };
  }
}

// Run sync
syncSwingStocks().then(result => {
  if (result.updated) {
    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${result.newTickersCount} new tickers`);
    console.log(`   Total: ${result.totalCount} tickers in universe`);
    console.log(`\n✅ Swing stock universe is now current!`);
    process.exit(0);
  } else {
    console.log(`\nℹ️ Status: ${result.message}`);
    process.exit(0);
  }
});
