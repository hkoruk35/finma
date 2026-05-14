
const path = require('path');
const fs = require('fs');

function listOptionsDates() {
  const base = path.resolve(__dirname, 'frontend', 'public', 'data');
  try {
    if (!fs.existsSync(base)) return [];
    const dirs = fs.readdirSync(base).filter((d) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
      return fs.existsSync(path.join(base, d, "options_picks.json"));
    });
    if (dirs.length > 0) return dirs.sort().reverse();
  } catch (e) {
      console.error(e);
  }
  return [];
}

console.log("Found dates:", listOptionsDates());
