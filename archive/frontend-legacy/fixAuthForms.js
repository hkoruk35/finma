const fs = require('fs');

// 1. Update LoginForm.tsx
const loginPath = 'C:/Users/afksm/finma/frontend/components/public/LoginForm.tsx';
let loginContent = fs.readFileSync(loginPath, 'utf8');
loginContent = loginContent.replace(
  'BOGA <span className="text-[#3b82f6]">AI</span>',
  'BOGA<span className="text-[#3b82f6]">STOCK</span>'
);
fs.writeFileSync(loginPath, loginContent, 'utf8');

// 2. Update RegisterForm.tsx
const regPath = 'C:/Users/afksm/finma/frontend/components/public/RegisterForm.tsx';
let regContent = fs.readFileSync(regPath, 'utf8');
regContent = regContent.replace(
  'BOGA <span className="text-[#3b82f6]">AI</span>',
  'BOGA<span className="text-[#3b82f6]">STOCK</span>'
);
regContent = regContent.replace(
  '<p className="text-white/50 text-sm font-medium">{t.title}</p>\n          <p className="text-white/30 text-xs mt-1">{t.subtitle}</p>',
  '<p className="text-white/50 text-lg font-bold">{t.title}</p>\n          {t.subtitle && <p className="text-white/30 text-xs mt-1">{t.subtitle}</p>}'
);
const regTarget = `              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
                placeholder={t.usernamePlaceholder}
                required
                disabled={loading}
              />
            </div>`;
const regReplacement = `              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all"
                placeholder={t.usernamePlaceholder}
                required
                disabled={loading}
              />
              <p className="text-[10px] text-white/30 ml-1 mt-2">
                {locale === "tr" ? "Sadece harf ve rakam. Boşluk veya @, !, ? gibi özel karakterler kullanılamaz." 
                 : locale === "es" ? "Solo letras y números. Sin espacios ni caracteres especiales como @, !, ?."
                 : locale === "fr" ? "Lettres et chiffres uniquement. Pas d'espaces ni de caractères spéciaux comme @, !, ?."
                 : locale === "pt" ? "Apenas letras e números. Sem espaços ou caracteres especiais como @, !, ?."
                 : "Only letters and numbers. No spaces or special characters like @, !, ?."}
              </p>
            </div>`;
regContent = regContent.replace(regTarget, regReplacement);
fs.writeFileSync(regPath, regContent, 'utf8');

// 3. Update copy.ts
const copyPath = 'C:/Users/afksm/finma/frontend/lib/i18n/copy.ts';
let copyContent = fs.readFileSync(copyPath, 'utf8');

// Replace register subtitles to empty string
copyContent = copyContent.replace(/subtitle: "Free access to the BOGA AI Top 100 Tracker",/g, 'subtitle: "",');
copyContent = copyContent.replace(/subtitle: "BOGA AI Top 100 Tracker'a ücretsiz erişim",/g, 'subtitle: "",');
copyContent = copyContent.replace(/subtitle: "Acceso gratuito al Rastreador Top 100 de BOGA AI",/g, 'subtitle: "",');
copyContent = copyContent.replace(/subtitle: "Accès gratuit au Suivi Top 100 BOGA AI",/g, 'subtitle: "",');
copyContent = copyContent.replace(/subtitle: "Acesso gratuito ao Rastreador Top 100 BOGA AI",/g, 'subtitle: "",'); // Guessing PT translation

// Make TR register title "Hesap Oluştur"
copyContent = copyContent.replace(/title: "Hesap oluştur",/g, 'title: "Hesap Oluştur",');

fs.writeFileSync(copyPath, copyContent, 'utf8');

console.log("Updated components and copy.ts");
