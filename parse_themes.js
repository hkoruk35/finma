const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.py');
const outputPath = path.join(__dirname, 'frontend', 'lib', 'themeData.ts');

if (!fs.existsSync(configPath)) {
  console.error("config.py not found at " + configPath);
  process.exit(1);
}

const content = fs.readFileSync(configPath, 'utf8');
const lines = content.split('\n');

const themes = [];
let currentSector = '';
let currentSubTheme = '';
let sectorTickers = [];
let subThemeTickers = [];

// Helper to clean name
function cleanName(name) {
  return name.replace('#', '').replace('—', '-').trim();
}

for (let line of lines) {
  line = line.trim();
  
  // Detect Sector starts
  const sectorMatch = line.match(/^FIXED_TICKERS_([A-Z_]+)\s*=\s*\[/);
  if (sectorMatch) {
    // If we had a previous sector, we don't need to do anything here because we push sub-themes immediately
    const rawSector = sectorMatch[1];
    currentSector = rawSector.toLowerCase().split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    // Handle special mappings
    if (currentSector === 'Technology') currentSector = 'Technology';
    if (currentSector === 'Communication') currentSector = 'Communication Services';
    sectorTickers = [];
    currentSubTheme = '';
    subThemeTickers = [];
    continue;
  }
  
  // Detect Sector ends
  if (line === ']' && currentSector) {
    // Push the last sub-theme
    if (currentSubTheme && subThemeTickers.length > 0) {
      themes.push({
        name: currentSubTheme,
        sector: currentSector,
        tickers: [...subThemeTickers]
      });
    }
    // Also push the main Sector as a theme!
    if (sectorTickers.length > 0) {
      themes.push({
        name: currentSector,
        sector: 'Sectors',
        tickers: [...sectorTickers]
      });
    }
    currentSector = '';
    currentSubTheme = '';
    sectorTickers = [];
    subThemeTickers = [];
    continue;
  }
  
  if (!currentSector) continue;
  
  // Detect sub-theme comments
  if (line.startsWith('#')) {
    // Save previous sub-theme if exists
    if (currentSubTheme && subThemeTickers.length > 0) {
      themes.push({
        name: currentSubTheme,
        sector: currentSector,
        tickers: [...subThemeTickers]
      });
    }
    currentSubTheme = cleanName(line);
    subThemeTickers = [];
    continue;
  }
  
  // Extract tickers
  const tickerMatches = line.match(/"([A-Z\.]+)"/g);
  if (tickerMatches) {
    for (const tm of tickerMatches) {
      const ticker = tm.replace(/"/g, '');
      if (ticker) {
        sectorTickers.push(ticker);
        if (currentSubTheme) {
          subThemeTickers.push(ticker);
        }
      }
    }
  }
}

// Generate TS output
const tsContent = `export interface Theme {
  name: string;
  sector: string;
  tickers: string[];
}

export const MARKET_THEMES: Theme[] = ${JSON.stringify(themes, null, 2)};
`;

fs.writeFileSync(outputPath, tsContent, 'utf8');
console.log(`Successfully parsed ${themes.length} themes from config.py and saved to ${outputPath}`);
