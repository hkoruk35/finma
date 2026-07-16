const fs = require('fs');

const path = 'C:/Users/afksm/finma/frontend/components/public/RegisterForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// Add states for region and selectedLanguage
content = content.replace(
  '  const [password, setPassword] = useState("");',
  `  const [password, setPassword] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(locale.toUpperCase());
  const [region, setRegion] = useState("");`
);

// Update API payload
content = content.replace(
  '          consentAccepted: consentChecked,',
  '          consentAccepted: consentChecked,\n          selectedLanguage: selectedLanguage.toLowerCase(),\n          region,'
);

// Add the new form fields
const newFields = `
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
                  {locale === "tr" ? "DİL SEÇİMİ" : locale === "es" ? "IDIOMA" : locale === "fr" ? "LANGUE" : locale === "pt" ? "IDIOMA" : "LANGUAGE"}
                </label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all appearance-none"
                  required
                  disabled={loading}
                >
                  <option value="EN">English</option>
                  <option value="TR">Türkçe</option>
                  <option value="ES">Español</option>
                  <option value="FR">Français</option>
                  <option value="PT">Português</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-black uppercase tracking-widest text-white/40 mb-2 ml-1">
                  {locale === "tr" ? "ÜLKE" : locale === "es" ? "PAÍS" : locale === "fr" ? "PAYS" : locale === "pt" ? "PAÍS" : "COUNTRY"}
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-[#161b22] border border-white/10 rounded-2xl px-4 py-4 text-white focus:outline-none focus:border-[#3b82f6] transition-all appearance-none"
                  required
                  disabled={loading}
                >
                  <option value="" disabled>{locale === "tr" ? "Seçiniz" : "Select"}</option>
                  <option value="US">United States</option>
                  <option value="TR">Türkiye</option>
                  <option value="UK">United Kingdom</option>
                  <option value="DE">Germany</option>
                  <option value="FR">France</option>
                  <option value="ES">Spain</option>
                  <option value="BR">Brazil</option>
                  <option value="PT">Portugal</option>
                  <option value="CA">Canada</option>
                  <option value="AU">Australia</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
`;

content = content.replace(
  '          <form onSubmit={handleSubmit} className="space-y-6">',
  '          <form onSubmit={handleSubmit} className="space-y-6">\n' + newFields
);

fs.writeFileSync(path, content, 'utf8');
console.log("Updated RegisterForm");
