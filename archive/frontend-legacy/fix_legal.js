const fs = require('fs');
const path = require('path');

const locales = ['en', 'es', 'fr', 'pt', 'tr'];
const pages = ['disclaimer', 'privacy', 'terms'];
const basePath = path.join(__dirname, 'app', 'global');

let modifiedCount = 0;

locales.forEach(locale => {
  pages.forEach(page => {
    const filePath = path.join(basePath, locale, page, 'page.tsx');
    if (!fs.existsSync(filePath)) {
      console.log(`File not found: ${filePath}`);
      return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    // 1. Replace Header import
    content = content.replace(/import Header from ".*?";/, 'import MemberHeader from "@/components/public/MemberHeader";');

    // 2. Replace <Header ... /> with <MemberHeader locale="locale" />
    content = content.replace(/<Header[^>]*\/>/, `<MemberHeader locale="${locale}" />`);

    // 3. Remove the broken language link section
    // It usually looks like:
    // <div className="flex justify-end mb-4">
    //   <Link href="/global/en/disclaimer/tr" ...>Türkçe →</Link>
    // </div>
    // We can use a regex to match this block.
    content = content.replace(/<div className="flex justify-end mb-4">[\s\S]*?<\/div>/, '');

    // 4. Fix fonts to be more readable (not kaba/thick)
    content = content.replace(/className="text-4xl font-black/g, 'className="text-3xl font-semibold');
    content = content.replace(/className="text-xl font-bold/g, 'className="text-lg font-medium');
    content = content.replace(/className="text-2xl font-bold/g, 'className="text-xl font-semibold');

    // 5. Fix Footer to include locale
    content = content.replace(/<Footer hidePlatform={true}(?: locale="[^"]*")? \/>/, `<Footer hidePlatform={true} locale="${locale}" />`);

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Modified: ${filePath}`);
      modifiedCount++;
    }
  });
});

console.log(`Finished processing. Modified ${modifiedCount} files.`);
