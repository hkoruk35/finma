const fs = require('fs');
const path = require('path');
const locales = ['en', 'es', 'fr', 'pt', 'tr'];

const sortLabels = {
  en: 'Sorted by volume',
  es: 'Ordenado por volumen',
  fr: 'Trié par volume',
  pt: 'Classificado por volume',
  tr: 'Hacim sırasına göre'
};

locales.forEach(loc => {
  const file = path.join('app', 'global', loc, 'home', 'page.tsx');
  if (!fs.existsSync(file)) return;
  
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace the remaining 'performanceEntries' inside the HomeSimpleCard block
  // Wait, let's just find the HomeSimpleCard with 'viewAllHref="/global/[loc]/performance"'
  const cardRegex = new RegExp(`<HomeSimpleCard\\s+title=\"[^\"]+\"\\s+accent=\"#10b981\"\\s+stocks=\\{[^}]+\\}\\s+viewAllHref=\"/global/${loc}/performance\"[^>]+/>`, 's');
  
  const newCard = `<HomeSimpleCard
            title="Top 100"
            accent="#10b981"
            stocks={top100ByVolume}
            viewAllHref="/global/${loc}/top100"
            locale="${loc}"
            sortLabel="${sortLabels[loc]}"
            requirePremium
          />`;
          
  content = content.replace(cardRegex, newCard);
  
  fs.writeFileSync(file, content);
  console.log('Updated ' + loc);
});
