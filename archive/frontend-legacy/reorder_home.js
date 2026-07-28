const fs = require('fs');
const glob = require('glob');

const files = glob.sync('C:/Users/afksm/finma/frontend/app/global/*/home/page.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');

  // We are looking for the grid div which contains 3 children:
  // <HomeSimpleCard ... />
  // <HomeWatchlistSlot ... />
  // <HomeSimpleCard ... />
  
  // A regex to capture the three components
  const regex = /(<div className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide md:grid md:grid-cols-3 gap-4 md:gap-6 pb-6 md:pb-0">\s*)(<HomeSimpleCard[\s\S]*?\/>\s*)(<HomeWatchlistSlot[\s\S]*?\/>\s*)(<HomeSimpleCard[\s\S]*?\/>\s*<\/div>)/;
  
  const match = content.match(regex);
  if (match) {
    const newContent = content.replace(regex, `$1$3$2$4`);
    fs.writeFileSync(file, newContent, 'utf8');
    console.log(`Updated ${file}`);
  } else {
    console.log(`Could not match pattern in ${file}`);
  }
}
