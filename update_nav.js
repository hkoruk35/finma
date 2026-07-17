const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'fr', 'pt', 'tr'];
const pages = ['swing/page.tsx', 'watchlist/page.tsx', 'top100/page.tsx'];
const baseDir = path.join(__dirname, 'frontend/app/global');

for (const loc of locales) {
  for (const page of pages) {
    const filePath = path.join(baseDir, loc, page);
    if (fs.existsSync(filePath)) {
      let content = fs.readFileSync(filePath, 'utf-8');
      
      // Look for the TOP 100 link
      const regex = new RegExp(`(<Link href="/global/${loc}/top100" className="[^"]+">TOP 100</Link>)`);
      
      if (regex.test(content) && !content.includes(`my-watchlist`)) {
        // Create the new link string
        const newLink = `\n          <Link href="/global/${loc}/my-watchlist" className="text-[10px] font-bold px-3 py-1.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#3b82f6] hover:text-[#3b82f6] transition-colors">MY WATCHLIST</Link>`;
        
        content = content.replace(regex, `$1${newLink}`);
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
      }
    }
  }
}
console.log('Done');
