const fs = require('fs');
const langs = ['en', 'tr', 'es', 'fr', 'pt'];

langs.forEach(lang => {
  const path = `C:/Users/afksm/finma/frontend/app/global/${lang}/page.tsx`;
  if (fs.existsSync(path)) {
    let content = fs.readFileSync(path, 'utf8');
    
    // Replace import
    content = content.replace('import Header from "@/components/Header";', 'import MemberHeader from "@/components/public/MemberHeader";');
    
    // Replace usage
    content = content.replace(`<Header hideMenus={true} globalLocale="${lang}" />`, `<MemberHeader locale="${lang}" />`);
    
    fs.writeFileSync(path, content, 'utf8');
    console.log(`Updated ${lang}`);
  } else {
    console.log(`Not found ${lang}`);
  }
});
