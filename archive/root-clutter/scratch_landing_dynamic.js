const fs = require('fs');

let code = fs.readFileSync('frontend/components/global/GlobalLandingPage.tsx', 'utf8');

// Add the state for dynamic company
if (!code.includes('const [currentCompany, setCurrentCompany]')) {
  code = code.replace(
    'const [prices, setPrices] = useState<Record<string, PriceInfo>>({});',
    `const [prices, setPrices] = useState<Record<string, PriceInfo>>({});
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentGroup, setCurrentGroup] = useState("");`
  );
}

// Replace the synchronous GROUPS loop with a useEffect
const syncLoopRegex = /\/\/ Determine current company\/sector name based on selection[\s\S]*?break;\n    \}\n  \}/;
const replacementLoop = `// Determine current company/sector name based on selection
  useEffect(() => {
    let found = false;
    for (const g of GROUPS) {
      const item = g.items.find(i => i.ticker === selectedTicker);
      if (item) {
        setCurrentGroup(g.group);
        setCurrentCompany(item.label);
        found = true;
        break;
      }
    }
    if (!found) {
      setCurrentGroup("");
      setCurrentCompany("");
      fetch(\`/api/tickers/search?q=\${selectedTicker}\`)
        .then(r => r.json())
        .then(data => {
          if (data && data.results) {
            const match = data.results.find((d: any) => d.ticker === selectedTicker);
            if (match) {
              setCurrentCompany(match.name || "");
              setCurrentGroup(match.sector || "");
            }
          }
        }).catch(() => {});
    }
  }, [selectedTicker]);`;

if (code.match(syncLoopRegex)) {
  code = code.replace(syncLoopRegex, replacementLoop);
}

fs.writeFileSync('frontend/components/global/GlobalLandingPage.tsx', code, 'utf8');
console.log('Updated GlobalLandingPage with dynamic company names');
