const fs = require("fs");
const path = require("path");

const files = [
  path.join(__dirname, "../lib/copilot/visitorDemo.ts"),
  path.join(__dirname, "../lib/copilot/faqData.ts"),
  path.join(__dirname, "../lib/i18n/copy.ts")
];

const replacements = [
  // Specific suffixes first
  { search: /BOGA AI'nin/g, replace: "BogaSmart'ın" },
  { search: /BOGA AI'nin/g, replace: "BogaSmart'ın" },
  { search: /BOGA AI'ın/g, replace: "BogaSmart'ın" },
  { search: /BOGA AI'a/g, replace: "BogaSmart'a" },
  { search: /da BOGA AI/g, replace: "da BogaSmart" },
  { search: /da BOGA AI/g, replace: "da BogaSmart" },
  { search: /da BOGA AI/g, replace: "da BogaSmart" },
  { search: /da BOGA AI/g, replace: "da BogaSmart" },

  // General terms
  { search: /BOGA Copilot/g, replace: "BogaSmart Copilot" },
  { search: /Boga Copilot/g, replace: "BogaSmart Copilot" },
  { search: /BOGA COPILOT/g, replace: "BogaSmart Copilot" },
  { search: /BOGA Pro/g, replace: "BogaSmart Pro" },
  { search: /Boga Pro/g, replace: "BogaSmart Pro" },
  { search: /BOGA AI/g, replace: "BogaSmart" },
  { search: /Boga AI/g, replace: "BogaSmart" },
  { search: /Boga/g, replace: "BogaSmart" } // Catch remaining alone "Boga" references if they exist
];

files.forEach((filePath) => {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }
  let content = fs.readFileSync(filePath, "utf8");
  replacements.forEach((rep) => {
    content = content.replace(rep.search, rep.replace);
  });
  // Avoid duplicating Smart in BogaSmart
  content = content.replace(/BogaSmartSmart/g, "BogaSmart");
  content = content.replace(/BogaSmartsmart/g, "BogaSmart");
  content = content.replace(/BogaSmartStock/g, "BogaStock"); // Revert any BogaStock -> BogaSmartStock mistakes
  content = content.replace(/BogaSmartSTOCK/g, "BogaStock");
  content = content.replace(/BogaSmartstock/g, "BogaStock");
  
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`Branding updated successfully in: ${path.basename(filePath)}`);
});
