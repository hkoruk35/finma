const fs = require('fs');
const path = 'C:/Users/afksm/finma/frontend/components/public/MemberHeader.tsx';
let content = fs.readFileSync(path, 'utf8');

// Fix 1: getLangHref logic
const oldGetLangHref = `  const getLangHref = (targetLang: string) => {
    if (!pathname) return \`/global/\${targetLang.toLowerCase()}/home\`;
    const targetLoc = targetLang.toLowerCase();
    
    const isFaqPage = pathname.endsWith('/Perguntas_Frequentes') || pathname.endsWith('/sss') || pathname.endsWith('/faq');
    if (isFaqPage) {
      const faqSuffix = targetLoc === 'pt' ? '/Perguntas_Frequentes' : targetLoc === 'tr' ? '/sss' : '/faq';
      return \`/global/\${targetLoc}\${faqSuffix}\`;
    }
    
    return pathname.replace(new RegExp(\`^/global/\${locale}\`), \`/global/\${targetLoc}\`);
  };`;

const newGetLangHref = `  const getLangHref = (targetLang: string) => {
    if (!pathname) return \`/global/\${targetLang.toLowerCase()}/home\`;
    const targetLoc = targetLang.toLowerCase();
    
    let pathSuffix = pathname.replace(new RegExp(\`^/global/\${locale}\`), '');
    
    // Check specific paths
    if (pathSuffix === '/giris' || pathSuffix === '/login') {
      return \`/global/\${targetLoc}\${targetLoc === 'tr' ? '/giris' : '/login'}\`;
    }
    if (pathSuffix === '/kayit' || pathSuffix === '/register') {
      return \`/global/\${targetLoc}\${targetLoc === 'tr' ? '/kayit' : '/register'}\`;
    }
    if (pathSuffix === '/hesabim' || pathSuffix === '/account' || pathSuffix === '/cuenta' || pathSuffix === '/compte' || pathSuffix === '/conta') {
      return \`/global/\${targetLoc}\${targetLoc === 'tr' ? '/hesabim' : '/account'}\`;
    }
    if (pathSuffix.toLowerCase() === '/sss' || pathSuffix.toLowerCase() === '/faq' || pathSuffix.toLowerCase() === '/perguntas_frequentes') {
      return \`/global/\${targetLoc}\${targetLoc === 'pt' ? '/Perguntas_Frequentes' : targetLoc === 'tr' ? '/sss' : '/faq'}\`;
    }
    
    return \`/global/\${targetLoc}\${pathSuffix}\`;
  };`;

content = content.replace(oldGetLangHref, newGetLangHref);

// Fix 2: Logo link destination
content = content.replace(
  '<Link href={homeHref} className="flex items-center gap-2 group flex-shrink-0">',
  '<Link href={isLoggedIn ? homeHref : `/global/${locale}`} className="flex items-center gap-2 group flex-shrink-0">'
);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated MemberHeader logic");
