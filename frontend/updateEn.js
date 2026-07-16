const fs = require('fs');
const path = './landing-config.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data.en.screenshots = [
  {
    "src": "/screenshots/weng1.png",
    "label": "Home — Live Summary",
    "desc": "Swing and Trend hourly summary with performance banner"
  },
  {
    "src": "/screenshots/weng2.png",
    "label": "Deep Stock Analysis",
    "desc": "Technical indicators, entry/stop/target prices, BOGA Score and live chart"
  },
  {
    "src": "/screenshots/weng3.png",
    "label": "Daily Swing Candidates",
    "desc": "14 candidates, EMA/RSI signals, pattern detection and real-time price tracking"
  },
  {
    "src": "/screenshots/weng4.png",
    "label": "System Performance",
    "desc": "Sector profitability heat map and historical trade records"
  }
];

for (let i = 0; i < data.en.features.length; i++) {
  if (data.en.features[i].title === "Top 100 Weekly Tracker") {
    data.en.features[i].title = "Clearer Decisions";
    data.en.features[i].desc = "You will make decisions more easily with fewer stocks, focusing only on the best opportunities picked by BOGASTOCK.";
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
console.log("Updated English config");
