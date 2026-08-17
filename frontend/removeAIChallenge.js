const fs = require('fs');
let data = fs.readFileSync('lib/futureContent.ts', 'utf8');
const originalLength = data.length;

const regex = /\s*\{\s*title:\s*"AI Challenge",\s*text:\s*"[^"]*",\s*\},/g;
data = data.replace(regex, '');

console.log('Replaced ' + (originalLength - data.length) + ' characters');
fs.writeFileSync('lib/futureContent.ts', data);
